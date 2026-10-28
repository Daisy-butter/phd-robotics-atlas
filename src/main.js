import './styles.css';
import ForceGraph from 'force-graph';
import { llmConfig } from './config.js';

const TYPE_COLOR = {
  Paper: '#5b8cff',
  Topic: '#3dd6c6',
  Method: '#a78bfa',
  Benchmark: '#fbbf24',
  Lab: '#94a3b8',
  Trend: '#fb7185',
};

const EDGE_COLOR = {
  cites: '#64748b',
  extends: '#3dd6c6',
  contrasts: '#f472b6',
  uses_method: '#a78bfa',
  evaluates_on: '#fbbf24',
  belongs_to_topic: '#34d399',
  proposes: '#60a5fa',
  related_to: '#94a3b8',
};

const EDGE_LABEL = {
  cites: '引用',
  extends: '扩展',
  contrasts: '对比',
  uses_method: '采用方法',
  evaluates_on: '评测于',
  belongs_to_topic: '归属主题',
  proposes: '提出',
  related_to: '相关',
};

const TYPE_LABEL = {
  Paper: '论文',
  Topic: '主题',
  Method: '方法路线',
  Benchmark: '基准',
  Lab: '机构',
  Trend: '趋势',
};

const CORE_TYPES = ['Paper', 'Topic', 'Method'];

const state = {
  graph: null,
  insights: [],
  digests: [],
  insightsByPaper: new Map(),
  insightsByTopic: new Map(),
  selectedId: null,
  highlightTopic: null,
  query: '',
  view: 'graph',
  visibleTypes: new Set(CORE_TYPES),
  fg: null,
  nodeById: new Map(),
  llmBusy: false,
};

const app = document.getElementById('app');

function baseUrl() {
  return import.meta.env.BASE_URL || '/';
}

async function loadGraph() {
  const url = `${baseUrl()}graph.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load graph.json: ${res.status}`);
  return res.json();
}

function indexInsights(insights) {
  state.insightsByPaper = new Map();
  state.insightsByTopic = new Map();
  for (const ins of insights) {
    for (const pid of ins.relatedPapers || []) {
      if (!state.insightsByPaper.has(pid)) state.insightsByPaper.set(pid, []);
      state.insightsByPaper.get(pid).push(ins);
    }
    for (const tid of ins.topics || []) {
      if (!state.insightsByTopic.has(tid)) state.insightsByTopic.set(tid, []);
      state.insightsByTopic.get(tid).push(ins);
    }
  }
}

