/**
 * 模型输出的清洗层。
 *
 * 两类问题在实测中都真实发生过：
 * 1. schema 键名占位符漏进正文——例如卷首语里出现一段内容就是 "paragraphs_note_removed"。
 * 2. 结构化输出并不强制 minItems / maxItems——schema 写了 maxItems: 3，实际返回了 4 条。
 *
 * 所以模型输出在落盘和渲染之前都要过这一层，而不是信任 schema。
 */

/** 形如 foo_bar、paragraphs_note_removed 的 snake_case 标识符：正常中英文行文不会长这样。 */
const PLACEHOLDER = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/i;

export function isPlaceholder(s) {
  return typeof s === 'string' && PLACEHOLDER.test(s.trim());
}

const isUsable = (s) => typeof s === 'string' && s.trim() !== '' && !isPlaceholder(s);

/** 过滤字符串数组：去掉空串与占位符，并按上限截断。 */
function cleanList(value, max, path, drop) {
  const arr = Array.isArray(value) ? value : [];
  const kept = [];
  for (const item of arr) {
    if (!isUsable(item)) { drop(`${path}: 丢弃无效条目 ${JSON.stringify(String(item).slice(0, 40))}`); continue; }
    kept.push(item.trim());
  }
  if (max && kept.length > max) {
    drop(`${path}: 超出上限 ${max}，截断 ${kept.length - max} 条`);
    kept.length = max;
  }
  return kept;
}

/** 清洗标量：不可用时返回 fallback。 */
function cleanText(value, path, drop, fallback = '') {
  if (isUsable(value)) return value.trim();
  if (typeof value === 'string' && value.trim() !== '') {
    drop(`${path}: 丢弃无效值 ${JSON.stringify(value.slice(0, 40))}`);
  }
  return fallback;
}

/**
 * @param {object} article 模型返回的文章对象
 * @param {{sourceTitle?: string}} ctx 兜底用的原文信息
 * @param {(msg: string) => void} [onDrop] 每丢弃一处调用一次
 * @returns {{article: object, dropped: string[]}}
 */
export function sanitizeArticle(article, ctx = {}, onDrop) {
  const dropped = [];
  const drop = (m) => { dropped.push(m); onDrop?.(m); };
  const a = { ...article };

  a.title = cleanText(a.title, 'title', drop, ctx.sourceTitle || '（标题缺失）');
  a.subtitle = cleanText(a.subtitle, 'subtitle', drop);
  a.dek = cleanText(a.dek, 'dek', drop);
  a.fidelity_note = cleanText(a.fidelity_note, 'fidelity_note', drop);

  a.topic_tags = cleanList(a.topic_tags, 5, 'topic_tags', drop);
  a.tldr = cleanList(a.tldr, 5, 'tldr', drop);
  a.context = cleanList(a.context, 3, 'context', drop);
  a.counterpoints = cleanList(a.counterpoints, 4, 'counterpoints', drop);
  a.takeaway = cleanList(a.takeaway, 2, 'takeaway', drop);

  a.sections = (Array.isArray(a.sections) ? a.sections : [])
    .map((s, i) => ({
      ...s,
      heading: cleanText(s.heading, `sections[${i}].heading`, drop),
      paragraphs: cleanList(s.paragraphs, 6, `sections[${i}].paragraphs`, drop),
      highlight: cleanText(s.highlight, `sections[${i}].highlight`, drop),
    }))
    .filter((s, i) => {
      if (s.heading && s.paragraphs.length) return true;
      drop(`sections[${i}]: 整节丢弃（标题或正文为空）`);
      return false;
    })
    .slice(0, 8);

  a.numbers = (Array.isArray(a.numbers) ? a.numbers : [])
    .map((n, i) => ({
      value: cleanText(n.value, `numbers[${i}].value`, drop),
      label: cleanText(n.label, `numbers[${i}].label`, drop),
      note: cleanText(n.note, `numbers[${i}].note`, drop),
    }))
    .filter((n) => n.value && n.label)
    .slice(0, 4);

  a.glossary = (Array.isArray(a.glossary) ? a.glossary : [])
    .map((g, i) => ({
      // term 是英文原词，允许出现下划线，不做占位符判定
      term: typeof g.term === 'string' ? g.term.trim() : '',
      zh: cleanText(g.zh, `glossary[${i}].zh`, drop),
      explain: cleanText(g.explain, `glossary[${i}].explain`, drop),
    }))
    .filter((g) => g.term && g.zh && g.explain)
    .slice(0, 6);

  a.chart = sanitizeChart(a.chart, drop);

  return { article: a, dropped };
}

function sanitizeChart(chart, drop) {
  const none = { kind: 'none', title: '', unit: '', note: '', series_label: '', points: [] };
  if (!chart || typeof chart !== 'object') return none;
  if (!['bar', 'line', 'donut'].includes(chart.kind)) return none;

  const points = (Array.isArray(chart.points) ? chart.points : [])
    .filter((p) => p && Number.isFinite(p.value) && isUsable(p.label))
    .map((p) => ({ label: String(p.label).trim(), value: p.value }))
    .slice(0, 12);

  if (points.length < 2) {
    drop('chart: 有效数据点不足 2 个，改为不出图');
    return none;
  }
  return {
    kind: chart.kind,
    title: cleanText(chart.title, 'chart.title', drop),
    unit: typeof chart.unit === 'string' ? chart.unit.trim() : '',
    note: cleanText(chart.note, 'chart.note', drop),
    series_label: cleanText(chart.series_label, 'chart.series_label', drop, '项目'),
    points,
  };
}

/**
 * @returns {{editorial: object|null, dropped: string[]}} 段落全被丢光时返回 null
 */
export function sanitizeEditorial(editorial, onDrop) {
  const dropped = [];
  const drop = (m) => { dropped.push(m); onDrop?.(m); };
  if (!editorial || typeof editorial !== 'object') return { editorial: null, dropped };

  const out = {
    headline: cleanText(editorial.headline, 'editorial.headline', drop),
    paragraphs: cleanList(editorial.paragraphs, 3, 'editorial.paragraphs', drop),
    thread: cleanText(editorial.thread, 'editorial.thread', drop),
  };
  if (!out.paragraphs.length) {
    drop('editorial: 段落全部无效，本期不出卷首语');
    return { editorial: null, dropped };
  }
  return { editorial: out, dropped };
}
