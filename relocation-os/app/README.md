# The plan engine

The guide answers *"which pathway is mine, and in what order?"* — read once, deeply, before the move.

The engine answers *"what do I do this week, and what is about to expire?"* — consulted for two years, briefly, during it.

```
app/engine/plan.mjs        the engine (pure, no dependencies)
app/engine/plan.test.mjs   22 tests, including every shipped pathway
app/engine/cli.mjs         inspect its output without building an app
```

```bash
node --test app/engine/plan.test.mjs
node app/engine/cli.mjs --country vietnam --pathway work-permit-ld --move 2027-06-01
node app/engine/cli.mjs --country cambodia --pathway employed-eb --move 2027-02-01 --timeline
```

No dependencies and no I/O inside the engine, so the same module runs in Node, in React Native, and in the validator.

## What it does that nothing else does

**Shelf-life backward scheduling.** Relocation failures are almost never knowledge failures — they are timing failures. The most expensive one in this whole category is ordering a document too *early*:

```
DO NOT ORDER YET   these expire before they are needed

  ⏳ Time the FBI Identity History Summary deliberately
      valid 180 days · needed 2027-04-02 for "Your employer files the work permit dossier"
      order between 2026-10-11 and 2027-03-16  (33 days from now)
```

The engine knows the check is valid for 180 days, that obtaining it takes 10, and the date it gets consumed — so it computes the window in which ordering it actually works, and reports `waiting` until then. Ordering it in September would waste it as surely as forgetting it entirely.

**Feasibility.** A move date that cannot work is said so, with the binding constraint and a date that does:

```
⚠ THIS MOVE DATE DOES NOT WORK
  · Check your passport expiry today — its window closed 30 day(s) ago
  Earliest date that works: 2027-01-06
```

**Absolute calendar deadlines.** Some obligations are tied to the calendar, not to the mover. Cambodia's Foreign Manpower Quota must be filed between 1 September and 30 November *for the following year* — miss it and no work permit can issue, however qualified you are. With a February move date nine months out, that window is the one thing the engine says to do today.

## How it works

`buildPlan(pack, { pathwayId, targetMoveDate, entryDate?, today?, heldDocuments? })`

1. **Collect** — module items matching the pathway (`appliesTo` filtering, already used by the guide).
2. **Place** — each module's `window` (`"T-150 to T-60 days"`) becomes offsets from the move date. The `ongoing` and `contingency` phases are deliberately undated.
3. **Order** — topological sort over `schedule.dependsOn`; a task cannot start before its dependencies finish. Cycles throw rather than hang.
4. **Schedule backwards** — for anything with `shelfLifeDays` + `consumedBy`, compute the order window from the consumption date. This overrides the module window, because a shelf life binds harder.
5. **Resolve calendar rules** — `absoluteWindow` to its next real occurrence, `recurrence` into dated instances, `dayCounter` into a tax-residency crossing date and alert.
6. **State** — `ready`, `waiting`, `locked`, `overdue`, `infeasible`, `reorder`, `done`, relative to today.
7. **Feasibility** — infeasible windows and overdue critical tasks, with the earliest workable move date.

`todayView(plan)` reduces that to the three things a phone screen should show: what to do now, what explicitly *not* to do yet, and what is wrong.

## Authoring scheduling data

Optional per module item. Content without it still renders in the guide; it simply never lands on a dated plan.

```json
{
  "task": "Time the FBI Identity History Summary deliberately",
  "key": "vn.fbi-check",
  "schedule": {
    "durationDays": 10,
    "shelfLifeDays": 180,
    "consumedBy": "vn.wp-filing"
  }
}
```

The validator enforces what makes this trustworthy: keys unique, `dependsOn` and `consumedBy` resolving, `shelfLifeDays` requiring a `consumedBy`, a document that takes longer to obtain than it stays valid rejected outright, an item and its consumer sharing at least one pathway, every module window parsing — and finally it **builds a real plan for every pathway of every pack** on each run, so a scheduling regression fails the content build.

## Held documents

Pass `heldDocuments: { 'vn.fbi-check': { issuedOn: '2026-08-01' } }` and the engine checks each against the day it is needed. If it will have expired, the task returns `reorder` with a high-severity alert. This is what turns the app's document vault from storage into a warning system.

## Not built yet

- Persistence, sync, and accounts — the engine is deliberately stateless.
- Notification delivery. The engine produces the dates; scheduling the local notification is app-layer work.
- Multi-country comparison — run `buildPlan` per country and diff the outputs.
- Household plans, where different family members hold different documents.
