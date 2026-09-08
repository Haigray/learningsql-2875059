// Run: node --test app/mobile/src/app.test.mjs
//
// Covers the app's pure layer — plan state and notification wording. The screens
// need a simulator; these do not, and they are where the behaviour actually lives.

import test from 'node:test';
import assert from 'node:assert/strict';
import { reducer, INITIAL, createPlan, selectPlanInputs, isComplete,
         pendingPackUpdate, selectActivePlan } from './state/store.js';
import { deriveNotifications, upcoming } from './notifications/schedule.js';
import { buildPlan } from './engine/plan.generated.mjs';
import { PACKS, MANIFEST, byCode } from './data/packs.generated.js';

const NEW_PLAN = {
  id: 'p1', countryCode: 'VN', packVersion: '1.1.0', pathwayId: 'work-permit-ld',
  targetMoveDate: '2027-06-01', entryDate: '2027-06-01',
};
const withPlan = () => reducer(INITIAL, { type: 'PLAN_CREATED', plan: NEW_PLAN });

/* ------------------------------------------------------------------ store */

test('creating a plan pins the pack version and makes it active', () => {
  const s = withPlan();
  assert.equal(s.activePlanId, 'p1');
  assert.equal(selectActivePlan(s).packVersion, '1.1.0');
  assert.deepEqual(s.completed.p1, {});
});

test('a plan without a pinned pack version is refused', () => {
  assert.throws(() => createPlan({ ...NEW_PLAN, packVersion: undefined }), /pin the pack version/);
  assert.throws(() => createPlan({ ...NEW_PLAN, targetMoveDate: undefined }), /needs id/);
});

test('an unknown action returns the same object, so React does not re-render', () => {
  const s = withPlan();
  assert.equal(reducer(s, { type: 'NOPE' }), s);
});

test('completing and un-completing a task is idempotent', () => {
  let s = withPlan();
  s = reducer(s, { type: 'TASK_COMPLETED', planId: 'p1', taskKey: 'vn.passport', on: '2026-09-08' });
  const once = s;
  s = reducer(s, { type: 'TASK_COMPLETED', planId: 'p1', taskKey: 'vn.passport', on: '2026-09-09' });
  assert.equal(s, once, 'completing twice must not churn state');
  assert.ok(isComplete(s, 'p1', 'vn.passport'));
  s = reducer(s, { type: 'TASK_UNCOMPLETED', planId: 'p1', taskKey: 'vn.passport' });
  assert.equal(isComplete(s, 'p1', 'vn.passport'), false);
});

test('a recorded document must carry an issue date', () => {
  const s = withPlan();
  assert.throws(() => reducer(s, { type: 'DOCUMENT_RECORDED', planId: 'p1', taskKey: 'vn.fbi-check' }),
    /needs an issue date/);
});

test('recorded documents reach the engine through selectPlanInputs', () => {
  let s = withPlan();
  s = reducer(s, { type: 'DOCUMENT_RECORDED', planId: 'p1', taskKey: 'vn.fbi-check', issuedOn: '2026-06-01' });
  const inputs = selectPlanInputs(s, 'p1');
  assert.equal(inputs.heldDocuments['vn.fbi-check'].issuedOn, '2026-06-01');
  assert.equal(inputs.pathwayId, 'work-permit-ld');
});

test('deleting a plan leaves no orphaned state behind', () => {
  let s = withPlan();
  s = reducer(s, { type: 'TASK_COMPLETED', planId: 'p1', taskKey: 'a' });
  s = reducer(s, { type: 'DOCUMENT_RECORDED', planId: 'p1', taskKey: 'b', issuedOn: '2026-01-01' });
  s = reducer(s, { type: 'PLAN_DELETED', planId: 'p1' });
  assert.deepEqual(Object.keys(s.plans), []);
  assert.equal(s.completed.p1, undefined);
  assert.equal(s.documents.p1, undefined);
  assert.equal(s.activePlanId, null);
});

