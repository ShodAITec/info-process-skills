/**
 * 一次完整运行：加载技能 → 执行 → 落盘 → 跑技能自带的校验脚本。
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { OUTPUT_DIR } from './config.js';
import { loadSkill } from './skill.js';
import { runSkill } from './runner.js';
import { renderMarkdownPage } from './render/html.js';
import { estimate, fmt } from './cost.js';


/**
 * 引用核验（编号引用格式）。
 *
 * 正文只出 [N] 标记，完整网址集中在文末「参考来源」清单。核验三件事：
 *   1. 清单里的网址是否真的在本次检索台账里（防编造链接）
 *   2. 正文的编号是否都有对应条目（防悬空引用）
 *   3. 清单里是否有正文没用到的编号（防凑数）
 *
 * URL 正则必须排除中文全角标点，否则会把后续正文粘进网址，
 * 把真实链接误判成编造——实测这会让 96% 的准确率错报成 52%。
 */
function verifyCitations(markdown, ledger) {
  const canon = (u) => String(u).trim()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();
  const known = new Set(ledger.map(canon));

  // 参考清单：从「参考来源 / 参考文献 / References」小节往后找
  const refHeading = markdown.search(/^#{1,3}\s*(参考来源|参考文献|来源清单|References)\s*$/im);
  const refSection = refHeading >= 0 ? markdown.slice(refHeading) : '';
  const body = refHeading >= 0 ? markdown.slice(0, refHeading) : markdown;

  const refs = new Map();           // 编号 → 网址
  for (const m of refSection.matchAll(/\[(\d{1,3})\]\s*([^\n]*?)(https?:\/\/[^\s<>"'`\]）】，。、；：！？（【]+)/g)) {
    refs.set(m[1], m[3].replace(/[.,;:，。、）】]+$/, ''));
  }

  const usedMarkers = new Set([...body.matchAll(/\[(\d{1,3})\]/g)].map((m) => m[1]));
  const bareUrlsInBody = [...body.matchAll(/https?:\/\/[^\s<>"'`\]）】，。、；：！？（【]+/g)].length;

  // 回退：没有编号清单时（旧报告或模型未遵守格式），退化为核验正文里的裸露网址，
  // 否则会报出 0/0 这种看似完美实则什么都没查的结果。
  const bodyUrls = [...new Set([...body.matchAll(/https?:\/\/[^\s<>"'`\]）】，。、；：！？（【]+/g)]
    .map((m) => canon(m[0].replace(/[.,;:，。、）】]+$/, ''))))];
  const refUrls = refs.size ? [...refs.values()].map(canon) : bodyUrls;
  const unmatched = [...new Set(refUrls.filter((u) => !known.has(u)))];
  const danglingMarkers = [...usedMarkers].filter((n) => !refs.has(n));
  const unusedRefs = [...refs.keys()].filter((n) => !usedMarkers.has(n));

  return {
    style: refs.size ? 'numbered' : 'inline',
    markers: usedMarkers.size,
    refs: refs.size,
    total: refUrls.length,
    verified: refUrls.length - unmatched.length,
    unmatched,
    danglingMarkers,
    unusedRefs,
    bareUrlsInBody,
    rate: refUrls.length ? (refUrls.length - unmatched.length) / refUrls.length : 1,
  };
}

const slug = (s) => String(s).toLowerCase().replace(/[^\w一-龥]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'run';

/** 跑技能自带的校验脚本。技能自己定义什么算合格，引擎不替它判断。 */
function execScript(cmd, args, cwd) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, timeout: 120_000 });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
    p.on('error', (e) => resolve({ code: -1, out: '', err: String(e.message) }));
  });
}

async function runValidators(skill, reportPath, outDir, onEvent) {
  const results = [];
  for (const rel of skill.scripts) {
    if (!/validate|check/i.test(rel)) continue;         // 只跑校验类，打包类另行触发
    const abs = path.join(skill.dir, rel);
    const isPy = rel.endsWith('.py');
    const isJs = /\.(js|mjs)$/.test(rel);
    if (!isPy && !isJs) continue;

    // 三类参数约定，顺序不能反：
    //   1. 名字里带 skill 的是校验技能包自身 → 不传参数
    //   2. issue/package 类要整个产物目录（它会在目录里找 Markdown、images/）
    //   3. report/markdown 类要单个报告文件
    // 注意 validate_skill_package 同时含 skill 与 package，必须先排除。
    const validatesSkillItself = /skill/i.test(rel);
    const wantsDir = !validatesSkillItself && /issue|package/i.test(rel);
    const wantsFile = !validatesSkillItself && !wantsDir && /report|markdown|compact/i.test(rel);
    const args = [abs, ...(wantsDir ? [outDir] : wantsFile ? [reportPath] : [])];

    const r = await execScript(isPy ? 'python3' : 'node', args, skill.dir);
    const text = (r.out || r.err);
    const ok = r.code === 0;
    // 有些校验器用非零退出码表达「建议」而非「错误」（如密度检查只输出 [WARN]）。
    // 全部一律标成「未通过」会夸大严重性，让真正的硬失败被噪音淹没。
    const advisory = !ok && /\[WARN\]/.test(text) && !/FAILED|ERROR/i.test(text);
    const status = ok ? 'pass' : advisory ? 'advisory' : 'fail';
    results.push({ script: rel, ok, status, output: text.slice(0, 600) });
    onEvent({
      level: status === 'fail' ? 'warn' : 'info',
      message: `  校验 ${rel}: ${{ pass: '通过', advisory: '通过（有排版建议）', fail: '未通过' }[status]}`
        + (status === 'fail' ? ' — ' + text.split('\n')[0].slice(0, 120) : ''),
      at: Date.now(),
    });
  }
  return results;
}

/**
 * @param {{skillId:string, task:string, onEvent?:Function, signal?:AbortSignal, html?:boolean}} opts
 */
export async function run({ skillId, task, onEvent = () => {}, signal, provider, html = true, evalGate = true }) {
  const started = Date.now();
  const log = (level, message, data) => onEvent({ level, message, data, at: Date.now() });

  log('step', `加载技能 ${skillId}`);
  const skill = await loadSkill(skillId);
  log('info', `  ${skill.name}${skill.version ? ' v' + skill.version : ''} · ${skill.included.length} 个规范文件 · ${skill.totalChars} 字符`);
  if (skill.skipped.length) log('warn', `  ${skill.skipped.length} 个文件因超出预算未加载`);

  const result = await runSkill({ skill, task, onEvent, signal, provider, evalGate });

  const stamp = new Date().toISOString().slice(0, 10);
  const dir = path.join(OUTPUT_DIR, skillId, `${stamp}-${slug(task)}`);
  await fs.mkdir(dir, { recursive: true });

  // 引擎元数据写到产物目录**之外**的同级文件。
  // 技能对自己的产物目录往往是严格白名单（ai-research-digest 的校验器
  // 会把任何多余条目判为 unexpected root entry，包括隐藏目录）。
  const runMetaPath = `${dir}.run.json`;

  const mdPath = path.join(dir, 'report.md');
  await fs.writeFile(mdPath, result.report, 'utf8');
  log('info', `  已写出 ${result.report.length} 字符 → report.md`);

  // 技能若自带渲染器，用它——产出格式属于技能契约的一部分，引擎不该强加自己的样式。
  const ownRenderer = skill.scripts.find((f) => /render.*\.(mjs|js)$/i.test(f));
  if (html && ownRenderer) {
    const r = await execScript('node', [path.join(skill.dir, ownRenderer), dir], skill.dir);
    if (r.code === 0) {
      log('info', `  已用技能自带渲染器 ${ownRenderer} 生成 HTML`);
    } else {
      log('warn', `  技能渲染器失败（${(r.err || r.out).split('\n')[0].slice(0, 100)}），回退到引擎通用渲染`);
      await fs.writeFile(path.join(dir, 'report.html'),
        renderMarkdownPage({ markdown: result.report, title: task, skill, meta: { ...result, generatedAt: new Date().toISOString() } }), 'utf8');
    }
  } else if (html) {
    await fs.writeFile(path.join(dir, 'report.html'),
      renderMarkdownPage({ markdown: result.report, title: task, skill, meta: { ...result, generatedAt: new Date().toISOString() } }), 'utf8');
  }

  log('step', '引用核验与技能自带校验');
  const citations = verifyCitations(result.report, result.ledger);
  const pct = (citations.rate * 100).toFixed(0);
  const warn = (m) => onEvent({ level: 'warn', message: m, at: Date.now() });

  onEvent({
    level: citations.unmatched.length ? 'warn' : 'info',
    message: `  引用核验：正文 ${citations.markers} 个标记 · 清单 ${citations.refs} 条 · `
      + `${citations.verified}/${citations.total} 可追溯（${pct}%）`,
    at: Date.now(),
  });
  if (citations.style === 'inline' && citations.total) {
    warn('    未使用编号引用格式——正文直接出现了网址，未找到「参考来源」小节');
  }
  if (citations.bareUrlsInBody) warn(`    正文中仍有 ${citations.bareUrlsInBody} 处裸露网址，应改为编号标记`);
  if (citations.danglingMarkers.length) warn(`    悬空编号（正文有、清单无）：${citations.danglingMarkers.join('、')}`);
  if (citations.unusedRefs.length) {
    const ratio = citations.unusedRefs.length / Math.max(citations.refs, 1);
    // 少数多余条目是小瑕疵；过半未引用说明模型把检索结果整个倒进了清单，
    // 这种情况下编号极易错位，整份报告的引用体系都不可信。
    if (ratio > 0.3) {
      warn(`    ⚠ 清单 ${citations.refs} 条中有 ${citations.unusedRefs.length} 条正文未引用（${(ratio * 100).toFixed(0)}%）`
         + `——编号很可能错位，引用体系不可信，建议重跑`);
    } else {
      warn(`    清单多余编号（正文未引用）：${citations.unusedRefs.slice(0, 12).join('、')}`
         + (citations.unusedRefs.length > 12 ? ` 等 ${citations.unusedRefs.length} 个` : ''));
    }
  }
  for (const u of citations.unmatched.slice(0, 5)) warn(`    台账中未找到：${u.slice(0, 92)}`);

  const validations = await runValidators(skill, mdPath, dir, onEvent);

  const cost = estimate({
    model: result.provider.model,
    usage: result.usage,
    searches: result.evidence.filter((e) => e.tool === 'search_web').length,
  });
  log('info', `  估算成本：${fmt(cost.total)}（token ${fmt(cost.tokenCost)} + 检索 ${fmt(cost.searchCost)}）${cost.note ? ' · ' + cost.note : ''}`);

  const manifest = {
    skill: { id: skill.id, name: skill.name, version: skill.version },
    task,
    generatedAt: new Date().toISOString(),
    provider: result.provider,
    durationMs: Date.now() - started,
    usage: result.usage,
    researchRounds: result.rounds,
    sources: result.ledger,
    evidence: result.evidence,
    citations,
    evidenceEval: result.evidenceEval,
    reportEval: result.reportEval,
    cost,
    validations,
  };
  await fs.writeFile(runMetaPath, JSON.stringify(manifest, null, 2), 'utf8');

  const secs = ((Date.now() - started) / 1000).toFixed(0);
  log('done', `完成：${result.report.length} 字符 · ${result.ledger.length} 个来源 · 引用可核验 ${pct}% · 用时 ${secs}s`, { dir, mdPath });
  return { dir, mdPath, manifest, report: result.report };
}
