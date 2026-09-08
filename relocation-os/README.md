# Relocation OS

A country-pack format, validator, and renderer for building relocation guides that are structured identically across every country — sold as $30 digital products and consumed by a companion app.

**First pack: United States → Vietnam.**

## Why a format instead of a document

Relocation guides rot. Vietnam alone replaced its work-permit decree in August 2025, added two visa categories in July 2026, and changes its document authentication regime on 11 September 2026. A guide written as a document goes stale silently.

A guide written as *validated structured content* can be checked by a machine, re-rendered on every correction, diffed between versions, and consumed by an app — and it refuses to build once it is overdue for review.

```
content/<country>/pack.json   the researched content, every claim cited
schema/                       the format every country shares
build/validate.mjs            structural + referential integrity, and a freshness guard
build/render.mjs              pack -> the standalone HTML product that gets sold
dist/                         build output
business/                     business plan and app specification
AUTHORING.md                  how to add the next country
```

## Build

```bash
node build/validate.mjs content/vietnam/pack.json
node build/render.mjs   content/vietnam/pack.json dist/vietnam-relocation-guide.html
```

No dependencies, no install step. The rendered guide is a single self-contained HTML file that works offline.

## What is in the Vietnam pack

- **8 pathways** — e-visa, 5-year exemption certificate, TT family, work permit, work-permit exemption, UĐ1 tech, DT investor tiers, student.
- **21 decision-tree nodes**, including four honest dead ends: no retirement visa, no digital nomad visa, the DT4 trap, and no viable pathway at all.
- **8 phase modules** with 59 checklist items, from US exit admin through ongoing dual-country tax compliance.
- **10 cross-cutting traps**, including the apostille switchover on 11 September 2026 and the 6-month shelf life on the FBI background check.
- **23 cited sources**, each tiered by how much weight it carries.

## Content principles

1. **No source, no claim.** The schema enforces a citation registry; the validator rejects unknown source ids.
2. **Tier honestly.** A law firm's summary of a decree is not the decree, and the guide says so on every source.
3. **Date everything.** Every rendered guide carries its verification date in the header.
4. **Lead with what is false.** The reality check comes before any pathway, because the expensive mistakes happen before anyone files a form.
5. **Write real dead ends.** Telling a retiree in four minutes that Vietnam has no retirement visa is worth more than the purchase price.

## Not legal advice

Researched reference material. Immigration rules change without notice and are applied with discretion. Every claim is cited so it can be checked against its source before anyone acts on it.
