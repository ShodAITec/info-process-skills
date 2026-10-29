/**
 * 工具注册表：把检索能力暴露成 OpenAI function-calling 格式，供模型调用。
 *
 * 设计原则：工具只负责取回事实，不做判断。每个结果都带 URL，
 * 便于后续做引用核验——模型声称引用的链接必须真实出现在工具返回里。
 */
import { searchWeb, fetchPage } from './web.js';
import { fetchPapers } from './scholar.js';

/** 本次运行中工具真实返回过的 URL，用于反编造核验 */
export function createUrlLedger() {
  const seen = new Set();
  const canon = (u) => {
    try {
      const x = new URL(u);
      return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase();
    } catch { return String(u ?? '').toLowerCase(); }
  };
  return {
    add: (u) => { if (u) seen.add(canon(u)); },
    has: (u) => seen.has(canon(u)),
    size: () => seen.size,
    all: () => [...seen],
  };
}

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: '联网检索网页。用于查找行业新闻、企业动态、产品信息、公开案例。返回标题与真实 URL。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索词。具体、带时间限定效果更好，如「酒店 AI 收益管理 2026」' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_page',
      description: '抓取指定 URL 的正文内容。用于核实 search_web 返回的结果，或读取已知地址的全文。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '完整的 http(s) 地址' },
          max_chars: { type: 'integer', description: '最多返回多少字符，默认 20000' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_scholar',
      description: '检索学术论文（OpenAlex 全学科 + arXiv 预印本）。返回标题、摘要、年份、引用数与 DOI。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '英文检索词。中文行业名需先转成通用英文说法，如 hotel management' },
          limit: { type: 'integer', description: '返回篇数，默认 10，上限 20' },
        },
        required: ['query'],
      },
    },
  },
];

/** 工具执行。任何失败都以结构化结果返回，不抛错——让模型看到失败并自行换路。 */
export async function runTool(name, args, { ledger, onEvent = () => {} } = {}) {
  const t0 = Date.now();
  const log = (msg) => onEvent({ level: 'tool', message: `  ${name}: ${msg}`, at: Date.now() });

  try {
    if (name === 'search_web') {
      const r = await searchWeb(String(args.query ?? ''));
      if (!r.ok) { log(`检索失败 — ${r.error}`); return { ok: false, error: r.error }; }
      r.results.forEach((x) => ledger?.add(x.url));
      log(`「${args.query}」→ ${r.results.length} 条（${Date.now() - t0}ms）`);
      return { ok: true, results: r.results };
    }

    if (name === 'fetch_page') {
      const r = await fetchPage(String(args.url ?? ''), { maxChars: Math.min(Number(args.max_chars) || 20000, 40000) });
      if (!r.ok) { log(`抓取失败 ${args.url} — ${r.error}`); return { ok: false, error: r.error }; }
      ledger?.add(r.url);
      log(`${new URL(r.url).hostname} → ${r.text.length} 字符${r.truncated ? '（已截断）' : ''}`);
      return { ok: true, url: r.url, title: r.title, text: r.text, truncated: r.truncated };
    }

    if (name === 'search_scholar') {
      const papers = await fetchPapers(String(args.query ?? ''), {
        limit: Math.min(Number(args.limit) || 10, 20),
        onEvent: () => {},
      });
      papers.forEach((p) => ledger?.add(p.url));
      log(`「${args.query}」→ ${papers.length} 篇（${Date.now() - t0}ms）`);
      return {
        ok: true,
        papers: papers.map((p) => ({
          title: p.title, date: p.date, citations: p.citations, venue: p.venue,
          authors: p.authors, url: p.url, source: p.source,
          abstract: (p.abstract || '').slice(0, 700),
        })),
      };
    }

    return { ok: false, error: `未知工具 ${name}` };
  } catch (e) {
    log(`异常 — ${String(e.message || e).slice(0, 120)}`);
    return { ok: false, error: String(e.message || e).slice(0, 300) };
  }
}