function matchesQuery(node, q) {
  if (!q) return true;
  const hay = [
    node.title,
    node.label,
    node.team,
    node.coreIdea,
    node.body,
    node.description,
    ...(node.topics || []),
    ...(node.methods || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

function visibleNode(n) {
  if (!state.visibleTypes.has(n.type)) return false;
  if (state.query && !matchesQuery(n, state.query)) return false;
  if (state.highlightTopic) {
    const set = topicRelatedIds(state.highlightTopic);
    if (!set.has(n.id)) return false;
  }
  return true;
}

function filteredGraphData() {
  const nodes = state.graph.nodes.filter(visibleNode).map((n) => ({ ...n }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = state.graph.edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({ ...e }));
  return { nodes, links };
}

function connectedIds(id) {
  const set = new Set([id]);
  for (const e of state.graph.edges) {
    if (e.source === id) set.add(e.target);
    if (e.target === id) set.add(e.source);
  }
  return set;
}

function topicRelatedIds(topicId) {
  const set = new Set([topicId]);
  for (const e of state.graph.edges) {
    if (e.source === topicId || e.target === topicId) {
      set.add(e.source);
      set.add(e.target);
    }
  }
  for (const n of state.graph.nodes) {
    if ((n.topics || []).includes(topicId)) set.add(n.id);
  }
  return set;
}

function renderShell() {
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"></div>
        <div>
          <h1>机器人控制知识谱系</h1>
          <p>Paper · Topic · Method — 领域知识结构（笔记不进图）</p>
        </div>
      </div>
      <nav class="nav" role="tablist">
        <button type="button" data-view="graph" class="active">知识图谱</button>
        <button type="button" data-view="papers">论文</button>
        <button type="button" data-view="digests">简报</button>
      </nav>
      <div class="top-actions">
        <div class="search-wrap">
          <input id="search" type="search" placeholder="搜索论文 / 主题 / 方法…" autocomplete="off" />
        </div>
        <button type="button" class="icon-btn" id="btn-reset" title="复位视图">⟲</button>
      </div>
    </header>
    <div class="main" id="main">
      <section class="graph-pane">
        <div class="graph-toolbar">
          <div class="toolbar-row">
            <span class="toolbar-label">Topic</span>
            <div id="topic-chips"></div>
          </div>
          <div class="toolbar-row">
            <span class="toolbar-label">节点</span>
            <div id="type-filters" class="type-filters"></div>
          </div>
        </div>
        <div class="stats-pill" id="stats"></div>
        <div id="graph"></div>
        <div class="legend legend-nodes" id="legend-nodes"></div>
        <div class="legend legend-edges" id="legend-edges"></div>
      </section>
      <aside class="side" id="side">
        <div class="side-header">
          <div class="eyebrow">详情</div>
          <h2 id="side-title">点选节点查看</h2>
        </div>
        <div class="side-body" id="side-body">
          <p class="empty-hint">
            默认展示 Paper + Topic + Method 核心层。Insight 与 Digest 不在图中，会在侧栏或「简报」页出现。
            拖拽节点、滚轮缩放；点击节点高亮邻域。
          </p>
        </div>
      </aside>
      <section class="list-view" id="list-view"></section>
      <section class="digest-view" id="digest-view"></section>
    </div>
  `;

  app.querySelectorAll('.nav button').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.getElementById('search').addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    applyGraphFilter();
    if (state.view === 'papers') renderPapersList();
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    state.highlightTopic = null;
    state.selectedId = null;
    updateTopicChips();
    applyGraphFilter();
    renderSide(null);
    if (state.fg) state.fg.zoomToFit(400, 60);
  });
}

function renderTypeFilters() {
  const types = [...new Set(state.graph.nodes.map((n) => n.type))].sort();
  const el = document.getElementById('type-filters');
  el.innerHTML = types
    .map(
      (t) => `
    <label class="type-toggle">
      <input type="checkbox" data-type="${t}" ${state.visibleTypes.has(t) ? 'checked' : ''} />
      <span class="swatch" style="--c:${TYPE_COLOR[t] || '#94a3b8'}"></span>
      ${TYPE_LABEL[t] || t}
    </label>`
    )
    .join('');
  el.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('change', () => {
      if (inp.checked) state.visibleTypes.add(inp.dataset.type);
      else state.visibleTypes.delete(inp.dataset.type);
      applyGraphFilter();
    });
  });
}

function renderLegends() {
  const nodeEl = document.getElementById('legend-nodes');
  nodeEl.innerHTML = CORE_TYPES.map(
    (t) => `<span><i class="dot" style="background:${TYPE_COLOR[t]}"></i>${TYPE_LABEL[t]}</span>`
  ).join('');

  const edgeEl = document.getElementById('legend-edges');
  const used = [...new Set(state.graph.edges.map((e) => e.type))];
  edgeEl.innerHTML =
    `<span class="legend-title">边</span>` +
    used
      .map(
        (ty) =>
          `<span><i class="line" style="background:${EDGE_COLOR[ty] || '#475569'}"></i>${EDGE_LABEL[ty] || ty}</span>`
      )
      .join('');
}

function updateTopicChips() {
  const topics = state.graph.nodes.filter((n) => n.type === 'Topic');
  const el = document.getElementById('topic-chips');
  el.innerHTML =
    `<button type="button" class="chip ${!state.highlightTopic ? 'active' : ''}" data-topic="">全部</button>` +
    topics
      .map(
        (t) =>
          `<button type="button" class="chip ${state.highlightTopic === t.id ? 'active' : ''}" data-topic="${t.id}">${t.label || t.title}</button>`
      )
      .join('');
  el.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.highlightTopic = btn.dataset.topic || null;
      updateTopicChips();
      applyGraphFilter();
    });
  });
}

function setView(view) {
  state.view = view;
  const main = document.getElementById('main');
  main.classList.toggle('list-mode', view === 'papers');
  main.classList.toggle('digest-mode', view === 'digests');
  app.querySelectorAll('.nav button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  if (view === 'papers') renderPapersList();
  else if (view === 'digests') renderDigests();
  else if (state.fg) {
    setTimeout(() => {
      const g = document.getElementById('graph');
      state.fg.width(g.clientWidth).height(g.clientHeight);
      state.fg.zoomToFit(300, 50);
    }, 50);
  }
}

function nodeRadius(n) {
  if (n.type === 'Topic') return 11;
  if (n.type === 'Method') return 9;
  if (n.type === 'Paper') return 8;
  return 7;
}

function isNodeDimmed(node) {
  if (state.selectedId) {
    const set = connectedIds(state.selectedId);
    if (!set.has(node.id) && node.id !== state.selectedId) return true;
  }
  return false;
}

function isLinkHighlighted(l) {
  const s = typeof l.source === 'object' ? l.source.id : l.source;
  const t = typeof l.target === 'object' ? l.target.id : l.target;
  if (state.selectedId && (s === state.selectedId || t === state.selectedId)) return true;
  if (state.highlightTopic && (s === state.highlightTopic || t === state.highlightTopic)) return true;
  return false;
}

function initForceGraph() {
  const container = document.getElementById('graph');
  const { nodes, links } = filteredGraphData();

  const fg = ForceGraph()(container)
    .graphData({ nodes, links })
    .backgroundColor('rgba(0,0,0,0)')
    .nodeId('id')
    .nodeLabel((n) => `${TYPE_LABEL[n.type] || n.type}: ${n.title}`)
    .nodeRelSize(6)
    .nodeVal((n) => nodeRadius(n))
    .nodeColor((n) => TYPE_COLOR[n.type] || '#94a3b8')
    .linkColor((l) => EDGE_COLOR[l.type] || '#475569')
    .linkWidth((l) => (isLinkHighlighted(l) ? 2.4 : 0.85))
    .linkDirectionalArrowLength(5)
    .linkDirectionalArrowRelPos(1)
    .linkCurvature(0.12)
    .cooldownTicks(100)
    .onNodeClick((n) => {
      state.selectedId = n.id;
      renderSide(n);
      refreshPaint();
    })
    .onBackgroundClick(() => {
      state.selectedId = null;
      renderSide(null);
      refreshPaint();
    });

  fg.nodeCanvasObject((node, ctx, globalScale) => {
    const r = nodeRadius(node);
    const dim = isNodeDimmed(node);
    const selected = state.selectedId === node.id;
    const color = TYPE_COLOR[node.type] || '#94a3b8';

    ctx.globalAlpha = dim ? 0.2 : 1;
    ctx.beginPath();
    if (node.type === 'Method') {
      const s = r * (selected ? 1.2 : 1);
      ctx.moveTo(node.x, node.y - s);
      ctx.lineTo(node.x + s, node.y);
      ctx.lineTo(node.x, node.y + s);
      ctx.lineTo(node.x - s, node.y);
      ctx.closePath();
    } else if (node.type === 'Topic') {
      const s = r * (selected ? 1.15 : 1);
      ctx.rect(node.x - s, node.y - s, s * 2, s * 2);
    } else {
      ctx.arc(node.x, node.y, r * (selected ? 1.25 : 1), 0, 2 * Math.PI, false);
    }
    ctx.fillStyle = color;
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    const label =
      node.type === 'Topic' || node.type === 'Method'
        ? node.label || node.title
        : shortTitle(node.title, 20);
    const fontSize = Math.max(10 / globalScale, 2.8);
    ctx.font = `500 ${fontSize}px IBM Plex Sans, Noto Sans SC, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = dim ? 'rgba(148,163,184,0.35)' : 'rgba(232,238,249,0.9)';
    ctx.fillText(label, node.x, node.y + r + 3);
    ctx.globalAlpha = 1;
  });

  fg.nodePointerAreaPaint((node, color, ctx) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius(node) + 3, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
  });

  fg.d3Force('charge').strength(-220);
  fg.d3Force('link').distance(85);

  state.fg = fg;
  const resize = () => fg.width(container.clientWidth).height(container.clientHeight);
  resize();
  window.addEventListener('resize', resize);
  setTimeout(() => fg.zoomToFit(400, 70), 250);
  updateStats();
}

function updateStats() {
  const { nodes, links } = filteredGraphData();
  document.getElementById('stats').textContent =
    `可见 ${nodes.length} 节点 · ${links.length} 边 · ${state.insights.length} 条笔记（图外）`;
}

function applyGraphFilter() {
  if (!state.fg) return;
  const data = filteredGraphData();
  state.fg.graphData(data);
  updateStats();
  refreshPaint();
  setTimeout(() => state.fg.zoomToFit(350, 60), 150);
}

function refreshPaint() {
  if (!state.fg) return;
  state.fg.nodeColor(state.fg.nodeColor());
  state.fg.linkWidth((l) => (isLinkHighlighted(l) ? 2.4 : 0.75));
  state.fg.linkColor((l) => {
    const sid = typeof l.source === 'object' ? l.source.id : l.source;
    const tid = typeof l.target === 'object' ? l.target.id : l.target;
    const s = state.nodeById.get(sid);
    const t = state.nodeById.get(tid);
    if (s && t && (isNodeDimmed(s) || isNodeDimmed(t))) return 'rgba(71,85,105,0.2)';
    return EDGE_COLOR[l.type] || '#475569';
  });
}

function shortTitle(t, max = 20) {
  if (!t) return '';
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function insightsBlock(items) {
  if (!items?.length) return '';
  return `
    <div class="notes-section">
      <h3>阅读笔记 <span class="hint">（不进图谱）</span></h3>
      ${items
        .map(
          (ins) => `
        <article class="note-card">
          <div class="note-head">${escapeHtml(ins.title)}${ins.date ? `<time>${escapeHtml(ins.date)}</time>` : ''}</div>
          <p>${escapeHtml(ins.body)}</p>
        </article>`
        )
        .join('')}
    </div>`;
}

function llmPanelHtml(paper) {
  if (paper.type !== 'Paper') return '';
  const mode = llmConfig.mock ? 'Mock（未连 vLLM）' : 'API';
  return `
    <div class="llm-panel">
      <div class="llm-head">
        <h3>LLM 抽取辅助</h3>
        <span class="tag mono">${mode}</span>
      </div>
      <p class="llm-hint">GitHub Pages 无法在浏览器运行 Qwen3-7B。本地 <code>docker compose -f docker-compose.vllm.yml up</code> 后设置 <code>VITE_LLM_MOCK=false</code>。</p>
      <button type="button" class="btn-primary" id="btn-llm" ${state.llmBusy ? 'disabled' : ''}>
        ${state.llmBusy ? '请求中…' : '从摘要建议 Method / 边'}
      </button>
      <pre class="llm-out" id="llm-out" hidden></pre>
    </div>`;
}

async function runLlmExtract(paper) {
  const outEl = document.getElementById('llm-out');
  if (!outEl) return;
  state.llmBusy = true;
  const btn = document.getElementById('btn-llm');
  if (btn) btn.disabled = true;

  const text = [paper.title, paper.coreIdea, paper.body].filter(Boolean).join('\n');

  try {
    let result;
    if (llmConfig.mock) {
      await new Promise((r) => setTimeout(r, 450));
      result = {
        mock: true,
        methods: paper.methods || ['method-vla'],
        suggested_edges: (paper.topics || []).map((tid) => ({
          target: tid,
          type: 'belongs_to_topic',
          note: '（mock）来自 paper.topics',
        })),
        summary_zh: paper.coreIdea || '（mock 摘要）',
      };
    } else {
      const res = await fetch(llmConfig.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: 'system',
              content:
                '输出 JSON：methods[], suggested_edges[{target,type,note}], summary_zh。method id 以 method- 开头。',
            },
            { role: 'user', content: text.slice(0, 4000) },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '{}';
      result = JSON.parse(raw.replace(/^```json?\n?|\n?```$/g, ''));
    }
    outEl.hidden = false;
    outEl.textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    outEl.hidden = false;
    outEl.textContent = `Error: ${err.message}`;
  } finally {
    state.llmBusy = false;
    if (btn) btn.disabled = false;
  }
}

function renderSide(node) {
  const title = document.getElementById('side-title');
  const body = document.getElementById('side-body');
  if (!node) {
    title.textContent = '点选节点查看';
    body.innerHTML = `<p class="empty-hint">点选 Paper / Topic / Method 查看谱系关系与附注。Insight 仅在此展示，不作为力导向图节点。</p>`;
    return;
  }
  title.textContent = node.title;
  const links = [];
  if (node.paperUrl) links.push(`<a class="btn-link" href="${node.paperUrl}" target="_blank" rel="noopener">论文</a>`);
  if (node.projectUrl) links.push(`<a class="btn-link" href="${node.projectUrl}" target="_blank" rel="noopener">项目</a>`);

  const conns = [];
  for (const e of state.graph.edges) {
    if (e.source === node.id) {
      const other = state.nodeById.get(e.target);
      if (other && state.visibleTypes.has(other.type)) conns.push({ edge: e, other, dir: '→' });
    } else if (e.target === node.id) {
      const other = state.nodeById.get(e.source);
      if (other && state.visibleTypes.has(other.type)) conns.push({ edge: e, other, dir: '←' });
    }
  }

  let notes = [];
  if (node.type === 'Paper') notes = state.insightsByPaper.get(node.id) || [];
  if (node.type === 'Topic') notes = state.insightsByTopic.get(node.id) || [];

  const methodTags = (node.methods || [])
    .map((mid) => state.nodeById.get(mid))
    .filter(Boolean)
    .map((m) => `<span class="tag method">${escapeHtml(m.label || m.title)}</span>`)
    .join('');

  body.innerHTML = `
    <span class="type-badge ${node.type}">${TYPE_LABEL[node.type] || node.type}</span>
    <div class="meta-grid">
      ${node.team ? `<div class="meta-item"><label>团队</label><div>${escapeHtml(node.team)}</div></div>` : ''}
      ${node.date ? `<div class="meta-item"><label>时间</label><div>${escapeHtml(node.date)}</div></div>` : ''}
      ${node.coreIdea ? `<div class="meta-item"><label>核心 Idea</label><div>${escapeHtml(node.coreIdea)}</div></div>` : ''}
      ${node.description ? `<div class="meta-item"><label>说明</label><div>${escapeHtml(node.description)}</div></div>` : ''}
      ${methodTags ? `<div class="meta-item"><label>方法</label><div class="tag-row">${methodTags}</div></div>` : ''}
    </div>
    ${links.length ? `<div class="link-row">${links.join('')}</div>` : ''}
    ${node.body ? `<div class="body-text">${escapeHtml(node.body)}</div>` : ''}
    ${insightsBlock(notes)}
    ${
      conns.length
        ? `<div class="connected"><h3>谱系关联</h3><div class="conn-list">${conns
            .map(
              (c) => `<button type="button" class="conn-item" data-id="${c.other.id}">
            <span class="etype">${c.dir} ${EDGE_LABEL[c.edge.type] || c.edge.type}${c.edge.note ? ' · ' + escapeHtml(c.edge.note) : ''}</span>
            ${escapeHtml(c.other.title)}
          </button>`
            )
            .join('')}</div></div>`
        : ''
    }
    ${llmPanelHtml(node)}
  `;

  body.querySelectorAll('.conn-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = state.nodeById.get(btn.dataset.id);
      if (!n) return;
      state.selectedId = n.id;
      renderSide(n);
      refreshPaint();
      const gNode = state.fg.graphData().nodes.find((x) => x.id === n.id);
      if (gNode) state.fg.centerAt(gNode.x, gNode.y, 600);
    });
  });

  const llmBtn = document.getElementById('btn-llm');
  if (llmBtn) llmBtn.addEventListener('click', () => runLlmExtract(node));
}

