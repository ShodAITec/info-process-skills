#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    print("Usage: validate_report_structure.py <report.md>")
    raise SystemExit(2)

p=Path(sys.argv[1])
text=p.read_text(encoding="utf-8")

checks = [
    ("Chapter 1", r"^#\s+0?1\b"),
    ("Chapter 2", r"^#\s+0?2\b"),
    ("Chapter 3", r"^#\s+0?3\b"),
    ("Chapter 4", r"^#\s+0?4\b"),
    ("Chapter 5", r"^#\s+0?5\b"),
    ("Chapter 6", r"^#\s+0?6\b"),
    ("Chapter 7", r"^#\s+0?7\b"),
    ("Chapter 8", r"^#\s+0?8\b"),
    ("Chapter 9", r"^#\s+0?9\b"),
    ("Final", r"^#\s+(?:Final|10\b)")
]
missing=[]
for name,pat in checks:
    if not re.search(pat,text,re.M):
        missing.append(name)

if missing:
    print("FAIL missing chapters:", ", ".join(missing))
    raise SystemExit(1)

if "Constraint" not in text and "约束" not in text:
    print("WARN: Chapter 7 constraint-system mapping may be missing.")

if "推荐自主" not in text and "推荐等级" not in text:
    print("WARN: Chapter 8 recommended autonomy decision may be missing.")

print("PASS: report has the expected v1.5.0 narrative skeleton.")
