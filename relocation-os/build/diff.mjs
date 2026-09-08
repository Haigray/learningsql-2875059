#!/usr/bin/env node
// Compares two editions of a country pack and writes the customer update.
//
// The freshness operation only pays off if buyers SEE it, so this turns a
// content change into the email that proves the product is alive.
//
// Usage:
//   node build/diff.mjs old.json new.json            human-readable diff
//   node build/diff.mjs old.json new.json --email    draft the buyer update
//   node build/diff.mjs --git HEAD~1 content/vietnam/pack.json

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const wantEmail = argv.includes('--email');
const args = argv.filter(a => a !== '--email');

let oldPack, newPack, oldLabel;
if (args[0] === '--git') {
  const [, ref, file] = args;
  const rel = execSync(`git ls-files --full-name "${file}"`, { encoding: 'utf8' }).trim() || file;
  oldPack = JSON.parse(execSync(`git show ${ref}:${rel}`, { encoding: 'utf8' }));
  newPack = JSON.parse(readFileSync(file, 'utf8'));
  oldLabel = ref;
} else {
  if (args.length < 2) { console.error('usage: node build/diff.mjs <old.json> <new.json> [--email]'); process.exit(2); }
  oldPack = JSON.parse(readFileSync(args[0], 'utf8'));
  newPack = JSON.parse(readFileSync(args[1], 'utf8'));
  oldLabel = args[0];
}

// Compare keyed collections so a reordering is not reported as a change.
const keyed = (arr, key) => new Map((arr ?? []).map(x => [typeof key === 'function' ? key(x) : x[key], x]));

const changes = [];   // { area, kind, id, detail, material }
const note = (area, kind, id, detail, material = false) => changes.push({ area, kind, id, detail, material });

function compare(area, oldArr, newArr, key, label = x => x[key] ?? x.title ?? x.id) {
  const o = keyed(oldArr, key), n = keyed(newArr, key);
  for (const [id, item] of n) {
    if (!o.has(id)) { note(area, 'added', label(item), 'new entry', true); continue; }
    const before = JSON.stringify(o.get(id)), after = JSON.stringify(item);
    if (before !== after) {
      // Identify which fields actually moved, so the email can be specific.
      const fields = Object.keys(item).filter(f =>
        JSON.stringify(item[f]) !== JSON.stringify(o.get(id)[f]));
      note(area, 'changed', label(item), `field(s): ${fields.join(', ')}`,
        fields.some(f => !['sourceIds', 'note'].includes(f)));
    }
  }
  for (const [id, item] of o) if (!n.has(id)) note(area, 'removed', label(item), 'entry removed', true);
}

compare('pathway',   oldPack.pathways,    newPack.pathways,    'id',       x => x.name);
compare('gotcha',    oldPack.gotchas,     newPack.gotchas,     'title');
compare('module',    oldPack.modules,     newPack.modules,     'id',       x => x.title);
compare('reality',   oldPack.realityCheck, newPack.realityCheck, 'claim',  x => x.claim.slice(0, 60));
compare('contested', oldPack.contested,   newPack.contested,   'question', x => x.question.slice(0, 60));
compare('watchlist', oldPack.watchlist,   newPack.watchlist,   'title');
compare('source',    oldPack.sources,     newPack.sources,     'id',       x => x.id);

if (oldPack.meta.verifiedAsOf !== newPack.meta.verifiedAsOf) {
  note('meta', 'changed', 'verifiedAsOf', `${oldPack.meta.verifiedAsOf} → ${newPack.meta.verifiedAsOf}`);
}

/* ------------------------------------------------------------------ output */

if (!wantEmail) {
  console.log(`\n${newPack.meta.country}: ${oldLabel} (v${oldPack.meta.version}) → v${newPack.meta.version}`);
  console.log('─'.repeat(72));
  if (!changes.length) console.log('  No content changes.\n');
  let last = '';
  for (const c of changes.sort((a, b) => a.area.localeCompare(b.area))) {
    if (c.area !== last) { console.log(`\n${c.area}`); last = c.area; }
    console.log(`  ${c.material ? '*' : ' '} ${c.kind.padEnd(8)} ${c.id}`);
    console.log(`             ${c.detail}`);
  }
  const material = changes.filter(c => c.material).length;
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${changes.length} change(s), ${material} material.`);
  console.log(material
    ? 'Material changes: bump the minor version, add a changelog entry, and send the update.\n'
    : 'Cosmetic only: a patch bump is enough, no email needed.\n');
  process.exit(0);
}

// The buyer-facing update, drafted from the changelog entry for this version.
const entry = (newPack.changelog ?? []).find(e => e.version === newPack.meta.version);
const actions = (entry?.changes ?? []).filter(c => c.actionRequired);
const ruleChanges = (entry?.changes ?? []).filter(c => c.kind === 'rule-change');

console.log(`Subject: ${newPack.meta.country} guide updated${ruleChanges.length ? ' — a rule changed' : ''} (v${newPack.meta.version})

Your ${newPack.meta.country} Relocation Guide has been updated to v${newPack.meta.version}, verified ${newPack.meta.verifiedAsOf}.

${entry?.summary ?? 'Content refreshed against current sources.'}

${actions.length ? `WHAT YOU NEED TO DO

${actions.map(c => `- ${c.actionRequired}`).join('\n')}
` : 'Nothing in this update requires action from you — it is a refresh.\n'}
WHAT CHANGED

${(entry?.changes ?? []).map(c => `- [${c.kind}] ${c.what}`).join('\n') || '- Sources re-verified with no substantive change.'}

Your updated guide: [link]

This is why the guide is worth keeping rather than reading once. ${newPack.meta.country}'s
rules move, and every buyer gets every update at no extra cost.

— [Your name]

---
${changes.filter(c => c.material).length} material change(s) detected by build/diff.mjs.
${(newPack.watchlist ?? []).filter(w => w.impact === 'pathway-changing').length} pathway-changing item(s) still on the watchlist.`);
