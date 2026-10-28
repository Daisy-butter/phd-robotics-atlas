# 数据模型 Schema

## 节点类型（Node）

| type | 含义 | 主要字段 |
|------|------|----------|
| `Paper` | 论文 / 技术报告 | `id`, `title`, `team`, `date`, `coreIdea`, `paperUrl`, `projectUrl`, `topics[]` |
| `Insight` | 会话或精读产生的观点 | `id`, `title`, `date`, `relatedPapers[]`, `topics[]`, 正文 |
| `Topic` | 研究主题簇 | `id`, `title`, `shortLabel`, `description` |
| `Digest` | 每日/阶段性简报 | `id`, `title`, `date`, `papers[]` |

所有节点 id 全局唯一，建议前缀：`paper-` / `insight-` / `topic-` / `digest-`。

## 边类型（Edge）

写在 `content/edges.yaml`：

| type | 含义 | 典型方向 |
|------|------|----------|
| `cites` | 引用 | Paper → Paper |
| `extends` | 扩展 / 在其上推进 | Paper → Paper |
| `contrasts` | 对比 / 不同路线 | Paper ↔ Paper |
| `uses_method` | 方法复用 | Paper → Paper |
| `shares_benchmark` | 共享基准或相近评测语境 | Paper ↔ Paper |
| `motivates` | 推进某主题，或观点驱动某方向 | Paper/Insight → Topic |
| `discussed_in` | 在观点或简报中被讨论 | Insight/Digest → Paper |

示例：

```yaml
edges:
  - source: paper-a
    target: paper-b
    type: contrasts
    note: 可选说明
```

## 编译

```bash
npm run build:data
```

产出：

- `data/graph.json` — 便于 diff / 备份
- `public/graph.json` — 供前端 `fetch`

`graph.json` 顶层：

```json
{
  "meta": { "title": "...", "generatedAt": "...", "nodeCount": N, "edgeCount": M },
  "nodes": [ /* ... */ ],
  "edges": [ /* ... */ ]
}
```

## 维护建议

- 每天简报落入 `content/digests/digest-YYYY-MM-DD.md`，并链到当日论文。
- Insight 写短、可检索；长对话不必全文入库。
- 边先少而准：宁可每周手动画几条「真读过的关系」，不要全自动引用洪水。
