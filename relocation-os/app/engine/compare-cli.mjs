#!/usr/bin/env node
// Runs one profile against every country pack.
//
//   node app/engine/compare-cli.mjs --profile app/profiles/retiree.json
//   node app/engine/compare-cli.mjs --profile app/profiles/investor.json --facts

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { compareCountries } from './compare.mjs';

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const has = n => argv.includes(`--${n}`);

const path = flag('profile');
if (!path || !existsSync(path)) {
  console.error('usage: node app/engine/compare-cli.mjs --profile <file.json> [--facts] [--closed]');
  console.error('\navailable profiles:');
  for (const f of readdirSync('app/profiles')) console.error(`  app/profiles/${f}`);
  process.exit(2);
}
const profile = JSON.parse(readFileSync(path, 'utf8'));
const packs = readdirSync('content').map(c => JSON.parse(readFileSync(`content/${c}/pack.json`, 'utf8')));
const r = compareCountries(packs, profile);

const B = s => `\x1b[1m${s}\x1b[0m`;
const dim = s => `\x1b[2m${s}\x1b[0m`;
const pad = (s, n) => String(s).padEnd(n);

console.log(`\n${B(profile.label ?? 'Profile')}`);
console.log(dim(`compared across ${packs.length} countries · ${new Date().toISOString().slice(0, 10)}`));
console.log(dim('─'.repeat(76)));

/* the answer, first */
if (!r.verdict.recommended) {
  console.log(`\n${B('NO COUNTRY FITS')}`);
  console.log(`  ${r.verdict.reason}`);
} else {
  console.log(`\n${B('BEST FIT')}  ${B(r.verdict.recommended)} — ${r.verdict.pathway}`);
  console.log(dim(`  ${r.verdict.reason}`));
  if (r.verdict.runnerUp) {
    console.log(dim(`  Runner-up: ${r.verdict.runnerUp.country} — ${r.verdict.runnerUp.pathway}`));
  }
}
for (const w of r.verdict.warnings) console.log(`  ⚠ ${w}`);

/* per country */
console.log(`\n${B('BY COUNTRY')}`);
for (const c of r.countries) {
  const tally = `${c.open.length} open · ${c.check.length} to check · ${c.closed.length} closed`;
  console.log(`\n  ${B(pad(c.country, 10))} ${dim(tally)}`);
  for (const p of c.open) {
    console.log(`    ✓ ${p.name}${p.matchedGroup ? dim(`  [${p.matchedGroup}]`) : ''}`);
    console.log(dim(`        ${p.difficulty.replace('-', ' ')} · ${p.durationGranted ?? ''}`));
  }
  for (const p of c.check) {
    console.log(`    ? ${p.name}`);
    console.log(dim(`        need to know: ${p.unknown.map(u => u.cond.field).join(', ')}`));
  }
  if (has('closed')) {
    for (const p of c.closed) {
      const b = p.blockers[0];
      console.log(dim(`    ✕ ${p.name} — ${b?.cond.because ?? b?.cond.field ?? ''}`));
    }
  }
  if (!c.open.length && !c.check.length && !has('closed')) {
    const common = c.closed[0]?.blockers[0];
    console.log(dim(`    nothing open. Most common blocker: ${common?.cond.because ?? common?.cond.field ?? '—'}`));
  }
}

/* what would change the answer */
if (r.unlocks.length) {
  console.log(`\n${B('WHAT WOULD OPEN MORE DOORS')}`);
  for (const u of r.unlocks.slice(0, 5)) {
    const tag = { close: 'within reach', stretch: 'a stretch', far: 'far off',
                  wait: 'time', 'life-change': 'life change' }[u.reachability];
    console.log(`  ${dim(pad(`[${tag}]`, 16))} ${u.summary}`);
    for (const o of u.opens) console.log(dim(`                   → ${o.country}: ${o.pathway}`));
  }
}

/* the facts that differ */
if (has('facts')) {
  console.log(`\n${B('HOW THEY DIFFER')}`);
  const codes = r.countries.map(c => c.code);
  console.log(dim(`  ${pad('', 42)}${codes.map(c => pad(c, 22)).join('')}`));
  for (const f of r.facts) {
    if (!f.differs) continue;
    console.log(`  ${pad(f.label, 42)}${codes.map(c => pad(f.values[c], 22)).join('')}`);
  }
}
console.log();
