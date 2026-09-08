# Adding a new country

The whole business rests on the second country costing far less than the first. That only holds if you follow the same process every time.

## 1. Research before you write anything

Work top-down through the source tiers, and record which tier each fact came from:

- `primary-law` — the decree, law, or circular itself. Best. Chase these for anything expensive.
- `government` — official agency and ministry pages, the destination country's immigration portal, the origin country's tax authority.
- `professional` — law and accounting firm analysis. Usually accurate, occasionally stale, sometimes marketing.
- `community` — forums, expat blogs. Useful for what *actually happens* at the counter; never sufficient on its own for a legal claim.

**Establish what does not exist first.** Every country has a widely-believed visa that is a draft, a pilot, or pure invention. Finding it is the highest-value research you will do, because it is simultaneously the best marketing and the biggest saving for the buyer.

## 2. Fill the same eight phases

Never invent new phases. The spine is fixed — `decide`, `documents`, `exit-origin`, `money`, `arrival`, `first-90-days`, `ongoing`, `contingency` — and the validator enforces exactly one module per phase. Buyers who purchase a second country must recognise the structure instantly, and the app's plan engine depends on the window offsets parsing consistently.

## 3. Build the tree so it eliminates fast

Order the questions by how many people each answer removes:

1. Duration and purpose — separates visits from moves.
2. Family and ancestry connection — almost always the cheapest route, and the most commonly overlooked.
3. Employer sponsorship — the main road in most countries.
4. Capital — tiered, with the residence threshold made explicit.
5. Study.
6. Everything else — which is where the honest dead ends live.

**Write real dead ends.** A tree where every branch reaches a pathway is a lie, and the dead ends are what buyers quote to their friends.

## 4. Validate, render, review

```bash
node build/validate.mjs content/<country>/pack.json
node build/render.mjs   content/<country>/pack.json dist/<country>-relocation-guide.html
```

The validator fails on dangling tree edges, unreachable pathways, unknown source ids, a missing phase, and an overdue `reviewDue`. Fix errors; do not ship warnings you have not read.

Then read the rendered guide end to end as a buyer would. Ask of every claim: *would I act on this if it were my $6,000 and my move?*

## 5. Set the review clock

Set `meta.reviewDue` to 90 days out and put it in a calendar. The validator refuses to build an overdue pack — that is deliberate, and it is the mechanism that keeps the catalogue honest as it grows.
