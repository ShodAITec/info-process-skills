# Run state, appendix, and debugging records

## 1. Persistent records

Use implementation-neutral storage. JSON, tables, or a database are all acceptable.

| Record | Minimum fields |
| --- | --- |
| Source | `source_name`, `source_url`, `domain`, `language`, `source_tier`, `access_type`, `trust_notes`, `update_frequency`, `status`, `last_reviewed_at` |
| Author | `author_name`, `alternate_names`, `affiliation`, `expertise`, `channels`, `topic_tags`, `historical_quality_notes`, `credibility_notes`, `tracking_status`, `last_reviewed_at` |
| Issue history | `issue_id`, ISO year/week, content period, generated time, package name, selected articles, domains, material exceptions |
| Skill run | run identity and version, start/completion time, timezone, requested/actual period, retrieval cutoff, reader, requested/delivered count, candidate IDs and stage counts, character counts, AI-disclosure check, visual summary, Markdown/HTML consistency and offline checks, exceptions, output package |
| Source search | `source_name`, original domain, discovery channel, layer, search/listing URL or query, round, search time, direct-site-visit status, raw visible results count or unavailable reason, opened count or unavailable reason, unique canonical candidate IDs, access failure |

For every published article, issue history retains at least canonical URL, normalized title, author, source, date, core propositions, topic tags, and issue ID for cross-issue deduplication.

## 2. Candidate lifecycle

Maintain one candidate per canonical URL from first discovery. Minimum information includes metadata, discovery time, domain/topic/cluster, processing stage and stage time, full-text status, core propositions, decision and reason, rejection stage/reason/time, exception type, cross-issue match, visual record, and issue ID.

Recommended lifecycle: `discovered → metadata_filtered → fulltext_verified → fully_read → shortlisted → selected / rejected → published`.

The visual record includes type (`original` or `ai_generated`), original article URL, original-image URL and credit when available, relevance assessment, reuse permission/license reference and checked time for an original image, or the exact absence/rights/access reason triggering AI fallback; also caption, provenance line, alt text, mapped claims/evidence locators, relative asset path, MIME, dimensions, bytes, quality adjustment, path check, render status and check time. Never record `permission_verified` without checkable evidence.

Funnel counts must be computed from candidate records rather than reconstructed after writing. Every rejected candidate retains a plain-language reason and timestamp.

At each stage store `entered`, `passed`, `rejected`, `rejected_by_primary_reason` and `not_processed` when interrupted; satisfy `entered = passed + rejected + not_processed`. Keep one primary rejection reason per candidate and stage and show secondary tags separately. Aggregate candidate counts by original publisher without double-counting leads from two search channels. Source-search records may include raw hits that were never candidate articles; report raw hits, inspected/opened results, and admitted unique candidate articles under separate column headers. If initial raw-result logs are absent, report only the verified subset and mark total coverage `不可核算` rather than extrapolating.

## 3. Time and check records

Initialize `started_at` before discovery. Reader metadata `撰文时间` is the actual time the article-led editorial manuscript was written/frozen, before rendering HTML; internal `retrieval_cutoff` remains in this operator appendix only. A later HTML or layout revision keeps the original writing time and records the revision timestamp separately in the appendix. The run's true `completed_at` is recorded after validation and packaging in the final delivery message or an external operational record, never predated or backfilled into the sealed issue. Use one timezone and second-level precision for all timestamps. A substantive rewrite gets a new writing time and preserves the earlier version in revision history.

Each check result contains `check_name`, `status` (`passed`, `failed`, or `unavailable`), reason, and checked time. Instrumentation failure is `unavailable`, never `passed`.

## 4. Final run appendix

The final H2 section must be `## 附录｜Skill 系统运行记录`, immediately followed by:

```markdown
> **后台提示：** 以下内容为 Skill 系统运行记录，供后台核查与调试使用，不属于读者正文。
```

Use compact tables covering: run identity and editorial-freeze time; requested scope and actual cutoff; **source-search coverage** (site/channel, searched versus directly visited, raw results, opened results, unique candidates, missing counts); candidate funnel with actual recorded stage counts and primary exclusion reasons (never inferred target counts); selected and rejected outcomes; source/topic concentration; per-article and issue length; metadata/full-text/deduplication; per-image attribution, reuse evidence or AI fallback; image path and 2 MiB; completed pre-freeze checks; material exceptions and automatic actions; stopping condition. Verify stage and source subtotals reconcile with the traceable candidate IDs. If a count, prior issue, or check is unavailable, explicitly say so and identify which denominator is missing.

HTML validation and ZIP integrity happen **after** the Markdown freezes. Never pre-write their `passed` result in the Markdown/HTML appendix: that would create a self-referential document and tempt false claims. Report these post-freeze results after running the tools in the final delivery message or a separate non-published operational record. If the user requests a later published correction, create a new revision and rerun the full validation/packaging process. Do not modify the issue merely to embed its own final archive check.

If no material exception occurred, state `本次运行无重大异常`. Logs expose observable facts and decisions only. Never include hidden reasoning, chain-of-thought, credentials, access tokens, personal/confidential data, raw prompts, tool payloads, or copied full article text.
