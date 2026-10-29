/**
 * Provider 注册与解析。
 *
 * 引擎只认一个接口：complete({messages, tools, ...})。
 * 想接新模型，在 PRESETS 里加一行即可，技能和执行器都不用动。
 */
import { createProvider } from './openai-compatible.js';
import { getKey } from '../config.js';

/** 预设：endpoint + 默认模型 + 所需密钥 */
export const PRESETS = {
  thehive: {
    label: 'TheHive · DeepSeek',
    endpoint: 'https://api-cdn.thehive.ai/api/v3/chat/completions',
    model: 'deepseek-ai/deepseek-v4.1-flash-1017',
    keyName: 'THEHIVE_API_KEY',
    note: '1M 上下文；推理 token 会占用生成预算，max_tokens 要给足',
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    keyName: 'OPENAI_API_KEY',
  },
  deepseek: {
    label: 'DeepSeek 官方',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    keyName: 'DEEPSEEK_API_KEY',
  },
  moonshot: {
    label: 'Moonshot',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-128k',
    keyName: 'MOONSHOT_API_KEY',
  },
  ollama: {
    label: '本地 Ollama',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    model: process.env.IPS_MODEL || 'qwen2.5:14b',
    keyName: null,   // 本地无需密钥
  },
};

/**
 * @param {string} [id] 预设名；省略时读 IPS_PROVIDER，默认 thehive
 * 也可用环境变量完全自定义：IPS_ENDPOINT + IPS_MODEL + IPS_API_KEY
 */
export function resolveProvider(id = process.env.IPS_PROVIDER || 'thehive') {
  if (process.env.IPS_ENDPOINT) {
    return createProvider({
      label: 'custom',
      endpoint: process.env.IPS_ENDPOINT,
      model: process.env.IPS_MODEL || 'default',
      apiKey: process.env.IPS_API_KEY || '',
    });
  }

  const p = PRESETS[id];
  if (!p) throw new Error(`未知 provider「${id}」。可用：${Object.keys(PRESETS).join('、')}，或用 IPS_ENDPOINT 自定义。`);

  const apiKey = p.keyName ? getKey(p.keyName) : '';
  if (p.keyName && !apiKey) {
    throw new Error(`provider「${id}」需要 ${p.keyName}。请写入 config.md 或设为环境变量。`);
  }
  return createProvider({
    label: p.label,
    endpoint: p.endpoint,
    model: process.env.IPS_MODEL || p.model,
    apiKey,
  });
}

export function listProviders() {
  return Object.entries(PRESETS).map(([id, p]) => ({
    id, label: p.label, model: p.model, keyName: p.keyName,
    ready: !p.keyName || Boolean(getKey(p.keyName)),
    note: p.note ?? '',
  }));
}
