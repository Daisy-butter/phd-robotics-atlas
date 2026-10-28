# 机器人控制知识谱系（phd-robotics-atlas）

博士个人知识图谱站点：沉淀论文（Paper）、阅读与讨论观点（Insight）、研究主题（Topic）与每日简报（Digest），并用可交互力导向图展示工作之间的连接。

- **本地路径**：`/workspace/phd-robotics-atlas`
- **技术栈**：Vite + 原生 ES Module + [force-graph](https://github.com/vasturiano/force-graph)（2D）
- **数据真相源**：`content/` 下的 Markdown + `content/edges.yaml`，由脚本编译为 `data/graph.json` / `public/graph.json`
- **部署**：GitHub Pages（base path `/phd-robotics-atlas/`）

## 功能

- 暗色学术风全屏图谱：节点按类型着色，边按关系类型区分
- Hover 标签、点击侧栏详情（团队 / 时间 / 核心 idea / 论文链 / 项目链）
- 搜索过滤、按 Topic 高亮子图、拖拽 / 缩放 / 复位
- Hash 路由：`#/` 图谱，`#/papers` 论文列表

## 本地开发

```bash
cd phd-robotics-atlas
npm install
npm run build:data   # content → graph.json
npm run dev          # http://localhost:5173/phd-robotics-atlas/
npm run build        # 产出 dist/，可挂 Pages
npm run preview      # 预览构建结果
```

> 开发服务器与 Pages 一样使用 base `/phd-robotics-atlas/`，请打开带该前缀的 URL。

## 如何添加一篇论文

1. 在 `content/papers/` 新建 `your-slug.md`，YAML frontmatter 至少包含：

```yaml
---
id: paper-your-slug          # 全局唯一
type: Paper
title: "论文标题"
team: "机构 / 团队"
date: "YYYY-MM-DD"
coreIdea: "一句话核心 idea"
paperUrl: "https://arxiv.org/abs/..."
projectUrl: null              # 或项目页 / GitHub URL
topics: [topic-vla, topic-wbc]
---

可选正文：精读笔记摘要……
```

2. （可选）在 `content/insights/` 写一条 Insight，`relatedPapers` 指向该论文 id。
3. 在 `content/edges.yaml` 补充边（见 [SCHEMA.md](./SCHEMA.md)）。
4. 运行 `npm run build:data`，刷新页面。

脚本也会根据 `topics` / `relatedPapers` / `papers` 字段**自动补** `motivates` 与 `discussed_in` 边（若尚未手写）。

## GitHub 仓库与 Pages（需你在 GitHub 上操作）

本仓库**故意未配置 `git remote`**，避免误推到其他仓库。你在 GitHub 上新建**空仓库** `phd-robotics-atlas`（建议账号 Daisy-Butter）后：

```bash
cd phd-robotics-atlas
git remote add origin git@github.com:Daisy-Butter/phd-robotics-atlas.git
# 或 https://github.com/Daisy-Butter/phd-robotics-atlas.git
git push -u origin main
```

然后：

1. 仓库 **Settings → Pages**
2. Source 选 **GitHub Actions**（本仓已含 `.github/workflows/deploy-pages.yml`）
3. 等待 workflow 跑完后访问：  
   `https://Daisy-Butter.github.io/phd-robotics-atlas/`

若仓库名不是 `phd-robotics-atlas`，请同步修改 `vite.config.js` 里的 `base`。

## 目录结构

```
content/
  papers/ insights/ topics/ digests/   # Markdown 源
  edges.yaml                           # 边定义
data/graph.json                        # 编译产物（亦复制到 public/）
src/                                   # 前端
scripts/build-graph.mjs                # 编译脚本
.github/workflows/deploy-pages.yml
```

## 许可

私人博士知识库；论文元数据与观点仅供个人学习研究使用。
