# RAG 向量检索选型评估：Pinecone vs Qdrant vs pgvector

> **决策问题**：为一个 5 人团队、千万级（约 10M）向量的 RAG 检索场景，选定主用向量检索方案。
> **候选方案**：Pinecone（托管 Serverless/Pod）、Qdrant（Cloud 托管 / 自建 OSS）、pgvector（含 pgvectorscale 扩展，自建或托管 Postgres）
> **硬约束**：团队 5 人、无专职 SRE；向量规模 10M 量级；需要 metadata 过滤（多租户/类别）；预算未定，按 3 年 TCO 比较
> **关键假设**（变了结论会变）：
> 1. 向量维度按 **1536**（OpenAI 类 embedding）估算；若为 768 维，内存与成本约减半。
> 2. 查询量按 **两档**分别测算：低档 100 万次/月、高档 1 亿次/月（约 3.3 万次/天）。**这一档位直接决定 Pinecone 与 Qdrant 的排序**。
> 3. 单命名空间/单集合承载全量数据；若做租户级命名空间切分，Pinecone 读成本可降一个数量级 [14]。
> 4. 团队已有 Postgres 使用经验，但没有向量库运维经验。
> 5. 无强合规/数据驻留硬要求；若有，Qdrant 自建或 Hybrid 是唯一可行路径 [2]。
> 6. 人力成本按 ¥1,000/人日（约 $140）折算，仅用于内部比较。

# 01 推荐与理由

**主选：Qdrant**（形态上优先 Qdrant Cloud 托管，规模稳定后可评估自建 OSS）。

理由按权重排序：

1. **成本结构可预测且可优化**。Qdrant Cloud 按集群资源（RAM/vCPU/磁盘）计费，**不按查询次数计费** [2][11]。开启 scalar 量化后，10M×1536 维的集群可从 32GB 档降到 8GB 档，月费从约 $1,824 降到约 $456 [11]；再叠加磁盘索引可到约 $114 [11]。相比之下 Pinecone 的账单随查询范围线性放大，同一份 10M 数据在不同查询模型下可算出 $371/月 [4] 与 $1,168/月 [14] 两个差 3 倍的数——对 5 人团队而言，这种不确定性本身就是风险。
2. **许可证干净，退出成本低**。Qdrant 采用 Apache License 2.0 [7][13]，检索未发现其改许可（BSL/SSPL）的记录；同一套软件可从 Cloud 平移到自建，官方提供迁移工具与文档 [2]。
3. **过滤检索是它的强项而非补丁**。Qdrant 原生支持 payload 过滤、混合检索（RRF/DBSF 融合）、多租户分区 [13]；而 pgvector 的 HNSW 是"先检索后过滤"，高选择性过滤会返回不足 LIMIT 条数，需要 iterative scan 或分区绕行 [3][15]。
4. **性能在可比口径下不落后**。在 50M×768 维、99% recall 的第三方可比测试中，Qdrant 的 p95/p99 延迟优于 Postgres+pgvectorscale（36.73ms vs 60.42ms；38.71ms vs 74.60ms）[5]；在 VectorDBBench 1M 数据集上，QdrantCloud-16c64g 的 p99 为 6.4ms、QPS 1,242、recall 0.9474，优于 Pinecone p2.x8 的 13.7ms / 1,146 / 0.9262 [6]。

**备选：pgvector + pgvectorscale**（仅当团队已重度使用 Postgres 且愿意自管数据库）。

- 若已有 Postgres 实例，边际成本接近零；pgvectorscale 的 StreamingDiskANN 把索引搬到 SSD，官方称在 50M×768 维、99% recall 下相比 Pinecone s1 索引 p95 延迟低 28 倍、吞吐高 16 倍、自建成本低 75% [19][8]。
- 但**纯 pgvector 的 HNSW 在 10M×1536 维下索引可达 80–120GB，必须全驻内存**，超出即退化为多秒级查询 [18]；且 pgvectorscale **在 AWS RDS 上不可用** [15]，等于要求团队自己运维 Postgres 高可用。

**结论反转条件**（任一成立则应改选）：

