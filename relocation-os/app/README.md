# The plan engine

The guide answers *"which pathway is mine, and in what order?"* — read once, deeply, before the move.

The engine answers *"what do I do this week, and what is about to expire?"* — consulted for two years, briefly, during it.

```
app/engine/plan.mjs           dated, dependency-ordered plan for one country
app/engine/match.mjs          evaluates a pathway’s criteria against a profile
app/engine/compare.mjs        cross-country comparison and unlock analysis
app/engine/*.test.mjs         43 tests, covering every shipped pathway
app/engine/cli.mjs            the plan, from the terminal
app/engine/compare-cli.mjs    the comparison, from the terminal
app/profiles/                 five example mover profiles
```

```bash
node --test app/engine/plan.test.mjs
node --test app/engine/compare.test.mjs
node app/engine/cli.mjs --country vietnam --pathway work-permit-ld --move 2027-06-01
node app/engine/compare-cli.mjs --profile app/profiles/retiree.json --facts
```

No dependencies and no I/O inside the engines, so the same modules run in Node, in React Native, in the validator, and — inlined at build time — in the browser.

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

---

# Cross-country comparison

The plan engine answers *"what do I do this week?"* once a country is chosen. The comparison engine answers the question that comes before it: **"which of these countries has a door open for me at all?"**

```bash
node app/engine/compare-cli.mjs --profile app/profiles/retiree.json --facts
node build/render-compare.mjs dist/southeast-asia-comparison.html
```

## Making heterogeneous countries comparable

Three countries with three differently-shaped decision trees cannot be compared by reading them. So each pathway declares machine-evaluable `criteria` in a vocabulary shared by every pack — `schema/profile.schema.json`, 24 fields covering age, money, family tie, employment, and what the person actually needs.

```json
"criteria": {
  "all": [{ "field": "age", "op": "gte", "value": 55,
            "because": "the ER extension is age-gated at 55" }],
  "any": [{ "label": "Bank deposit route",
            "all": [{ "field": "liquidSavingsUsd", "op": "gte", "value": 25000 }] }]
}
```

The `because` text is written for the buyer, because it is shown verbatim when a pathway is ruled out. `any` groups handle pathways with genuinely distinct categories — Thailand's four LTR routes — and report which one matched.

## An unknown is never a rejection

If a profile does not say whether someone holds a degree, the answer is **check**, not closed. Telling someone a door is shut when it is merely unverified is the most damaging error this could make, so the engine will not do it.

## Ranking that can be explained

No opaque score. Countries sort on three visible components: has an open pathway, then unmet stated needs, then difficulty of the easiest open route. Within a country, pathways sort by **specificity** — how many of the person's actual facts the criteria engaged with.

That last part was a real bug. A retiree was once recommended Cambodia's *job-seeker* visa, because it tied with the retirement extension on difficulty and won on alphabet. A route gated on "age 55 and retired" is a better answer for a retiree than an open-to-all gateway visa, and the ordering now says so. There is a regression test.

## Unlock analysis

For every closed pathway that is one change away, what would that change be, and how reachable is it?

```
WHAT WOULD OPEN MORE DOORS
  [within reach]   annualIncomeUsd: 70,000 → 80,000 (a gap of 10,000)
                   → Thailand: Long-Term Resident Visa (LTR)
```

For a US$70k remote worker that is the single most valuable line in the product: a US$10k income increase turns a five-year tourist-classified visa with no bank account into ten years with a work permit, family inclusion, and exemption from Thai tax on foreign income.

Reachability is measured against **where the person stands**, not against the target — 8,000 → 330,000 is not "most of the way there". Two categories are deliberately demoted: `wait` for age, which nobody can decide to change, and `life-change` for booleans like acquiring a job offer or a spouse. And shortening your stay is never offered as an unlock, because that is abandoning the goal rather than reaching it.

## The comparison product

`build/render-compare.mjs` produces a single self-contained HTML page: a short form, and live results as it is filled in. Nothing is sent anywhere.

The engine is **not reimplemented for the browser**. It is inlined from the same tested source, with the one filesystem read replaced at build time, and the build refuses to emit if any Node-only code survives. A test then runs the shipped bundle's own code against all five example profiles and asserts it produces identical verdicts, open pathways, and unlocks to the Node engine. Without that guard the two would drift, and the product would quietly start lying.
