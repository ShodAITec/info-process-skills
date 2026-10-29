/** 页面共用的样式与脚本，全部内联，保证生成的 HTML 可离线单文件打开。 */

export const BASE_CSS = `
:root {
  color-scheme: light;
  --bg: #fbfaf7;
  --surface-1: #ffffff;
  --surface-2: #f4f2ed;
  --surface-3: #ebe8e1;
  --border: #e2ded4;
  --border-strong: #cfcabd;
  --text-primary: #16150f;
  --text-secondary: #55524a;
  --text-muted: #858175;
  --accent: #b4451f;
  --accent-soft: #fbeee7;
  --series-1: #2a78d6;
  --series-2: #eb6834;
  --series-3: #1baf7a;
  --series-4: #eda100;
  --series-5: #e87ba4;
  --series-6: #008300;
  --shadow: 0 1px 2px rgba(20,18,12,.05), 0 8px 24px -12px rgba(20,18,12,.16);
  --radius: 14px;
  --serif: "Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", "Georgia", serif;
  --sans: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB",
          "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #131311;
    --surface-1: #1a1a19;
    --surface-2: #212120;
    --surface-3: #2b2b29;
    --border: #33332f;
    --border-strong: #4a4a45;
    --text-primary: #f6f5f0;
    --text-secondary: #c3c2b7;
    --text-muted: #8e8d83;
    --accent: #f0805a;
    --accent-soft: #2a1a13;
    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
    --series-4: #c98500;
    --series-5: #d55181;
    --series-6: #008300;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 28px -14px rgba(0,0,0,.7);
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #131311;
  --surface-1: #1a1a19;
  --surface-2: #212120;
  --surface-3: #2b2b29;
  --border: #33332f;
  --border-strong: #4a4a45;
  --text-primary: #f6f5f0;
  --text-secondary: #c3c2b7;
  --text-muted: #8e8d83;
  --accent: #f0805a;
  --accent-soft: #2a1a13;
  --series-1: #3987e5;
  --series-2: #d95926;
  --series-3: #199e70;
  --series-4: #c98500;
  --series-5: #d55181;
  --series-6: #008300;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 28px -14px rgba(0,0,0,.7);
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text-primary);
  font-family: var(--sans);
  font-size: 17px;
  line-height: 1.5;
  overflow-x: hidden;
}
a { color: inherit; }
img { max-width: 100%; height: auto; display: block; }
h1, h2, h3 { line-height: 1.25; margin: 0; font-weight: 700; letter-spacing: -.01em; }

/* 阅读进度条 */
.progress {
  position: fixed; inset: 0 auto auto 0; height: 3px; width: 100%;
  transform: scaleX(0); transform-origin: 0 50%;
  background: var(--accent); z-index: 60; will-change: transform;
}

/* 顶栏 */
.topbar {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: 16px;
  padding: 10px max(20px, calc(50vw - 560px));
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: saturate(1.6) blur(12px);
  border-bottom: 1px solid var(--border);
  font-size: 13px; color: var(--text-secondary);
}
.topbar .brand { font-weight: 700; color: var(--text-primary); letter-spacing: .02em; }
.topbar .spacer { flex: 1; }
.topbar a { text-decoration: none; }
.topbar a:hover { color: var(--accent); }
.theme-toggle {
  border: 1px solid var(--border); background: var(--surface-1); color: var(--text-secondary);
  border-radius: 999px; padding: 4px 12px; font: inherit; font-size: 12px; cursor: pointer;
}
.theme-toggle:hover { border-color: var(--border-strong); color: var(--text-primary); }

.wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px 96px; }
.col { max-width: 720px; margin: 0 auto; }

/* 逐段淡入 */
.reveal { opacity: 0; transform: translateY(14px); transition: opacity .6s ease, transform .6s cubic-bezier(.2,.7,.3,1); }
.reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
  html { scroll-behavior: auto; }
}

.tag {
  display: inline-block; padding: 3px 10px; border-radius: 999px;
  background: var(--surface-2); border: 1px solid var(--border);
  font-size: 12px; color: var(--text-secondary); letter-spacing: .02em;
}
.tag.accent { background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--accent); }

footer.site {
  border-top: 1px solid var(--border); margin-top: 64px; padding-top: 24px;
  font-size: 13px; color: var(--text-muted); line-height: 1.7;
}
`;

