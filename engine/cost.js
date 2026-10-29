/**
 * 成本估算。价目写在这里集中维护，跑之前能给出预估，跑飞了有预算闸门。
 * 价格会变，以各家官网为准；未知模型按 0 计并标注，不瞎猜。
 */
const PRICES = {
  // $/百万 token
  'deepseek-ai/deepseek-v4.1-flash-1017': { in: 0.28, out: 0.42, note: 'TheHive 刊例，需以官网为准' },
  'deepseek-chat':                        { in: 0.27, out: 1.10 },
  'gpt-4o':                               { in: 2.50, out: 10.00 },
  'claude-haiku-4-5':                     { in: 1.00, out: 5.00 },
};
/** 服务端检索按次计费 */
const SEARCH_PER_CALL = 10 / 1000;   // Anthropic web search: $10 / 千次

export function priceOf(model) {
  return PRICES[model] ?? null;
}

export function estimate({ model, usage, searches = 0 }) {
  const p = priceOf(model);
  const tokens = p
    ? (usage.input ?? 0) / 1e6 * p.in + (usage.output ?? 0) / 1e6 * p.out
    : null;
  const search = searches * SEARCH_PER_CALL;
  return {
    known: Boolean(p),
    tokenCost: tokens,
    searchCost: search,
    total: (tokens ?? 0) + search,
    note: p?.note ?? (p ? '' : `未收录 ${model} 的价目，token 成本未计入`),
  };
}

export const fmt = (n) => (n == null ? '—' : `$${n.toFixed(4)}`);