function renderPapersList() {
  const el = document.getElementById('list-view');
  let papers = state.graph.nodes.filter((n) => n.type === 'Paper');
  if (state.query) papers = papers.filter((n) => matchesQuery(n, state.query));
  if (state.highlightTopic) papers = papers.filter((n) => (n.topics || []).includes(state.highlightTopic));
  papers.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  el.innerHTML = `
    <div class="list-header">
      <div>
        <h2>论文库</h2>
        <p>${papers.length} 篇 · 点击卡片在图谱中定位</p>
      </div>
    </div>
    <div class="paper-grid">
      ${papers
        .map((p) => {
          const topics = (p.topics || [])
            .map((tid) => state.nodeById.get(tid))
            .filter(Boolean)
            .map((t) => `<span class="tag">${escapeHtml(t.label || t.title)}</span>`)
            .join('');
          const noteCount = (state.insightsByPaper.get(p.id) || []).length;
          return `<article class="paper-card" data-id="${p.id}">
            <span class="type-badge Paper">Paper</span>
            <h3>${escapeHtml(p.title)}</h3>
            <p class="idea">${escapeHtml(p.coreIdea || '')}</p>
            <div class="meta">
              ${p.team ? `<span class="tag">${escapeHtml(p.team)}</span>` : ''}
              ${p.date ? `<span class="tag">${escapeHtml(p.date)}</span>` : ''}
              ${noteCount ? `<span class="tag note">${noteCount} 笔记</span>` : ''}
              ${topics}
            </div>
          </article>`;
        })
        .join('')}
    </div>
  `;

  el.querySelectorAll('.paper-card').forEach((card) => {
    card.addEventListener('click', () => {
      const n = state.nodeById.get(card.dataset.id);
      state.selectedId = n.id;
      setView('graph');
      renderSide(n);
      refreshPaint();
      setTimeout(() => {
        const gNode = state.fg.graphData().nodes.find((x) => x.id === n.id);
        if (gNode) {
          state.fg.centerAt(gNode.x, gNode.y, 700);
          state.fg.zoom(2.2, 700);
        }
      }, 120);
    });
  });
}

