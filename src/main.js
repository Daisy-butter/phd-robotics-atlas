import './styles.css';
import ForceGraph from 'force-graph';

const TYPE_COLOR = {
  Paper: '#5b8cff',
  Insight: '#f5a524',
  Topic: '#3dd6c6',
  Digest: '#c084fc',
};

const EDGE_COLOR = {
  cites: '#64748b',
  extends: '#3dd6c6',
  contrasts: '#f472b6',
  uses_method: '#60a5fa',
  shares_benchmark: '#a78bfa',
  motivates: '#34d399',
  discussed_in: '#fbbf24',
};

const EDGE_LABEL = {
  cites: '引用',
  extends: '扩展',
  contrasts: '对比',
  uses_method: '方法复用',
  shares_benchmark: '共享基准',
  motivates: '推进/归属',
  discussed_in: '讨论于',
};

const TYPE_LABEL = {
  Paper: '论文',
  Insight: '观点',
  Topic: '主题',
  Digest: '简报',
};

const state = {
  graph: null,
  selectedId: null,
  highlightTopic: null,
  query: '',
  view: 'graph', // graph | papers
  fg: null,
  nodeById: new Map(),
};

const app = document.getElementById('app');

function baseUrl() {
  // Vite BASE_URL ends with /
  return import.meta.env.BASE_URL || '/';
}

async function loadGraph() {
  const url = `${baseUrl()}graph.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load graph.json: ${res.status}`);
  return res.json();
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
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

function connectedIds(id) {
  const set = new Set([id]);
  for (const e of state.graph.edges) {
    if (e.source === id || e.source.id === id) set.add(typeof e.target === 'object' ? e.target.id : e.target);
    if (e.target === id || e.target.id === id) set.add(typeof e.source === 'object' ? e.source.id : e.source);
  }
  return set;
}

