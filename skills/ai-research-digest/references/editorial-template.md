# Editorial structure and writing

## 1. Publication opening

Name the Markdown `AI_Research_Digest_YYYY_Www.md` using the ISO week; use `他山见闻｜YYYY 年第 WW 周刊` as its reader-facing H1. The internal ASCII file slug is retained for compatibility. Immediately below the H1 reproduce this single block exactly:

```markdown
> 阅读说明：本期文章**内容（含配图）由 AI 辅助生成，并**经过编辑加工和校验。周刊仅提供中文导读与评论，不直接翻译原文，作者观点以原文为准。
```

Then state the content period and `撰文时间` (the original writing/freeze time, to the second in UTC+8), selected article count, domains, and target readers. Do not display a separate `检索截止` row in reader-facing metadata: record the actual retrieval cutoff in the operator appendix. Do not label an HTML re-render time as the writing time; record a later format revision separately in the appendix. The period end must not be later than the last successful retrieval time. If using completed natural days, end at the previous local day `23:59:59` and say so.

## 2. Whole-issue structure

Use this order: publication opening and metadata → 卷首语 → 本期核心观察 → 目录 → dynamically named editorial sections and articles → 关于本周刊 → 附录｜Skill 系统运行记录.

The preface identifies the shared question connecting the selected pieces. `本期核心观察` contains 2–4 issue-level findings derived from multiple articles and names convergence, disagreement, progression, or tension; it must not repeat five abstracts. Create sections from the material rather than forcing every default domain to appear.

## 3. Article structure

Each article uses this outer shell:

```markdown
### 1. 中文编辑标题

> **一句话推荐：** 文章讨论什么，以及为什么值得读。

#### 文章解读

- **原文：** [Original title](direct-original-url)
- **作者：** 中英文名
- **作者背景：** 与本文判断相关的简要身份
- **来源：** 原始发布机构或作者站点
- **发布日期：** YYYY-MM-DD

![准确的中文替代文本](./images/01_topic.png)

*配图说明：解释图中场景、关键关系或比较，并指出它如何帮助理解文章。*

连续编辑导读，共 2–4 个自然段。

#### 另一面

1. 证据、假设或方法的具体限制。
2. 重要反方观点、其他解释或适用边界。
```

Within the continuous prose, default to author judgment → argument construction → decisive evidence → value to the intended domestic professional readers. This is an information order, not four visible headings. Adapt it when the article form requires, but do not omit the core judgment, reasoning, evidence, or reading value.

The Chinese headline should express the article's central judgment, tension, or question rather than mechanically translate the original. The recommendation sentence explains why the piece is worth reading rather than repeating its abstract. Preserve attribution with wording such as “作者认为”“文章引用”“编辑补充”“由此可以推断”.

`另一面` contains 2–3 concrete limitations, alternative explanations, or unresolved questions. Do not manufacture criticism or write a second rebuttal essay.

## 4. Length and Chinese style

| Component | Target |
| --- | ---: |
| Preface | 250–350 Chinese characters |
| Cross-article observations | 2–4 observations; 300–500 characters total |
| Chinese headline | Preferably ≤30 Chinese characters |
| Recommendation sentence | 40–80 Chinese characters |
| Complete article reader content | Normally 1,000–1,300; complex pieces ≤1,500 |
| Default five-article reader body | 7,000–8,500 Chinese characters |

For an article count the recommendation, continuous prose, and `另一面`; exclude metadata, image syntax, and caption. For the issue count the preface, core observations, and all article reader content; exclude contents, metadata, images, captions, and the run appendix.

Write accurate, restrained, natural Chinese without translationese or unsupported elevation. Introduce Chinese-English pairs only when a technical term benefits from them. Use tables only for genuine comparisons. Length is a guardrail, not a padding target; preserve decisive evidence and record defensible exceptions in the appendix.

For all bold labels, leave one space after the closing `**`, including an original-title link (for example, `**原文：** [Title](URL)`). The renderer preserves compatibility with legacy link-adjacent labels; the validator checks the finished HTML for visible literal `**`.
