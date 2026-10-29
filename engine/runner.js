/**
 * 技能执行器：带工具的 agent 循环 + 长文分段续写。
 *
 * 分两阶段：
 *   研究阶段——模型自由调用检索工具积累证据
 *   写作阶段——证据一次性注入，专心产出 Markdown
 *
 * 关键设计：**证据与对话分离**。
 * 工具返回的全文存进独立证据库，对话里只回灌紧凑摘要（标题/URL/节选）。
 * 否则每轮把几万字符塞回 messages，十几轮后上下文膨胀到几十万字符，
 * 模型调用越来越慢、成本线性上涨——实测会让单次运行卡住十几分钟没有产出。
 */
import { resolveProvider } from './providers/index.js';
import { TOOLS, runTool, createUrlLedger } from './sources/index.js';
import { ENGINE } from './config.js';
import { evalEvidence, evalReport } from './eval.js';

const now = () => Date.now();

function addUsage(acc, u) {
  acc.input += u.input ?? 0;
  acc.output += u.output ?? 0;
  acc.reasoning += u.reasoning ?? 0;
  acc.cached += u.cached ?? 0;
  acc.calls += 1;
  return acc;
}

/** 回灌给对话的紧凑形式——够模型判断"还要不要继续查"，但不占上下文。 */
function compactForChat(name, result, evidenceId) {
  if (!result?.ok) return JSON.stringify({ ok: false, error: result?.error ?? '未知错误' });

  if (name === 'search_web') {
    return JSON.stringify({
      ok: true, evidence_id: evidenceId,
      results: (result.results ?? []).map((r) => ({ title: r.title?.slice(0, 110), url: r.url })),
    });
  }
  if (name === 'fetch_page') {
    return JSON.stringify({
      ok: true, evidence_id: evidenceId, url: result.url, title: result.title?.slice(0, 140),
      chars: result.text?.length ?? 0, truncated: Boolean(result.truncated),
      excerpt: (result.text ?? '').slice(0, 1800),
      note: '全文已存入证据库，写作阶段可用。此处仅节选。',
    });
  }
  if (name === 'search_scholar') {
    return JSON.stringify({
      ok: true, evidence_id: evidenceId,
      papers: (result.papers ?? []).map((p) => ({
        title: p.title?.slice(0, 130), date: p.date, citations: p.citations,
        venue: p.venue?.slice(0, 60), url: p.url, abstract: (p.abstract ?? '').slice(0, 320),
      })),
    });
  }
  return JSON.stringify(result).slice(0, 4000);
}

/** 写作阶段注入的完整证据文档 */
function renderEvidence(evidence, budget = 320_000) {
  const blocks = [];
  let used = 0;
  for (const e of evidence) {
    let block;
    if (e.tool === 'fetch_page') {
      block = `### [${e.id}] 网页全文：${e.data.title || ''}\nURL: ${e.data.url}\n\n${e.data.text}`;
    } else if (e.tool === 'search_web') {
      block = `### [${e.id}] 检索「${e.query}」\n`
        + (e.data.results ?? []).map((r) => `- ${r.title}\n  ${r.url}`).join('\n');
    } else if (e.tool === 'search_scholar') {
      block = `### [${e.id}] 学术检索「${e.query}」\n`
        + (e.data.papers ?? []).map((p) =>
            `- ${p.title}（${p.date}，引用 ${p.citations}，${p.source}）\n  ${p.url}\n  摘要：${p.abstract}`).join('\n\n');
    } else return '';
    if (used + block.length > budget) { blocks.push(`\n[证据预算用尽，后续 ${evidence.length - blocks.length} 条未展开]`); break; }
    used += block.length;
    blocks.push(block);
  }
  return blocks.join('\n\n');
}