function topicRelatedIds(topicId) {
  const set = new Set([topicId]);
  for (const e of state.graph.edges) {
    const s = typeof e.source === 'object' ? e.source.id : e.source;
    const t = typeof e.target === 'object' ? e.target.id : e.target;
    if (s === topicId || t === topicId) {
      set.add(s);
      set.add(t);
    }
  }
  // also papers listing the topic
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
          <p>论文 · Insight · Topic · Digest — 博士个人知识图谱</p>
        </div>
      </div>
      <nav class="nav" role="tablist">
        <button type="button" data-view="graph" class="active">图谱</button>
        <button type="button" data-view="papers">论文列表</button>
      </nav>
      <div class="top-actions">
        <div class="search-wrap">
          <input id="search" type="search" placeholder="搜索论文 / 观点 / 主题…" autocomplete="off" />
        </div>
        <button type="button" class="icon-btn" id="btn-reset" title="复位视图">⟲</button>
      </div>
    </header>
    <div class="main" id="main">
      <section class="graph-pane">
        <div class="graph-toolbar" id="topic-chips"></div>
        <div class="stats-pill" id="stats"></div>
        <div id="graph"></div>
        <div class="legend">
          <span><i class="dot paper"></i>Paper</span>
          <span><i class="dot insight"></i>Insight</span>
          <span><i class="dot topic"></i>Topic</span>
          <span><i class="dot digest"></i>Digest</span>
        </div>
      </section>
      <aside class="side" id="side">
        <div class="side-header">
          <div class="eyebrow">详情</div>
          <h2 id="side-title">点选节点查看</h2>
        </div>
        <div class="side-body" id="side-body">
          <p class="empty-hint">
            拖拽移动节点，滚轮缩放。点击节点查看团队、发布时间、核心 idea 与链接。
            可用顶部 Topic 芯片高亮子图，或切换到「论文列表」浏览。
          </p>
        </div>
      </aside>
      <section class="list-view" id="list-view"></section>
    </div>
  `;

  app.querySelectorAll('.nav button').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.getElementById('search').addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    refreshFilters();
    if (state.view === 'papers') renderPapersList();
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    state.highlightTopic = null;
    state.selectedId = null;
    updateTopicChips();
    refreshFilters();
    renderSide(null);
    if (state.fg) {
      state.fg.zoomToFit(400, 60);
    }
  });
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
      refreshFilters();
    });
  });
}

function setView(view) {
  state.view = view;
  const main = document.getElementById('main');
  main.classList.toggle('list-mode', view === 'papers');
  app.querySelectorAll('.nav button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  if (view === 'papers') renderPapersList();
  else if (state.fg) {
    // force resize after layout change
    setTimeout(() => {
      const g = document.getElementById('graph');
      state.fg.width(g.clientWidth).height(g.clientHeight);
      state.fg.zoomToFit(300, 50);
    }, 50);
  }
}

function nodeRadius(n) {
  if (n.type === 'Topic') return 10;
  if (n.type === 'Paper') return 8;
  if (n.type === 'Insight') return 7;
  return 6;
}

function initForceGraph() {
  const container = document.getElementById('graph');
  const nodes = state.graph.nodes.map((n) => ({ ...n }));
  const links = state.graph.edges.map((e) => ({
    ...e,
    source: e.source,
    target: e.target,
  }));

  const fg = ForceGraph()(container)
    .graphData({ nodes, links })
    .backgroundColor('rgba(0,0,0,0)')
    .nodeId('id')
    .nodeLabel((n) => `${TYPE_LABEL[n.type] || n.type}: ${n.title}`)
    .nodeRelSize(6)
    .nodeVal((n) => nodeRadius(n))
    .nodeColor((n) => TYPE_COLOR[n.type] || '#94a3b8')
    .linkColor((l) => EDGE_COLOR[l.type] || '#475569')
    .linkWidth((l) => (isLinkHighlighted(l) ? 2.2 : 1))
    .linkDirectionalArrowLength(4)
    .linkDirectionalArrowRelPos(1)
    .linkCurvature(0.15)
    .cooldownTicks(80)
    .onNodeClick((n) => {
      state.selectedId = n.id;
      renderSide(n);
      refreshFilters();
    })
    .onBackgroundClick(() => {
      state.selectedId = null;
      renderSide(null);
      refreshFilters();
    });

  fg.nodeCanvasObject((node, ctx, globalScale) => {
    const r = nodeRadius(node);
    const dim = isNodeDimmed(node);
    const selected = state.selectedId === node.id;
    const color = TYPE_COLOR[node.type] || '#94a3b8';

    ctx.globalAlpha = dim ? 0.18 : 1;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r * (selected ? 1.25 : 1), 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    const label = node.type === 'Topic' ? node.label || node.title : shortTitle(node.title, 18);
    const fontSize = Math.max(10 / globalScale, 2.8);
    ctx.font = `${fontSize}px IBM Plex Sans, Noto Sans SC, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = dim ? 'rgba(148,163,184,0.35)' : 'rgba(232,238,249,0.92)';
    ctx.fillText(label, node.x, node.y + r + 2);
    ctx.globalAlpha = 1;
  });

  fg.nodePointerAreaPaint((node, color, ctx) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius(node) + 2, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
  });

  // gentle forces
  fg.d3Force('charge').strength(-180);
  fg.d3Force('link').distance(70);

  state.fg = fg;

  const resize = () => {
    fg.width(container.clientWidth).height(container.clientHeight);
  };
  resize();
  window.addEventListener('resize', resize);
  setTimeout(() => fg.zoomToFit(400, 60), 200);

  document.getElementById('stats').textContent = `${state.graph.meta.nodeCount} nodes · ${state.graph.meta.edgeCount} edges`;
}

