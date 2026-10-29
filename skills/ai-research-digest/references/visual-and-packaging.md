# Visuals and publication packaging

## 1. One article, one attributed image

After full-text verification, select exactly one content-linked image per selected article. First inspect images actually present on its original page (including article illustration, photograph, chart or diagram) and choose the one that best helps explain the article. Check its direct provenance, visible credit and the right to reproduce and redistribute that specific image in both a shareable Markdown package and standalone offline HTML. Keep any copyright notice or watermark intact. An image's mere public visibility, article access, original-page link or photographer attribution does not establish reuse rights; syndication rights for article text do not imply rights to its images. Do not copy a third-party image when rights cannot be confirmed. Record the source page, image locator, credited rights holder and concrete license/permission evidence.

If no relevant original image exists, no permitted original image is available, the credit is unverifiable, or a suitable image cannot be locally acquired, generate one explanatory AI image based on the verified article's arguments. Record which reason triggered fallback. Do not substitute an image from a repost or stock site as if it came from the original article.

For the AI fallback, choose the form by content: a restrained scene illustration for people, family, culture, and social situations; an explanatory infographic for causal, structural, procedural, or institutional relationships; a data chart only for verified quantitative comparisons. Do not use generic stock imagery, decorative title art, invented numbers, unsupported causal arrows or misleading scales. Avoid closely reproducing a protected original illustration's distinctive composition or style.

Prefer little or no text inside generated images. Explain the meaning in the caption. Every visual proposition must map to the article's claim-evidence record.

## 2. Image placement and caption

Place the image inside `文章解读`, after original metadata and before the continuous prose. Use stable portable filenames such as `01_topic.png` and standard relative Markdown:

```markdown
![准确描述图片内容与文章关系的中文替代文本](./images/01_topic.png)

*配图说明：用一至两句话解释图中场景、关键关系或比较，并指出读者应该关注什么。*
```

Add a separate provenance line immediately after each article-specific caption. Use these two patterns:

```markdown
*配图说明：画面呈现……，帮助理解文章关于……的判断。*

*图片来源：原文配图；[{{ORIGINAL_PUBLISHER}} 原文页面]({{ORIGINAL_URL}})；{{CREATOR_CREDIT}}；使用依据：[{{LICENSE_NAME}}]({{LICENSE_URL}})。*
```

```markdown
*配图说明：图中展示……，用于解释文章的……关系。*

*图片来源：AI 根据原文论证生成，非原文配图。*
```

Every caption begins exactly with `配图说明：` and explains the visible scene or relationship in 1–2 sentences. Every provenance line begins exactly with `图片来源：`. For an original image link to the **article's own** original URL (not merely a generic home page), preserve the original credit as printed, and state the checked reuse basis (license name/link or authorization record); never publish template placeholders or write `已授权` without evidence. If credit appears in the image itself, retain it and also write the line. The fixed opening reader notice discloses AI-assisted article content including images; per-image source lines still distinguish reused original artwork from AI-generated images.

## 3. Image quality and compatibility

Each raster file must be no larger than 2 MiB. Preserve native dimensions and high quality when already compliant. If oversized, optimize in this order: strip metadata and losslessly compress → use an efficient high-quality format → slightly reduce quality → reduce dimensions only as a last resort.

Use PNG for line art, small Chinese text, or transparency; use high-quality JPEG or WebP for photographic or painterly illustrations. Verify semantic consistency, alt text, Chinese readability, dimensions, extension/MIME match, file size, relative-path resolution, and Typora rendering.

Do not use Base64 data URIs, absolute paths, transient paths, or remote image dependencies **in Markdown**. The separate offline HTML embeds the same verified local image bytes as Data URIs; never apply the Markdown compatibility ban to that generated file.

## 4. Offline HTML and package layout

Treat the finished Markdown as the editorial source of truth. After finalizing its run appendix, use `node scripts/render_offline_html.mjs /absolute/path/to/issue-directory` to generate the sibling HTML deterministically. Copy every article image into the HTML as a `data:image/...;base64,` URI. In HTML, **never render clickable hyperlinks**: show the linked title or source name as text; on the following separate line print `原文网址：完整URL` for each article's original link and `引用网址：完整URL` for every other external Markdown link (including the appendix, image provenance and references). Long URLs may wrap visually, but their underlying text must be complete and selectable. Internal TOC links become text labels. Do not insert `<a>` or `href` anywhere in HTML. Markdown may retain its existing clickable links. Keep the fixed AI/reader notices prominent, use UTF-8 and inline responsive CSS, and make the operator appendix visibly marked and collapsed by default without omitting its content. Do not load scripts, CDN styles, fonts, remote images, or network-dependent widgets. The standalone HTML remains usable offline; printed external URLs require copying into a browser to visit.

The renderer requires the local `marked` Markdown package. If unavailable, stop and report the missing renderer; never publish an HTML placeholder or bypass the structural checks.

Any correction to Markdown or a local image invalidates the HTML: re-render and revalidate. Keep both formats' text, article sequence, captions and metadata identical; do not maintain a second manually written editorial text. Verify from a local `file://` URL with the network disabled, including mobile-width layout and images when a browser is available. If the browser is unavailable, record that visual inspection was unavailable and rely only on verified structural checks; never label an unperformed visual check as passed.

Deliver one ZIP with exactly one root Markdown, one root HTML, and one sibling `images/` directory:

```text
AI_Research_Digest_YYYY_Www.zip
└── AI_Research_Digest_YYYY_Www/
    ├── AI_Research_Digest_YYYY_Www.md
    ├── AI_Research_Digest_YYYY_Www.html
    └── images/
        ├── 01_topic.png
        └── ...
```

Both documents contain the same reader content and final run appendix; `images/` is needed for Markdown, while HTML is independently portable. Do not create separate reader and operator Markdown files. Finalize Markdown, render HTML, then run `python3 scripts/package_issue.py /absolute/path/to/issue-directory`: it runs the validator, packages exactly the expected members and reads every ZIP member back for a byte-for-byte check. Report its real result at delivery; don't write it into the already frozen appendix.
