#!/usr/bin/env node
// Validates a country pack against the schema AND against the referential rules
// that a JSON Schema cannot express. Content bugs in this product are not
// cosmetic: a dangling tree edge is a buyer who reaches a dead screen mid-decision.
//
// Usage: node build/validate.mjs content/vietnam/pack.json

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(HERE, '..', 'schema', 'country-pack.schema.json');

const errors = [];
const warnings = [];
const err  = (path, msg) => errors.push(`${path}: ${msg}`);
const warn = (path, msg) => warnings.push(`${path}: ${msg}`);

// ---------------------------------------------------------------------------
// A deliberately small JSON Schema checker covering the subset used by our
// schema. Avoids a dependency so `node build/validate.mjs` works on a clean
// checkout with no install step.
// ---------------------------------------------------------------------------
function checkSchema(node, schema, path) {
  if (schema.enum && !schema.enum.includes(node)) {
    return err(path, `must be one of ${schema.enum.join(', ')} (got ${JSON.stringify(node)})`);
  }

  const t = schema.type;
  if (t === 'object') {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      return err(path, 'expected an object');
    }
    for (const key of schema.required ?? []) {
      if (!(key in node)) err(path, `missing required property "${key}"`);
    }
    const props = schema.properties ?? {};
    for (const [key, value] of Object.entries(node)) {
      if (props[key]) checkSchema(value, props[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) err(path, `unexpected property "${key}"`);
    }
    return;
  }

  if (t === 'array') {
    if (!Array.isArray(node)) return err(path, 'expected an array');
    if (schema.minItems != null && node.length < schema.minItems) {
      err(path, `expected at least ${schema.minItems} item(s), got ${node.length}`);
    }
    if (schema.items) node.forEach((v, i) => checkSchema(v, schema.items, `${path}[${i}]`));
    return;
  }

  if (t === 'string') {
    if (typeof node !== 'string') return err(path, 'expected a string');
    if (schema.pattern && !new RegExp(schema.pattern).test(node)) {
      err(path, `does not match required pattern ${schema.pattern}`);
    }
    if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(node)) {
      err(path, `expected an ISO date (YYYY-MM-DD), got "${node}"`);
    }
    return;
  }

  if (t === 'number' && typeof node !== 'number') err(path, 'expected a number');
  if (t === 'boolean' && typeof node !== 'boolean') err(path, 'expected a boolean');
}

// ---------------------------------------------------------------------------
// Referential integrity — the rules that actually protect the buyer.
// ---------------------------------------------------------------------------
const PHASE_SPINE = [
  'decide', 'documents', 'exit-origin', 'money',
  'arrival', 'first-90-days', 'ongoing', 'contingency',
];

