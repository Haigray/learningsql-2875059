# Relocation OS — app specification

## What the app is for

The guide answers *"which pathway is mine and what is the sequence?"* It is read once, deeply, before the move.

The app answers *"what do I do this week, and what is about to expire?"* It is opened for two years, briefly, during the move.

Those are different products with different shapes. The app is **not** the guide on a phone — that mistake produces an unread PDF viewer. The app is a stateful deadline engine that happens to be seeded by the same content.

## The core insight

Relocation failures are almost never knowledge failures. They are **timing and sequencing failures**:

- The FBI check that had to be under 6 months old at filing, and was 7.
- The residence card that came out short because the passport had 18 months left.
- The temporary residence declaration nobody filed in the first 12 hours, discovered nine months later.
- The work-permit renewal that started 20 days out instead of 60.

Every one of these is a date arithmetic problem. That is what the app does: it takes the pathway from the tree, computes a real dated plan from the user's target move date, and then *chases them*.

## Architecture

```
content packs (this repo, git)
        │  CI validates + publishes versioned JSON
        ▼
   pack CDN  ──►  app pulls, caches offline, checks version on launch
        │
        ▼
  plan engine  ──►  user's dated task graph  ──►  notifications
        │
        ▼
  Supabase (user state, docs, sync)
```

The app ships with the packs bundled so it works on day one with no network, then pulls updates. **Content never lives in the app binary's source.** A rule change is a pack release, not an app-store submission — this is the single most important architectural decision here.

## Data model

```ts
type UserPlan = {
  id: string;
  countryCode: string;        // 'VN'
  packVersion: string;        // '1.0.0' — pin, so a mid-move content change is a reviewed event
  pathwayId: string;          // from the decision tree
  treeAnswers: string[];      // replayable, so we can re-derive if they change an answer
  targetMoveDate: string;     // the anchor for all date arithmetic
  status: 'planning' | 'in-progress' | 'arrived' | 'settled';
};

type PlanTask = {
  id: string;
  planId: string;
  sourceRef: string;          // 'modules.m-documents.items[2]' — traceable back to the pack
  title: string;
  detail: string;
  phase: Phase;
  critical: boolean;
  dueDate: string;            // computed
  blockedBy: string[];        // real dependency edges
  shelfLifeDays?: number;     // e.g. FBI check = 180 — drives the "don't start yet" warning
  state: 'locked' | 'ready' | 'in-progress' | 'done' | 'overdue';
};

type UserDocument = {
  id: string; planId: string; kind: string;
  issuedOn?: string; expiresOn?: string;
  authenticated?: 'none' | 'apostille' | 'consular-legalization';
  fileRef?: string;           // encrypted at rest
};
```

## The plan engine

This is the actual product. Everything else is UI.

1. **Anchor** on `targetMoveDate`.
2. **Select** the module items matching the user's `pathwayId` (the `appliesTo` field already does this filtering in the guide).
3. **Place** each task using its module `window` (`"T-150 to T-60 days"` parses to an offset range).
4. **Resolve dependencies** from `blocker` text and explicit edges — a task is `locked` until its blockers are `done`.
5. **Apply shelf-life backward scheduling.** This is the differentiating trick. For a task with `shelfLifeDays`, do not schedule it as early as possible. Schedule it so it is still valid at the moment it is *consumed*:

   > *Don't order your FBI check yet.* It expires 6 months after issue and your employer files on 12 March. Order it between 20 January and 10 February.

   No competitor does this, and it is the exact failure the gotchas describe.
6. **Recompute** on any change to the move date, and warn loudly when a change invalidates an already-obtained document.

## Screens

| Screen | Job |
|---|---|
| **Today** | Three things: what is ready now, what expires soonest, what is blocked and why. Opens here always. |
| **Pathway** | The decision tree, re-runnable. Changing an answer rebuilds the plan with an explicit diff — never silently. |
| **Timeline** | The dated plan, grouped by phase, with dependency lines. Scrollable past and future. |
| **Documents** | Every document with issue and expiry dates, authentication state, and encrypted scans. Powers the shelf-life warnings. |
| **Guide** | The full country pack, searchable, offline. The reference layer. |
| **Alerts** | Renewal countdowns. The reason people keep the app after arrival. |

## Notifications — the retention mechanism

Users churn when an app has nothing to say. These have something to say for two years:

- **Shelf-life windows.** "Order your FBI check in the next 10 days." *(the killer feature)*
- **Expiry ladders.** Passport, visa, residence card, work permit, licence, insurance — at 90, 60, and 30 days.
- **The 12-hour rule.** Triggered on arrival: "Has your landlord filed your temporary residence declaration? It was due within 12 hours."
- **Tax residency.** "You reach 183 days in Vietnam on 4 August. From that date you are taxable on worldwide income." Fires 30 days before.
- **Content updates.** "Vietnam pack updated: apostille replaces consular legalization on 11 September. This affects 2 tasks in your plan." Ties the content operation directly to perceived app value.

That last one is why the freshness operation and the app reinforce each other. Every update you do is a re-engagement event.

## Build order

1. **v0.1 — read-only.** Bundled packs, decision tree, guide reader, offline. Ships in weeks, validates that people want it on a phone.
2. **v0.2 — the plan engine.** Dated tasks, dependencies, shelf-life scheduling, local notifications. *This is the version worth paying for.*
3. **v0.3 — accounts and sync.** Supabase, multi-device, document vault. Enables the subscription.
4. **v0.4 — multi-country.** Compare two pathways side by side. Serves undecided movers, who are a large and underserved segment.
5. **v1.0 — households.** Shared plans for couples and families. Different family members hold different documents; today that is coordinated over text message and it fails constantly.

## Constraints worth writing down

- **Offline is mandatory, not a feature.** People use this in immigration queues and on planes with no roaming.
- **Never state a rule the pack cannot cite.** The app inherits the guide's citation discipline; every task links to its source.
- **Pin the pack version per plan.** A content update mid-move must be a reviewed diff, never a silent mutation of someone's plan.
- **Documents are sensitive.** Passport scans and background checks. Encrypt at rest, make export and delete trivial, and never send them anywhere they are not needed.
- **Do not add a chat feature.** The instant the app answers "what should I do in my situation" in free text, it is giving immigration advice. That is a different business with a different licence.