test('a newer pack is offered, never silently applied', () => {
  const s = withPlan();
  const manifest = [{ code: 'VN', country: 'Vietnam', version: '1.2.0' }];
  const pending = pendingPackUpdate(s, 'p1', manifest);
  assert.deepEqual(pending, { from: '1.1.0', to: '1.2.0', country: 'Vietnam' });
  assert.equal(s.plans.p1.packVersion, '1.1.0', 'the plan must not have moved on its own');

  const after = reducer(s, { type: 'PACK_UPDATE_ACCEPTED', planId: 'p1', packVersion: '1.2.0' });
  assert.equal(after.plans.p1.packVersion, '1.2.0');
  assert.equal(pendingPackUpdate(after, 'p1', manifest), null);
});

test('the bundled manifest never reports an update against itself', () => {
  for (const m of MANIFEST) {
    const s = reducer(INITIAL, { type: 'PLAN_CREATED', plan: {
      ...NEW_PLAN, countryCode: m.code, packVersion: m.version,
      pathwayId: byCode(m.code).pathways[0].id } });
    assert.equal(pendingPackUpdate(s, 'p1', MANIFEST), null, `${m.code} reports a spurious update`);
  }
});

/* ---------------------------------------------------------- notifications */

const vnPlan = () => buildPlan(byCode('VN'), {
  pathwayId: 'work-permit-ld', targetMoveDate: '2027-06-01', entryDate: '2027-06-01', today: '2026-09-08' });

test('the shelf-life window produces the notification that defines the product', () => {
  const n = deriveNotifications(vnPlan(), { now: '2026-09-08' });
  const open = n.find(x => x.id === 'vn.fbi-check:window-open');
  assert.ok(open, 'must tell the user when they may order the criminal record check');
  assert.equal(open.category, 'shelf-life');
  assert.equal(open.priority, 'high');
  assert.match(open.body, /valid for 180 days/);
  assert.match(open.body, /Order it between now and/);

  const closing = n.find(x => x.id === 'vn.fbi-check:window-closing');
  assert.ok(closing, 'must also chase before the window shuts');
  assert.ok(closing.at > open.at);
});

test('a held document that expires too early is the most urgent thing in the app', () => {
  const plan = buildPlan(byCode('VN'), {
    pathwayId: 'work-permit-ld', targetMoveDate: '2027-06-01', today: '2026-09-08',
    heldDocuments: { 'vn.fbi-check': { issuedOn: '2026-05-01' } } });
  const n = deriveNotifications(plan, { now: '2026-09-08' });
  const re = n.find(x => x.category === 'document-expiry');
  assert.ok(re, 'an already-obtained document that will expire must be surfaced');
  assert.equal(re.at, '2026-09-08', 'immediately, not on some future date');
  assert.match(re.body, /before it is needed on/);
  assert.equal(n.some(x => x.id === 'vn.fbi-check:window-open'), false,
    'and it must not also nag about ordering it on schedule');
});

test('only critical tasks generate deadline notifications', () => {
  const plan = vnPlan();
  const n = deriveNotifications(plan, { now: '2026-09-08' });
  const keys = new Set(n.filter(x => x.category === 'deadline').map(x => x.taskKey));
  for (const key of keys) {
    assert.equal(plan.tasks.find(t => t.key === key).critical, true,
      `${key} is not critical and should not buzz a phone`);
  }
});

test('completed tasks stop notifying', () => {
  const plan = vnPlan();
  const all = deriveNotifications(plan, { now: '2026-09-08' });
  const target = all.find(x => x.category === 'shelf-life').taskKey;
  const after = deriveNotifications(plan, { now: '2026-09-08', completed: { [target]: '2026-10-01' } });
  assert.equal(after.some(x => x.taskKey === target), false);
});

test('tax-residency thresholds are announced ahead of the crossing, with the reason', () => {
  const n = deriveNotifications(vnPlan(), { now: '2026-09-08' });
  const t = n.find(x => x.category === 'threshold');
  assert.ok(t);
  assert.match(t.body, /183 days/);
  assert.match(t.body, /worldwide income/);
});

