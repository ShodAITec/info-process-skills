/**
 * 服务端生成内联 SVG 图表 —— 不依赖任何前端图表库，页面完全自包含。
 * 色板取自已通过 CVD/对比度校验的分类色序（blue → orange → aqua → yellow → magenta → green）。
 */

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 同一个系列里的数字要用同一种小数位，否则会出现 "7" 和 "3.90" 并排的难看情况。
 * 小数位由整组数据里最"细"的那个决定，最多 2 位。
 */
function makeFormatter(values) {
  const finite = values.filter(Number.isFinite);
  const maxAbs = Math.max(...finite.map(Math.abs), 0);
  const scale = maxAbs >= 1e9 ? [1e9, 'B'] : maxAbs >= 1e6 ? [1e6, 'M'] : maxAbs >= 1e4 ? [1e3, 'K'] : [1, ''];
  const decimals = finite.every((v) => Number.isInteger(v / scale[0]))
    ? 0
    : finite.some((v) => Math.abs((v / scale[0]) * 10) % 1 > 1e-9) ? 2 : 1;
  return (n) => `${(n / scale[0]).toFixed(decimals)}${scale[1]}`;
}

/** 单个数字的通用格式（图例、合计等不属于某个系列的场合）。 */
const fmt = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(abs < 10 ? 2 : 1);
};