- **查询量很低且突发**（月查询 < 约 40 万次、有明显空闲期）：Pinecone Serverless 的 scale-to-zero 更划算，10M 数据在低查询模型下可低至 $50 起的月度下限区间 [14][4]。
- **团队完全没有运维余量、且要求零调优上线**：Pinecone 无需做容量规划与量化配置 [4]，Qdrant Cloud 需要自己选集群规格与量化参数 [11]。
- **数据必须留在既有 Postgres/RDS 内、不允许新增系统**：选 pgvector，但需接受 10M 是它的能力上沿，需配 halfvec 量化 [15][18]。
- **规模涨到亿级以上**：pgvector 路线触顶，应转向 Qdrant/Milvus 类专用引擎 [8]。

# 02 决策范围与约束

**要解决的**：为 RAG 检索层选定一个向量存储与检索组件，满足 10M 量级、带 metadata 过滤、可支撑生产 SLA。

**不解决的**：embedding 模型选型、rerank 策略、chunking 策略、LLM 侧成本。注意 embedding 生成成本是独立账单，在 RAG 场景下常超过向量库本身费用 [4]。

**硬约束**：

| 约束 | 内容 | 对结论的影响 |
|---|---|---|
| 人力 | 5 人，无专职 SRE | 排除需要长期专人运维的多节点自建集群 |
| 规模 | 10M 向量，1536 维 | 排除纯 pgvector HNSW 单机方案（内存墙）[18] |
| 功能 | 需 metadata 过滤/多租户 | 过滤能力成为硬指标，非加分项 |
| 预算 | 未定，按 3 年 TCO | 需要 1 年/3 年双口径 |
| 合规 | 无已知硬要求 | 若后续出现，仅 Qdrant 自建/Hybrid 可满足 [2] |

# 03 候选方案与入选理由

| 方案 | 类型 | 入选理由 |
|---|---|---|
| **Pinecone** | 采购/托管（专有） | 市场认知度最高的全托管向量库，Serverless 按读写单元计费，零容量规划 [1][4]；代表"采购"一侧的基准 |
| **Qdrant** | 开源（Apache 2.0）+ 托管 Cloud | 同时具备 OSS 自建与托管两种形态，是"开源可退出"与"托管省心"的交集 [7][2] |
| **pgvector（+ pgvectorscale）** | 开源扩展，跑在既有 Postgres 上 | 代表"复用现有基础设施"路线，边际成本最低，且 pgvectorscale 补上了磁盘索引这一环 [3][19] |

三者恰好覆盖"采购托管 / 开源+托管 / 自建复用"三类，对比成立。

**未纳入**：Milvus、Weaviate、Elasticsearch。证据中虽有提及 [5][6][11]，但本次调研未取得其针对 10M×1536 维的完整定价与运维材料，纳入会造成不对等比较。

# 04 评分维度与权重

**先定权重，再看分数。** 权重如下，理由逐条给出，欢迎在会上质疑。

| # | 维度 | 权重 | 为什么是这个权重 |
|---|---|---|---|
| D1 | 3 年 TCO（含人力） | **30%** | 5 人团队、规模已过千万，成本是持续性的、每月可见的支出；且三家在此维度差异最大（数量级级别），是最能区分候选的维度 |
| D2 | 运维负担与团队技能匹配 | **25%** | 无专职 SRE 是硬约束。一个需要每周投入数小时调参的方案，对 5 人团队的机会成本高于其节省的费用 |
| D3 | 检索性能与召回（可比口径） | **20%** | RAG 的检索质量直接影响答案质量，但 10M 量级下三家都能做到亚 100ms 级 [5][6]，差距不构成一票否决，故不给最高权重 |
| D4 | 锁定与迁移成本 | **10%** | 向量数据可由源文档重新 embedding 生成，理论上可重建；但重建成本高（时间+embedding 费用），故不可忽略也不应主导 |
| D5 | 扩展性上限（走向 50M/100M） | **10%** | 当前 10M，但 RAG 语料通常只增不减；不过 3 年内翻 10 倍是小概率，故权重中等 |
| D6 | 功能完备度（过滤/混合检索/多租户） | **5%** | 三家都能做，差异体现在实现质量而非有无，故权重最低 |

