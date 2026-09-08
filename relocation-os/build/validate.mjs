#!/usr/bin/env node
// Validates a country pack against the schema AND against the referential rules
// that a JSON Schema cannot express. Content bugs in this product are not
// cosmetic: a dangling tree edge is a buyer who reaches a dead screen mid-decision.
//
// Usage: node build/validate.mjs content/vietnam/pack.json

import { readFileSync } from 'node:fs';
import { parseWindow, buildPlan } from '../app/engine/plan.mjs';
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
  const today = new Date().toISOString().slice(0, 10);
  const nodes      = new Map((pack.tree?.nodes ?? []).map(n => [n.id, n]));
  const pathwayIds = new Set((pack.pathways ?? []).map(p => p.id));
  const sourceIds  = new Set((pack.sources ?? []).map(s => s.id));
  const sourceById = new Map((pack.sources ?? []).map(s => [s.id, s]));

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

  // --- Edition and assurance ------------------------------------------------
  // The whole no-adviser model rests on these being enforced, not aspirational.
  if (pack.meta?.edition === 'reviewed' && !pack.meta.reviewedBy) {
    err('meta.edition', "claims 'reviewed' but names no reviewer — never claim professional review without one");
  }

  for (const pw of pack.pathways ?? []) {
    // Self-verification is the substitute for a paid reviewer. No exceptions.
    if (!pw.verification?.length) {
      err(`pathways[${pw.id}].verification`, 'has no self-verification steps — a buyer cannot confirm this pathway without us');
    }
    // Point buyers at the government, not at commentary.
    const anyOfficial = (pw.verification ?? []).some(v =>
      v.url || pack.sources.some(s => s.isOfficialPortal && s.title.toLowerCase().includes(v.authority.toLowerCase().slice(0, 12)))
    );
    if (pw.verification?.length && !anyOfficial) {
      warn(`pathways[${pw.id}].verification`, 'no verification step links an official portal — prefer a government URL the buyer can open');
    }
    // A pathway resting only on blogs is a pathway to re-research.
    const tiers = new Set();
    JSON.stringify(pw).replace(/"sourceIds":\[([^\]]*)\]/g, (_, ids) => {
      ids.split(',').forEach(raw => {
        const s = sourceById.get(raw.trim().replace(/"/g, ''));
        if (s) tiers.add(s.tier);
      });
      return '';
    });
    if (tiers.size && !tiers.has('primary-law') && !tiers.has('government')) {
      warn(`pathways[${pw.id}]`, 'rests entirely on professional/community sources — upgrade at least one claim to primary law or a government page');
    }
  }

  // --- Contested claims -----------------------------------------------------
  for (const c of pack.contested ?? []) {
    for (const pos of c.positions) {
      for (const id of pos.sourceIds ?? []) {
        if (!sourceIds.has(id)) err(`contested["${c.question}"]`, `position cites unknown source "${id}"`);
      }
    }
    if (!c.practicalEffect) {
      warn(`contested["${c.question}"]`, 'states a dispute but not what the buyer should do meanwhile');
    }
  }

  // --- Watchlist ------------------------------------------------------------
  for (const w of pack.watchlist ?? []) {
    for (const id of w.affectsPathways ?? []) {
      if (!pathwayIds.has(id)) err(`watchlist["${w.title}"]`, `references unknown pathway "${id}"`);
    }
    if (w.checkBy && w.checkBy < today) {
      warn(`watchlist["${w.title}"]`, `was due for a check on ${w.checkBy} — run build/watch.mjs`);
    }
    // A pathway-changing rumour is dangerous unless the buyer-facing copy
    // already says it is unconfirmed. Check that it actually does.
    if (w.status === 'rumoured' && w.impact === 'pathway-changing') {
      const facing = JSON.stringify([pack.realityCheck ?? [], pack.gotchas ?? []]);
      const flagged = (w.sourceIds ?? []).some(id => facing.includes(id));
      if (!flagged) {
        err(`watchlist["${w.title}"]`,
          'is a pathway-changing rumour that no reality-check or gotcha entry warns about — buyers will meet this claim in the wild and must be told it is unconfirmed');
      }
    }
  }

  // --- Scheduling metadata -------------------------------------------------
  // The app's plan engine reads this. A dangling reference here becomes a task
  // that silently never appears on someone's plan.
  const allItems = (pack.modules ?? []).flatMap(m =>
    m.items.map((it, i) => ({ ...it, _at: `modules[${m.id}].items[${i}]`, _module: m })));
  const itemKeys = new Set(allItems.filter(i => i.key).map(i => i.key));

  const seenKeys = new Set();
  for (const it of allItems) {
    if (!it.key) continue;
    if (seenKeys.has(it.key)) err(it._at, `duplicate item key "${it.key}"`);
    seenKeys.add(it.key);
  }

  for (const it of allItems) {
    const s = it.schedule;
    if (!s) continue;
    if (!it.key) err(it._at, 'has a schedule but no key — nothing can reference it and it cannot be tracked across edits');

    for (const dep of s.dependsOn ?? []) {
      if (!itemKeys.has(dep)) err(it._at, `schedule.dependsOn references unknown key "${dep}"`);
    }
    if (s.consumedBy && !itemKeys.has(s.consumedBy)) {
      err(it._at, `schedule.consumedBy references unknown key "${s.consumedBy}"`);
    }
    if (s.shelfLifeDays && !s.consumedBy) {
      err(it._at, 'has shelfLifeDays but no consumedBy — the engine cannot time it without knowing when it is used');
    }
    if (s.consumedBy === it.key) err(it._at, 'is consumed by itself');

    // A shelf life shorter than the time it takes to obtain can never be satisfied.
    if (s.shelfLifeDays && s.durationDays && s.durationDays >= s.shelfLifeDays) {
      err(it._at, `takes ${s.durationDays} days to obtain but is valid for only ${s.shelfLifeDays} — impossible to use`);
    }

    // Scheduling only reaches a plan if the item and its consumer share a pathway.
    if (s.consumedBy) {
      const consumer = allItems.find(x => x.key === s.consumedBy);
      const scopeOf = x => x.appliesTo?.filter(p => p !== '*') ?? [];
      const a = scopeOf(it), b = consumer ? scopeOf(consumer) : [];
      if (a.length && b.length && !a.some(p => b.includes(p))) {
        err(it._at, `shares no pathway with its consumer "${s.consumedBy}", so it will never be scheduled`);
      }
    }
  }

  // The module windows must actually parse, or nothing in them gets a date.
  for (const m of pack.modules ?? []) {
    const dated = !['ongoing', 'contingency'].includes(m.phase);
    if (dated && !parseWindow(m.window)) {
      err(`modules[${m.id}].window`, `"${m.window ?? ''}" is not a parsable window like "T-90 to T-30 days" — its items cannot be placed on a plan`);
    }
  }

  // Finally: build a real plan for every pathway. Catches cycles and anything
  // the static checks above miss.
  for (const pw of pack.pathways ?? []) {
    try {
      const plan = buildPlan(pack, { pathwayId: pw.id, targetMoveDate: '2027-06-01', today: '2026-09-08' });
      for (const t of plan.tasks) {
        for (const w of t.warnings) warn(`plan[${pw.id}].${t.key}`, w);
      }
    } catch (e) {
      err(`plan[${pw.id}]`, `plan engine cannot build a plan: ${e.message}`);
    }
  }

  // --- Changelog ------------------------------------------------------------
  const log = pack.changelog ?? [];
  if (log.length) {
    if (log[0].version !== pack.meta.version) {
      err('changelog[0]', `newest entry is v${log[0].version} but meta.version is v${pack.meta.version} — bump one of them`);
    }
    const cmp = v => v.split('.').map(Number);
    for (let i = 1; i < log.length; i++) {
      const [a, b] = [cmp(log[i - 1].version), cmp(log[i].version)];
      const newer = a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
      if (!newer) err(`changelog[${i}]`, `v${log[i].version} is not older than v${log[i - 1].version} — changelog must be newest first`);
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
