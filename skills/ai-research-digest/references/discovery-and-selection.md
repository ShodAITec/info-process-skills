# Discovery and selection

## 1. Three-layer discovery system

| Layer | Purpose | Typical channels | Treatment |
|---|---|---|---|
| Core sources | Stable high-quality candidate supply | Aeon, Noema, Boston Review, The Point, Public Books, HBR, MIT Sloan, McKinsey, BCG, FT, Bloomberg Opinion, Stratechery, NBER | Enter metadata candidate pool directly |
| Author knowledge base | Follow scholars, investors, entrepreneurs, and analysts across changing platforms | Independent sites, newsletters, Substack, institutional pages | Track by author identity and publication history |
| Open discovery | Find emerging authors, arguments, and topics | Medium, Substack discovery, Hacker News, Reddit, X, Google Scholar, newsletter recommendations | Treat as discovery signals; verify the original source before admission |

Platform presence is not evidence of quality. The 70/20/10 proportions in the product concept are directional discovery emphasis, not final issue quotas.

Use source-driven, author-driven, and topic-driven discovery together. Topics may include philosophy, history, society, culture, organization and management, corporate strategy, accounting and finance, macroeconomics, capital markets, and investment frameworks. Technology-related articles may enter only as published arguments for guided reading; they must not turn the task into technology intelligence, company research, or an employer-specific workstream.

Do not use employer, company, product, drone, robotics, or management-action context from other tasks to prioritize candidates. Discovery and selection must be grounded only in this publication's reader definition, requested scope, and article quality.

At first discovery, normalize the original URL into a canonical URL and create one candidate record with source, discovery timestamp, provisional topic cluster, and stage `discovered`. Update the same record through filtering, full-text verification, full reading, shortlisting, rejection, selection, and publication; do not create duplicate records for tracking parameters or republications.

For every source actually searched, start a source-search record **before** inspecting results: original site/domain (or author channel/open discovery channel), access/search method, query or listing URL, observed time range, search round, visited status, number of visible raw results, number actually opened, number of unique canonical candidates admitted, and inaccessible/unmeasured reason. Distinguish a search targeted at a domain from directly visiting its site. Do not call a source “visited” merely because the domain name occurred in a query. Record the discovery channel separately from the original publisher when they differ. The listed sources are examples, not a closed allowlist; rotate across relevant domains and authors based on scope and publishable articles.

## 2. Candidate funnel and reading depth

| Stage | Target volume | Processing depth |
|---|---:|---|
| Initial candidates | 50-150 | Title, author, source, publication date, URL, and public standfirst only |
| Basic filtering | 20-40 | Abstract or opening, author background, source verification, and initial deduplication |
| Full reading | 10-15 | Complete body, core claims, reasoning, evidence, and claim-evidence record |
| Final selection | 5 by default | Full Chinese guided reading, “另一面”, original link, and final quality check |

Stop discovery after covering all three layers, reaching at least 10 high-quality full-text candidates, and completing 2 consecutive supplemental search rounds with no new high-quality candidate. Also stop at 150 initial candidates. If fewer than 10 remain after the two rounds, continue with those available; do not extend the content period or lower quality unless the user explicitly changes the period.

## 3. Same-issue and cross-issue deduplication

Within the current issue, check exact URL or republication, normalized title, semantic similarity, and underlying claim. Merge republications; when conclusions are substantially the same, keep the piece with stronger originality, evidence, and authority. Preserve two pieces only when they express materially different and useful positions.

Across issues, compare each candidate with prior selections by original URL, normalized title, author, semantic content, and core proposition. Never reselect the same article. Reselect a nearby topic only when it adds substantial new evidence, a new framework, a changed conclusion, or an important opposing view; record what is genuinely new.

If prior issue state is unavailable, continue autonomously and disclose in the final exception note that cross-issue deduplication could not be completed.

## 4. Three-stage selection

### Stage 1: hard admission

Reject when any condition fails: complete full text; confirmed original source; identifiable author and publication date; not an advertisement, brief, or low-quality republication; a complete argument and basic reasoning; publication date within the requested period, except an older article explicitly supplied by the user.

Hard rules cannot be relaxed by editorial judgment.

### Stage 2: AI domain-quality judgment

Do not use mechanical 1-5 anchors, fixed weights, or a universal score threshold. Judge holistically and retain a plain-language reason.

| Domain | Main considerations |
|---|---|
| Humanities | Originality, theoretical depth, explanatory power, cross-domain connection, author credibility |
| Business strategy | Business insight, causal reasoning, case value, transferability, author expertise |
| Finance and economics | Analytical framework, data quality, mechanism explanation, long-term judgment, author credibility |

Domestic-reader relevance does not require the article to discuss China. Ask whether its framework, evidence, or argument helps professional readers in humanities and social sciences, business and management, finance and accounting, investment research, or ideas and culture understand a problem or build longer-term judgment. Do not translate relevance into recommendations for a specific company or management team.

### Stage 3: whole-issue editorial selection

Choose the final set by article value, topic overlap, author/source concentration, viewpoint diversity, domain balance, reading difficulty, and whether the pieces support a coherent editorial preface. Do not enforce category quotas. Keep one piece per underlying topic unless a second piece provides a valuable opposing position.

Retain reasons for full-reading admission, final selection, major rejection, and same-topic tradeoffs.

Record every rejection at the stage where it occurs with a concise structured reason and second-level timestamp. Record cross-issue matches with the historical issue ID. At the end, calculate the funnel from candidate lifecycle records and verify that the selected and published counts match the final issue.

Keep the stage counts and exclusions reconcilable: unique canonical candidates at entry = those passing to the next stage + those rejected at that stage. Assign one primary exclusion reason at the earliest failing stage; secondary tags can be recorded but must not be added again to the excluded total. Show per-site candidate counts, each stage's remaining count, and a mutually exclusive rejection-reason breakdown in the operator appendix. Visible search-result totals may include duplicates and must never be presented as unique candidate counts. If a tool does not expose reliable result totals, use `未记录/不可得` and disclose the coverage gap instead of inferring a complete funnel.
