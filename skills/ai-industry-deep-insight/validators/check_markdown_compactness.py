#!/usr/bin/env python3
from pathlib import Path
import re, sys

BULLET = re.compile(r"^\s*[-*+]\s+(.+?)\s*$")
NUM = re.compile(r"^\s*\d+[.)]\s+(.+?)\s*$")
SPECIAL = re.compile(r"https?://|\[[^\]]+\]\([^)]+\)||```")
MAX_LEN = 52

def clean(s):
    return re.sub(r"[；;。.]$", "", s.strip())

def scan(path):
    lines=path.read_text(encoding="utf-8").splitlines()
    warnings=[]
    i=0
    while i < len(lines):
        kind=None
        if BULLET.match(lines[i]): kind=BULLET
        elif NUM.match(lines[i]): kind=NUM
        if not kind:
            i+=1; continue
        start=i; items=[]
        while i < len(lines):
            m=kind.match(lines[i])
            if not m: break
            items.append(clean(m.group(1))); i+=1
        if len(items)>=2 and all(len(x)<=MAX_LEN and not SPECIAL.search(x) for x in items):
            warnings.append((start+1,i,items))
    return warnings

if len(sys.argv)<2:
    print("Usage: check_markdown_compactness.py <report.md> [...]")
    raise SystemExit(2)

n=0
for f in map(Path,sys.argv[1:]):
    if f.suffix.lower()!=".md" or not f.exists(): continue
    for s,e,items in scan(f):
        n+=1
        print(f"[WARN] {f}:{s}-{e} -> " + "、".join(items[:6]) + ("……" if len(items)>6 else ""))
if n:
    print(f"Found {n} possible vertical-density issue(s).")
    raise SystemExit(1)
print("PASS: no obvious short-list density issues.")
