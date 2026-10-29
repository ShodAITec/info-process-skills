/**
 * 技能加载器。
 *
 * 两个技能包的目录结构并不一致（一个用 rules/ + context/，另一个用 references/），
 * 所以加载策略是「约定 + 引用追踪」двух路并行：
 *   1. 约定目录：rules / references / context / outputs / assets 下的 .md 全收
 *   2. 引用追踪：SKILL.md 正文里的本地 markdown 链接也收
 * 两路合并去重。这样新增技能时不需要改引擎。
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { SKILLS_DIR } from './config.js';

const CONVENTIONAL = ['rules', 'references', 'context', 'outputs', 'prompts', 'assets'];

/** 解析 YAML frontmatter。只取需要的几个字段，不引第三方 YAML 库。 */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };

  const meta = {};
  let currentKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const top = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    const nested = line.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (top) {
      currentKey = top[1];
      const v = top[2].trim().replace(/^["']|["']$/g, '');
      meta[currentKey] = v === '' ? {} : v;
    } else if (nested && currentKey && typeof meta[currentKey] === 'object') {
      meta[currentKey][nested[1]] = nested[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body: text.slice(m[0].length) };
}

const isMd = (f) => /\.(md|markdown)$/i.test(f);

async function listMd(dir) {
  const out = [];
  async function walk(d) {
    let entries = [];
    try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (isMd(e.name)) out.push(p);
    }
  }
  await walk(dir);
  return out;
}

/** 列出所有可用技能 */
export async function listSkills() {
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true }).catch(() => []);
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(SKILLS_DIR, e.name, 'SKILL.md');
    if (!fsSync.existsSync(skillFile)) continue;
    const { meta } = parseFrontmatter(await fs.readFile(skillFile, 'utf8'));
    out.push({
      id: e.name,
      name: meta.name || e.name,
      description: (meta.description || '').replace(/\s+/g, ' ').slice(0, 200),
      version: meta.metadata?.version || '',
      language: meta.metadata?.language || '',
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * 加载一个技能的完整上下文。
 * @param {string} id 目录名
 * @param {{maxChars?:number}} opts 总字符预算。DeepSeek 上下文 1M，默认给得比较宽。
 */
export async function loadSkill(id, { maxChars = 420_000 } = {}) {
  const dir = path.join(SKILLS_DIR, id);
  const skillFile = path.join(dir, 'SKILL.md');
  if (!fsSync.existsSync(skillFile)) {
    const avail = (await listSkills()).map((s) => s.id).join('、');
    throw new Error(`技能「${id}」不存在。可用：${avail || '（无）'}`);
  }

  const rawSkill = await fs.readFile(skillFile, 'utf8');
  const { meta, body } = parseFrontmatter(rawSkill);

  // 1) 约定目录
  const found = new Set();
  for (const sub of CONVENTIONAL) {
    const p = path.join(dir, sub);
    if (fsSync.existsSync(p)) (await listMd(p)).forEach((f) => found.add(f));
  }
  // 2) SKILL.md 正文里的本地链接
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)]+\.md)\)/gi)) {
    const p = path.resolve(dir, m[1]);
    if (p.startsWith(dir) && fsSync.existsSync(p)) found.add(p);
  }

  // 顺序：rules/context 优先（约束），outputs/prompts 次之（模板），其余最后
  const weight = (f) => {
    const r = path.relative(dir, f);
    if (r.startsWith('rules')) return 0;
    if (r.startsWith('context')) return 1;
    if (r.startsWith('references')) return 2;
    if (r.startsWith('outputs')) return 3;
    if (r.startsWith('prompts')) return 4;
    return 5;
  };
  const files = [...found].sort((a, b) => weight(a) - weight(b) || a.localeCompare(b));

  const parts = [];
  const included = [];
  const skipped = [];
  let used = body.length;

  for (const f of files) {
    const rel = path.relative(dir, f);
    const text = await fs.readFile(f, 'utf8');
    if (used + text.length > maxChars) { skipped.push({ rel, chars: text.length }); continue; }
    used += text.length;
    included.push({ rel, chars: text.length });
    parts.push(`\n\n<<<FILE: ${rel}>>>\n${text.trim()}`);
  }

  const scripts = [];
  for (const sub of ['scripts', 'validators']) {
    const p = path.join(dir, sub);
    if (!fsSync.existsSync(p)) continue;
    for (const f of await fs.readdir(p)) scripts.push(path.join(sub, f));
  }

  return {
    id, dir, meta,
    name: meta.name || id,
    description: meta.description || '',
    version: meta.metadata?.version || '',
    /** 完整系统提示：SKILL.md 正文 + 全部规范文件 */
    systemPrompt:
      `以下是你要执行的技能「${meta.name || id}」的完整定义。严格按其中的规则执行。\n\n`
      + `<<<FILE: SKILL.md>>>\n${body.trim()}${parts.join('')}`,
    included, skipped, scripts,
    totalChars: used,
  };
}