export const CHART_CSS = `
.chart { margin: 36px 0; padding: 20px 20px 12px; background: var(--surface-1);
  border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
.chart-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.chart-title { font-weight: 700; font-size: 15px; }
.chart-unit { font-size: 12px; color: var(--text-muted); }
.chart-body { position: relative; }
.chart-body svg { width: 100%; height: auto; overflow: visible; }
.chart .grid { stroke: var(--border); stroke-width: 1; }
.chart .axis-line { stroke: var(--border-strong); stroke-width: 1; }
.chart .tick, .chart .axis { fill: var(--text-muted); font-size: 11px; font-family: var(--sans); }
.chart .value { fill: var(--text-secondary); font-size: 11.5px; font-weight: 600; font-family: var(--sans); }
.chart .legend-label { fill: var(--text-primary); font-size: 13px; font-family: var(--sans); }
.chart .legend-value { fill: var(--text-muted); font-size: 11.5px; font-family: var(--sans); }
.chart .donut-total { fill: var(--text-primary); font-size: 26px; font-weight: 700; font-family: var(--sans); }
.chart .donut-total-label { fill: var(--text-muted); font-size: 11px; font-family: var(--sans); }
.chart .hit { fill: transparent; }
.chart .bar { fill: var(--series-1); transform-origin: center bottom;
  animation: growY .7s cubic-bezier(.2,.8,.3,1) both; animation-delay: calc(var(--i) * 55ms); }
.chart .line { fill: none; stroke: var(--series-1); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;
  stroke-dasharray: 2400; stroke-dashoffset: 2400; animation: draw 1.5s cubic-bezier(.4,0,.2,1) .1s forwards; }
.chart .area { fill: url(#lineFade); opacity: 0; animation: fadeIn .8s ease .7s forwards; }
.chart .dot { fill: var(--series-1); stroke: var(--surface-1); stroke-width: 2;
  opacity: 0; animation: fadeIn .3s ease both; animation-delay: calc(600ms + var(--i) * 60ms); }
.chart .slice { stroke: var(--surface-1); stroke-width: 2; transform-origin: 250px 180px;
  animation: popIn .55s cubic-bezier(.2,.8,.3,1) both; animation-delay: calc(var(--i) * 80ms); }
.chart .mark { cursor: default; }
/* 同一系列内的"非焦点项"：只降不透明度，不换色，避免把强调误读成另一个类别 */
.chart .mark.muted .bar { opacity: .38; }
.chart .mark.muted .value, .chart .mark.muted .axis { opacity: .7; }
.chart .mark.muted:hover .bar { opacity: .6; }
.chart .mark:hover .bar, .chart .mark:focus-visible .bar,
.chart .mark:hover .slice, .chart .mark:focus-visible .slice { filter: brightness(1.12); }
.chart .mark:hover .dot, .chart .mark:focus-visible .dot { r: 6; }
.chart .mark:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@keyframes growY { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes fadeIn { to { opacity: 1; } }
@keyframes popIn { from { transform: scale(.82); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .chart .bar, .chart .line, .chart .area, .chart .dot, .chart .slice { animation: none; opacity: 1; stroke-dashoffset: 0; transform: none; }
}
.chart-tip {
  position: absolute; pointer-events: none; z-index: 5;
  background: var(--text-primary); color: var(--bg);
  padding: 6px 10px; border-radius: 8px; font-size: 12px; line-height: 1.4;
  white-space: nowrap; box-shadow: 0 4px 16px -4px rgba(0,0,0,.4); transform: translate(-50%, -130%);
}
.chart-tip b { display: block; font-size: 13px; }
.chart-note { margin: 12px 0 0; font-size: 12px; color: var(--text-muted); line-height: 1.6; }
.chart-table { margin-top: 10px; font-size: 13px; }
.chart-table summary { cursor: pointer; color: var(--text-muted); font-size: 12px; padding: 4px 0; }
.chart-table table { width: 100%; border-collapse: collapse; margin-top: 8px; }
.chart-table th, .chart-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); font-weight: 400; }
.chart-table thead th { color: var(--text-muted); font-size: 12px; }
.chart-table td { text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; }
`;

export const PAGE_JS = `
(function () {
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem('sp-theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) {}

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var isDark = root.getAttribute('data-theme') === 'dark' ||
      (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    var next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('sp-theme', next); } catch (e2) {}
  });

  // 阅读进度
  var bar = document.querySelector('.progress');
  if (bar) {
    var tick = function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
    };
    addEventListener('scroll', tick, { passive: true });
    addEventListener('resize', tick);
    tick();
  }

  // 逐段淡入
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      reveals.forEach(function (el) { io.observe(el); });
    }
  }

  // 目录高亮
  var links = [].slice.call(document.querySelectorAll('.toc a[href^="#"]'));
  if (links.length && 'IntersectionObserver' in window) {
    var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    targets.forEach(function (t) { spy.observe(t); });
  }

  // 数字滚动
  var nums = document.querySelectorAll('[data-countup]');
  if (nums.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        nio.unobserve(en.target);
        var el = en.target, full = el.textContent;
        var m = full.match(/-?[\\d.,]+/);
        if (!m) return;
        var target = parseFloat(m[0].replace(/,/g, ''));
        if (!isFinite(target)) return;
        var dec = (m[0].split('.')[1] || '').length, t0 = performance.now();
        (function step(t) {
          var k = Math.min(1, (t - t0) / 900);
          var e = 1 - Math.pow(1 - k, 3);
          el.textContent = full.replace(m[0], (target * e).toFixed(dec));
          if (k < 1) requestAnimationFrame(step);
          else el.textContent = full;
        })(t0);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { nio.observe(n); });
  }

  // 图表 tooltip
  document.querySelectorAll('[data-chart]').forEach(function (box) {
    var tip = box.querySelector('.chart-tip');
    if (!tip) return;
    var show = function (mark, ev) {
      tip.innerHTML = '<b>' + (mark.dataset.value || '') + '</b>' + (mark.dataset.label || '');
      tip.hidden = false;
      var r = box.getBoundingClientRect();
      var b = (ev && ev.clientX != null)
        ? { x: ev.clientX, y: ev.clientY }
        : (function () { var mr = mark.getBoundingClientRect(); return { x: mr.left + mr.width / 2, y: mr.top }; })();
      tip.style.left = Math.max(48, Math.min(r.width - 48, b.x - r.left)) + 'px';
      tip.style.top = Math.max(24, b.y - r.top) + 'px';
    };
    box.addEventListener('pointermove', function (e) {
      var mark = e.target.closest('.mark');
      if (mark) show(mark, e); else tip.hidden = true;
    });
    box.addEventListener('pointerleave', function () { tip.hidden = true; });
    box.addEventListener('focusin', function (e) {
      var mark = e.target.closest('.mark');
      if (mark) show(mark, null);
    });
    box.addEventListener('focusout', function () { tip.hidden = true; });
  });
})();
`;
