# Launching without paying for professional review

## First, a correction to my own advice

I told you to have a licensed Vietnamese immigration adviser review the pack before selling. That was a recommendation about **accuracy assurance**, not a legal requirement I had established. You are right to push on it, because there is a cheaper substitute that is arguably better — and it is now built into the product.

One thing I can't do is tell you what your legal exposure is. I'm not a lawyer, this isn't legal advice about your business, and the answer varies by state. What follows is product and content design that reduces how much the business rests on a claim of expertise. If revenue gets meaningful, spend an hour with a US attorney on your terms and disclaimers — that is a one-off cost, not a per-country one.

## The substitution: verification instead of assurance

A reviewer makes the product trustworthy by adding their credibility to yours. That is expensive, per country, forever, and it does not survive the next decree.

The alternative is to **stop asking to be trusted**. Hand the buyer the verification procedure and let them confirm the high-stakes facts themselves, against the authority that can actually answer.

That is now enforced by the schema. Every pathway carries `verification` entries, and the validator refuses to build a pack without them. Each one names:

- **the check** — the specific thing to confirm
- **the authority** — the office that can answer, not a law firm and not a forum
- **the how** — the exact question, phrased to be copied verbatim
- **what a real answer sounds like** — so the buyer knows when they have been fobbed off

From the Cambodia pack:

> **That your employer holds a current Foreign Manpower Quota with capacity**
> *Ask:* Ministry of Labour and Vocational Training, via your employer's FWCMS account
> *How:* Ask HR to open their FWCMS account and show you the quota for the current year and how many places remain. Ask before you sign anything.
> *A real answer sounds like:* A number of approved places and a number used. "We'll sort it out" means they may not have applied in the September-to-November window.

This is more valuable than a reviewer's sign-off. A reviewer certifies the pack was right in March. The verification steps let the buyer confirm it is right today, and teach them to re-check after the next change.

## Publishing the disagreements instead of resolving them

The second mechanism is the new `contested` section. Where credible sources genuinely conflict, the guide sets out both positions, who holds each, what it practically means, and how the buyer settles it for their own facts.

Cambodia's tax question is the clearest case. Professional sources say residents are taxed on worldwide salary. Community sources say enforcement is territorial in practice. Both are probably accurate about their own subject. Picking one and asserting it would be the single riskiest sentence in the product. Publishing both, and saying plainly that the buyer is choosing which risk to carry, is honest, more useful, and removes the need for someone to adjudicate it.

This is where a reviewer would have been most valuable and is also where they would have been least willing to commit.

## Two editions, named honestly

`meta.edition` is now required and takes one of two values, and the guide states which in its header and its opening notice:

- **`navigator`** — researched against public primary and government sources by the publisher. No licensed practitioner reviewed it, and the guide says so in as many words. Ships with the verification steps.
- **`reviewed`** — a named practitioner reviewed it, on a stated date. The validator refuses this value without a named reviewer.

Both packs ship as `navigator`. The rendered guide says:

> **Navigator edition.** This guide was researched against public primary and government sources by its publisher. No licensed practitioner in Cambodia has reviewed it, and we do not pretend otherwise. That is exactly why every pathway carries its own verify-this-yourself steps.

Saying this out loud is a feature. It differentiates you from every competitor implying an authority they do not have, and it sets the buyer's expectation correctly before they read a word.

## The line not to cross

The distinction that matters is between **publishing general information** and **advising a specific person on their specific case**. Giving individualized immigration advice for a fee is a regulated activity in the US. Publishing researched reference material is not.

Practical rules:

- The decision tree sorts a buyer into a **published category**. It never says "in your situation you should do X."
- Never answer a customer email with tailored advice. Answer with a pointer: which section covers it, and which verification step settles it. Build support macros that do only this.
- **Do not sell the "done-with-you pathway audit"** from the original business plan without professional advice on it first. It is the one product in the ladder that looks like individualized advice, and it is also the only one that is not automatable. Drop it, or restructure it as a live walkthrough of the buyer's own verification steps where they do the asking.
- Never describe yourself as an adviser, consultant, or specialist in immigration. You are a publisher.
- Never take a referral fee from a visa agency. It converts a guide into an inducement and destroys the trust the product runs on.

## Cheap substitutes for the things a reviewer would have caught

| What a reviewer gives you | Substitute | Cost |
|---|---|---|
| Confirms the rule is current | Verification steps the buyer runs | £0, built in |
| Resolves ambiguity | `contested` section publishing both readings | £0, built in |
| Authority for a claim | Source tiers, and a standing job to upgrade claims to primary law | Time only |
| Catches a rule change | `watchlist` plus `build/watch.mjs` | Time only |
| Catches errors in the field | Buyer reports — a free year of updates for anyone who reports a rule change | Near zero |
| Overall credibility | Saying plainly that no practitioner reviewed it | Negative cost |

The buyer feedback loop deserves emphasis. Your customers are standing in the actual queues. Ten engaged buyers per country will catch more real change than one annual review, and they cost you nothing but the discipline to log what they tell you.

## When to buy the review anyway

Not per country, and not before launch. Buy it when:

1. **A country pack passes roughly $25k in revenue.** The review is then a rounding error and a marketing asset — flip that pack to the `reviewed` edition.
2. **A pathway involves large sums.** Cambodia's citizenship-by-investment route moves a third of a million dollars. That specific pathway is worth a practitioner's eyes even while the rest of the pack stays `navigator`.
3. **You are ever tempted to answer a specific buyer's specific question.** That is the moment to have someone qualified in the loop, or to decline.

## What to do before you sell anything

1. Get your terms of sale, disclaimer, and refund policy reviewed once by a US attorney. One-off, covers every country.
2. Keep the 30-day no-questions refund. On a 94%-margin product it costs almost nothing and defuses most complaints before they escalate.
3. Keep the verification steps prominent, not buried. They are the product's honesty and its best feature.
4. Never let marketing copy promise an outcome. "Every legal route, and how to check each one yourself" is accurate and sells. "Get your visa guaranteed" is a different business with different rules.
