# AI Industry Deep Insight Skill v1.5.0

这是一个面向管理层的 **AI × 行业深度洞察 Skill**。

## v1.5.0 的核心变化

v1.5.0 不再只规定“研究什么”，而是同时规定：

> **结论怎么形成、章节怎么分工、证据怎么追踪、最终报告怎么证明第一章的核心判断。**

核心叙事：

> **核心判断 → 业务流程与 AI 能力 → 高价值场景 → 学术与行业进展 → 产品/案例/实证 → 人的工作方式与组织分工 → 监管/法规/标准/风险 → 自主边界与人工接管 → KPI/Economics/落地 → Final 回扣。**

## 关键新增能力

**Judgment Architecture**：第一章 4–8 个全篇一级判断。  
**Judgment Traceability Matrix**：Judgment → Process → Capability → Scenario → Evidence → KPI。  
**Chapter Contract**：每章只回答一个问题。  
**Academic / Industry / Commercial 三线研究**：三者必须显式检查。  
**Constraint Mapping**：Constraint → System Requirement → Human Gate。  
**Autonomy Decision**：区分 Can Automate 与 Should Automate。  
**Global Narrative Consistency**：Final 必须回扣 Chapter 1，不重新制造结论。

## 默认输出

单文件 Markdown；时间戳统一按北京时间（Asia/Shanghai）。

## 运行入口

1. 阅读 `SKILL.md`
2. 执行 `prompts/run_industry_deep_insight.md`
3. 使用 `outputs/markdown_report_template.md`
4. 交付前执行 `evals/final_checklist.md`
5. 可运行 `validators/validate_report_structure.py` 与 `validators/check_markdown_compactness.py`
