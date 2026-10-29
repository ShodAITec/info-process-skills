/**
 * 网页检索与抓取。
 *
 * 检索后端是可插拔的：DeepSeek / TheHive 没有服务端联网能力，
 * 所以检索必须由引擎提供。当前内置 anthropic 后端（复用已有的 key），
 * 要换成 Brave / Tavily / Serper 只需在这里加一个 backend 实现。
 */
import { getKey, ENGINE } from '../config.js';

const UA = 'InfoProcessSkills/1.0 (open-source research tooling)';

/* ───────────────────────── 网页抓取 ───────────────────────── */

const STRIP = /<(script|style|nav|footer|header|aside|form|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * 阅读代理回退（第三方服务 r.jina.ai）。
 *
 * 直连拿不到可用正文时（JS 渲染、非常规 HTML 结构、站点暂时不可达），
 * 交给阅读服务取公开页面的 Markdown。它返回标题与发布日期，
 * 证据质量比自己剥 HTML 更好，所以成功时优先采用。
 *
 * ⚠️ 数据流向：启用回退意味着把目标 URL 发送给 jina.ai。
 * 不希望任何地址离开本机时，传 { allowReader: false } 关闭。
 * 本回退只用于公开可访问页面，不用于绕过付费墙、登录或访问控制。
 */
async function fetchViaReader(url, { maxChars }) {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'User-Agent': UA, Accept: 'text/plain' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`reader HTTP ${res.status}`);
  const body = await res.text();
  if (body.trim().length < 120) throw new Error('reader 返回内容过少');

  const title = body.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const published = body.match(/^Published Time:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const text = body.replace(/^(Title|URL Source|Published Time|Markdown Content):.*$/gm, '').trim();

  return {
    ok: true, url, title, published, contentType: 'reader',
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
    totalChars: text.length,
    via: 'r.jina.ai',
  };
}

/** 抓一个 URL，转成可读纯文本。失败返回 {ok:false}，不抛错——让模型自己决定换一个。 */
export async function fetchPage(url, { maxChars = 20000, allowReader = true } = {}) {
  const tryReader = async (why) => {
    if (!allowReader) return { ok: false, url, error: why };
    try { return await fetchViaReader(url, { maxChars }); }
    catch (e) { return { ok: false, url, error: `${why}；阅读代理亦失败（${String(e.message).slice(0, 80)}）` }; }
  };

  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return { ok: false, url, error: '仅支持 http(s)' };

    const res = await fetch(u, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    // 429/5xx 是临时性故障；403 绝大多数情况是对陌生 UA 的通用拦截，
    // 页面本身在浏览器里公开可读——这几类值得换条路再试一次。
    // 不重试 401（需要登录）和 451（法律原因下架）：那是明确的访问控制，应当尊重。
    if (!res.ok) {
      if ([403, 429, 500, 502, 503].includes(res.status)) return tryReader(`HTTP ${res.status}`);
      return { ok: false, url, error: `HTTP ${res.status}` };
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const body = await res.text();

    if (ct.includes('json')) {
      return { ok: true, url: res.url, contentType: 'json', text: body.slice(0, maxChars) };
    }

    const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
    const text = body
      .replace(STRIP, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    // 剥完 HTML 只剩极少正文，多半是 JS 渲染页，交给阅读代理
    if (text.length < 400) return tryReader('直连正文过短（疑似 JS 渲染）');

    return {
      ok: true, url: res.url, title, contentType: 'html',
      text: text.slice(0, maxChars),
      truncated: text.length > maxChars,
      totalChars: text.length,
    };
  } catch (e) {
    return tryReader(String(e.message || e).slice(0, 120));
  }
}

/* ───────────────────────── 检索后端 ───────────────────────── */

/**
 * Anthropic 服务端检索。只用它做「搜」这一步，不参与写作——
 * 写作模型由 provider 决定（默认 DeepSeek）。
 */
async function searchViaAnthropic(query, { maxResults = 10 } = {}) {
  const key = getKey('ANTHROPIC_API_KEY');
  if (!key) return { ok: false, error: '未配置 ANTHROPIC_API_KEY，无法使用该检索后端' };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',            // 只做检索，用最便宜的档
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
      messages: [{ role: 'user', content: `搜索：${query}\n只需执行检索，不要总结。` }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) return { ok: false, error: `Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const data = await res.json();

  const results = [];
  for (const block of data.content ?? []) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
    for (const r of block.content) {
      if (r?.url) results.push({ title: r.title ?? '', url: r.url, snippet: (r.page_age ? `[${r.page_age}] ` : '') + (r.encrypted_content ? '' : '') });
    }
  }
  return { ok: true, backend: 'anthropic', query, results: results.slice(0, maxResults) };
}

const BACKENDS = { anthropic: searchViaAnthropic };

/** 自动挑一个可用后端；都不可用时如实返回失败，不静默降级成空结果。 */
export async function searchWeb(query, opts = {}) {
  const want = ENGINE.searchBackend;
  const order = want === 'auto' ? ['anthropic'] : want === 'none' ? [] : [want];

  if (!order.length) {
    return { ok: false, error: '联网检索已关闭（IPS_SEARCH=none）。仅能使用学术库与直接抓取。' };
  }
  const errors = [];
  for (const b of order) {
    const fn = BACKENDS[b];
    if (!fn) { errors.push(`未知后端 ${b}`); continue; }
    const r = await fn(query, opts);
    if (r.ok) return r;
    errors.push(`${b}: ${r.error}`);
  }
  return { ok: false, error: errors.join('; ') };
}

export function availableBackends() {
  return Object.keys(BACKENDS).filter((b) => (b === 'anthropic' ? Boolean(getKey('ANTHROPIC_API_KEY')) : true));
}