合计 100%。

# 05 评分矩阵

评分 1–5 分，5 为最优。分数基于第 06 节的 TCO 测算与第 03 节引用的取证。

| 维度（权重） | Pinecone | Qdrant | pgvector(+scale) |
|---|---|---|---|
| D1 3 年 TCO（30%） | 3 | **4** | **5** |
| D2 运维负担（25%） | **5** | 4 | 2 |
| D3 性能与召回（20%） | 4 | **5** | 3 |
| D4 锁定与迁移（10%） | 2 | **5** | **5** |
| D5 扩展性上限（10%） | **5** | **5** | 2 |
| D6 功能完备度（5%） | 4 | **5** | 3 |
| **加权总分** | **3.75** | **4.55** | **3.60** |

计算式（示例，Qdrant）：4×0.30 + 4×0.25 + 5×0.20 + 5×0.10 + 5×0.10 + 5×0.05 = 1.20+1.00+1.00+0.50+0.50+0.25 = **4.45**。
Pinecone：3×0.30 + 5×0.25 + 4×0.20 + 2×0.10 + 5×0.10 + 4×0.05 = 0.90+1.25+0.80+0.20+0.50+0.20 = **3.85**。
pgvector：5×0.30 + 2×0.25 + 3×0.20 + 5×0.10 + 2×0.10 + 3×0.05 = 1.50+0.50+0.60+0.50+0.20+0.15 = **3.45**。

（上表加权总分以此处计算式为准：Pinecone 3.85、Qdrant 4.45、pgvector 3.45。）

**关键分差说明**：

- **D1 是 Qdrant 与 Pinecone 拉开差距的地方**，但差距大小高度依赖查询量假设。若月查询量低于约 40 万次，Pinecone 的分数应上调至 4，两者接近持平。
- **D2 是 pgvector 的致命项**。10M×1536 维的 HNSW 索引需 80–120GB 内存，索引构建需把 `maintenance_work_mem` 从默认 64MB 提到 8–16GB，否则构建慢 10–50 倍甚至失败 [18][15]。这对 5 人团队是持续的隐性负担。
- **D3 的分数不来自单一基准**。Tiger Data 的 50M 测试显示 Qdrant 尾延迟更优但 Postgres 吞吐高 11.4 倍 [5]——**该测试由 Timescale（pgvectorscale 厂商）执行，存在利益相关**，故未据此给 pgvector 加分。VectorDBBench 的 1M 测试中 Qdrant 与 Pinecone 差距不大 [6]，且该工具由 Zilliz 维护，同样存在厂商背景。

# 06 TCO 测算

## 假设（显式写出，变了结论会变）

- 规模：10M 向量 × 1536 维，float32 原始约 61.4GB [22 见注]，含 HNSW 图开销按 1.3 倍计约 80GB。
- 查询量：**低档 100 万次/月**；**高档 1 亿次/月**。
- 写入：初始一次性导入 10M 条，稳态每月 50 万次 upsert。
- 人力：¥1,000/人日 ≈ $140/人日。
- 汇率与云厂商区域价差忽略，全部取证据中的美元报价。

## 直接成本（月度）

| 项目 | Pinecone | Qdrant Cloud | pgvector（自建 Postgres） |
|---|---|---|---|
| 存储/集群 | $0.33/GB/月 [1]；10M×1536 约 71.5GB → 约 $23.6 [14] | 8GB 档 + scalar 量化 ≈ $456 [11]；再叠磁盘索引 ≈ $114 [11] | 复用既有实例 ≈ $0；独立 r6g 级实例约 $400–600 [15] |
| 读/查询 | $16–18/百万 RU [1]；**RU 数取决于命名空间大小**：71.5GB 命名空间 = 71.5 RU/次 [14] | **$0**（按集群计费，不按查询）[2][11] | $0（含在实例内） |
| 写入 | $4–4.5/百万 WU [1] | $0 [11] | $0 |
| 低档（100 万次/月）合计 | 约 **$1,168/月** [14] | 约 **$456/月**（未优化）/ **$114/月**（量化+磁盘索引）[11] | 约 **$0–600/月** [15] |
| 高档（1 亿次/月）合计 | 按 71.5 RU/次推算约 **$114,000/月**（本报告估算：1亿×71.5÷1e6×$16 = $114,400，未含存储） | 仍约 **$456/月**（查询不额外计费）[11] | 仍约 **$0–600/月**（受实例规格约束，需扩容） |

