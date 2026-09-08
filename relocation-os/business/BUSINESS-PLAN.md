# Relocation OS — business plan

## The one thing to be honest about first

You asked for a business that runs on autopilot. **Fulfilment can be fully automatic. The content cannot.**

Immigration rules change constantly, and this pack proves it: Vietnam replaced its entire work-permit decree in August 2025, added two visa categories on 1 July 2026, and switches its document authentication regime on 11 September 2026. A guide written eighteen months ago and left alone is now actively dangerous — it will tell a buyer to get consular legalization that is about to be replaced, and cite a decree that no longer exists.

So the model is: **automated delivery, scheduled content operations.** Payment, delivery, licensing, updates, and support macros all run themselves. Re-verification is a recurring calendar obligation you budget for, roughly 4–8 hours per country per quarter. That obligation is not a drag on the business — it *is* the moat. Anyone can generate a relocation PDF in an afternoon. Almost nobody maintains one, which is why nearly every guide on the market is quietly out of date.

Build the freshness operation and you have a business. Skip it and you have a refund queue and eventually a liability problem.

## What is actually being sold

Not information — information is free and abundant. Three things people will pay for:

1. **Sequencing.** The FBI background check has a 6-month shelf life and the degree apostille takes 4–8 weeks. Getting that order wrong costs six weeks and a few hundred dollars. Nobody tells you the order.
2. **Elimination.** Being told in four minutes that Vietnam has no retirement visa saves a retiree months and thousands in agency fees. The dead ends in the tree are as valuable as the pathways.
3. **Consequence mapping.** Not "you need a residence card" but "your card must expire 30 days before your passport, so renew the passport first or pay twice."

The reality-check section is the marketing. Give it away free — it converts precisely because it tells people what *not* to buy.

## Unit economics

| | Guide | Pro | App | Done-with-you |
|---|---|---|---|---|
| Price | $30 one-time | $79 one-time | $12/mo | $499 one-time |
| What it is | One country pack | Guide + worksheets + 12 months of updates | Cross-country planner, deadline tracking, doc vault | Live pathway audit + document sequencing plan |
| COGS | ~$0 | ~$0 | ~$1.50/mo | 2 hrs of your time |
| Gross margin | ~94% after fees | ~95% | ~85% | ~70% |
| Refund rate to model | 5% | 5% | n/a | 8% |

Payment processing plus platform runs 5–8%. Model 6%.

## Three routes to $1M, and which one to pick

**Route A — volume on a single $30 product.** 33,000 units to reach $1M. At a healthy 2.5% landing-page conversion that is 1.3M qualified visitors. Achievable only with years of compounding SEO. Do not plan around this alone.

**Route B — ladder across few countries.** Raise revenue per buyer instead of buyer count. A $30 buyer who takes Pro and six months of app is worth ~$160. 6,250 such buyers is $1M. Far more reachable, and the app subscription is what makes it compound.

**Route C — breadth.** Twenty country packs, each earning $50k/year. This is where the schema pays off: pack #12 costs a fraction of pack #1 because the format, renderer, validator, and checkout are already built. Marginal cost per new country is research time, not engineering.

**Pick B, then C.** Prove the ladder on Vietnam, then replicate the format across countries. A is a consequence of doing B and C well, not a strategy.

### A plausible three-year shape

| | Countries | Guides | Pro | App subs (avg) | Revenue |
|---|---|---|---|---|---|
| Year 1 | 3 | 3,500 | 600 | 700 | ~$220k |
| Year 2 | 10 | 12,000 | 2,600 | 3,200 | ~$800k |
| Year 3 | 20 | 22,000 | 5,500 | 6,500 | ~$1.7M |

Treat these as a shape, not a forecast. The sensitivity that matters most is app retention: at 6 months average tenure the model works, at 3 months Route B collapses back into Route A.

## Which countries, in what order

Score each candidate on: US outbound volume × rule complexity × how bad the free information is × how stable the rules are.

Complexity is a feature. Portugal and Vietnam are good products precisely because the rules are tangled. A country where the answer is "apply online, wait three weeks" cannot sustain a $30 guide.

1. **Vietnam** — built. Complex, poorly documented in English, high and rising US interest.
2. **Portugal** — highest US search volume in Europe; D7 and D8 confusion is severe; NHR changes create genuine need.
3. **Mexico** — largest US expat population; temporary vs permanent residente income thresholds are widely misunderstood.
4. **Thailand** — DTV, LTR, Elite; a genuinely confusing category landscape.
5. **Spain** — digital nomad visa plus autónomo complexity.
6. **Costa Rica, Colombia, Philippines, Japan, Italy** — second wave.

