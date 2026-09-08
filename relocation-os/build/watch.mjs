#!/usr/bin/env node
// The content operation's console. Answers one question: what needs checking today?
//
// Run it weekly. Everything it prints is a rule that could already have changed
// under a paying customer.
//
// Usage: node build/watch.mjs [content/*/pack.json ...]   (defaults to all packs)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const packs = args.length ? args : (existsSync('content')
  ? readdirSync('content').map(d => join('content', d, 'pack.json')).filter(existsSync)
  : []);

if (!packs.length) { console.error('no packs found'); process.exit(2); }

const today = new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const STALE_SOURCE_DAYS = 120;

const queue = [];   // { urgency, country, kind, what, due, why }
const add = (urgency, country, kind, what, due, why) =>
  queue.push({ urgency, country, kind, what, due, why });

for (const file of packs) {
  const k = JSON.parse(readFileSync(file, 'utf8'));
  const c = k.meta.country;

  // 1. The pack's own review clock. The validator refuses to build past this.
  if (k.meta.reviewDue) {
    const left = daysBetween(today, k.meta.reviewDue);
    if (left < 0)       add('OVERDUE', c, 'pack review', `re-verify the whole ${c} pack`, k.meta.reviewDue, `${-left} days overdue — the validator will refuse to build`);
    else if (left <= 30) add('SOON',   c, 'pack review', `re-verify the whole ${c} pack`, k.meta.reviewDue, `${left} days left`);
  }

  // 2. Watchlist items with a check date. This is the main queue.
  for (const w of k.watchlist ?? []) {
    if (!w.checkBy) { add('UNDATED', c, 'watchlist', w.title, '—', `status: ${w.status}, impact: ${w.impact} — give it a checkBy date`); continue; }
    const left = daysBetween(today, w.checkBy);
    const urgency = left < 0 ? 'OVERDUE' : left <= 21 ? 'SOON' : 'LATER';
    if (urgency !== 'LATER' || w.impact === 'pathway-changing') {
      add(urgency, c, 'watchlist', w.title, w.checkBy,
        `${w.status}, impact ${w.impact}${left < 0 ? ` — ${-left} days overdue` : ''}`);
    }
  }

  // 3. Gotchas tied to a rule change that has now passed.
  for (const g of k.gotchas ?? []) {
    if (g.expires && daysBetween(today, g.expires) <= 30) {
      add(g.expires < today ? 'OVERDUE' : 'SOON', c, 'gotcha', g.title, g.expires,
        'tied to a dated rule change — confirm the trap still exists, then rewrite or retire it');
    }
  }

  // 4. Sources nobody has looked at in a while.
  const stale = (k.sources ?? [])
    .filter(s => daysBetween(s.checkedOn, today) > STALE_SOURCE_DAYS)
    .sort((a, b) => a.checkedOn.localeCompare(b.checkedOn));
  if (stale.length) {
    add('SOON', c, 'sources', `${stale.length} source(s) unchecked for over ${STALE_SOURCE_DAYS} days`,
      stale[0].checkedOn, stale.slice(0, 4).map(s => s.id).join(', ') + (stale.length > 4 ? ', …' : ''));
  }

  // 5. Anything resting only on weak sources is a standing re-research job.
  const weak = (k.pathways ?? []).filter(p => {
    const ids = [...JSON.stringify(p).matchAll(/"([a-z0-9-]+)"/g)].map(m => m[1]);
    const tiers = (k.sources ?? []).filter(s => ids.includes(s.id)).map(s => s.tier);
    return tiers.length && !tiers.some(t => t === 'primary-law' || t === 'government');
  });
  for (const p of weak) {
    add('LATER', c, 'source tier', `${p.name} rests on commentary only`, '—',
      'find the decree or an official page — this is how the pack stops needing to be taken on trust');
  }
}

const RANK = { OVERDUE: 0, SOON: 1, UNDATED: 2, LATER: 3 };
queue.sort((a, b) => RANK[a.urgency] - RANK[b.urgency] || String(a.due).localeCompare(String(b.due)));

const W = { OVERDUE: '!!', SOON: '! ', UNDATED: '? ', LATER: '  ' };
console.log(`\nRelocation OS — content watch, ${today}\n${'─'.repeat(72)}`);
if (!queue.length) console.log('  Nothing due. Everything is inside its review window.\n');

let last = '';
for (const q of queue) {
  if (q.urgency !== last) { console.log(`\n${q.urgency}`); last = q.urgency; }
  console.log(`  ${W[q.urgency]} [${q.country}/${q.kind}] ${q.what}`);
  console.log(`        due ${q.due} — ${q.why}`);
}

const overdue = queue.filter(q => q.urgency === 'OVERDUE').length;
console.log(`\n${'─'.repeat(72)}`);
console.log(`${queue.length} item(s) in the queue, ${overdue} overdue.`);
console.log(overdue ? 'Clear the overdue items before shipping or promoting any pack.\n' : 'Nothing overdue.\n');
process.exit(overdue ? 1 : 0);
