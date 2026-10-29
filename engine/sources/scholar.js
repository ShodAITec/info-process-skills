/**
 * 学术论文检索层。
 *
 * 用两个免费、无需鉴权的公开 API，不做任何抓取：
 *   · OpenAlex —— 全学科覆盖，适合「酒店管理」这类非技术垂直行业
 *   · arXiv    —— CS/AI 预印本，补充技术前沿视角
 *
 * 为什么两个都要：实测「hotel management」在 arXiv 上只有 4 篇，
 * 在 OpenAlex 上有 2 万篇。但 arXiv 能拿到 OpenAlex 收录滞后的最新 AI 工作。
 */

const UA = 'InfoProcessSkills/1.0 (open-source research tooling)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWithRetry(url, { json = true, retries = 2 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'application/atom+xml' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json ? res.json() : res.text();
    } catch (e) {
      last = e;
      if (i < retries) await sleep(700 * 2 ** i);
    }
  }
  throw last;
}

/** OpenAlex 的摘要是倒排索引存的，要还原成正常文本。 */
function deInvertAbstract(inv) {
  if (!inv || typeof inv !== 'object') return '';
  const slots = [];
  for (const [word, positions] of Object.entries(inv)) {
    for (const p of positions) slots[p] = word;
  }
  return slots.filter(Boolean).join(' ').slice(0, 1200);
}

/**
 * OpenAlex 检索。
 * 用通用 search（默认按相关度排序）而不是 title_and_abstract.search + 日期排序——
 * 实测后者按日期排会把大量零引用、主题跑偏的条目顶上来。
 */
async function searchOpenAlex(industryEn, { sinceYear, limit }) {
  const query = `artificial intelligence ${industryEn}`;
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('filter', `from_publication_date:${sinceYear}-01-01,has_abstract:true`);
  url.searchParams.set('per-page', String(Math.min(limit * 2, 50)));
  url.searchParams.set('select', 'id,doi,title,publication_date,cited_by_count,authorships,primary_location,open_access,abstract_inverted_index,type');

  const data = await getWithRetry(url.toString());
  return (data.results ?? [])
    .filter((w) => w.title && w.type !== 'paratext')
    .map((w) => ({
      source: 'OpenAlex',
      title: w.title.trim(),
      date: w.publication_date ?? '',
      year: Number((w.publication_date ?? '').slice(0, 4)) || null,
      citations: w.cited_by_count ?? 0,
      authors: (w.authorships ?? []).slice(0, 4).map((a) => a.author?.display_name).filter(Boolean),
      venue: w.primary_location?.source?.display_name ?? '',
      url: w.doi ? `https://doi.org/${String(w.doi).replace(/^https?:\/\/doi\.org\//, '')}` : (w.id ?? ''),
      isOpenAccess: Boolean(w.open_access?.is_oa),
      abstract: deInvertAbstract(w.abstract_inverted_index),
    }));
}

/** arXiv Atom feed。注意查询里的引号要保留，否则会被当成 OR 拆词。 */
async function searchArxiv(industryEn, { limit }) {
  const terms = `all:"${industryEn}" AND (all:"artificial intelligence" OR all:"machine learning" OR all:"large language model")`;
  const url = new URL('https://export.arxiv.org/api/query');
  url.searchParams.set('search_query', terms);
  url.searchParams.set('max_results', String(limit));
  url.searchParams.set('sortBy', 'submittedDate');
  url.searchParams.set('sortOrder', 'descending');

  const xml = await getWithRetry(url.toString(), { json: false });
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];
  const tag = (s, t) => {
    const m = s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`));
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  };
  return entries.map((e) => {
    const date = tag(e, 'published').slice(0, 10);
    return {
      source: 'arXiv',
      title: tag(e, 'title'),
      date,
      year: Number(date.slice(0, 4)) || null,
      citations: 0, // arXiv 不提供引用数
      authors: [...e.matchAll(/<name>([\s\S]*?)<\/name>/g)].slice(0, 4).map((m) => m[1].trim()),
      venue: 'arXiv 预印本',
      url: tag(e, 'id'),
      isOpenAccess: true,
      abstract: tag(e, 'summary').slice(0, 1200),
    };
  }).filter((p) => p.title);
}

const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9一-龥]+/g, ' ').trim();

/**
 * 并行查两个源，按标题去重后返回。
 * @param {string} industryEn 行业的英文检索词
 * @param {{sinceYear?:number, limit?:number, onEvent?:Function}} opts
 */
export async function fetchPapers(industryEn, { sinceYear = new Date().getFullYear() - 2, limit = 12, onEvent = () => {} } = {}) {
  const [oa, ax] = await Promise.allSettled([
    searchOpenAlex(industryEn, { sinceYear, limit }),
    searchArxiv(industryEn, { limit: Math.ceil(limit / 2) }),
  ]);

  const all = [];
  for (const [name, r] of [['OpenAlex', oa], ['arXiv', ax]]) {
    if (r.status === 'fulfilled') {
      onEvent({ level: 'progress', message: `  ${name}：${r.value.length} 篇`, at: Date.now() });
      all.push(...r.value);
    } else {
      onEvent({ level: 'warn', message: `  ${name} 检索失败：${r.reason?.message ?? r.reason}`, at: Date.now() });
    }
  }

  const seen = new Set();
  const unique = all.filter((p) => {
    const k = normTitle(p.title);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 排序：优先近两年 + 高引用。arXiv 没有引用数，用「新」来补偿，避免被系统性排到最后。
  const nowY = new Date().getFullYear();
  const rank = (p) => {
    const recency = Math.max(0, 3 - (nowY - (p.year ?? nowY)));      // 0–3
    const impact = Math.log10(1 + p.citations) * 2;                   // 0–~6
    const preprintBoost = p.source === 'arXiv' && (p.year ?? 0) >= nowY - 1 ? 2 : 0;
    return recency + impact + preprintBoost;
  };
  unique.sort((a, b) => rank(b) - rank(a));

  return unique.slice(0, limit);
}
