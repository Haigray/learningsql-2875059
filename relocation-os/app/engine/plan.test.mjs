// Run: node --test app/engine/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildPlan, todayView, parseWindow, addDays, diffDays } from './plan.mjs';

const pack = c => JSON.parse(readFileSync(`content/${c}/pack.json`, 'utf8'));

/** Minimal synthetic pack, so scheduling behaviour is tested in isolation. */
function fixture(items, opts = {}) {
  return {
    meta: { country: 'Testland', countryCode: 'TL', version: '1.0.0', verifiedAsOf: '2026-01-01',
            origin: 'United States', currency: 'USD', priceUsd: 30, edition: 'navigator' },
    pathways: [{ id: 'main', name: 'Main' }, { id: 'other', name: 'Other' }],
    modules: [{ id: 'docs', phase: 'documents', title: 'Docs',
                window: opts.window ?? 'T-150 to T-60 days', items }],
    sources: [],
  };
}
const plan = (p, o = {}) => buildPlan(p, {
  pathwayId: 'main', targetMoveDate: '2027-06-01', today: '2026-09-08', ...o });
const task = (pl, key) => pl.tasks.find(t => t.key === key);

/* ------------------------------------------------------------- windows */

test('parseWindow reads offsets, and rejects the undated phases', () => {
  assert.deepEqual(parseWindow('T-150 to T-60 days'), { from: -150, to: -60 });
  assert.deepEqual(parseWindow('T-0 to T+7 days'), { from: 0, to: 7 });
  assert.deepEqual(parseWindow('T+7 to T+90 days'), { from: 7, to: 90 });
  assert.equal(parseWindow('Continuous'), null);
  assert.equal(parseWindow('Have this before you need it'), null);
  assert.equal(parseWindow(undefined), null);
});

test('window offsets place tasks relative to the move date', () => {
  const p = plan(fixture([{ task: 'A', key: 'a' }]));
  assert.equal(task(p, 'a').earliestStart, addDays('2027-06-01', -150));
  assert.equal(task(p, 'a').latestStart, addDays('2027-06-01', -60));
});

/* -------------------------------------------------- shelf-life scheduling */

test('a document with a shelf life is scheduled backwards from the day it is used', () => {
  const p = plan(fixture([
    { task: 'File dossier', key: 'file', schedule: { durationDays: 14 } },
    { task: 'Criminal record check', key: 'check',
      schedule: { durationDays: 10, shelfLifeDays: 180, consumedBy: 'file' } },
  ]));
  const check = task(p, 'check');
  const consumedOn = addDays('2027-06-01', -60);          // the filing's latest start

  assert.equal(check.shelfLife.consumedOn, consumedOn);
  // Not before it would expire...
  assert.equal(check.shelfLife.orderWindow.from, addDays(consumedOn, -180 + 7));
  // ...and not so late it cannot arrive.
  assert.equal(check.shelfLife.orderWindow.to, addDays(consumedOn, -(10 + 7)));
  assert.ok(diffDays(check.earliestStart, check.latestStart) > 0);
});

test('the shelf life overrides the module window when it binds harder', () => {
  // Module window opens T-150; a 60-day shelf life cannot possibly start there.
  const p = plan(fixture([
    { task: 'File', key: 'file', schedule: { durationDays: 0 } },
    { task: 'Short-lived doc', key: 'doc',
      schedule: { durationDays: 5, shelfLifeDays: 60, consumedBy: 'file' } },
  ]));
  const doc = task(p, 'doc');
  assert.ok(doc.earliestStart > addDays('2027-06-01', -150),
    'should start later than the module window would suggest');
});

test('"do not order this yet" — the state that stops the classic mistake', () => {
  const p = plan(fixture([
    { task: 'File', key: 'file', schedule: { durationDays: 14 } },
    { task: 'Check', key: 'check',
      schedule: { durationDays: 10, shelfLifeDays: 180, consumedBy: 'file' } },
  ]));
  const check = task(p, 'check');
  assert.equal(check.state, 'waiting', 'ordering it today would waste it');
  assert.ok(check.earliestStart > '2026-09-08');

  const view = todayView(p);
  assert.ok(view.doNotYet.some(t => t.key === 'check'),
    'the Today screen must surface it as explicitly not-yet');
});