export async function runSkill({
  skill, task, onEvent = () => {}, signal, provider,
  maxRounds = ENGINE.maxToolRounds, evalGate = true,
}) {
  const llm = provider ?? resolveProvider();
  const t0 = now();
  const log = (level, message, data) => onEvent({ level, message, data, at: now() });
  const usage = { input: 0, output: 0, reasoning: 0, cached: 0, calls: 0 };
  const ledger = createUrlLedger();
  const evidence = [];
  const abort = () => { if (signal?.aborted) throw new Error('已取消'); };

  log('info', `模型：${llm.label} · ${llm.model}`);
  log('step', `研究阶段（最多 ${maxRounds} 轮）`);

  const messages = [
    { role: 'system', content: skill.systemPrompt },
    {
      role: 'system',
      content:
        `执行环境：\n`
        + `· 工具：search_web（联网检索）、fetch_page（抓取网页正文）、search_scholar（学术论文）。\n`
        + `· 本阶段只调研，不要输出报告。每轮可以一次发起多个工具调用，效率更高。\n`
        + `· 工具返回的网页全文只给你节选；完整内容已存入证据库，写报告时会完整提供。\n`
        + `· 每条事实都要能对应真实 URL，绝不可凭记忆编造链接或数字。\n`
        + `· 工具失败就换检索词或换来源，不要假装拿到了数据。\n`
        + `· 证据足够时回复「调研完成」并简述已掌握的材料，不要再调用工具。`,
    },
    { role: 'user', content: task },
  ];

  const MIN_ROUNDS = Math.min(6, maxRounds);   // 再顺利也要跑够这么多轮
  let rounds = 0;
  let stagnantRounds = 0;      // 连续几轮没有带来新来源
  for (; rounds < maxRounds; rounds++) {
    const beforeSources = ledger.size();
    abort();
    const rt = now();
    const r = await llm.complete({ messages, tools: TOOLS, maxTokens: 6000, temperature: 0.3, signal });
    addUsage(usage, r.usage);

    const calls = (r.toolCalls ?? []).slice(0, ENGINE.maxToolCallsPerRound);
    if (!calls.length) {
      log('info', `  第 ${rounds + 1} 轮：调研结束（${ledger.size()} 个来源，${evidence.length} 条证据）`);
      break;
    }
    messages.push({ role: 'assistant', content: r.content ?? '', tool_calls: calls });

    // 同一轮内的工具互不依赖，并行执行。串行时一轮要 5–22 秒，多数时间耗在等网络。
    const settled = await Promise.all(calls.map(async (c) => {
      let args = {};
      try { args = JSON.parse(c.function?.arguments || '{}'); } catch { /* 坏参数交给工具报错 */ }
      const name = c.function?.name;
      return { c, name, args, result: await runTool(name, args, { ledger, onEvent }) };
    }));
    abort();

    // 证据编号必须在并行结束后按固定顺序分配，否则同一次运行的 ID 不可复现
    for (const { c, name, args, result } of settled) {
      let evidenceId = null;
      if (result?.ok) {
        evidenceId = `E${evidence.length + 1}`;
        evidence.push({ id: evidenceId, tool: name, query: args.query ?? args.url ?? '', data: result });
      }
      messages.push({ role: 'tool', tool_call_id: c.id, content: compactForChat(name, result, evidenceId) });
    }

    const gained = ledger.size() - beforeSources;
    log('progress',
      `  第 ${rounds + 1} 轮：${calls.length} 个工具 · 新增 ${gained} 个来源 · ${((now() - rt) / 1000).toFixed(1)}s`);

    // 提前停止要同时满足三个条件，缺一不可：
    //   连续 3 轮无新增 + 证据量达标 + 已跑满最少轮次
    // 早先只要 2 轮无新增就停，实测 3 轮就收工、来源从 212 掉到 70，质量明显下滑。
    // 单轮无新增是常态（模型会重复访问同一批站点），不足以说明边际收益见底。
    stagnantRounds = gained > 0 ? 0 : stagnantRounds + 1;
    if (stagnantRounds >= 3 && evidence.length >= 20 && rounds + 1 >= MIN_ROUNDS) {
      log('info', `  连续 ${stagnantRounds} 轮无新增来源且证据已达 ${evidence.length} 条，提前结束调研`);
      rounds += 1;
      break;
    }
  }

  if (rounds >= maxRounds) log('warn', `  达到轮次上限 ${maxRounds}`);
  if (!evidence.length) {
    throw new Error('未取得任何证据，无法生成有依据的报告。请检查网络与检索后端（node cli.js doctor）。');
  }
  log('info', `研究阶段：${rounds} 轮 · ${evidence.length} 条证据 · ${ledger.size()} 个来源 · ${usage.calls} 次调用`);

  /* ── 第一层质量闸门：证据够不够写 ── */
  let evidenceEval = null;
  if (evalGate) {
    log('step', '证据评审（第一层）');
    evidenceEval = await evalEvidence({ llm, skill, task, evidence, ledger: ledger.all(), signal });
    addUsage(usage, evidenceEval.usage);
    log(evidenceEval.sufficient ? 'info' : 'warn',
      `  评分 ${evidenceEval.score}/100 · ${evidenceEval.sufficient ? '证据充分' : '证据不足'} — ${evidenceEval.reason}`);
    for (const g of (evidenceEval.gaps ?? []).slice(0, 4)) log('warn', `    缺口：${g}`);

    // 证据不足时做真正的补研究，并重新评审——补一轮就放行等于没有闸门。
    // 实测过一次：评审打 32 分说证据不足，补一轮后照常写，产出明显偏薄。
    let pass = 0;
    while (!evidenceEval.sufficient && pass < 2) {
      pass += 1;
      const extra = (evidenceEval.extra_queries ?? []).slice(0, 4);
      if (!extra.length) { log('warn', '  评审未给出补检方向，停止补研究'); break; }

      log('step', `补研究第 ${pass} 轮：${extra.length} 个方向（评分 ${evidenceEval.score}）`);
      const before = ledger.size();
      await Promise.all(extra.map(async (q) => {
        const tool = /论文|研究综述|学术|paper|study|literature/i.test(q) ? 'search_scholar' : 'search_web';
        const r = await runTool(tool, { query: q }, { ledger, onEvent });
        if (r?.ok) evidence.push({ id: `E${evidence.length + 1}`, tool, query: q, data: r });
      }));

      // 检索只拿到标题，关键页面要读全文才算证据
      const fresh = [...new Set((evidenceEval.extra_queries ?? []).flatMap((q) => {
        const hit = evidence.find((e) => e.query === q && e.tool === 'search_web');
        return (hit?.data?.results ?? []).slice(0, 2).map((x) => x.url);
      }))].slice(0, 6);
      await Promise.all(fresh.map(async (u) => {
        const r = await runTool('fetch_page', { url: u }, { ledger, onEvent });
        if (r?.ok) evidence.push({ id: `E${evidence.length + 1}`, tool: 'fetch_page', query: u, data: r });
      }));

      log('info', `  补研究第 ${pass} 轮：来源 ${before} → ${ledger.size()}，证据 ${evidence.length} 条`);
      evidenceEval = await evalEvidence({ llm, skill, task, evidence, ledger: ledger.all(), signal });
      addUsage(usage, evidenceEval.usage);
      log(evidenceEval.sufficient ? 'info' : 'warn',
        `  复评 ${evidenceEval.score}/100 · ${evidenceEval.sufficient ? '证据充分' : '仍不足'} — ${evidenceEval.reason}`);
    }
    if (!evidenceEval.sufficient) {
      log('warn', '  补研究后证据仍不足——报告将如实披露缺口，请对照 run.json 的 evidenceEval 判断可用性');
    }
  }

  /* ───────── 写作阶段 ───────── */
  abort();
  const evidenceDoc = renderEvidence(evidence);
  log('step', `写作阶段（证据 ${evidenceDoc.length} 字符）`);

  const writeBase = [
    { role: 'system', content: skill.systemPrompt },
    { role: 'user', content: `任务：${task}` },
    { role: 'user', content: `以下是调研阶段取得的全部证据，报告只能基于这些材料：\n\n${evidenceDoc}` },
    {
      role: 'user',
      content:
        `现在输出最终报告：\n`
        + `· 严格遵循技能定义中的章节结构、排版与写作规范。\n`
        + `· 只用上面的证据。没查到的如实说明缺口，不要补足想象。\n`
        + `\n`
        + `【引用格式 —— 必须严格遵守】\n`
        + `· 正文中**只写编号标记**，如 \`[1]\`、\`[2]\`，多个来源写成 \`[1][3]\`。`
        + `正文里不允许出现任何裸露的 http/https 网址。\n`
        + `· 每个具体数字、企业名、调查结论、第三方论断，都要在该处标注编号。整篇不少于 10 处标记。\n`
        + `· 编号从 1 开始连续，同一来源在全文复用同一个编号。\n`
        + `· **报告最后必须以 \`# 参考来源\` 为标题列出完整清单**，每行格式：\n`
        + `  \`[1] 来源标题或出处 — https://完整网址\`\n`
        + `· 清单里的网址必须逐字复制上面证据里出现过的真实 URL，一个字符都不能改，更不能凭印象编造。\n`
        + `· **清单只列正文真正引用过的来源**。调研阶段检索到但没在正文用上的来源，一律不要列进去——\n`
        + `  实测出现过「清单 220 条、正文只用到 43 条」且编号互相错位的情况，这会让整份报告的引用失去意义。\n`
        + `· 编号必须连续：正文用了 N 个来源，清单就正好是 [1] 到 [N]，不跳号、不多列。\n`
        + `· 写完后自查一遍：随机挑 3 个正文编号，确认清单里同号条目讲的就是那件事。\n`
        + `· 直接输出 Markdown 正文，不要开场白，不要代码围栏。`,
    },
  ];

  let report = '';
  let emptyStreak = 0;
  for (let seg = 0; seg < 6; seg++) {
    abort();
    const st = now();
    const msgs = report
      ? [...writeBase,
         { role: 'assistant', content: report.slice(-3000) },
         { role: 'user', content: '接着上文继续写，不要重复已写内容，不要加过渡说明。' }]
      : writeBase;

    // 写作阶段把推理压到最低：实测不压时 DeepSeek 会用掉 3.3 万推理 token，
    // 正文产出 0 字符。写长报告需要的是「写」，不是反复权衡。
    const r = await llm.complete({
      messages: msgs, maxTokens: 32000, temperature: 0.4, signal,
      reasoningEffort: 'low',
      maxThinkingTokens: emptyStreak ? 512 : 2048,
    });
    addUsage(usage, r.usage);

    const chunk = r.content ?? '';
    log('progress',
      `  第 ${seg + 1} 段 +${chunk.length} 字符（累计 ${report.length + chunk.length}）`
      + `${r.usage.reasoning ? ` 推理 ${r.usage.reasoning}tok` : ''} ${((now() - st) / 1000).toFixed(1)}s`);

    if (!chunk.trim()) {
      emptyStreak += 1;
      log('warn', `  本段无正文产出（推理占了 ${r.usage.reasoning} token），收紧思考预算后重试`);
      if (emptyStreak >= 2) break;
      continue;
    }
    emptyStreak = 0;
    report += chunk;
    if (r.finishReason !== 'length') break;
    if (seg === 5) log('warn', '  达到续写上限，报告可能不完整');
  }

  if (report.trim().length < 400) {
    throw new Error(
      `写作阶段未能产出有效报告（仅 ${report.trim().length} 字符）。`
      + `常见原因：推理 token 耗尽生成预算，或证据不足以支撑该技能的产出要求。`,
    );
  }

  report = report.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/i, '').trim();

  /* ── 第二层质量闸门：成稿达标吗 ── */
  let reportEval = null;
  if (evalGate) {
    log('step', '成稿评审（第二层）');
    const canon = (u) => String(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();
    const known = new Set(ledger.all().map(canon));
    const cited = new Set([...report.matchAll(/https?:\/\/[^\s<>"'`\]）】，。、；：！？（【]+/g)]
      .map((m) => canon(m[0].replace(/[.,;:，。、）】]+$/, ''))));
    const markers = new Set([...report.matchAll(/\[(\d{1,3})\]/g)].map((m) => m[1]));
    const citations = {
      total: cited.size,
      verified: [...cited].filter((c) => known.has(c)).length,
      markers: markers.size,
    };

    reportEval = await evalReport({ llm, skill, task, report, citations, signal });
    addUsage(usage, reportEval.usage);
    const mark = { pass: 'info', revise: 'warn', fail: 'warn' }[reportEval.verdict] ?? 'info';
    log(mark, `  评分 ${reportEval.score}/100 · ${reportEval.verdict.toUpperCase()} — ${reportEval.reason}`);
    for (const [k, v] of Object.entries(reportEval.dimensions ?? {})) log('progress', `    ${k}：${v}`);
    for (const b of (reportEval.blocking_issues ?? []).slice(0, 4)) log('warn', `    待修：${b}`);
  }

  return {
    report,
    evidenceEval, reportEval,
    ledger: ledger.all(),
    evidence: evidence.map((e) => ({ id: e.id, tool: e.tool, query: e.query })),
    usage, rounds,
    provider: { label: llm.label, model: llm.model },
    durationMs: now() - t0,
  };
}