Ship one country per 3–4 weeks once the research workflow is routine. Never ship a country you have not verified against primary sources.

## Distribution

Organic search is the engine; everything else accelerates it.

- **SEO on the dead ends.** "Vietnam retirement visa" has real search volume and no honest answer ranking. Publish the truthful page — no retirement visa exists, here is what actually works — and it will outrank the agency spam because it satisfies the query. Every dead end in every tree is a free article that converts.
- **Myth-busting as the top of funnel.** The golden-visa reality check is a post, a video, and an ad. It builds trust faster than any feature list because it costs you a sale to say it.
- **Reddit and forums, by being useful.** r/expats, r/VietNam, country-specific Facebook groups. Answer specific questions with specific answers and a link only where it genuinely helps. This is slow, unscalable, and where the first 500 sales come from.
- **Email.** One list, segmented by country interest. The update emails are the product experience for Pro buyers, and they are also your best sales channel for the next country.
- **Affiliates.** Relocation YouTubers at 30%. They already have the audience and no product worth recommending.

Paid ads only after organic conversion is proven. A $30 product cannot absorb a $40 customer acquisition cost — paid only works once the ladder lifts revenue per buyer above ~$90.

## The content operation (the part that must not be automated away)

This is the real job. Put it on a calendar and treat it as production, not maintenance.

- **Quarterly, per country.** Re-verify every source. Update `meta.verifiedAsOf`, bump the version, re-render, re-deliver to everyone entitled to updates. `meta.reviewDue` in the pack makes the validator *refuse to ship* an overdue pack — that guard is deliberate.
- **Event-driven.** Any new decree, law, or fee change triggers an immediate patch release and an email. This is the single most visible sign the product is alive, and it is what justifies Pro.
- **Tier discipline.** A law-firm blog is not the decree. The `tier` field on every source keeps you and the buyer honest about what is actually established. Push high-stakes claims toward `primary-law` and `government` over time.
- **Buyer feedback loop.** Every buyer who reports a rule change or a rejection gets a free year of Pro. Your customers are a distributed verification network standing in the actual queues — no competitor can buy that.

## Legal and risk

Take these seriously; they are what separates a durable business from one that gets a demand letter.

- **Never cross into legal advice.** You sell researched reference material. The disclaimer is in the product header and the footer, and it must stay there. Do not answer "what should I do in my case" in writing.
- **Cite everything, tier everything.** Already enforced by the schema: no source, no claim.
- **Date everything visibly.** The verification date is in the header of every rendered guide. This is both honest and legally protective.
- **Refunds, generously.** A 30-day no-questions refund on a 94%-margin product costs almost nothing and eliminates the chargeback and complaint spiral that kills digital products.
- **Get a licensed adviser on retainer per country** once revenue supports it — for review, not for advice to buyers. It upgrades your source tier and it is a genuine marketing asset.
- **No affiliate relationships with visa agencies.** The moment the guide has a financial interest in a pathway, the trust that makes it work is gone.

## Stack

Deliberately boring, because none of it is the moat.

| Need | Choice | Why |
|---|---|---|
| Payments + delivery | Lemon Squeezy or Paddle | Merchant of record — they handle global VAT, which for a worldwide digital product is a genuine headache |
| Site | Astro on Cloudflare Pages | Static, fast, free at this scale; renders the same packs |
| Email | ConvertKit or Loops | Segmentation by country interest |
| App | React Native + Expo, Supabase backend | One codebase, both stores |
| Content source of truth | This repo | Packs are versioned in git; every guide is a build artifact, never hand-edited |

**The pack is the product.** The website, the PDF, the app, and the email course are all renderings of the same validated JSON. Never let content diverge into a Google Doc — the moment it does, versioning dies and the freshness operation becomes impossible.

## First 90 days

1. **Weeks 1–2.** Landing page. Give the Vietnam reality-check section away free in exchange for an email. Measure whether people actually want this before building more.
2. **Weeks 3–4.** Checkout live. First 50 sales at $20 to an early list, in exchange for feedback. Talk to every one of the first 50 buyers.
3. **Weeks 5–8.** Portugal pack, using the same schema. Time it — this is the number that tells you whether the format really is reusable.
4. **Weeks 9–12.** Ship the app in read-only form: same packs, deadline tracking, offline. Free with any guide purchase, to establish the habit before charging.
5. **Ongoing.** One country per month. One update email per country per quarter, without exception.

**The single decision that determines whether this reaches $1M:** whether you maintain the packs after the novelty wears off. The format, the renderer, and the validator are all built to make that maintenance cheap — but they cannot make you do it.