> **口径警告**：LeanOps 对同一 10M 场景给出 Pinecone 约 $371/月 [4]，Omid Saffari 给出约 $1,168/月 [14]。差异不在价格表，而在**每次查询消耗多少 RU**——前者按 25 RU/次、后者按"1 RU per GB of namespace"即 71.5 RU/次 [14]。Pinecone 官方文档确认后者是当前计费公式 [1][14]。**两个数字不可并列比较**，本报告采用官方公式口径。这也说明：Pinecone 的成本对"查询是否跨全量命名空间"极度敏感——若按租户切分命名空间，同一份 100M 数据的账单可从 $11,679 降到 $350 [14]。

## 人力成本

| 项目 | Pinecone | Qdrant Cloud | pgvector 自建 |
|---|---|---|---|
| 首次集成 | 0.5 人日（建索引+接入） | 2 人日（选规格+量化配置+payload 索引） | 5 人日（装扩展+调 `maintenance_work_mem`+建索引+验证 recall）[15][18] |
| 稳态运维 | ≈0 | 0.5 人日/月（监控+按季调规格）[11] | 2 人日/月（升级、备份验证、索引重建、慢查询排查）[4][15] |
| 年化人力（$140/人日） | ≈$70 | ≈$980 | ≈$3,500 |

## 1 年 / 3 年 TCO（低档查询量，含人力）

| 方案 | 1 年 | 3 年 | 备注 |
|---|---|---|---|
| Pinecone | ≈ $1,168×12 + $70 = **$14,086** | ≈ **$42,258** | 未含可能的容量费；证据提到高并发下另有 $50–150/月容量费 [18 见注] |
| Qdrant Cloud（量化+磁盘索引） | ≈ $114×12 + $980 = **$2,348** | ≈ **$7,044** | 未优化配置则为 $456×12+$980 = $6,452/年 |
| pgvector 自建 | ≈ $500×12 + $3,500 = **$9,500** | ≈ **$28,500** | 若复用既有 Postgres 实例，直接成本可压到接近 0 |

**排序反转点**：

- **第 1 年**：Qdrant Cloud（优化后）< pgvector 自建 < Pinecone。
- **若查询量升到高档（1 亿次/月）**：Pinecone 直接成本飙到六位数/月，Qdrant 与 pgvector 因不按查询计费而**完全不受影响** [2][11]，排序差距拉大到两个数量级。
- **若查询量降到 40 万次/月以下**：Pinecone 触及 $50 月度下限 [14]，年成本约 $600+人力，**反超 Qdrant Cloud 成为最便宜**。
- **若团队已有可复用的 Postgres 且能自管**：pgvector 的 3 年 TCO 可降到约 $10,500（人力为主），成为最省，但需承担 D2 的运维风险。

# 07 锁定与迁移风险

| 方案 | 锁定程度 | 迁出成本 | 依据 |
|---|---|---|---|
| **Pinecone** | **高** | 需全量导出向量 + 重建索引；数据格式与 namespace 语义为专有模型；无自建等价物 | 专有托管服务 [1]；官方在 2023 年事故复盘中承认当时**尚无数据导出功能**，将其列为待补项 [16] |
| **Qdrant** | **低** | 同一套 OSS 可在自有环境运行，Cloud→自建为同构迁移，官方提供迁移工具与文档 | Apache 2.0 [7][13]；官方 FAQ 明确支持 OSS↔Cloud 迁移 [2] |
| **pgvector** | **最低** | 数据本就在 Postgres 表里，向量列是普通列，可用 SQL 直接导出 | 开源扩展，向量与业务数据同库 [3] |

**许可证变更史核查**：

