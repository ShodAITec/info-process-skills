# InfoProcessSkills

**一套引擎，多种报告技能。**

把「做什么样的报告」写成可移植的技能包（纯 Markdown 规范），
把「怎么执行」交给一个模型无关的引擎。两者解耦，各自可独立使用。

```bash
node cli.js list                                      # 看有哪些技能
node cli.js run ai-industry-deep-insight "酒店管理"     # 跑一份行研报告
node cli.js export ai-research-digest --out p.md      # 导出提示词给任意 agent
```

---

## 两个独立的使用方式

### 方式一：直接用技能，不用本引擎

技能包是**纯 Markdown，不依赖任何模型或框架**。你可以把它喂给任何 agent：

```bash
# 导出成单个提示词文件
node cli.js export ai-industry-deep-insight --out prompt.md

# 或直接进剪贴板
node cli.js export ai-industry-deep-insight | pbcopy
```

然后：

| 用法 | 做法 |
| --- | --- |
| **Claude Code / Claude.ai** | 把 `skills/<id>/` 整个目录拷到 `.claude/skills/` 下 |
| **Cursor / Windsurf** | 导出的 `prompt.md` 放进项目规则文件 |
| **ChatGPT / Gemini / 任意聊天界面** | 把导出内容作为 system prompt 或首条消息 |
| **你自己的 Agent** | 读 `skills/<id>/SKILL.md` + 同目录规范文件，自行拼装 |

技能包里只有规范、模板和校验脚本，**没有任何厂商绑定**。

### 方式二：用本引擎跑

引擎负责检索、循环调用、落盘、跑校验。模型可任意替换：

```bash
node cli.js doctor                 # 检查密钥与可用后端
node cli.js run <skill> "<任务>"
```

---

## 支持的模型

引擎只认 OpenAI 兼容接口，换模型不改技能也不改代码：

| provider | 默认模型 | 所需密钥 |
| --- | --- | --- |
| `thehive`（默认） | `deepseek-ai/deepseek-v4.1-flash-1017` | `THEHIVE_API_KEY` |
| `openai` | `gpt-4o` | `OPENAI_API_KEY` |
| `deepseek` | `deepseek-chat` | `DEEPSEEK_API_KEY` |
| `moonshot` | `moonshot-v1-128k` | `MOONSHOT_API_KEY` |
| `ollama` | 本地模型 | 无 |

```bash
IPS_PROVIDER=openai node cli.js run ai-industry-deep-insight "口腔医疗"
IPS_ENDPOINT=https://your-endpoint/v1/chat/completions \
IPS_MODEL=your-model IPS_API_KEY=xxx node cli.js run ...   # 任意兼容服务
```

---

## 现有技能

| 技能 | 产出 |
| --- | --- |
| [`ai-industry-deep-insight`](skills/ai-industry-deep-insight/) | 面向管理层的「AI × 行业」深度洞察报告。先立核心判断，再用流程、能力、场景、学术进展、产品案例、监管边界、自主等级、KPI 逐层验证 |
| [`ai-research-digest`](skills/ai-research-digest/) | 海外人文社科 / 商业管理长文的中文精读周刊。自动发现、核验、选文、编辑、配图、质检、打包 |

新增技能只要在 `skills/` 下建一个带 `SKILL.md` 的目录，引擎会自动发现——
不需要改引擎代码。

---

## 架构

```
skills/              技能包：可移植的 Markdown 规范（本项目的核心资产）
└── <skill-id>/
    ├── SKILL.md         入口：YAML frontmatter + 执行说明
    ├── rules/           硬性规范
    ├── references/      详细规则（与 rules/ 二选一或并用）
    ├── outputs/         产出模板
    └── validators/      自带校验脚本，引擎会在产出后自动调用

engine/              参考实现：一种执行方式，可被替换
├── providers/           模型适配（OpenAI 兼容，预设 + 自定义）
├── sources/             检索工具：联网检索、网页抓取、学术库
├── skill.js             技能加载（约定目录 + 引用追踪，双路合并）
├── runner.js            agent 循环：研究阶段 → 写作阶段
├── pipeline.js          落盘 + 调用技能自带校验
└── render/              Markdown → 单文件 HTML

output/<skill-id>/<日期>-<任务>/
├── report.md        产物
├── report.html      单文件 HTML，离线可读，明暗双主题
└── run.json         用量、来源清单、校验结果
```

### 两个关键设计

**检索与生成分离。** DeepSeek 等模型没有服务端联网能力，引擎用 tool calling
自己提供 `search_web` / `fetch_page` / `search_scholar` 三个工具。
检索后端同样可插拔（`IPS_SEARCH`），没有任何后端时如实报错，不静默返回空结果。

**引用可核验。** 工具真实返回过的 URL 会进入台账，模型声称引用的链接可与台账比对。
学术检索走 OpenAlex（全学科）+ arXiv（AI 前沿），均为免费公开 API。

---

## 配置

复制 `config.example.md` 为 `config.md` 填入密钥。
**`config.md` 已在 `.gitignore` 中**，不会被提交。也可用环境变量或 `.env`（优先级更高）。

```
THEHIVE_API_KEY=...        # 生成模型
ANTHROPIC_API_KEY=...      # 可选，仅作联网检索后端
```

不配 `ANTHROPIC_API_KEY` 时，联网检索不可用，但学术库与直接抓取仍然工作——
引擎会明确告知，而不是假装检索成功。

---

## 开发

```bash
npm install
node cli.js doctor          # 自检
node cli.js show <skill>    # 看技能加载了哪些文件、多少字符
```

## 数据与合规

- **联网检索**走 Anthropic `web_search`，**学术检索**走 OpenAlex 与 arXiv 的公开 API。
- **网页抓取**先直连；直连拿不到可用正文时，回退到第三方阅读服务 `r.jina.ai`。
  **这意味着目标 URL 会被发送给 jina.ai。** 不希望任何地址离开本机，
  调用 `fetchPage(url, { allowReader: false })` 关闭回退。
- 抓取只针对**公开可访问**的页面，不绕过付费墙、登录或访问控制；
  返回 401 或 451 的地址直接放弃。请求带真实 UA `InfoProcessSkills/1.0`，不伪装浏览器。
- 生成内容**必须人工复核后才能对外使用**。报告里的事实、数字和引用都由模型产出，
  `run.json` 里的 `citations` 与 `reportEval` 是系统的自评，不构成核实。

## License

MIT —— 见 [LICENSE](LICENSE)。
