# 技能包

每个子目录是一个独立、可移植的技能包。**纯 Markdown，不绑定任何模型或框架。**

## 目录约定

引擎按以下约定自动加载，新增技能无需改引擎代码：

| 路径 | 作用 | 必需 |
| --- | --- | --- |
| `SKILL.md` | 入口。YAML frontmatter（`name` / `description` / `metadata`）+ 执行说明 | ✅ |
| `rules/*.md` | 硬性规范 | |
| `references/*.md` | 详细规则 | |
| `context/*.md` | 背景与默认值 | |
| `outputs/*.md` | 产出模板 | |
| `prompts/*.md` | 可复用的执行提示 | |
| `validators/*` `scripts/*` | 校验与打包脚本（`.py` / `.js` / `.mjs`），产出后自动调用 | |

加载策略是双路合并：**约定目录全收** + **追踪 `SKILL.md` 里的本地 Markdown 链接**。
两个现有技能目录结构并不相同，都能正确加载。

## 新增一个技能

```bash
mkdir -p skills/my-skill/rules
cat > skills/my-skill/SKILL.md <<'EOF'
---
name: my-skill
description: 一句话说清这个技能做什么、什么时候用、什么时候不用。
metadata:
  version: 0.1.0
  language: zh-CN
---

# 我的技能

## 输入与交付
...

## 执行步骤
1. ...

## 不可破坏的约束
- ...
EOF

node cli.js show my-skill      # 确认加载正确
node cli.js run my-skill "测试任务"
```

## 脱离本引擎使用

```bash
node cli.js export my-skill --out prompt.md
```

导出的是完整提示词（`SKILL.md` 正文 + 全部规范文件，带 `<<<FILE: 路径>>>` 分隔标记）。
贴进任何 agent 的 system prompt 即可，不需要本仓库的任何代码。