function checkIntegrity(pack) {
  const nodes      = new Map((pack.tree?.nodes ?? []).map(n => [n.id, n]));
  const pathwayIds = new Set((pack.pathways ?? []).map(p => p.id));
  const sourceIds  = new Set((pack.sources ?? []).map(s => s.id));

  // Every source id referenced anywhere must exist in the registry.
  (function walkSourceRefs(value, path) {
    if (Array.isArray(value)) return value.forEach((v, i) => walkSourceRefs(v, `${path}[${i}]`));
    if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value)) {
        if (key === 'sourceIds') {
          v.forEach((id, i) => {
            if (!sourceIds.has(id)) err(`${path}.sourceIds[${i}]`, `cites unknown source "${id}"`);
          });
        } else walkSourceRefs(v, `${path}.${key}`);
      }
    }
  })(pack, 'pack');

  // Tree: entry resolves, edges resolve, node types are well formed.
  if (pack.tree && !nodes.has(pack.tree.entry)) {
    err('tree.entry', `points at unknown node "${pack.tree.entry}"`);
  }
  for (const n of nodes.values()) {
    const at = `tree.nodes[${n.id}]`;
    if (n.type === 'question') {
      if (!n.question) err(at, 'a question node needs a "question"');
      if (!n.answers?.length) err(at, 'a question node needs at least one answer');
      for (const a of n.answers ?? []) {
        if (!nodes.has(a.next)) err(at, `answer "${a.label}" points at unknown node "${a.next}"`);
      }
    }
    if (n.type === 'outcome') {
      if (!n.pathwayId) err(at, 'an outcome node needs a "pathwayId"');
      else if (!pathwayIds.has(n.pathwayId)) err(at, `references unknown pathway "${n.pathwayId}"`);
    }
    if (n.type === 'deadend' && !n.verdict) {
      err(at, 'a dead-end node needs a "verdict" — never leave a buyer with nothing');
    }
  }

  // Reachability, both directions.
  const seen = new Set();
  (function walk(id) {
    if (!id || seen.has(id) || !nodes.has(id)) return;
    seen.add(id);
    for (const a of nodes.get(id).answers ?? []) walk(a.next);
  })(pack.tree?.entry);

  for (const id of nodes.keys()) {
    if (!seen.has(id)) err(`tree.nodes[${id}]`, 'is unreachable from the entry node');
  }

  const reachablePathways = new Set(
    [...seen].map(id => nodes.get(id)).filter(n => n.type === 'outcome').map(n => n.pathwayId)
  );
  for (const id of pathwayIds) {
    if (!reachablePathways.has(id)) {
      err(`pathways[${id}]`, 'is never reached by the decision tree — a buyer can never be routed to it');
    }
  }

  // Modules must fill the fixed phase spine exactly once each.
  const phases = (pack.modules ?? []).map(m => m.phase);
  for (const phase of PHASE_SPINE) {
    if (!phases.includes(phase)) err('modules', `no module covers the required phase "${phase}"`);
  }
  for (const phase of new Set(phases)) {
    if (phases.filter(p => p === phase).length > 1) {
      err('modules', `phase "${phase}" is covered by more than one module`);
    }
  }

  // appliesTo must name real pathways.
  for (const m of pack.modules ?? []) {
    const scopes = [
      [m.appliesTo, `modules[${m.id}].appliesTo`],
      ...(m.items ?? []).map((it, i) => [it.appliesTo, `modules[${m.id}].items[${i}].appliesTo`]),
    ];
    for (const [list, at] of scopes) {
      for (const id of list ?? []) {
        if (id !== '*' && !pathwayIds.has(id)) err(at, `references unknown pathway "${id}"`);
      }
    }
  }

  // Freshness. Immigration content rots; the product must say so out loud.
  const today = new Date().toISOString().slice(0, 10);
  if (pack.meta?.reviewDue && pack.meta.reviewDue < today) {
    err('meta.reviewDue', `pack is overdue for re-verification (due ${pack.meta.reviewDue}) — do not ship`);
  }
  for (const s of pack.sources ?? []) {
    if (s.checkedOn > today) warn(`sources[${s.id}].checkedOn`, 'is in the future');
  }
  for (const g of pack.gotchas ?? []) {
    if (g.expires && g.expires < today) {
      warn(`gotchas["${g.title}"]`, `expired on ${g.expires} — re-check whether this trap still applies`);
    }
  }

  // Uncited claims are a business risk, not just a content one.
  const citedPathways = (pack.pathways ?? []).filter(p =>
    JSON.stringify(p).includes('sourceIds')
  ).length;
  if (citedPathways < (pack.pathways ?? []).length) {
    warn('pathways', `${(pack.pathways ?? []).length - citedPathways} pathway(s) cite no sources at all`);
  }
}

// ---------------------------------------------------------------------------
const packPath = process.argv[2];
if (!packPath) {
  console.error('usage: node build/validate.mjs <path-to-pack.json>');
  process.exit(2);
}

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const pack   = JSON.parse(readFileSync(resolve(packPath), 'utf8'));

checkSchema(pack, schema, 'pack');
checkIntegrity(pack);

for (const w of warnings) console.warn(`  warn  ${w}`);
for (const e of errors)   console.error(`  ERROR ${e}`);

if (errors.length) {
  console.error(`\n${pack.meta?.country ?? packPath}: FAILED with ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(
  `\n${pack.meta.country} pack v${pack.meta.version} OK ` +
  `— ${pack.tree.nodes.length} tree nodes, ${pack.pathways.length} pathways, ` +
  `${pack.modules.length} phase modules, ${pack.gotchas?.length ?? 0} gotchas, ` +
  `${pack.sources.length} sources, ${warnings.length} warning(s).`
);