function renderDigests() {
  const el = document.getElementById('digest-view');
  const items = [...state.digests].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  el.innerHTML = `
    <div class="list-header">
      <div>
        <h2>每日简报</h2>
        <p>内容页，不进入主图谱</p>
      </div>
    </div>
    <div class="digest-list">
      ${items
        .map((d) => {
          const paperLinks = (d.papers || [])
            .map((pid) => state.nodeById.get(pid))
            .filter(Boolean)
            .map(
              (p) =>
                `<button type="button" class="tag linkish" data-paper="${p.id}">${escapeHtml(shortTitle(p.title, 42))}</button>`
            )
            .join('');
          return `<article class="digest-card">
            <header>
              <time>${escapeHtml(d.date || '')}</time>
              <h3>${escapeHtml(d.title)}</h3>
            </header>
            <p>${escapeHtml(d.body)}</p>
            <div class="meta">${paperLinks}</div>
          </article>`;
        })
        .join('')}
    </div>
  `;
  el.querySelectorAll('[data-paper]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = state.nodeById.get(btn.dataset.paper);
      if (!n) return;
      state.selectedId = n.id;
      setView('graph');
      renderSide(n);
      refreshPaint();
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function routeFromHash() {
  const h = (location.hash || '#/').replace(/^#/, '');
  if (h.startsWith('/papers')) setView('papers');
  else if (h.startsWith('/digests')) setView('digests');
  else setView('graph');
}

async function main() {
  renderShell();
  const graph = await loadGraph();
  state.graph = graph;
  state.insights = graph.insights || [];
  state.digests = graph.digests || [];
  indexInsights(state.insights);
  state.nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const defaults = graph.meta?.defaultVisibleTypes;
  if (Array.isArray(defaults)) state.visibleTypes = new Set(defaults);

  updateTopicChips();
  renderTypeFilters();
  renderLegends();
  initForceGraph();
  window.addEventListener('hashchange', routeFromHash);
  routeFromHash();

  app.querySelectorAll('.nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      location.hash = v === 'papers' ? '#/papers' : v === 'digests' ? '#/digests' : '#/';
    });
  });
}

main().catch((err) => {
  app.innerHTML = `<pre class="fatal">${escapeHtml(err.message || String(err))}</pre>`;
  console.error(err);
});