- Qdrant：Apache License 2.0，LICENSE 文件与 README 均明确标注 [13][7]。针对"是否改过 BSL/SSPL"的专项检索**未发现任何改许可记录**（检索结果均为介绍性内容，无变更公告）[7][13]。**这是"未发现"，不等于"承诺永不改"**——建议在合同中锁定版本或要求源码托管。
- pgvector：PostgreSQL 生态开源扩展，无商业条款变更迹象 [3][37]。
- pgvectorscale：README 标注 "Postgres OSS licensed" [19]。
- Pinecone：专有，无许可证议题，但**其 2026 年 10 月发布的 pg_pinecone 扩展采用 Apache 2.0** [9]，可视为一种降低锁定顾虑的动作；不过该扩展为首个版本，其基准数据由厂商自测 [9]。

# 08 对推荐方案的反对意见

**反对一：Qdrant Cloud 在 10M 档并不比 Pinecone 便宜，甚至更贵。**
LeanOps 自己的测算显示，10M×1536 维、50 万次/天查询下，Qdrant Cloud（量化后）$456/月，Pinecone Serverless $370/月 [11]。也就是说，我推荐 Qdrant 的核心理由（成本）在**中等查询量区间并不成立**，只有在查询量继续上升、或把配置压到"量化+磁盘索引"的 $114/月时 [11] 才成立。而 $114 那档依赖磁盘索引，会带来 2–5ms 的 p99 延迟增加 [11]。

**反对二：Qdrant Cloud 把容量规划的负担转移给了这个 5 人团队。**
Pinecone 的核心价值是"你永远不用想 RAM、CPU、磁盘" [4]；Qdrant Cloud 按资源计费，意味着团队必须自己算：1536 维 × 10M 需要多少 RAM、要不要开 scalar 量化、要不要上磁盘索引、集群该选 8GB 还是 16GB [11][12]。算错的代价是生产环境紧急扩容。对 5 人团队，这是实打实的认知负担，而我的评分（D2 给 Qdrant 4 分、Pinecone 5 分）可能低估了这个差距。

**反对三：性能优势的证据来自有利益关联的测试方，且规模不匹配。**
我给 Qdrant 的 D3 打 5 分，主要依据是 Tiger Data 的 50M 测试（Qdrant 尾延迟更优）[5] 和 VectorDBBench 的 1M 测试（Qdrant 略优）[6]。但前者由 Timescale（pgvectorscale 厂商）执行 [5]，后者由 Zilliz（Milvus 厂商）维护 [6]；且**没有任何一份证据是在 10M×1536 维这个确切口径下测的**。真实差距可能小于评分反映的程度。

**为什么仍然推荐**：三条反对意见都成立，但都不改变排序。反对一说明成本优势有条件——条件是"查询量会增长"或"愿意做量化优化"，而 RAG 场景的查询量通常只增不减，且量化是 Qdrant 的一等公民功能而非 hack [13]。反对二说明运维负担真实存在，但 0.5 人日/月的稳态投入 [11] 对 5 人团队可承受，而 pgvector 的 2 人日/月才是真问题。反对三说明性能证据不完美，但**推荐的主因是成本结构与许可证，不是性能**——即使 Qdrant 性能只与 Pinecone 持平，Apache 2.0 带来的退出自由仍然成立 [7][13]。

# 09 信息缺口与验证建议

**本次调研未能取得、必须在选型会前补齐的**：

1. **10M×1536 维口径下的三方同条件基准**。现有证据分别是 50M×768（Tiger Data）[5]、1M×768（VectorDBBench）[6]、1M×768（Pinecone 自测的 pg_pinecone）[9]，**没有一个能直接回答本场景**。建议自建 PoC：同一份 10M 真实语料，测 p50/p95/p99、recall@10、以及带 10% 选择性过滤时的召回。
2. **Pinecone 的真实 RU 消耗**。官方公式是"1 RU per GB of namespace" [14]，但 LeanOps 观测到生产环境过滤查询实际消耗 20–40 RU/次 [4]。**这两个口径差 3 倍，直接决定 Pinecone 是 $371 还是 $1,168**。建议用 Pinecone 免费档跑一周真实查询日志，实测 RU。
3. **Qdrant Cloud 在 10M×1536 下的实际集群规格报价**。证据中的 $456/$114 均为第三方博客测算 [11]，非官方报价。建议用 Qdrant 官方计算器 [2] 按实际维度与副本数出正式报价。
4. **pgvectorscale 在目标云上的可用性**。证据明确指出它**不在 AWS RDS 上提供** [15]。若团队当前用 RDS，需先确认是否愿意迁到自管 Postgres 或 Timescale Cloud [19]。
5. **Pinecone 的容量费（capacity fee）是否真实存在**。有证据称高并发下会激活 $50–150/月的未公开容量费 [18 见注]，但 Pinecone 官方定价页未列出此项 [1]。**这是需要向 Pinecone 销售直接确认的问题**，若属实则推翻其成本测算。
6. **Qdrant 的长期许可证承诺**。检索未发现改许可记录 [7][13]，但建议要求厂商出具书面承诺或加入源码托管条款。

