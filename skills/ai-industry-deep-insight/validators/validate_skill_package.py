#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]

REQUIRED = [
    "SKILL.md","README.md","MANIFEST.md","CHANGELOG.md","COMPATIBILITY.md",
    "context/domain_archetypes.md","context/defaults.md",
    "rules/research_framework.md","rules/judgment_architecture.md",
    "rules/judgment_traceability.md","rules/chapter_contracts.md",
    "rules/academic_industry_commercial.md","rules/evidence_freshness.md",
    "rules/customer_case.md","rules/regulation_system_mapping.md",
    "rules/autonomy_decision.md","rules/markdown_compact_layout.md",
    "rules/global_consistency.md","outputs/markdown_report_template.md",
    "prompts/run_industry_deep_insight.md","evals/final_checklist.md",
    "validators/validate_report_structure.py","validators/check_markdown_compactness.py"
]

missing=[p for p in REQUIRED if not (ROOT/p).exists()]
if missing:
    print("FAIL missing:")
    for p in missing: print("-", p)
    raise SystemExit(1)

text=(ROOT/"SKILL.md").read_text(encoding="utf-8")
tokens=[
    "version: 1.5.0","Judgment Traceability Matrix","Chapter 6｜AI 如何改变人的工作方式与组织分工",
    "Chapter 8｜AI 能自动到什么程度","Constraint → System Requirement → Human Gate",
    "Can Automate ≠ Should Automate"
]
for t in tokens:
    if t not in text:
        print("FAIL missing token:", t)
        raise SystemExit(1)

print("PASS: v1.5.0 package structure and core contracts validated.")
