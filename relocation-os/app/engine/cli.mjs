#!/usr/bin/env node
// Drives the plan engine from the terminal, so its output can be inspected
// without building an app first. The React Native Today screen renders exactly
// these fields.
//
//   node app/engine/cli.mjs --country vietnam --pathway work-permit-ld --move 2027-06-01
//   node app/engine/cli.mjs --country cambodia --pathway employed-eb --move 2027-03-01 --timeline

import { readFileSync, existsSync } from 'node:fs';
import { buildPlan, todayView, diffDays } from './plan.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = name => argv.includes(`--${name}`);

const country = flag('country');
if (!country) {
  console.error(`usage: node app/engine/cli.mjs --country <name> --pathway <id> --move <YYYY-MM-DD>
       optional: --entry <YYYY-MM-DD>  --today <YYYY-MM-DD>  --timeline  --all`);
  process.exit(2);
}
const file = `content/${country}/pack.json`;
if (!existsSync(file)) { console.error(`no pack at ${file}`); process.exit(2); }
const pack = JSON.parse(readFileSync(file, 'utf8'));

const pathwayId = flag('pathway');
if (!pathwayId) {
  console.error(`pathways in ${pack.meta.country}:`);
  for (const p of pack.pathways) console.error(`  ${p.id.padEnd(24)} ${p.name}`);
  process.exit(2);
}

const move = flag('move', '2027-06-01');
const plan = buildPlan(pack, {
  pathwayId,
  targetMoveDate: move,
  entryDate: flag('entry', move),
  today: flag('today'),
});

const B = s => `\x1b[1m${s}\x1b[0m`;
const dim = s => `\x1b[2m${s}\x1b[0m`;
const rule = () => console.log(dim('─'.repeat(74)));

console.log(`\n${B(`${plan.country} — ${plan.pathway.name}`)}`);
console.log(dim(`pack v${plan.packVersion} · move ${plan.targetMoveDate} · today ${plan.today}`));
rule();

const s = plan.summary;
console.log(`${s.total} tasks · ${B(s.ready)} ready · ${s.waiting} not yet · ${s.locked} blocked · ` +
            `${s.overdue} overdue · ${s.critical} critical`);

if (!plan.feasibility.ok) {
  console.log(`\n${B('⚠ THIS MOVE DATE DOES NOT WORK')}`);
  for (const p of plan.feasibility.problems) console.log(`  · ${p.title} — ${p.reason}`);
  if (plan.feasibility.earliestFeasibleMoveDate) {
    console.log(`  Earliest date that works: ${B(plan.feasibility.earliestFeasibleMoveDate)}`);
  }
}

const view = todayView(plan, 6);

if (view.overdue.length) {
  console.log(`\n${B('OVERDUE')}`);
  for (const t of view.overdue) console.log(`  ! ${t.title}${dim(`  (was due ${t.latestStart})`)}`);
}

console.log(`\n${B('DO NOW')}`);
if (!view.doNow.length) console.log(dim('  nothing actionable today'));
for (const t of view.doNow) {
  console.log(`  ${t.critical ? '●' : '○'} ${t.title}`);
  console.log(dim(`      by ${t.latestStart ?? '—'} · ${t.moduleTitle}`));
}

// The differentiating screen: things you should deliberately NOT do yet.
if (view.doNotYet.length) {
  console.log(`\n${B('DO NOT ORDER YET')}  ${dim('these expire before they are needed')}`);
  for (const t of view.doNotYet) {
    const w = t.shelfLife.orderWindow;
    console.log(`  ⏳ ${t.title}`);
    console.log(dim(`      valid ${t.shelfLife.days} days · needed ${t.shelfLife.consumedOn} for "${t.shelfLife.consumedByTitle}"`));
    console.log(`      ${B(`order between ${w.from} and ${w.to}`)}` +
                dim(`  (${diffDays(plan.today, w.from)} days from now)`));
  }
}

if (plan.alerts.length) {
  console.log(`\n${B('ALERTS')}`);
  for (const a of plan.alerts) {
    console.log(`  ${a.severity === 'high' ? '!' : '·'} ${a.message}`);
  }
}

if (has('timeline') || has('all')) {
  console.log(`\n${B('TIMELINE')}`);
  let phase = '';
  for (const t of plan.tasks) {
    if (!has('all') && ['ongoing', 'contingency'].includes(t.state)) continue;
    if (t.phase !== phase) { phase = t.phase; console.log(dim(`\n  ── ${phase} ──`)); }
    const when = t.dueDate ?? t.latestStart ?? '—';
    const mark = { overdue: '!', ready: '●', waiting: '⏳', locked: '□', infeasible: '✕',
                   reorder: '↻', done: '✓' }[t.state] ?? '·';
    console.log(`  ${mark} ${String(when).padEnd(12)} ${t.title}${t.critical ? dim('  ★') : ''}`);
  }
}
console.log();