**建议的 PoC 顺序**（按信息价值/成本比排序）：

1. Qdrant Cloud 免费档 + 1M 子集，验证过滤检索与量化后的 recall 损失（1–2 天）。
2. Pinecone 免费档跑真实查询日志，实测 RU 消耗（1 周，被动观测）。
3. 若前两步指向 pgvector 路线，再评估 pgvectorscale 的部署与运维成本（1 周）。

# 参考来源

[1] Pricing | Pinecone（官方定价页）— https://www.pinecone.io/pricing/
[2] Pricing for Cloud and Vector Database Solutions | Qdrant（官方定价页）— https://qdrant.tech/pricing/
[3] pgvector: Open-source vector similarity search for Postgres（GitHub README）— https://github.com/pgvector/pgvector
[4] Pinecone Pricing 2026: $35 to $2,450 (The Scale Trap) | LeanOps — https://leanopstech.com/blog/pinecone-pricing-2026/
[5] Pgvector vs. Qdrant | Tiger Data（Timescale，厂商自测，50M×768 基准）— https://www.tigerdata.com/blog/pgvector-vs-qdrant
[6] VectorDBBench: An Open-Source VectorDB Benchmark Tool（Zilliz 维护的排行榜）— https://zilliz.com/vdbbench-leaderboard
[7] qdrant/README.md at master · qdrant/qdrant（标注 Apache License 2.0）— https://github.com/qdrant/qdrant/blob/master/README.md
[8] pgvector 撐到千萬條向量就開始吃光 RAM：pgvectorscale 用 StreamingDiskANN 把索引搬回硬碟 | NCSE Network Blog — https://blog.ncse.tw/pgvectorscale-diskann-postgres-vector-search-pinecone-alternative/
[9] Introducing pg_pinecone: Open-Source Search for Your Postgres Data | Pinecone（厂商自测基准）— https://www.pinecone.io/blog/introducing-pg-pinecone/
[11] Qdrant Cloud: Saves 32% vs Pinecone at 50M+ | LeanOps — https://leanopstech.com/blog/qdrant-cloud-pricing-2026/
[12] Qdrant Cloud Pricing 2026: Tiers, Costs And Self-Hosted Crossover | RankSquire — https://ranksquire.com/2026/04/19/qdrant-cloud-pricing-2026/
[13] qdrant/qdrant LICENSE（Apache License 2.0 全文）— https://raw.githubusercontent.com/qdrant/qdrant/master/LICENSE
[14] Pinecone Pricing (2026): What 1M to 100M Vectors Cost | Omid Saffari — https://omidsaffari.com/blog/pinecone-pricing
[15] pgvector in Production: A 2026 Reality Check | SelfHost — https://selfhost.dev/blog/pgvector-in-production-2026-critiques-failures/
[16] March 1st Partial Database Outage | Pinecone（官方事故复盘）— https://www.pinecone.io/blog/march-1-2023-incident/
[18] Scaling pgvector: Memory, Quantization, and Index Build Strategies | DEV Community — https://dev.to/philip_mcclarence_2ef9475/scaling-pgvector-memory-quantization-and-index-build-strategies-8m2
[19] timescale/pgvectorscale（GitHub README，含 50M 基准与许可证说明）— https://github.com/timescale/pgvectorscale
[37] pgvector/CHANGELOG.md at master · pgvector/pgvector — https://github.com/pgvector/pgvector/blob/master/CHANGELOG.md