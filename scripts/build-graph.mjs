#!/usr/bin/env node
/**
 * Compile content → data/graph.json
 * Graph nodes: papers, topics, methods (+ optional benchmarks, labs, trends)
 * Annotations: insights, digests (NOT in nodes[])
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'data', 'graph.json');
const PUBLIC_OUT = path.join(ROOT, 'public', 'graph.json');

const GRAPH_DIRS = {
  papers: 'Paper',
  topics: 'Topic',
  methods: 'Method',
  benchmarks: 'Benchmark',
  labs: 'Lab',
  trends: 'Trend',
};

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw.trim() };
  const meta = yaml.load(m[1]) || {};
  const body = (m[2] || '').trim();
  return { meta, body };
}

function walkMd(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkMd(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

function normalizeType(t, fallback) {
  const map = {
    paper: 'Paper',
    topic: 'Topic',
    method: 'Method',
    benchmark: 'Benchmark',
    lab: 'Lab',
    trend: 'Trend',
    insight: 'Insight',
    digest: 'Digest',
  };
  const key = String(t || fallback || '').toLowerCase();
  return map[key] || t || fallback;
}

const nodes = [];
const byId = new Map();

for (const [dir, defaultType] of Object.entries(GRAPH_DIRS)) {
  for (const file of walkMd(path.join(CONTENT, dir))) {
    const raw = fs.readFileSync(file, 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.id) {
      console.warn('skip (no id):', file);
      continue;
    }
    const node = {
      id: meta.id,
      type: normalizeType(meta.type, defaultType),
      title: meta.title || meta.id,
      label: meta.shortLabel || meta.title || meta.id,
      team: meta.team || null,
      date: meta.date || null,
      coreIdea: meta.coreIdea || null,
      paperUrl: meta.paperUrl || null,
      projectUrl: meta.projectUrl || null,
      topics: meta.topics || [],
      methods: meta.methods || [],
      relatedPapers: meta.relatedPapers || [],
      papers: meta.papers || [],
      description: meta.description || null,
      body,
      sourceFile: path.relative(ROOT, file),
    };
    if (byId.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`);
    byId.set(node.id, node);
    nodes.push(node);
  }
}

const insights = [];
for (const file of walkMd(path.join(CONTENT, 'insights'))) {
  const raw = fs.readFileSync(file, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  if (!meta.id) continue;
  insights.push({
    id: meta.id,
    type: 'Insight',
    title: meta.title || meta.id,
    date: meta.date || null,
    relatedPapers: meta.relatedPapers || [],
    topics: meta.topics || [],
    body,
    sourceFile: path.relative(ROOT, file),
  });
}

const digests = [];
for (const file of walkMd(path.join(CONTENT, 'digests'))) {
  const raw = fs.readFileSync(file, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  if (!meta.id) continue;
  digests.push({
    id: meta.id,
    type: 'Digest',
    title: meta.title || meta.id,
    date: meta.date || null,
    papers: meta.papers || [],
    body,
    sourceFile: path.relative(ROOT, file),
  });
}

const edgesPath = path.join(CONTENT, 'edges.yaml');
let edges = [];
if (fs.existsSync(edgesPath)) {
  const doc = yaml.load(fs.readFileSync(edgesPath, 'utf8')) || {};
  edges = (doc.edges || []).map((e, i) => ({
    id: e.id || `e-${i}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    type: e.type,
    note: e.note || null,
  }));
}

const edgeKey = (s, t, ty) => `${s}|${t}|${ty}`;
const existing = new Set(edges.map((e) => edgeKey(e.source, e.target, e.type)));

for (const n of nodes) {
  if (n.type === 'Paper' && Array.isArray(n.topics)) {
    for (const tid of n.topics) {
      const k = edgeKey(n.id, tid, 'belongs_to_topic');
      if (!existing.has(k) && byId.has(tid)) {
        edges.push({
          id: `auto-bt-${n.id}-${tid}`,
          source: n.id,
          target: tid,
          type: 'belongs_to_topic',
          note: 'from paper.topics',
        });
        existing.add(k);
      }
    }
  }
  if (n.type === 'Paper' && Array.isArray(n.methods)) {
    for (const mid of n.methods) {
      const k = edgeKey(n.id, mid, 'uses_method');
      if (!existing.has(k) && byId.has(mid)) {
        edges.push({
          id: `auto-um-${n.id}-${mid}`,
          source: n.id,
          target: mid,
          type: 'uses_method',
          note: 'from paper.methods',
        });
        existing.add(k);
      }
    }
  }
}

const missing = [];
for (const e of edges) {
  if (!byId.has(e.source)) missing.push(`edge ${e.id}: missing source ${e.source}`);
  if (!byId.has(e.target)) missing.push(`edge ${e.id}: missing target ${e.target}`);
}
if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}

for (const ins of insights) {
  for (const pid of ins.relatedPapers) {
    if (!byId.has(pid)) missing.push(`insight ${ins.id}: unknown paper ${pid}`);
  }
}
for (const d of digests) {
  for (const pid of d.papers) {
    if (!byId.has(pid)) missing.push(`digest ${d.id}: unknown paper ${pid}`);
  }
}
if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}

const graph = {
  meta: {
    title: '机器人控制知识谱系',
    generatedAt: new Date().toISOString(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    insightCount: insights.length,
    digestCount: digests.length,
    defaultVisibleTypes: ['Paper', 'Topic', 'Method'],
  },
  nodes,
  edges,
  insights,
  digests,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(path.dirname(PUBLIC_OUT), { recursive: true });
const json = JSON.stringify(graph, null, 2);
fs.writeFileSync(OUT, json);
fs.writeFileSync(PUBLIC_OUT, json);

console.log(
  `Wrote ${nodes.length} nodes, ${edges.length} edges, ${insights.length} insights, ${digests.length} digests`
);
