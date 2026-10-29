/**
 * Markdown → 单文件 HTML。
 * 复用项目统一的配色令牌，明暗双主题，离线可读，无外部依赖。
 */
import { marked } from 'marked';
import { BASE_CSS, PAGE_JS } from './theme.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

marked.setOptions({ gfm: true, breaks: false });

const DOC_CSS = `
.doc { max-width: 1060px; margin: 0 auto; padding: 0 24px 100px; }
.doc-head { padding: 52px 0 26px; border-bottom: 2px solid var(--text-primary); margin-bottom: 34px; }
.doc-head .eyebrow { font-family: var(--mono); font-size: 11.5px; letter-spacing: .16em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 16px; }
.doc-head h1 { font-family: var(--serif); font-size: clamp(26px, 4.6vw, 40px); line-height: 1.18;
  margin: 0 0 14px; letter-spacing: -.01em; text-wrap: balance; }
.doc-head .meta { display: flex; flex-wrap: wrap; gap: 7px 20px; font-size: 12.5px;
  color: var(--text-muted); font-variant-numeric: tabular-nums; }

.layout { display: grid; grid-template-columns: minmax(0,1fr); gap: 40px; align-items: start; }
@media (min-width: 1080px) { .layout { grid-template-columns: minmax(0,1fr) 210px; } .toc { position: sticky; top: 74px; } }
.toc { font-size: 12.5px; line-height: 1.6; max-height: calc(100vh - 100px); overflow-y: auto; }
.toc h4 { font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 10px; }
.toc a { display: block; padding: 4px 0 4px 11px; color: var(--text-muted); text-decoration: none;
  border-left: 2px solid var(--border); transition: color .18s, border-color .18s; }
.toc a:hover, .toc a.active { color: var(--text-primary); border-left-color: var(--accent); }
.toc a.lv3 { padding-left: 22px; font-size: 12px; }

.md h1 { font-family: var(--serif); font-size: clamp(21px,3.2vw,27px); margin: 44px 0 14px;
  padding-bottom: 9px; border-bottom: 1px solid var(--border); scroll-margin-top: 74px; }
.md h1:first-child { margin-top: 0; }
.md h2 { font-family: var(--serif); font-size: 19px; margin: 30px 0 11px; scroll-margin-top: 74px; }
.md h3 { font-size: 16px; margin: 22px 0 8px; scroll-margin-top: 74px; }
.md h4 { font-size: 14.5px; margin: 18px 0 7px; color: var(--text-secondary); }
.md p { font-size: 15.5px; line-height: 1.85; margin: 0 0 14px; }
.md ul, .md ol { margin: 0 0 14px; padding-left: 22px; }
.md li { margin-bottom: 6px; line-height: 1.78; font-size: 15px; }
.md li::marker { color: var(--text-muted); }
.md blockquote { border-left: 3px solid var(--accent); background: var(--surface-1);
  margin: 0 0 16px; padding: 12px 18px; border-radius: 0 var(--radius) var(--radius) 0; }
.md blockquote p { margin: 0 0 7px; font-size: 14.5px; color: var(--text-secondary); }
.md blockquote p:last-child { margin: 0; }
.md code { font-family: var(--mono); font-size: .87em; background: var(--surface-2);
  border: 1px solid var(--border); padding: .08em .34em; border-radius: 3px; word-break: break-word; }
.md pre { background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 16px; overflow-x: auto; margin: 0 0 16px; box-shadow: var(--shadow); }
.md pre code { background: none; border: 0; padding: 0; font-size: 12.8px; line-height: 1.65; white-space: pre; }
.md table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin: 0; }
/* 多列表格宁可横向滚动，也不要把单元格挤成竖排单字 */
.md table { min-width: max-content; }
.md th, .md td { min-width: 6.5em; }
.md .tablewrap { overflow-x: auto; margin: 0 0 16px; border: 1px solid var(--border);
  border-radius: var(--radius); background: var(--surface-1); }
.md th, .md td { text-align: left; padding: 8px 13px; border-bottom: 1px solid var(--border);
  vertical-align: top; overflow-wrap: break-word; }
.md thead th { font-family: var(--mono); font-size: 10.5px; letter-spacing: .07em; text-transform: uppercase;
  color: var(--text-muted); font-weight: 400; background: var(--surface-2); }
.md tbody tr:last-child td { border-bottom: 0; }
.md a { color: var(--accent); text-underline-offset: 2px; word-break: break-word; }
.md hr { border: 0; border-top: 1px solid var(--border); margin: 30px 0; }
/* 编号引用：正文上标 + 文末清单锚点 */
.md .refmark { font-size: .72em; line-height: 0; vertical-align: super; margin: 0 .5px; }
.md .refmark a { color: var(--accent); text-decoration: none; padding: 0 1px; font-variant-numeric: tabular-nums; }
.md .refmark a:hover { text-decoration: underline; }
.md .refmark a:target, .md a.refback:target { background: var(--accent-soft); border-radius: 3px; }
.md a.refback { color: var(--accent); text-decoration: none; font-variant-numeric: tabular-nums;
  font-family: var(--mono); font-size: .92em; }
.md a.refback:hover { text-decoration: underline; }
.md img { max-width: 100%; height: auto; border-radius: var(--radius); border: 1px solid var(--border); }

.runinfo { margin-top: 56px; padding: 18px 22px; border: 1px dashed var(--border-strong);
  border-radius: var(--radius); font-size: 12.5px; line-height: 1.75; color: var(--text-muted); }
.runinfo b { color: var(--text-secondary); }
.runinfo details { margin-top: 9px; }
.runinfo summary { cursor: pointer; color: var(--accent); }
.runinfo ol { margin: 9px 0 0; padding-left: 20px; max-height: 240px; overflow-y: auto; }
.runinfo li { word-break: break-all; margin-bottom: 3px; }
`;