function shortTitle(t, max = 20) {
  if (!t) return '';
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function isNodeDimmed(node) {
  if (state.query && !matchesQuery(node, state.query)) return true;
  if (state.highlightTopic) {
    const set = topicRelatedIds(state.highlightTopic);
    if (!set.has(node.id)) return true;
  }
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

function refreshFilters() {
  if (!state.fg) return;
  // trigger repaint
  state.fg.nodeColor(state.fg.nodeColor());
  state.fg.linkWidth((l) => (isLinkHighlighted(l) ? 2.2 : 0.7));
  state.fg.linkColor((l) => {
    const s = typeof l.source === 'object' ? l.source : state.nodeById.get(l.source);
    const t = typeof l.target === 'object' ? l.target : state.nodeById.get(l.target);
    if (s && t && (isNodeDimmed(s) || isNodeDimmed(t))) return 'rgba(71,85,105,0.25)';
    return EDGE_COLOR[l.type] || '#475569';
  });
}

function renderSide(node) {
  const title = document.getElementById('side-title');
  const body = document.getElementById('side-body');
  if (!node) {
    title.textContent = '点选节点查看';
    body.innerHTML = `<p class="empty-hint">拖拽移动节点，滚轮缩放。点击节点查看团队、发布时间、核心 idea 与链接。可用顶部 Topic 芯片高亮子图。</p>`;
    return;
  }
  title.textContent = node.title;
  const links = [];
  if (node.paperUrl) links.push(`<a class="btn-link" href="${node.paperUrl}" target="_blank" rel="noopener">📄 论文页面</a>`);
  if (node.projectUrl) links.push(`<a class="btn-link" href="${node.projectUrl}" target="_blank" rel="noopener">🔗 项目 / GitHub</a>`);

  const conns = [];
  for (const e of state.graph.edges) {
    const s = e.source;
    const t = e.target;
    if (s === node.id) {
      const other = state.nodeById.get(t);
      if (other) conns.push({ edge: e, other, dir: '→' });
    } else if (t === node.id) {
      const other = state.nodeById.get(s);
      if (other) conns.push({ edge: e, other, dir: '←' });
    }
  }

  body.innerHTML = `
    <span class="type-badge ${node.type}">${TYPE_LABEL[node.type] || node.type}</span>
    <div class="meta-grid">
      ${node.team ? `<div class="meta-item"><label>团队</label><div>${escapeHtml(node.team)}</div></div>` : ''}
      ${node.date ? `<div class="meta-item"><label>发布时间</label><div>${escapeHtml(node.date)}</div></div>` : ''}
      ${node.coreIdea ? `<div class="meta-item"><label>核心 Idea</label><div>${escapeHtml(node.coreIdea)}</div></div>` : ''}
      ${node.description ? `<div class="meta-item"><label>简介</label><div>${escapeHtml(node.description)}</div></div>` : ''}
    </div>
    ${links.length ? `<div class="link-row">${links.join('')}</div>` : (node.type === 'Paper' ? `<div class="meta-item"><label>项目页</label><div>暂无</div></div>` : '')}
    ${node.body ? `<div class="body-text">${escapeHtml(node.body)}</div>` : ''}
    ${
      conns.length
        ? `<div class="connected"><h3>关联</h3><div class="conn-list">${conns
            .map(
              (c) => `<button type="button" class="conn-item" data-id="${c.other.id}">
            <span class="etype">${c.dir} ${EDGE_LABEL[c.edge.type] || c.edge.type}${c.edge.note ? ' · ' + escapeHtml(c.edge.note) : ''}</span>
            ${escapeHtml(c.other.title)}
          </button>`
            )
            .join('')}</div></div>`
        : ''
    }
  `;

  body.querySelectorAll('.conn-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = state.nodeById.get(btn.dataset.id);
      if (!n) return;
      state.selectedId = n.id;
      renderSide(n);
      refreshFilters();
      // center camera
      const gNode = state.fg.graphData().nodes.find((x) => x.id === n.id);
      if (gNode) state.fg.centerAt(gNode.x, gNode.y, 600);
    });
  });
}

function renderPapersList() {
  const el = document.getElementById('list-view');
  let papers = state.graph.nodes.filter((n) => n.type === 'Paper');
  if (state.query) papers = papers.filter((n) => matchesQuery(n, state.query));
  if (state.highlightTopic) {
    papers = papers.filter((n) => (n.topics || []).includes(state.highlightTopic));
  }
  papers.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  el.innerHTML = `
    <div class="list-header">
      <div>
        <h2>论文列表</h2>
        <p>共 ${papers.length} 篇 · 点击卡片在图谱中定位</p>
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
          return `<article class="paper-card" data-id="${p.id}">
            <span class="type-badge Paper">Paper</span>
            <h3>${escapeHtml(p.title)}</h3>
            <p class="idea">${escapeHtml(p.coreIdea || '')}</p>
            <div class="meta">
              ${p.team ? `<span class="tag">${escapeHtml(p.team)}</span>` : ''}
              ${p.date ? `<span class="tag">${escapeHtml(p.date)}</span>` : ''}
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
      refreshFilters();
      setTimeout(() => {
        const gNode = state.fg.graphData().nodes.find((x) => x.id === n.id);
        if (gNode) {
          state.fg.centerAt(gNode.x, gNode.y, 700);
          state.fg.zoom(2.2, 700);
        }
      }, 100);
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
  else setView('graph');
}

async function main() {
  renderShell();
  const graph = await loadGraph();
  state.graph = graph;
  state.nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  updateTopicChips();
  initForceGraph();
  window.addEventListener('hashchange', routeFromHash);
  routeFromHash();

  // sync hash when switching views via nav
  app.querySelectorAll('.nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = btn.dataset.view === 'papers' ? '#/papers' : '#/';
    });
  });
}

main().catch((err) => {
  app.innerHTML = `<pre style="padding:2rem;color:#f87171">${escapeHtml(err.message || String(err))}</pre>`;
  console.error(err);
});
