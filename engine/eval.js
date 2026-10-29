/**
 * 两层质量闸门。
 *
 *   第一层（写作前）：证据够不够支撑这份报告？不够就不该写。
 *   第二层（写作后）：成稿达标吗？不达标给出重做信号。
 *
 * 为什么需要：实测四份同类报告的行内引用数在 0–30 间波动，
 * 而系统自己完全不知道哪份更好。没有闸门，质量全靠运气。
 *
 * 评审用的是技能自己的约束，不是引擎的通用标准——
 * 每个技能对"合格"的定义不同，引擎不该越俎代庖。
 */

const parseJson = (text) => {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*\n/i, '').replace(/\n```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch { /* 继续尝试 */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* 放弃 */ } }
  return null;
};

/* ─────────── 第一层：证据充分性 ─────────── */

export async function evalEvidence({ llm, skill, task, evidence, ledger, signal }) {
  const inventory = evidence.map((e) => {
    if (e.tool === 'search_web') return `- [检索] ${e.query} → ${e.data.results?.length ?? 0} 条结果`;
    if (e.tool === 'search_scholar') return `- [学术] ${e.query} → ${e.data.papers?.length ?? 0} 篇`;
    if (e.tool === 'fetch_page') return `- [全文] ${(e.data.title || e.data.url).slice(0, 90)} · ${e.data.text?.length ?? 0} 字符`;
    return `- ${e.tool}`;
  }).join('\n');

  const r = await llm.complete({
    messages: [
      { role: 'system', content: `你是研究质量评审。依据下面的技能规范，判断已有证据是否足以支撑它要求的产出。\n\n${skill.systemPrompt.slice(0, 60_000)}` },
      {
        role: 'user',
        content:
          `任务：${task}\n\n已收集证据清单（共 ${evidence.length} 条，${ledger.length} 个来源）：\n${inventory}\n\n`
          + `严格输出 JSON：\n`
          + `{"sufficient": true/false, "score": 0-100, "coverage": {"<维度>": "充分|薄弱|缺失"}, `
          + `"gaps": ["最关键的缺口，最多4条"], "extra_queries": ["建议补检的具体检索词，最多4条"], "reason": "一句话"}\n\n`
          + `判据：技能要求的核心章节是否都有对应证据；关键结论能否被支撑。宁可判不足也不要放水。`,
      },
    ],
    maxTokens: 3000, temperature: 0.2, jsonMode: true, reasoningEffort: 'low', maxThinkingTokens: 1024, signal,
  });

  const v = parseJson(r.content) ?? { sufficient: true, score: 60, gaps: [], extra_queries: [], reason: '评审输出无法解析，默认放行' };
  return { ...v, usage: r.usage };
}

/* ─────────── 第二层：成稿质量 ─────────── */

export async function evalReport({ llm, skill, task, report, citations, signal }) {
  // 太长就抽样评：开头定调、中间看充实度、结尾看收束
  const sample = report.length > 48_000
    ? `${report.slice(0, 20_000)}\n\n…（中段省略 ${report.length - 44_000} 字符）…\n\n${report.slice(-24_000)}`
    : report;

  const r = await llm.complete({
    messages: [
      { role: 'system', content: `你是严格的报告评审。依据下面的技能规范评判成稿是否达标。\n\n${skill.systemPrompt.slice(0, 60_000)}` },
      {
        role: 'user',
        content:
          `任务：${task}\n`
          + `客观指标：全文 ${report.length} 字符；行内引用 ${citations.total} 处，其中 ${citations.verified} 处可追溯到检索台账。\n\n`
          + `成稿：\n${sample}\n\n`
          + `严格输出 JSON：\n`
          + `{"verdict":"pass|revise|fail","score":0-100,`
          + `"dimensions":{"结构完整性":0-100,"证据充分性":0-100,"判断质量":0-100,"引用规范":0-100,"写作质量":0-100},`
          + `"blocking_issues":["必须修的问题，最多4条"],"suggestions":["可改进项，最多4条"],"reason":"一句话"}\n\n`
          + `判据：是否遵循技能规定的章节与约束；有无编造迹象；关键结论是否有证据；缺口是否如实说明。`
          + `发现编造数字或无依据断言，直接 fail。`,
      },
    ],
    maxTokens: 4000, temperature: 0.2, jsonMode: true, reasoningEffort: 'low', maxThinkingTokens: 1536, signal,
  });

  const v = parseJson(r.content) ?? { verdict: 'pass', score: 60, dimensions: {}, blocking_issues: [], suggestions: [], reason: '评审输出无法解析，默认放行' };
  return { ...v, usage: r.usage };
}
