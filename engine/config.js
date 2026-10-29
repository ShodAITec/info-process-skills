/**
 * 全局配置与密钥解析。
 *
 * 密钥解析顺序：环境变量 → .env → config.md
 * 三处都只读不写——引擎绝不把密钥复制到任何新文件里。
 * config.md 已在 .gitignore 中，开源仓库不会带出密钥。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SKILLS_DIR = path.join(ROOT, 'skills');
export const OUTPUT_DIR = path.join(ROOT, 'output');

function fromEnvFile(name) {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return null;
  const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

function fromConfigMd(patterns) {
  const f = path.join(ROOT, 'config.md');
  if (!fs.existsSync(f)) return null;
  const text = fs.readFileSync(f, 'utf8');
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return (m[1] ?? m[0]).trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

/** @returns {string|null} 找不到返回 null，由调用方决定是否致命 */
export function getKey(name) {
  const spec = {
    THEHIVE_API_KEY: [/thehive[_\s]*api[_\s]*key\s*[=:]\s*["']?([A-Za-z0-9+/=_\-]{16,})["']?/i],
    ANTHROPIC_API_KEY: [/\b(sk-ant-[A-Za-z0-9_\-]+)/],
  }[name] ?? [];

  return process.env[name]?.trim() || fromEnvFile(name) || fromConfigMd(spec) || null;
}

export function requireKey(name, hint) {
  const k = getKey(name);
  if (!k) throw new Error(`缺少 ${name}。${hint ?? '请设置环境变量，或写入 .env / config.md。'}`);
  return k;
}

export const mask = (k) => (k ? `${k.slice(0, 6)}…${k.slice(-4)}` : '(none)');

export const ENGINE = {
  /** 默认生成模型 */
  provider: process.env.IPS_PROVIDER || 'thehive',
  /** 联网检索后端：anthropic | none。没有专用搜索 API 时用 anthropic 的服务端检索 */
  searchBackend: process.env.IPS_SEARCH || 'auto',
  /** agent 循环上限，防止失控 */
  maxToolRounds: 12,
  maxToolCallsPerRound: 6,
};