const slugId = (t, i) => `h-${i}-${String(t).toLowerCase().replace(/[^\w一-龥]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)}`;

export function renderMarkdownPage({ markdown, title, skill, meta = {} }) {
  const toc = [];
  const renderer = new marked.Renderer();

  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const plain = text.replace(/<[^>]+>/g, '').trim();
    const id = slugId(plain, toc.length);
    if (depth <= 3) toc.push({ id, text: plain, depth });
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  // 宽表格要能独立横向滚动，否则会把整页撑出横向滚动条
  renderer.table = function (token) {
    const base = marked.Renderer.prototype.table.call(this, token);
    return `<div class="tablewrap">${base}</div>`;
  };

  // 参考清单里相邻的 [N] 行会被 Markdown 合并成一个段落，导致锚点落点不准。
  // 渲染前把每条拆成独立块——这是呈现层的事，原始 Markdown 保持模型写的样子。
  let source = markdown;
  const refAt = source.search(/^#{1,3}\s*(参考来源|参考文献|来源清单|References)\s*$/im);
  if (refAt >= 0) {
    const head = source.slice(0, refAt);
    const tail = source.slice(refAt).replace(/\n(?=\[\d{1,3}\]\s)/g, '\n\n');
    source = head + tail;
  }

  let bodyHtml = marked.parse(source, { renderer });

  // 编号引用：正文 [N] → 可点击上标；参考清单条目加锚点。
  // 只在真的存在「参考来源」小节时才转换，避免把普通的 [1] 文本误伤。
  const hasRefList = /<h[1-3][^>]*>\s*(参考来源|参考文献|来源清单|References)\s*<\/h[1-3]>/i.test(bodyHtml);
  if (hasRefList) {
    const cut = bodyHtml.search(/<h[1-3][^>]*>\s*(参考来源|参考文献|来源清单|References)\s*<\/h[1-3]>/i);
    let head = bodyHtml.slice(0, cut);
    let tail = bodyHtml.slice(cut);

    // 正文标记 → 上标链接。
    // 先收紧空白：模型常写成「…在职 [6][14]。」，直接转换会在标记前后留下视觉空隙。
    head = head
      .replace(/[ \u00a0]+(\[\d{1,3}\])/g, '$1')                 // 标记前的空格
      .replace(/(\[\d{1,3}\])[ \u00a0]+(?=[，。、；：！？）】])/g, '$1'); // 标记与中文标点之间
    head = head.replace(/\[(\d{1,3})\]/g, (_, n) =>
      `<sup class="refmark"><a href="#ref-${n}" id="cite-${n}">[${n}]</a></sup>`);
    // 清单条目 → 锚点 + 回到正文
    tail = tail.replace(/\[(\d{1,3})\]/g, (_, n) =>
      `<a class="refback" id="ref-${n}" href="#cite-${n}">[${n}]</a>`);
    bodyHtml = head + tail;
  }
  const u = meta.usage ?? {};

  return `<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${BASE_CSS}${DOC_CSS}</style>
</head>
<body>
<div class="progress"></div>
<header class="topbar">
  <span class="brand">InfoProcessSkills</span>
  <span>${esc(skill?.name ?? '')}</span>
  <span class="spacer"></span>
  <button class="theme-toggle" data-theme-toggle type="button">明/暗</button>
</header>

<div class="doc">
  <header class="doc-head">
    <div class="eyebrow">${esc(skill?.id ?? 'report')}${skill?.version ? ' · v' + esc(skill.version) : ''}</div>
    <h1>${esc(title)}</h1>
    <div class="meta">
      <span>生成于 ${esc(new Date(meta.generatedAt ?? Date.now()).toLocaleString('zh-CN'))}</span>
      ${meta.provider ? `<span>模型 ${esc(meta.provider.label)}</span>` : ''}
      ${meta.ledger ? `<span>来源 ${meta.ledger.length} 个</span>` : ''}
      ${meta.rounds != null ? `<span>检索 ${meta.rounds} 轮</span>` : ''}
    </div>
  </header>

  <div class="layout">
    <main class="md">${bodyHtml}
      <div class="runinfo">
        <b>运行信息</b>　技能 ${esc(skill?.name ?? '')}${skill?.version ? ' v' + esc(skill.version) : ''}　·
        生成模型 ${esc(meta.provider?.model ?? '—')}　·
        模型调用 ${u.calls ?? 0} 次（输入 ${u.input ?? 0} / 输出 ${u.output ?? 0}${u.reasoning ? ' / 推理 ' + u.reasoning : ''} tokens）　·
        用时 ${Math.round((meta.durationMs ?? 0) / 1000)} 秒<br>
        本报告由自动化系统生成，所有事实性内容请以原文链接为准。
        ${meta.ledger?.length ? `<details><summary>本次检索到的 ${meta.ledger.length} 个来源</summary>
          <ol>${meta.ledger.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>` : ''}
      </div>
    </main>
    ${toc.length > 2 ? `<nav class="toc" aria-label="目录"><h4>目录</h4>
      ${toc.map((t) => `<a class="${t.depth >= 3 ? 'lv3' : ''}" href="#${t.id}">${esc(t.text)}</a>`).join('')}
    </nav>` : ''}
  </div>
</div>

<script>${PAGE_JS}</script>
<script>
// CSS 平滑滚动在部分环境里是空操作，锚点会点不动。
// 统一接管目录与引用标记的跳转，并在探测到没动时回退到瞬时滚动。
// 注意回退必须显式写 behavior:'instant'——html 上的 scroll-behavior:smooth
// 会让不带 behavior 的 scrollTo 一起失效。
(function(){
  var OFFSET=74;   // 吸顶栏高度
  function jump(a){
    var el=document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if(!el) return false;
    try{window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-OFFSET,behavior:'smooth'})}catch(_){}
    if(history.replaceState) history.replaceState(null,'',a.getAttribute('href'));
    // 校正到位，而不是只判断「有没有动」——平滑滚动可能动了一点就停下，
    // 长页面跳到文末引用时实测会差 1200px 以上。两次校正覆盖慢动画的情况。
    function settle(){
      var d=el.getBoundingClientRect().top-OFFSET;
      if(Math.abs(d)>8) window.scrollTo({top:window.scrollY+d,behavior:'instant'});
    }
    setTimeout(settle,340);
    setTimeout(settle,900);
    return true;
  }
  // 目录、正文引用上标、参考清单回链，三处都走同一套逻辑
  document.addEventListener('click',function(e){
    var a=e.target.closest('.toc a[href^="#"], .refmark a[href^="#"], a.refback[href^="#"]');
    if(!a) return;
    if(jump(a)) e.preventDefault();
  });
})();
</script>
</body>
</html>`;
}
