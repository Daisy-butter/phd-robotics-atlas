#!/usr/bin/env node
/**
 * Compile content/*.md + edges.yaml → data/graph.json
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

const TYPE_DIRS = ['papers', 'insights', 'topics', 'digests'];
const nodes = [];
const byId = new Map();

for (const dir of TYPE_DIRS) {
  for (const file of walkMd(path.join(CONTENT, dir))) {
    const raw = fs.readFileSync(file, 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.id) {
      console.warn('skip (no id):', file);
      continue;
    }
    const node = {
      id: meta.id,
      type: meta.type || dir.replace(/s$/, '').replace(/^./, (c) => c.toUpperCase()),
      title: meta.title || meta.id,
      label: meta.shortLabel || meta.title || meta.id,
      team: meta.team || null,
      date: meta.date || null,
      coreIdea: meta.coreIdea || null,
      paperUrl: meta.paperUrl || null,
      projectUrl: meta.projectUrl || null,
      topics: meta.topics || [],
      relatedPapers: meta.relatedPapers || [],
      papers: meta.papers || [],
      description: meta.description || null,
      body,
      sourceFile: path.relative(ROOT, file),
    };
    // Normalize type casing
    const t = String(node.type);
    if (/^paper$/i.test(t)) node.type = 'Paper';
    else if (/^insight$/i.test(t)) node.type = 'Insight';
    else if (/^topic$/i.test(t)) node.type = 'Topic';
    else if (/^digest$/i.test(t)) node.type = 'Digest';

    if (byId.has(node.id)) {
      throw new Error(`Duplicate node id: ${node.id}`);
    }
    byId.set(node.id, node);
    nodes.push(node);
  }
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

// Auto topic edges from paper.topics if missing
const edgeKey = (s, t, ty) => `${s}|${t}|${ty}`;
const existing = new Set(edges.map((e) => edgeKey(e.source, e.target, e.type)));
for (const n of nodes) {
  if (n.type === 'Paper' && Array.isArray(n.topics)) {
    for (const tid of n.topics) {
      const k = edgeKey(n.id, tid, 'motivates');
      if (!existing.has(k) && byId.has(tid)) {
        edges.push({
          id: `auto-${n.id}-${tid}`,
          source: n.id,
          target: tid,
          type: 'motivates',
          note: 'from paper.topics',
        });
        existing.add(k);
      }
    }
  }
  if (n.type === 'Insight' && Array.isArray(n.relatedPapers)) {
    for (const pid of n.relatedPapers) {
      const k = edgeKey(n.id, pid, 'discussed_in');
      if (!existing.has(k) && byId.has(pid)) {
        edges.push({
          id: `auto-${n.id}-${pid}`,
          source: n.id,
          target: pid,
          type: 'discussed_in',
          note: 'from insight.relatedPapers',
        });
        existing.add(k);
      }
    }
  }
  if (n.type === 'Digest' && Array.isArray(n.papers)) {
    for (const pid of n.papers) {
      const k = edgeKey(n.id, pid, 'discussed_in');
      if (!existing.has(k) && byId.has(pid)) {
        edges.push({
          id: `auto-${n.id}-${pid}`,
          source: n.id,
          target: pid,
          type: 'discussed_in',
          note: 'from digest.papers',
        });
        existing.add(k);
      }
    }
  }
}

// Validate
const missing = [];
for (const e of edges) {
  if (!byId.has(e.source)) missing.push(`edge ${e.id}: missing source ${e.source}`);
  if (!byId.has(e.target)) missing.push(`edge ${e.id}: missing target ${e.target}`);
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
  },
  nodes,
  edges,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(path.dirname(PUBLIC_OUT), { recursive: true });
const json = JSON.stringify(graph, null, 2);
fs.writeFileSync(OUT, json);
fs.writeFileSync(PUBLIC_OUT, json);

console.log(`Wrote ${nodes.length} nodes, ${edges.length} edges → data/graph.json & public/graph.json`);
