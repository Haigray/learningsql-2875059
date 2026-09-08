# Keeping the packs current

The operating procedure for the part of this business that cannot be automated. Run it and the catalogue compounds; skip it and every pack becomes a liability on a delay.

## The weekly pass — 15 minutes

```bash
node build/watch.mjs
```

Prints one queue across every country: watchlist items due, pack reviews approaching, gotchas tied to a rule change that has now passed, sources unchecked for over 120 days, and pathways still resting only on commentary. It exits non-zero if anything is overdue, so it can gate a deploy.

Clear the OVERDUE items. Ignore LATER. That is the whole weekly job.

## The quarterly pass — 4 to 8 hours per country

Triggered by `meta.reviewDue`, which the validator enforces: **an overdue pack refuses to build.** That guard is the mechanism that stops a stale guide from being sold.

1. Re-open every source in the pack. Confirm or correct each claim it supports.
2. Work the watchlist. Anything that landed graduates out of the watchlist and into the pack body.
3. Upgrade one or two claims from `professional` to `primary-law` or `government`. Over a year this quietly converts a pack from commentary into citation.
4. Fold in what buyers reported. They were at the counter; you were not.
5. Update `verifiedAsOf`, push `reviewDue` out 90 days, bump the version, add a changelog entry.
6. Validate, render, ship, email.

## When a rule actually changes

This is the event the whole business is built to absorb.

```bash
# 1. Edit content/<country>/pack.json — the change, its sources, a changelog entry
node build/validate.mjs content/<country>/pack.json

# 2. See exactly what moved since the last shipped edition
node build/diff.mjs --git HEAD content/<country>/pack.json

# 3. Draft the buyer email straight from the changelog
node build/diff.mjs --git HEAD content/<country>/pack.json --email

# 4. Rebuild and ship
node build/render.mjs content/<country>/pack.json dist/<country>-relocation-guide.html
```

`diff.mjs` separates material changes from cosmetic ones, so you know whether this is a minor version and an email, or a patch and silence. The email is drafted from the changelog's `actionRequired` fields — which is why writing those properly at edit time is worth the two extra minutes.

**Version discipline:** patch for typos and source refreshes, minor for a rule change or new content, major for a pathway appearing or disappearing. The validator checks the changelog's newest entry matches `meta.version`.

## Where changes get noticed first

In rough order of how early they surface:

1. **Practitioner alerts.** Law and accounting firms publish decree analysis within days — Tilleke, Baker McKenzie, Acclime, Emerhub, Dentons for the region. Subscribe to their alerts; this is the highest-yield input.
2. **Government portals.** Slower, authoritative, and the tier you actually want to cite. Every `isOfficialPortal` source in a pack is a page worth checking quarterly.
3. **Buyers.** Fastest signal for *enforcement* changes, which never get published anywhere. When someone reports the counter asked for a document the guide does not mention, that is a real change and you heard it first.
4. **Expat forums.** Noisy and often wrong, but they surface enforcement shifts before anything official acknowledges them. Treat as a lead, never as a source.

## What earns a watchlist entry

Anything that would change a pathway if it landed, and specifically:

- A proposal reported as though it were law. Vietnam's golden visa is the type case — this is where the scams live, and the watchlist is how you keep telling buyers it does not exist.
- Legislation passed but not yet in force, with a date. Vietnam's apostille accession sat here for nine months.
- Rules in force whose implementing detail is missing — Vietnam's UĐ1 today.
- Enforcement shifting without any rule changing. Cambodia's 2026 tightening. Nothing was published; the practice moved.

Give every entry a `checkBy` date. An entry without one never gets checked, and `watch.mjs` will nag you about exactly that.

## The rule that keeps this honest

Anything you cannot source, you do not claim. If a fact matters and no source is solid, it belongs in `contested` with both readings and a way for the buyer to settle it — not in the body of the guide stated as fact.
