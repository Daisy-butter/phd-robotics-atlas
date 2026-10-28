# 机器人控制知识谱系（phd-robotics-atlas）

博士个人**领域知识谱系**站点：论文（Paper）、主题（Topic）、方法路线（Method）构成可交互力导向图；阅读笔记（Insight）与每日简报（Digest）**不进入图谱**，在侧栏与独立页面展示。

- **技术栈**：Vite + 原生 ES Module + [force-graph](https://github.com/vasturiano/force-graph)
- **数据真相源**：`content/` Markdown + `content/edges.yaml` → `npm run build:data` → `public/graph.json`
- **部署**：GitHub Pages（base `/phd-robotics-atlas/`）
- **线上**：<https://daisy-butter.github.io/phd-robotics-atlas/>

数据模型详见 [SCHEMA.md](./SCHEMA.md)。

## 功能

- 深色学术风图谱：默认 **Paper + Topic + Method** 核心层，可按类型筛选
- 节点形状区分类型；边图例；搜索 / Topic 芯片过滤；点击高亮邻域
- 侧栏：论文元数据、**阅读笔记（不进图）**、谱系边、LLM 抽取辅助面板
- 路由：`#/` 图谱 · `#/papers` 论文 · `#/digests` 简报

## 本地开发

```bash
npm install
npm run build:data
npm run dev          # http://localhost:5173/phd-robotics-atlas/
npm run build
npm run preview
```

## 添加论文

1. `content/papers/your-slug.md`（见 SCHEMA.md 示例）
2. 可选：`content/insights/` 写笔记，`relatedPapers: [paper-…]`
3. 在 `content/edges.yaml` 补边；`topics` / `methods` 数组会自动生成 `belongs_to_topic` / `uses_method`
4. `npm run build:data`

## Qwen3-7B + vLLM（不在浏览器 / Pages 内运行）

GitHub Pages 是纯静态托管，**无法在访客浏览器或 Pages 上跑 7B GPU 模型**。本仓库提供：

| 组件 | 作用 |
|------|------|
| `docker-compose.vllm.yml` | 本地/服务器 GPU 上启动 vLLM OpenAI 兼容 API（默认 `Qwen/Qwen3-7B`，端口 8000） |
| `scripts/llm_extract.py` | CLI：把论文摘要发给 vLLM，输出建议的 `methods` 与边 JSON |
| 前端 `src/config.js` | `VITE_LLM_MOCK`（默认 mock）与 `VITE_LLM_API_URL` |

### 启动 vLLM（需 NVIDIA GPU + Container Toolkit）

```bash
docker compose -f docker-compose.vllm.yml up -d
# API: http://127.0.0.1:8000/v1/chat/completions
```

### CLI 抽取示例

```bash
export VLLM_BASE_URL=http://127.0.0.1:8000/v1
python3 scripts/llm_extract.py --text-file content/papers/pact-vla.md
```

### 前端连接真实 API（开发机）

创建 `.env.local`：

```env
VITE_LLM_MOCK=false
VITE_LLM_API_URL=http://127.0.0.1:8000/v1/chat/completions
VITE_LLM_MODEL=Qwen/Qwen3-7B
```

重新 `npm run dev`。在图谱中选中 Paper，侧栏点击「从摘要建议 Method / 边」。  
生产 Pages 构建若不注入上述变量，则保持 **Mock**，不会假装在浏览器里跑 7B。

> 若 API 与 Pages 不同源，需自行配置 CORS 或通过同源反向代理；静态站本身不包含 GPU 推理。

## 目录结构

```
content/
  papers/ topics/ methods/ insights/ digests/
  edges.yaml
data/graph.json
scripts/build-graph.mjs
scripts/llm_extract.py
docker-compose.vllm.yml
src/
.github/workflows/deploy-pages.yml
```

## GitHub Pages

仓库 Settings → Pages → Source：**GitHub Actions**（`.github/workflows/deploy-pages.yml`）。

## 许可

私人博士知识库；论文元数据与笔记仅供个人学习研究使用。
