#!/usr/bin/env node
/**
 * InfoProcessSkills —— 技能驱动的报告生成器
 *
 *   node cli.js list
 *   node cli.js run <skill-id> "<任务描述>"
 *   node cli.js doctor
 */
import path from 'node:path';
import { listSkills, loadSkill } from './engine/skill.js';
import { run } from './engine/pipeline.js';
import { getKey, ENGINE } from './engine/config.js';
import { availableBackends } from './engine/sources/web.js';
import { listProviders, resolveProvider } from './engine/providers/index.js';

const C = { dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m',
            cyan: '\x1b[36m', bold: '\x1b[1m', off: '\x1b[0m' };
const paint = { error: C.red, warn: C.yellow, step: C.cyan + C.bold, done: C.green + C.bold,
                progress: C.dim, tool: C.dim, info: '' };
const print = (e) => {
  const c = paint[e.level] ?? '';
  console.log(`${c}${e.message}${c ? C.off : ''}`);
};

const [cmd, ...rest] = process.argv.slice(2);

function usage() {
  console.log(`
${C.bold}InfoProcessSkills${C.off} — 技能驱动的报告生成器

命令：
  ${C.cyan}list${C.off}                       列出所有可用技能
  ${C.cyan}run <skill> "<任务>"${C.off}       用指定技能生成报告
  ${C.cyan}doctor${C.off}                     检查密钥与检索后端是否就绪
  ${C.cyan}show <skill>${C.off}               查看某个技能加载了哪些规范文件
  ${C.cyan}export <skill>${C.off}             导出完整提示词，供任意 agent 使用\n  ${C.cyan}new <skill-id>${C.off}             脚手架生成一个新技能骨架

运行选项：
  --no-eval                  跳过两层质量评审（更快更省，但没有质量闸门）
  --no-html                  只产出 Markdown

示例：
  node cli.js run ai-industry-deep-insight "酒店管理"
  node cli.js run ai-research-digest "本周海外人文社科长文精选"
  node cli.js export ai-industry-deep-insight --out prompt.md
  node cli.js export ai-industry-deep-insight | pbcopy

环境变量：
  IPS_PROVIDER=thehive       选择生成模型（thehive/openai/deepseek/moonshot/ollama）
  IPS_MODEL=...              覆盖该 provider 的默认模型
  IPS_ENDPOINT=...           接任意 OpenAI 兼容服务（配合 IPS_API_KEY）
  IPS_SEARCH=none            关闭联网检索（只用学术库与直接抓取）
`);
}

