---
name: ai-research-digest
description: "Discover, verify, select and explain published overseas humanities, social science, culture, business, management, economics and finance articles as a Chinese editorial weekly; deliver Markdown and independently offline-readable HTML. Use for article curation, guided reading, weekly production or revisions to this weekly. Exclude Insight Analysis, technology or industry intelligence, and employer-specific action reports."
---

# 他山见闻 · 周刊生产

把已发表的海外长文组织成面向国内人文社科、思想文化、商业管理、金融经济等专业读者的中文精读周刊。按**任务类型**判断适用范围：即使文章谈 AI，只要任务是选文和忠实解读，就属于本 Skill；研究技术、产业或企业行动不属于本 Skill。始终与 Insight Analysis 及用户的公司业务隔离。

## 默认输入与交付

- 最近 7 天，按用户当地时区计算，以实际检索截止时间为终点；默认五篇，合格不足则少发，不凑数。
- 自动完成来源发现、全文核验、选文、编辑、配图和质检；用户提供的文章只进入候选池。
- 一份 ZIP：同名 Markdown、独立离线 HTML 和供 Markdown 使用的 `images/`。两种格式均保留文末后台运行附录。Markdown 可保留链接；HTML 不生成可点击超链接，原文和引用的完整网址另起一行以纯文本显示。
- 若缺少完整可合法阅读的全文，不精读、不入选；若检索/访问能力整体失效，交付有原因的执行报告，不冒充正式刊物。

## 单一规则来源

| 阶段 | 唯一详细规范 |
| --- | --- |
| 发现、去重、筛选、停止 | [discovery-and-selection.md](references/discovery-and-selection.md) |
| 全文、证据、归属、版权与异常 | [evidence-and-copyright.md](references/evidence-and-copyright.md) |
| 中文写法、栏目、篇幅、固定声明 | [editorial-template.md](references/editorial-template.md) |
| 原图核权、AI 回退、图注、文件结构 | [visual-and-packaging.md](references/visual-and-packaging.md) |
| 候选记录、时间、后台附录 | [run-record-schema.md](references/run-record-schema.md) |

排版使用 [weekly-template.md](assets/weekly-template.md)。不得从 README、历史 CHANGELOG 或旧刊物反推执行规则。

## 从发现到交付

1. **启动：** 记录开始时间、统计周期、时区、读者及目标篇数。建逐站检索台账及逐篇候选台账；从核心来源、作者和开放线索发现原文章。区分搜索命中、实际访问、独立候选及原始出版站。
2. **准入：** 统一 URL，逐篇核对原始出处、作者、日期及全文；按硬门槛淘汰无法核验者，记录时间和原因。执行同期与已知历史刊期去重。
3. **选文：** 完读优质候选并记录主张—论证—证据；由 AI 判断单篇价值和整期互补性，不用机械总分和固定领域配额。执行参考文档规定的停止条件。
4. **编辑：** 根据选中文章生成当期栏目、卷首语和跨文章观察。每篇有推荐语、`文章解读`（原文链接、作者、出处、日期和 2–4 段连续精读）、`另一面`；区分作者论断、事实、第三方材料与编辑推断。只做中文导读和评论，不译整篇。
5. **配图：** 每篇选一张与论证相连的图。优先检查原文图片的创作者署名和**具体可再分发依据**；无合适且可用原图时生成 AI 示意图，记录真实回退原因。图片存 `images/`，逐篇写解释性 `配图说明：` 和可追溯 `图片来源：`。
6. **定稿：** 在 Markdown 首页用一个提示块合并 AI 声明与阅读说明；首页保留内容周期与秒级北京时间“撰文时间”，不单列检索截止。以 `## 附录｜Skill 系统运行记录` 收尾，内部保留真实检索截止、逐站检索量、可对账的分阶段淘汰原因及**已经发生且可核对**的筛选、异常及封包前检查；原始检索未记录时如实标注，绝不倒推总量。此时不预写 HTML/ZIP/浏览器的未来检查结果。
7. **生成与校验：** 从定稿 Markdown 生成 HTML；运行结构与内容校验，必要时核实 `file://` 离线显示。任意文字或图片更改都须重新生成 HTML、重新校验。浏览器未测时记录 `未验证`，不能改称通过。
8. **封包：** 用 [package_issue.py](scripts/package_issue.py) 对已验证的刊物打包并立即核验归档；封包校验结果在最终交付消息中反馈，不回填已封包文档，避免自引用和不实日志。

## 不可破坏的约束

- 始终称“周刊”，对外刊名统一为“他山见闻”，首页标题使用 `他山见闻｜YYYY 年第 WW 周刊`。首页按编辑模板保留一个固定阅读说明提示块；元数据使用 `内容周期` 与 `撰文时间`，不出现读者侧 `检索截止` 或 `生成时间`。文末附录醒目标明不属于读者正文。
- 不采用无全文摘要、付费墙绕行、无权利依据的原图复制或未经证实的数字。原文有图不等于能复制到可分享的 ZIP/离线 HTML；原图不符条件时自动切换为明示的 AI 图。
- Markdown 图片一律本地相对路径；每张 ≤2 MiB，HTML 内嵌同字节图片，正文信息与 Markdown 一致。HTML 内所有外部引用保留标题与完整 URL 文本，禁止 `<a>` 和 `href`；没有外部资源依赖。粗体标签后跟正文时留空格，不允许 HTML 显示字面量 `**`。
- 常规单篇读者文字约 1,000–1,300 字，复杂文章可至 1,500；默认五篇读者正文目标 7,000–8,500 字。以论证完整性优先，不填充篇幅。
- 候选台账、异常和检验记录使用可观察事实；不得写隐藏推理、凭证、原文大段复制或虚构通过的检查。

## 维护

行为变化同步更新其**唯一负责的规范**、SKILL.md、README、用户功能说明书及模板/脚本；在 [CHANGELOG.md](CHANGELOG.md) 追加秒级北京时间，维护 [TODO.md](TODO.md) 的未完成项。修改后在真实刊物副本上执行回归，再做 Skill 结构校验；不改写已发布的历史版本条目。

## 引用格式

正文只写 `[N]` 编号，完整网址集中到文末 `# 参考来源`。详见 [citation_format.md](rules/citation_format.md)。
