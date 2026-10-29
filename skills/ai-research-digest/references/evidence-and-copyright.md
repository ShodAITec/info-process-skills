# Evidence, access, copyright, and exceptions

## 1. Full-text admission

An article is eligible only when the complete body can be read legally and its argument can be checked from beginning to end. A headline, search snippet, abstract, excerpt, newsletter preview, paywall teaser, or secondary summary is not full text. Do not bypass logins, subscriptions, paywalls, robots restrictions, or other access controls.

If the full text cannot be confirmed, set `fulltext_status` to `unavailable` or `incomplete`, reject it at the admission stage, and record the reason. Do not write a shortened “introduction” from public summaries and do not lower the standard to fill the issue.

## 2. Claim-evidence record

For every shortlisted article retain an internal record with: core propositions; argument steps; supporting data, examples, research, or historical material; assumptions and limitations; evidence locators; and claim type.

| Type | Meaning | Writing rule |
| --- | --- | --- |
| Author claim | The author's judgment or inference | Attribute with wording such as “作者认为” |
| Source fact | A fact directly supported by the article or linked primary source | State it with the source context |
| Third-party claim | A quoted study, expert, company, or institution | Preserve the original attribution |
| Editorial interpretation | Context, comparison, or inference added by the weekly | Mark it as editorial explanation or inference |

Important numbers require the original article or an authoritative primary source. If units, denominators, dates, definitions, or scope cannot be confirmed, remove the number or state the uncertainty. Never let smooth Chinese prose erase attribution boundaries.

## 3. Copyright and faithful explanation

Produce a Chinese guided reading and commentary, not a substitute for the original. Do not output an unauthorized full translation, reproduce long passages, or mirror the original paragraph structure. Quote only short necessary phrases, keep the original link visible, and preserve author, source, and publication date.

Apply a separate image-rights gate even when article full text is legally readable. For each proposed original-page image check the page's image credit and permission/license terms, which may belong to a photographer or agency rather than the article publisher. The contemplated use is a redistributable local image and an offline HTML embedding, not simply linking back to the image. If the rights basis is absent, restrictive, contradictory or unresolved, record the reason and create an AI image instead; do not claim that a caption or citation itself grants reuse permission. If explicit permission is required but unavailable, continue autonomously via AI fallback. Retain verifiable attribution and authorization details in the run record, without disclosing private correspondence or tokens.

## 4. Autonomous exception handling

Do not interrupt the user for ordinary failures. Apply the rule, preserve the reason, and report material exceptions in the final run appendix.

| Situation | Automatic action |
| --- | --- |
| Fewer than the requested number qualify | Publish the actual number; never pad |
| Full text is unavailable or incomplete | Reject; no guided reading |
| Original source cannot be verified | Reject |
| Original article has no suitable image | Generate an article-specific AI image; record `original_image_absent` |
| Original image rights or credit cannot be confirmed | Do not copy; generate an AI image and record `original_image_rights_unverified` or `credit_unverified` |
| Permitted image cannot be downloaded or optimized for the offline package | Generate an AI image and record `original_image_asset_unavailable` |
| User-supplied article is weak | Keep it in the candidate record and explain non-selection |
| One topic or source dominates | Prefer the strongest argument; retain opposing pieces only when they add real contrast |
| Search or access capability fails broadly | Stop the formal issue and deliver an execution report |
| Metadata cannot be verified | Reject or delete the affected record; never guess |

Record exception object, stage, type, automatic action, plain-language reason, evidence locator, suggested follow-up, and timestamp. Exclude hidden reasoning, credentials, private data, raw tool payloads, and copyrighted full text.