try {
  if (!cmd || cmd === 'help' || cmd === '--help') { usage(); process.exit(0); }

  if (cmd === 'list') {
    const skills = await listSkills();
    if (!skills.length) { console.log('skills/ 下还没有技能。'); process.exit(0); }
    console.log(`\n共 ${skills.length} 个技能：\n`);
    for (const s of skills) {
      console.log(`  ${C.bold}${s.id}${C.off}${s.version ? C.dim + '  v' + s.version + C.off : ''}`);
      console.log(`  ${C.dim}${s.description.slice(0, 96)}${C.off}\n`);
    }
    process.exit(0);
  }

  if (cmd === 'doctor') {
    console.log(`\n${C.bold}生成模型（provider）${C.off}`);
    for (const p of listProviders()) {
      const mark = p.ready ? C.green + '✓' + C.off : C.dim + '·' + C.off;
      console.log(`  ${mark} ${p.id.padEnd(10)} ${C.dim}${p.model}${C.off}`);
      if (!p.ready) console.log(`     ${C.dim}需要 ${p.keyName}${C.off}`);
      else if (p.note) console.log(`     ${C.dim}${p.note}${C.off}`);
    }
    console.log(`  ${C.dim}也可用 IPS_ENDPOINT + IPS_MODEL + IPS_API_KEY 接任意 OpenAI 兼容服务${C.off}`);

    const anth = getKey('ANTHROPIC_API_KEY');
    console.log(`\n${C.bold}联网检索后端${C.off}  ${ENGINE.searchBackend}`);
    const bk = availableBackends();
    console.log(`  可用：${bk.length ? C.green + bk.join('、') + C.off : C.yellow + '无（仅学术库与直接抓取）' + C.off}`);
    if (!anth) console.log(`  ${C.dim}配置 ANTHROPIC_API_KEY 可启用联网检索；不配则只能用 search_scholar 与 fetch_page${C.off}`);

    try {
      const prov = resolveProvider();
      process.stdout.write(`\n${C.bold}连通性${C.off}  ${prov.label} … `);
      const h = await prov.health();
      console.log(`${C.green}正常${C.off} ${C.dim}${h.ms}ms${C.off}`);
    } catch (e) {
      console.log(`${C.red}失败${C.off} ${String(e.message).slice(0, 160)}`);
    }

    console.log(`\n${C.bold}技能${C.off}  ${(await listSkills()).map((s) => s.id).join('、') || '（无）'}\n`);
    process.exit(0);
  }

  if (cmd === 'show') {
    const k = await loadSkill(rest[0]);
    console.log(`\n${C.bold}${k.name}${C.off}${k.version ? ' v' + k.version : ''}`);
    console.log(`${C.dim}${k.description.slice(0, 200)}${C.off}\n`);
    console.log(`系统提示共 ${k.totalChars} 字符，收录 ${k.included.length} 个文件：`);
    for (const f of k.included) console.log(`  ${String(f.chars).padStart(6)}  ${f.rel}`);
    if (k.skipped.length) console.log(`\n${C.yellow}超预算未加载：${k.skipped.map((f) => f.rel).join('、')}${C.off}`);
    if (k.scripts.length) console.log(`\n自带脚本：${k.scripts.join('、')}`);
    console.log();
    process.exit(0);
  }

  if (cmd === 'new') {
    const id = rest[0];
    if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      console.error('用法：node cli.js new <skill-id>（小写字母、数字、连字符）'); process.exit(2);
    }
    const fs = await import('node:fs/promises');
    const fsSync = await import('node:fs');
    const { SKILLS_DIR } = await import('./engine/config.js');
    const dir = `${SKILLS_DIR}/${id}`;
    if (fsSync.existsSync(dir)) { console.error(`技能「${id}」已存在`); process.exit(2); }

    await fs.mkdir(`${dir}/rules`, { recursive: true });
    await fs.mkdir(`${dir}/outputs`, { recursive: true });
    await fs.writeFile(`${dir}/SKILL.md`, `---
name: ${id}
description: 一句话说清这个技能做什么、什么时候用、什么时候不该用。描述会被用于技能选择，要具体。
metadata:
  version: 0.1.0
  language: zh-CN
---

# ${id}

## 输入与交付
- 输入：
- 交付：Markdown 报告，章节见 outputs/report_template.md

## 执行步骤
1. 明确问题边界与范围
2. 分线检索证据
3. 形成判断
4. 按模板输出

## 不可破坏的约束
- 只写检索到的真实内容，来源未披露的数字写「未披露」，绝不估算
- 每个关键结论就近给出来源链接
- 材料不足时如实说明缺口，不用套话填充
`, 'utf8');
    await fs.writeFile(`${dir}/outputs/report_template.md`, `# <标题>

> **研究截止**：<日期>
> **执行技能**：${id}

# 01 <第一章>

# 02 <第二章>
`, 'utf8');
    await fs.writeFile(`${dir}/rules/evidence.md`, `# 证据规范

- 每条事实对应一个真实 URL
- 数字必须与来源一致；来源没给就写「未披露」
- 区分：作者论断 / 客观事实 / 第三方材料 / 本报告推断
`, 'utf8');

    console.log(`${C.green}已创建${C.off} skills/${id}/`);
    console.log(`  SKILL.md、rules/evidence.md、outputs/report_template.md`);
    console.log(`\n下一步：编辑 SKILL.md，然后 ${C.cyan}node cli.js show ${id}${C.off}`);
    process.exit(0);
  }

  if (cmd === 'export') {
    const id = rest[0];
    if (!id) { console.error('用法：node cli.js export <skill-id> [--out 文件]'); process.exit(2); }
    const k = await loadSkill(id);
    const i = rest.indexOf('--out');
    const outFile = i >= 0 ? rest[i + 1] : null;
    if (outFile) {
      const fs = await import('node:fs/promises');
      await fs.writeFile(outFile, k.systemPrompt, 'utf8');
      console.error(`${C.green}已导出${C.off} ${k.name} → ${outFile}（${k.totalChars} 字符，${k.included.length} 个规范文件）`);
      console.error(`${C.dim}把它作为 system prompt 贴进任何 agent 即可使用，不依赖本引擎。${C.off}`);
    } else {
      process.stdout.write(k.systemPrompt);   // 管道友好：只有提示内容走 stdout
    }
    process.exit(0);
  }

  if (cmd === 'run') {
    const skillId = rest[0];
    const task = rest.slice(1).filter((a) => !a.startsWith('--')).join(' ').trim();
    if (!skillId || !task) { console.error('用法：node cli.js run <skill-id> "<任务描述>"'); process.exit(2); }

    const r = await run({ skillId, task, onEvent: print, html: !rest.includes('--no-html'), evalGate: !rest.includes('--no-eval') });
    console.log(`\n${C.bold}产物目录：${C.off}${r.dir}`);
    console.log(`${C.bold}打开报告：${C.off}file://${path.join(r.dir, 'report.html')}`);
    const u = r.manifest.usage;
    console.log(`${C.dim}用量：${u.calls} 次调用 · 入 ${u.input} / 出 ${u.output}${u.reasoning ? ' / 推理 ' + u.reasoning : ''} tokens${C.off}`);
    const c = r.manifest.cost;
    if (c) console.log(`${C.dim}估算成本：${c.total != null ? '$' + c.total.toFixed(4) : '—'}${c.note ? '（' + c.note + '）' : ''}${C.off}`);
    process.exit(0);
  }

  console.error(`未知命令 ${cmd}`); usage(); process.exit(2);
} catch (e) {
  console.error(`${C.red}失败：${e.message}${C.off}`);
  process.exit(1);
}
