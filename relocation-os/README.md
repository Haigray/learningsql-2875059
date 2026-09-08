# Relocation OS

A country-pack format, validator, and renderer for building relocation guides that are structured identically across every country — sold as $30 digital products and consumed by a companion app.

**Packs: United States → Vietnam, Cambodia, and Thailand.**

## Why a format instead of a document

Relocation guides rot. Vietnam alone replaced its work-permit decree in August 2025, added two visa categories in July 2026, and changes its document authentication regime on 11 September 2026. A guide written as a document goes stale silently.

A guide written as *validated structured content* can be checked by a machine, re-rendered on every correction, diffed between versions, and consumed by an app — and it refuses to build once it is overdue for review.

```
content/<country>/pack.json   the researched content, every claim cited
schema/                       the format every country shares
build/validate.mjs            structural + referential integrity, and a freshness guard
build/render.mjs              pack -> the standalone HTML product that gets sold
build/watch.mjs               what needs re-checking today, across every pack
build/diff.mjs                what changed between editions, + the buyer update email
schema/profile.schema.json    the shared vocabulary that makes countries comparable
app/engine/                   plan engine (one country) + comparison engine (all of them)
app/profiles/                 example mover profiles
build/render-compare.mjs      packs -> the interactive comparison product
dist/                         build output
business/                     business plan and app specification
AUTHORING.md                  how to add the next country
```

## Build

```bash
node build/validate.mjs content/vietnam/pack.json
node build/render.mjs   content/vietnam/pack.json dist/vietnam-relocation-guide.html
node build/watch.mjs                                    # content operations queue
node build/diff.mjs --git HEAD content/vietnam/pack.json --email

node --test app/engine/plan.test.mjs                    # 22 tests
node --test app/engine/compare.test.mjs                 # 21 tests
node app/engine/compare-cli.mjs --profile app/profiles/retiree.json --facts
node build/render-compare.mjs dist/southeast-asia-comparison.html
node app/engine/cli.mjs --country vietnam --pathway work-permit-ld --move 2027-06-01
```

The same packs drive the guide and the app. See `app/README.md` — the engine's
distinguishing feature is telling someone *not* to order a document yet, because
it would expire before the day it is used.

No dependencies, no install step. The rendered guide is a single self-contained HTML file that works offline.

## Assurance: the navigator edition

Neither pack has been reviewed by a licensed practitioner, and both say so in their own header. Instead every pathway carries **verify-this-yourself** steps naming the office that can answer, the question to ask verbatim, and what a real answer sounds like — and the validator refuses to build a pathway without them. Where credible sources genuinely conflict, the guide publishes both positions rather than picking one. See `business/LAUNCHING-WITHOUT-AN-ADVISER.md`.

## What is in the Vietnam pack

- **8 pathways** — e-visa, 5-year exemption certificate, TT family, work permit, work-permit exemption, UĐ1 tech, DT investor tiers, student.
- **21 decision-tree nodes**, including four honest dead ends: no retirement visa, no digital nomad visa, the DT4 trap, and no viable pathway at all.
- **8 phase modules** with 59 checklist items, from US exit admin through ongoing dual-country tax compliance.
- **10 cross-cutting traps**, including the apostille switchover on 11 September 2026 and the 6-month shelf life on the FBI background check.
- **29 cited sources**, each tiered by how much weight it carries, six of them official portals.
- **3 contested claims** and a **5-item watchlist** of rules in motion.

## What is in the Thailand pack

- **8 pathways** — visa exemption, DTV, LTR (four categories), Thailand Privilege (five tiers), retirement (Non-O / O-A / O-X), Non-B plus work permit, marriage, and education.
- **The widest price range in the catalogue**: free, to THB 50,000 for a ten-year LTR, to THB 5,000,000 for Privilege Reserve. The single most valuable page compares LTR against Privilege, which most buyers never do — they are thirty times apart in price for a weaker product.
- **12 traps**, including visa-free entry dropping from 60 days to 30 on 15 September 2026, the DTV's Tourist classification that costs holders their bank accounts, and TM30 needing a fresh filing after every single re-entry.
- **3 contested claims** and a **7-item watchlist** — the fastest-moving country in the catalogue, which is why its review clock is 60 days rather than 90.

## What is in the Cambodia pack

- **8 pathways** — tourist, the ordinary E-class gateway, employed EB plus work permit, self-sponsored company, ER retirement, EG job-seeker, ES student, citizenship by investment.
- **A real retirement route**, which Vietnam does not have, and **no apostille**, which Vietnam now does — the two packs are a deliberate contrast.
- **10 traps**, including the five-dollar decision at the airport counter, the work permit that expires on 31 December whenever it was issued, and the Foreign Manpower Quota applied for a year in advance.
- **3 contested claims**, including whether Cambodia actually taxes foreign-sourced income — where the law and the enforcement pattern point in different directions.

## Why three countries, and these three

They are the three destinations Americans actually compare against each other in mainland Southeast Asia — and they answer the same questions differently, which is what makes holding all three worth more than the sum of the parts. Document authentication is the clearest example:

| | Apostille accepted? |
|---|---|
| **Vietnam** | Yes, from 11 September 2026 |
| **Cambodia** | No — not a Convention member; full consular legalization |
| **Thailand** | Not until 28 February 2027 |

Three neighbours, three different answers, all within one year. A buyer comparing them will get this wrong from any other source.

Retirement splits the same way: Cambodia has a real retirement extension from age 55, Thailand has three different retirement routes that differ enormously on insurance, and Vietnam has none at all.

## Content principles

1. **No source, no claim.** The schema enforces a citation registry; the validator rejects unknown source ids.
2. **Tier honestly.** A law firm's summary of a decree is not the decree, and the guide says so on every source.
3. **Date everything.** Every rendered guide carries its verification date in the header.
4. **Lead with what is false.** The reality check comes before any pathway, because the expensive mistakes happen before anyone files a form.
5. **Write real dead ends.** Telling a retiree in four minutes that Vietnam has no retirement visa is worth more than the purchase price.
6. **Hand over the verification.** Do not ask to be trusted; give the buyer the procedure to check the high-stakes facts themselves.
7. **Publish disagreements.** Where good sources conflict, say so and say what it means, rather than picking a side and hoping.

## Not legal advice

Researched reference material. Immigration rules change without notice and are applied with discretion. Every claim is cited so it can be checked against its source before anyone acts on it.
