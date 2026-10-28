# 知识谱系数据模型（Schema）

本仓库区分 **图谱实体**（进入 force-graph）与 **附注内容**（Insight / Digest，不进入节点集合）。

## 一、图谱节点（Node）

| type | 含义 | 主要字段 | 默认显示 |
|------|------|----------|----------|
| `Paper` | 论文 / 技术报告 | `id`, `title`, `team`, `date`, `coreIdea`, `paperUrl`, `projectUrl`, `topics[]`, `methods[]`, 正文 | 是 |
| `Topic` | 研究方向 / 问题簇（如「延迟鲁棒部署」「人形全身控制」） | `id`, `title`, `shortLabel`, `description` | 是 |
| `Method` | 技术路线标签（VLA / WAM / WBC / RSI / Agentic 等） | `id`, `title`, `shortLabel`, `description` | 是 |
| `Benchmark` | 基准或数据集 | `id`, `title`, `shortLabel`, `description` | 否（可筛选打开） |
| `Lab` | 实验室 / 机构（可选） | `id`, `title`, `shortLabel` | 否 |
| `Trend` | 阶段性趋势标签（慎用，易泛滥） | `id`, `title`, `description` | 否 |

**id 前缀建议**：`paper-` / `topic-` / `method-` / `benchmark-` / `lab-` / `trend-`。

### 不在图谱中的内容

| 类型 | 存储位置 | 用途 |
|------|----------|------|
| **Insight** | `content/insights/*.md` | 会话 / 精读笔记；编译进 `graph.json` 的 `insights[]`，按 `relatedPapers` / `topics` 在侧栏展示 |
| **Digest** | `content/digests/*.md` | 每日简报；编译进 `graph.json` 的 `digests[]`，在「简报」页展示，**不作为图节点** |

## 二、边（Edge）

定义于 `content/edges.yaml`。编译时还会根据 Paper 的 `topics[]` / `methods[]` **自动补** `belongs_to_topic` / `uses_method`（若尚未手写）。

| type | 中文 | 含义 | 典型方向 | 示例 |
|------|------|------|----------|------|
| `cites` | 引用 | 明确引用关系 | Paper → Paper | A 在 related work 中引用 B |
| `extends` | 扩展 | 在对方框架上推进 | Paper → Paper | HAF-VLA 在 π₀.₅ 上加分层 flow |
| `contrasts` | 对比 | 同问题不同路线 | Paper ↔ Paper | PACT（延迟窗口）vs Fast-VLA（理解/伺服解耦） |
| `uses_method` | 采用方法 | 工作显式采用某技术路线 | Paper → Method | Fast-VLA → method-vla |
| `evaluates_on` | 评测于 | 在基准 / 数据集上报告结果 | Paper → Benchmark | （样例可后续补） |
| `belongs_to_topic` | 归属主题 | 工作落在某问题簇 | Paper → Topic | PACT-VLA → topic-vla |
| `proposes` | 提出 | 提出新方法 / 新设定 | Paper → Method 或 Topic | 新架构论文 → method-xxx |
| `related_to` | 相关 | 概念邻近、共享语境，非严格引用 | Paper ↔ Paper / Topic ↔ Topic | 部署叙事相近的两篇工作 |

```yaml
edges:
  - source: paper-pact-vla
    target: paper-fast-vla
    type: contrasts
    note: 都解决部署效率，路线不同
```

## 三、编译产物

```bash
npm run build:data
```

输出：

- `data/graph.json` — 便于 diff
- `public/graph.json` — 前端 `fetch`

顶层结构：

```json
{
  "meta": {
    "title": "机器人控制知识谱系",
    "generatedAt": "ISO-8601",
    "nodeCount": 0,
    "edgeCount": 0,
    "insightCount": 0,
    "digestCount": 0
  },
  "nodes": [ /* Paper | Topic | Method | … */ ],
  "edges": [ /* 仅连接 nodes 内 id */ ],
  "insights": [ /* 附注，不进 force-graph */ ],
  "digests": [ /* 简报页 */ ]
}
```

## 四、维护建议

1. **图谱**：只放「读论文后愿意画在谱系里」的实体；Insight 写短、可检索，挂在 Paper 侧栏。
2. **边**：少而准；每周手动画几条真读过的关系，避免引用洪水。
3. **Digest**：按日落 `content/digests/digest-YYYY-MM-DD.md`，链到当日 `papers[]`，不必进主图。
4. **LLM 辅助**：浏览器 / GitHub Pages **不能**跑 Qwen3-7B；本地或服务器用 vLLM 起服务，站点通过可配置 API 调用（见 README）。`scripts/llm_extract.py` 可离线从摘要建议 Method 与边。

## 五、Paper frontmatter 示例

```yaml
---
id: paper-example
type: Paper
title: "Example Paper"
team: "Lab"
date: "2026-10-28"
coreIdea: "一句话"
paperUrl: "https://arxiv.org/abs/..."
projectUrl: null
topics: [topic-vla]
methods: [method-vla, method-agentic]
---
正文可选
```

## 六、Insight frontmatter 示例

```yaml
---
id: insight-example
type: Insight
title: "短标题"
date: "2026-10-28"
relatedPapers: [paper-pact-vla]
topics: [topic-vla]
---
笔记正文（不进图节点）
```