test('Thailand generates recurring 90-day reporting reminders, ahead of each due date', () => {
  const plan = buildPlan(byCode('TH'), {
    pathwayId: 'retirement', targetMoveDate: '2027-01-15', entryDate: '2027-01-15', today: '2026-09-08' });
  const n = deriveNotifications(plan, { now: '2026-09-08' });
  const rec = n.filter(x => x.category === 'recurring');
  assert.ok(rec.length >= 1, 'the 90-day report must be scheduled');
  assert.match(rec[0].body, /repeats/);
});

test('arrival-day address registration fires on the entry date', () => {
  const plan = buildPlan(byCode('TH'), {
    pathwayId: 'retirement', targetMoveDate: '2027-01-15', entryDate: '2027-01-15', today: '2026-09-08' });
  const n = deriveNotifications(plan, { now: '2026-09-08' });
  const a = n.find(x => x.category === 'arrival');
  assert.ok(a, 'the hour-scale registration rule needs a same-day nudge');
  assert.equal(a.at, '2027-01-15');
});

test('notifications are unique, sorted, and never scheduled in the past', () => {
  for (const pack of PACKS) {
    for (const pw of pack.pathways) {
      const plan = buildPlan(pack, {
        pathwayId: pw.id, targetMoveDate: '2027-06-01', entryDate: '2027-06-01', today: '2026-09-08' });
      const n = deriveNotifications(plan, { now: '2026-09-08' });
      const ids = n.map(x => x.id);
      assert.equal(new Set(ids).size, ids.length, `${pack.meta.countryCode}/${pw.id}: duplicate ids`);
      for (let i = 1; i < n.length; i++) {
        assert.ok(n[i - 1].at <= n[i].at, `${pack.meta.countryCode}/${pw.id}: not sorted`);
      }
      for (const x of n) {
        assert.ok(x.at >= '2026-09-08', `${x.id} scheduled in the past`);
        assert.ok(x.title && x.body, `${x.id} has empty copy`);
        assert.ok(!/undefined|NaN|\[object/.test(x.title + x.body), `${x.id} has broken copy: ${x.body}`);
      }
    }
  }
});

test('upcoming() windows the next quarter', () => {
  const n = deriveNotifications(vnPlan(), { now: '2026-09-08' });
  const soon = upcoming(n, '2026-09-08', 90);
  assert.ok(soon.every(x => x.at <= '2026-12-07'));
  assert.ok(soon.length <= n.length);
});

/* -------------------------------------------------------------- hydration */

test('hydrating from disk survives state written by an older build', () => {
  // Real devices carry state from whatever version was installed last. Missing
  // keys must not crash the app on launch.
  const partial = { plans: { p1: { ...NEW_PLAN } }, activePlanId: 'p1' };
  const s = reducer(INITIAL, { type: 'HYDRATE', state: partial });
  assert.equal(s.activePlanId, 'p1');
  assert.deepEqual(s.completed, {});
  assert.deepEqual(s.documents, {});
  assert.equal(s.settings.notificationsEnabled, true, 'defaults must be filled in');
});

test('hydrating garbage falls back to a usable state rather than crashing', () => {
  assert.deepEqual(reducer(INITIAL, { type: 'HYDRATE', state: undefined }), INITIAL);
  const orphan = reducer(INITIAL, { type: 'HYDRATE', state: { plans: {}, activePlanId: 'gone' } });
  assert.equal(orphan.activePlanId, null, 'an active id with no plan behind it must be dropped');
});

test('hydrating picks a surviving plan when the active one is gone', () => {
  const s = reducer(INITIAL, { type: 'HYDRATE', state: {
    plans: { p2: { ...NEW_PLAN, id: 'p2' } }, activePlanId: 'deleted' } });
  assert.equal(s.activePlanId, 'p2');
});