/** 把一个粗略步长吸附到 1/2/2.5/5 × 10^k。 */
function niceStep(rough) {
  if (!(rough > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].find((m) => m * base >= rough - 1e-12) * base;
}

/** 轴上限对齐到刻度步长，保证最高的一条网格线正好是轴顶，柱子不会顶出网格。 */
function niceMax(max, count = 4) {
  if (!(max > 0)) return 1;
  const step = niceStep(max / count);
  return Math.ceil(max / step - 1e-9) * step;
}

/**
 * @param {{kind:'bar'|'line'|'donut'|'none', title:string, unit:string, note:string, series_label:string, points:{label:string,value:number}[]}} chart
 * @returns {string} HTML 片段（figure），或空字符串
 */
export function renderChart(chart, { id = 'chart' } = {}) {
  if (!chart || chart.kind === 'none') return '';
  const points = (chart.points || []).filter((p) => Number.isFinite(p.value));
  if (points.length < 2) return '';

  const body =
    chart.kind === 'donut' ? donut(points, chart, id)
    : chart.kind === 'line' ? line(points, chart, id)
    : bar(points, chart, id);

  return `
<figure class="viz-root chart" id="${esc(id)}">
  <figcaption class="chart-head">
    <span class="chart-title">${esc(chart.title)}</span>
    ${chart.unit ? `<span class="chart-unit">单位：${esc(chart.unit)}</span>` : ''}
  </figcaption>
  <div class="chart-body" data-chart>${body}<div class="chart-tip" hidden></div></div>
  ${chart.note ? `<p class="chart-note">${esc(chart.note)}</p>` : ''}
  <details class="chart-table">
    <summary>查看数据表</summary>
    <table>
      <thead><tr><th scope="col">${esc(chart.series_label || '项目')}</th><th scope="col">数值${chart.unit ? `（${esc(chart.unit)}）` : ''}</th></tr></thead>
      <tbody>${(() => { const f = makeFormatter(points.map((q) => q.value)); return points.map((p) => `<tr><th scope="row">${esc(p.label)}</th><td>${esc(f(p.value))}</td></tr>`).join(''); })()}</tbody>
    </table>
  </details>
</figure>`;
}

/* ---------------------------------- 柱状图 ---------------------------------- */
function bar(points, chart, id) {
  const W = 720, H = 360;
  const m = { top: 24, right: 20, bottom: 56, left: 56 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const f = makeFormatter(points.map((p) => p.value));
  const hasNeg = points.some((p) => p.value < 0);
  const max = niceMax(Math.max(...points.map((p) => Math.abs(p.value))));
  const min = hasNeg ? -max : 0;
  const y = (v) => m.top + ih - ((v - min) / (max - min)) * ih;
  const zeroY = y(0);

  const slot = iw / points.length;
  const gap = 2;                                   // 2px 表面间隙
  const bw = Math.min(52, Math.max(8, slot - 18));
  const r = 4;                                     // 4px 圆角数据端

  const ticks = gridTicks(min, max, 4);
  const grid = ticks.map((t) => `
    <line class="grid" x1="${m.left}" x2="${m.left + iw}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
    <text class="tick" x="${m.left - 10}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${esc(f(t))}</text>`).join('');

  // 标签太密时只标首尾与极值
  const labelEvery = points.length > 8 ? Math.ceil(points.length / 6) : 1;
  const peak = points.reduce((a, p, i) => (Math.abs(p.value) > Math.abs(points[a].value) ? i : a), 0);

  const bars = points.map((p, i) => {
    const cx = m.left + slot * i + slot / 2;
    const x = cx - bw / 2 + gap / 2;
    const w = bw - gap;
    const top = p.value >= 0 ? y(p.value) : zeroY;
    const h = Math.max(2, Math.abs(zeroY - y(p.value)));
    const showLabel = i === 0 || i === points.length - 1 || i === peak || i % labelEvery === 0;
    return `<g class="mark${p.muted ? ' muted' : ''}" tabindex="0" data-label="${esc(p.label)}" data-value="${esc(f(p.value))}${esc(chart.unit || '')}">
      <rect class="hit" x="${(cx - slot / 2).toFixed(1)}" y="${m.top}" width="${slot.toFixed(1)}" height="${ih}"/>
      <path class="bar" d="${roundedBar(x, top, w, h, r, p.value >= 0)}" style="--i:${i}"/>
      ${showLabel ? `<text class="value" x="${cx.toFixed(1)}" y="${(p.value >= 0 ? top - 8 : top + h + 15).toFixed(1)}" text-anchor="middle">${esc(f(p.value))}</text>` : ''}
      <text class="axis" x="${cx.toFixed(1)}" y="${(m.top + ih + 22).toFixed(1)}" text-anchor="middle">${esc(truncate(p.label, 8))}</text>
    </g>`;
  }).join('');

  return svg(W, H, chart.title, `
    ${grid}
    ${hasNeg ? `<line class="axis-line" x1="${m.left}" x2="${m.left + iw}" y1="${zeroY.toFixed(1)}" y2="${zeroY.toFixed(1)}"/>` : ''}
    <line class="axis-line" x1="${m.left}" x2="${m.left + iw}" y1="${m.top + ih}" y2="${m.top + ih}"/>
    ${bars}`);
}

function roundedBar(x, y, w, h, r, up) {
  const rr = Math.min(r, w / 2, h);
  return up
    ? `M${x} ${y + h} L${x} ${y + rr} Q${x} ${y} ${x + rr} ${y} L${x + w - rr} ${y} Q${x + w} ${y} ${x + w} ${y + rr} L${x + w} ${y + h} Z`
    : `M${x} ${y} L${x} ${y + h - rr} Q${x} ${y + h} ${x + rr} ${y + h} L${x + w - rr} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - rr} L${x + w} ${y} Z`;
}

/* ---------------------------------- 折线图 ---------------------------------- */
function line(points, chart) {
  const W = 720, H = 360;
  const m = { top: 24, right: 28, bottom: 56, left: 56 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const f = makeFormatter(points.map((p) => p.value));
  const vals = points.map((p) => p.value);
  const rawMin = Math.min(...vals), rawMax = Math.max(...vals);
  const pad = (rawMax - rawMin) * 0.15 || Math.abs(rawMax) * 0.1 || 1;
  const min = rawMin >= 0 && rawMin - pad < 0 ? 0 : rawMin - pad;
  const max = rawMax + pad;
  const x = (i) => m.left + (points.length === 1 ? iw / 2 : (iw * i) / (points.length - 1));
  const y = (v) => m.top + ih - ((v - min) / (max - min || 1)) * ih;

  const ticks = gridTicks(min, max, 4);
  const grid = ticks.map((t) => `
    <line class="grid" x1="${m.left}" x2="${m.left + iw}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
    <text class="tick" x="${m.left - 10}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${esc(f(t))}</text>`).join('');

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)} ${(m.top + ih).toFixed(1)} L${x(0).toFixed(1)} ${(m.top + ih).toFixed(1)} Z`;

  const labelEvery = points.length > 8 ? Math.ceil(points.length / 6) : 1;
  const marks = points.map((p, i) => {
    const showLabel = i === 0 || i === points.length - 1;
    return `<g class="mark" tabindex="0" data-label="${esc(p.label)}" data-value="${esc(f(p.value))}${esc(chart.unit || '')}">
      <rect class="hit" x="${(x(i) - iw / points.length / 2).toFixed(1)}" y="${m.top}" width="${(iw / points.length).toFixed(1)}" height="${ih}"/>
      <circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="4.5" style="--i:${i}"/>
      ${showLabel ? `<text class="value" x="${x(i).toFixed(1)}" y="${(y(p.value) - 12).toFixed(1)}" text-anchor="${i === 0 ? 'start' : 'end'}">${esc(f(p.value))}</text>` : ''}
      ${i % labelEvery === 0 || i === points.length - 1 ? `<text class="axis" x="${x(i).toFixed(1)}" y="${(m.top + ih + 22).toFixed(1)}" text-anchor="middle">${esc(truncate(p.label, 8))}</text>` : ''}
    </g>`;
  }).join('');

  return svg(W, H, chart.title, `
    <defs><linearGradient id="lineFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--series-1)" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="var(--series-1)" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <line class="axis-line" x1="${m.left}" x2="${m.left + iw}" y1="${m.top + ih}" y2="${m.top + ih}"/>
    <path class="area" d="${area}"/>
    <path class="line" d="${d}"/>
    ${marks}`);
}

/* ---------------------------------- 环形图 ---------------------------------- */
function donut(points, chart) {
  const W = 720, H = 360;
  const cx = 250, cy = H / 2, R = 118, r0 = 74;
  const total = points.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  const gapDeg = 1.6; // ≈2px 表面间隙

  let angle = -90;
  const slices = points.slice(0, 6).map((p, i) => {
    const sweep = (Math.max(0, p.value) / total) * 360;
    const a0 = angle + gapDeg / 2;
    const a1 = angle + sweep - gapDeg / 2;
    angle += sweep;
    if (a1 <= a0) return '';
    return `<g class="mark" tabindex="0" data-label="${esc(p.label)}" data-value="${esc(fmt(p.value))}${esc(chart.unit || '')} · ${((p.value / total) * 100).toFixed(1)}%">
      <path class="slice" d="${arcPath(cx, cy, R, r0, a0, a1)}" style="fill:${SERIES[i % SERIES.length]};--i:${i}"/>
    </g>`;
  }).join('');

  const legend = points.slice(0, 6).map((p, i) => {
    const pct = ((Math.max(0, p.value) / total) * 100).toFixed(1);
    return `<g transform="translate(430 ${cy - points.length * 15 + i * 30})">
      <rect class="swatch" x="0" y="-9" width="12" height="12" rx="3" style="fill:${SERIES[i % SERIES.length]}"/>
      <text class="legend-label" x="20" y="0">${esc(truncate(p.label, 12))}</text>
      <text class="legend-value" x="20" y="17">${esc(fmt(p.value))}${esc(chart.unit || '')} · ${pct}%</text>
    </g>`;
  }).join('');

  return svg(W, H, chart.title, `
    ${slices}
    <text class="donut-total" x="${cx}" y="${cy - 2}" text-anchor="middle">${esc(fmt(total))}</text>
    <text class="donut-total-label" x="${cx}" y="${cy + 20}" text-anchor="middle">合计</text>
    ${legend}`);
}

function arcPath(cx, cy, R, r0, a0, a1) {
  const p = (rad, deg) => {
    const t = (deg * Math.PI) / 180;
    return [(cx + rad * Math.cos(t)).toFixed(2), (cy + rad * Math.sin(t)).toFixed(2)];
  };
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1);
  const [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

/* ---------------------------------- 公共 ---------------------------------- */
/**
 * 刻度落在 1/2/2.5/5 × 10^k 的整数倍上，避免出现 5.63、3.75 这种读数。
 * 返回的刻度可能略微超出 [min, max]，调用方按实际域裁剪。
 */
function gridTicks(min, max, count) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const step = niceStep(span / count);
  const first = Math.ceil(min / step - 1e-9) * step;
  const ticks = [];
  for (let v = first; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks.length >= 2 ? ticks : [min, max];
}

function truncate(s, n) {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

function svg(W, H, title, inner) {
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

/** 迷你条形图：用于首页排行，无坐标轴。 */
export function sparkBars(values, { width = 96, height = 22 } = {}) {
  const max = Math.max(...values, 1);
  const bw = width / values.length;
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" aria-hidden="true">${values
    .map((v, i) => {
      const h = Math.max(2, (v / max) * height);
      return `<rect x="${(i * bw + 0.5).toFixed(1)}" y="${(height - h).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`;
    })
    .join('')}</svg>`;
}