test('a shelf life shorter than the time to obtain the document is flagged infeasible', () => {
  const p = plan(fixture([
    { task: 'File', key: 'file' },
    { task: 'Impossible doc', key: 'doc',
      schedule: { durationDays: 40, shelfLifeDays: 45, consumedBy: 'file' } },
  ]));
  assert.equal(task(p, 'doc').state, 'infeasible');
  assert.equal(p.feasibility.ok, false);
  assert.match(p.feasibility.problems[0].reason, /cannot be timed/);
});

test('a document already held is checked against the day it is needed', () => {
  const f = fixture([
    { task: 'File', key: 'file', schedule: { durationDays: 14 } },
    { task: 'Check', key: 'check',
      schedule: { durationDays: 10, shelfLifeDays: 180, consumedBy: 'file' } },
  ]);
  const consumedOn = addDays('2027-06-01', -60);

  const stale = plan(f, { heldDocuments: { check: { issuedOn: addDays(consumedOn, -200) } } });
  assert.equal(task(stale, 'check').state, 'reorder');
  assert.ok(stale.alerts.some(a => a.kind === 'document-expiry'));

  const good = plan(f, { heldDocuments: { check: { issuedOn: addDays(consumedOn, -30) } } });
  assert.equal(task(good, 'check').state, 'done');
  assert.equal(good.alerts.filter(a => a.kind === 'document-expiry').length, 0);
});

/* ------------------------------------------------------- dependencies */

test('a task cannot start before what it depends on has finished', () => {
  const p = plan(fixture([
    { task: 'Season the money', key: 'season', schedule: { durationDays: 90 } },
    { task: 'Apply', key: 'apply', schedule: { dependsOn: ['season'] } },
  ]));
  const season = task(p, 'season'), apply = task(p, 'apply');
  assert.ok(apply.earliestStart >= season.finishBy);
  assert.deepEqual(apply.dependsOn, ['season']);
});

test('a dependency cycle is an error, not a hang', () => {
  assert.throws(() => plan(fixture([
    { task: 'A', key: 'a', schedule: { dependsOn: ['b'] } },
    { task: 'B', key: 'b', schedule: { dependsOn: ['a'] } },
  ])), /dependency cycle/);
});

test('dependencies on items outside the pathway are ignored rather than fatal', () => {
  const p = plan(fixture([
    { task: 'Scoped elsewhere', key: 'gone', appliesTo: ['other'] },
    { task: 'Mine', key: 'mine', schedule: { dependsOn: ['gone'] } },
  ]));
  assert.ok(task(p, 'mine'));
  assert.deepEqual(task(p, 'mine').dependsOn, []);
});

/* ------------------------------------------- calendar windows and repeats */

test('an annual window resolves to its next real occurrence', () => {
  const p = plan(fixture([
    { task: 'Quota filing', key: 'quota', schedule: { absoluteWindow: { from: '09-01', to: '11-30' } } },
  ]));
  const q = task(p, 'quota');
  assert.equal(q.kind, 'annual');
  assert.equal(q.earliestStart, '2026-09-01');
  assert.equal(q.latestStart, '2026-11-30');
  assert.equal(q.state, 'ready', 'today (8 Sept) falls inside the window');
});

test('an annual window already past this year rolls to next year', () => {
  const p = plan(fixture([
    { task: 'Renewal', key: 'renew', schedule: { absoluteWindow: { from: '01-01', to: '03-31' } } },
  ]));
  assert.equal(task(p, 'renew').earliestStart, '2027-01-01');
});

test('recurring obligations are emitted as dated instances from the entry date', () => {
  const p = plan(fixture([
    { task: '90-day report', key: 'rep', schedule: { recurrence: { everyDays: 90, from: 'entry' } } },
  ]), { entryDate: '2027-06-01' });
  const instances = p.tasks.filter(t => t.parentKey === 'rep');
  assert.equal(instances.length, 8);
  assert.equal(instances[0].dueDate, addDays('2027-06-01', 90));
  assert.equal(instances[1].dueDate, addDays('2027-06-01', 180));
  assert.ok(instances.every(t => t.kind === 'recurring'));
});

test('a day-count threshold produces a dated alert', () => {
  const p = plan(fixture([
    { task: 'Tax residency', key: 'tax',
      schedule: { dayCounter: { threshold: 183, warnBefore: 30, label: 'Worldwide income.' } } },
  ]), { entryDate: '2027-06-01' });
  const t = task(p, 'tax');
  assert.equal(t.dayCounter.crossOn, addDays('2027-06-01', 183));
  assert.equal(t.dayCounter.warnOn, addDays('2027-06-01', 153));
  assert.ok(p.alerts.some(a => a.kind === 'day-counter' && a.message === 'Worldwide income.'));
});

/* ----------------------------------------------------------- filtering */

test('items and modules scoped to another pathway are excluded', () => {
  const p = plan(fixture([
    { task: 'Mine', key: 'mine' },
    { task: 'Theirs', key: 'theirs', appliesTo: ['other'] },
    { task: 'Everyone', key: 'all', appliesTo: ['*'] },
  ]));
  assert.ok(task(p, 'mine') && task(p, 'all'));
  assert.equal(task(p, 'theirs'), undefined);
});

test('undated phases are kept but never given fake dates', () => {
  const p = plan(fixture([{ task: 'Forever', key: 'f' }], { window: 'Continuous' }));
  const f = task(p, 'f');
  assert.equal(f.earliestStart, null);
  assert.equal(f.state, 'contingency');
});

/* -------------------------------------------------------- feasibility */

test('a move date too soon reports the binding constraint and a workable date', () => {
  const p = plan(fixture([
    { task: 'Long lead item', key: 'slow', critical: true, schedule: { durationDays: 60 } },
  ]), { targetMoveDate: '2026-09-20' });          // window closed months ago
  assert.equal(p.feasibility.ok, false);
  assert.ok(p.feasibility.earliestFeasibleMoveDate > '2026-09-20');
  assert.equal(p.feasibility.problems[0].key, 'slow');
});

test('errors on unknown pathway and missing inputs rather than guessing', () => {
  assert.throws(() => buildPlan(fixture([]), { pathwayId: 'nope', targetMoveDate: '2027-01-01' }), /unknown pathway/);
  assert.throws(() => buildPlan(fixture([]), { targetMoveDate: '2027-01-01' }), /pathwayId is required/);
  assert.throws(() => buildPlan(fixture([]), { pathwayId: 'main' }), /targetMoveDate is required/);
});

/* -------------------------------------------------- the real content packs */

test('every pathway in every shipped pack produces a usable plan', () => {
  for (const country of readdirSync('content')) {
    const p = pack(country);
    for (const pw of p.pathways) {
      const built = buildPlan(p, {
        pathwayId: pw.id, targetMoveDate: '2027-06-01', entryDate: '2027-06-01', today: '2026-09-08' });
      assert.ok(built.tasks.length > 0, `${country}/${pw.id} produced no tasks`);
      assert.ok(built.summary.total >= built.summary.ready, `${country}/${pw.id} summary inconsistent`);
      for (const t of built.tasks) {
        if (t.earliestStart && t.latestStart) {
          assert.ok(t.earliestStart <= t.latestStart,
            `${country}/${pw.id}/${t.key}: window runs backwards`);
        }
      }
    }
  }
});

test('Vietnam work permit: the FBI check is timed off the employer filing date', () => {
  const p = buildPlan(pack('vietnam'), {
    pathwayId: 'work-permit-ld', targetMoveDate: '2027-06-01', today: '2026-09-08' });
  const check = p.tasks.find(t => t.key === 'vn.fbi-check');
  assert.ok(check, 'the FBI check must be scheduled on this pathway');
  assert.equal(check.shelfLife.days, 180);
  assert.equal(check.shelfLife.consumedBy, 'vn.wp-filing');
  assert.equal(check.state, 'waiting', 'today is still too early to order it');
});

test('Cambodia: both hard calendar windows land on real dates', () => {
  const p = buildPlan(pack('cambodia'), {
    pathwayId: 'employed-eb', targetMoveDate: '2027-06-01', today: '2026-09-08' });
  const fmq = p.tasks.find(t => t.key === 'kh.fmq-quota');
  const renew = p.tasks.find(t => t.key === 'kh.wp-renewal');
  assert.equal(fmq.earliestStart, '2026-09-01');
  assert.equal(renew.earliestStart, '2027-01-01');
});

test('Thailand DTV: seasoning gates the application', () => {
  const p = buildPlan(pack('thailand'), {
    pathwayId: 'retirement', targetMoveDate: '2027-06-01', today: '2026-09-08' });
  const season = p.tasks.find(t => t.key === 'th.seasoning');
  const ext = p.tasks.find(t => t.key === 'th.extension');
  assert.ok(season && ext);
  assert.ok(ext.earliestStart >= season.finishBy, 'the extension must wait for seasoning to finish');
});
