// Cross-country comparison.
//
// The question this answers is not "how do these countries differ" — a table can
// do that. It is "given my actual situation, which of these has a door open, what
// does it cost me, and what single change would open the most doors?"
//
// Everything here is explainable: no opaque score decides someone's move. Each
// country carries the specific reasons it fits or does not.

import { matchPack, describe } from './match.mjs';

const DIFFICULTY_RANK = { low: 0, moderate: 1, high: 2, 'very-high': 3 };

/** Pathway prose answers start with Yes/No often enough to be useful, and we say when they do not. */
function answerOf(text) {
  const t = (text ?? '').trim().toLowerCase();
  if (/^(yes|the card itself is not|no direct)/.test(t)) return /^yes/.test(t) ? 'yes' : 'unclear';
  if (/^no\b/.test(t) || /^not\b/.test(t)) return 'no';
  return 'unclear';
}

/** The needs a profile explicitly states, and whether a pathway satisfies them. */
function assessNeeds(profile, pathway, comparables) {
  const needs = [];
  const add = (need, met, detail) => needs.push({ need, met, detail });

  if (profile.needsWorkAuthorization === true) {
    const a = answerOf(pathway?.canWorkLocally);
    add('work legally for a local employer', a === 'yes' ? 'yes' : a === 'no' ? 'no' : 'check',
      pathway?.canWorkLocally ?? '');
  }
  if (profile.needsLocalBanking === true) {
    // Pathway criteria already exclude tourist-classified routes for anyone who
    // needs banking, so reaching this point means the open route is bankable.
    add('open a local bank account', 'yes',
      comparables?.localBankingNeedsNonTouristVisa
        ? 'this country restricts banking by visa class, and this route clears it'
        : '');
  }
  if (profile.bringingFamily === true) {
    const a = answerOf(pathway?.canBringFamily);
    add('bring family', a === 'yes' ? 'yes' : a === 'no' ? 'no' : 'check', pathway?.canBringFamily ?? '');
  }
  if (profile.wantsPermanence === true) {
    const route = comparables?.permanenceRoute ?? 'none';
    add('reach permanent residence or citizenship', route === 'none' ? 'no' : 'check',
      route === 'none' ? 'no realistic route exists' : `possible route: ${route.replace('-', ' ')}`);
  }
  return needs;
}

/**
 * Ranks a country's open pathways: the one that most specifically fits this
 * person first, then easiest, then by name for stable output.
 */
const byFit = (a, b) =>
  (b.specificity ?? 0) - (a.specificity ?? 0) ||
  (DIFFICULTY_RANK[a.difficulty] ?? 9) - (DIFFICULTY_RANK[b.difficulty] ?? 9) ||
  a.name.localeCompare(b.name);

/**
 * @param packs    array of validated country packs
 * @param profile  a mover profile (see schema/profile.schema.json)
 */
export function compareCountries(packs, profile) {
  const countries = packs.map(pack => {
    const m = matchPack(pack, profile);
    const cmp = pack.meta.comparables ?? {};
    const open = [...m.open].sort(byFit);
    const check = [...m.check].sort(byFit);
    const best = open[0] ?? null;
    const needs = assessNeeds(profile, best, cmp);

    return {
      country: m.country, code: m.countryCode, packVersion: m.packVersion,
      comparables: cmp,
      open, check, closed: m.closed,
      best,
      needs,
      unmetNeeds: needs.filter(n => n.met === 'no'),
      openCount: open.length,
      // Deliberately transparent ordering: an open door beats an easy door,
      // and an unmet stated need outweighs both.
      rank: [
        open.length ? 0 : check.length ? 1 : 2,
        needs.filter(n => n.met === 'no').length,
        best ? (DIFFICULTY_RANK[best.difficulty] ?? 9) : 9,
      ],
    };
  });

  const ranked = [...countries].sort((a, b) =>
    a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2] ||
    a.country.localeCompare(b.country));

  /* ------------------------------------------------- what would open doors */
  // For every closed pathway, what single change to the profile would unlock it?
  const byField = new Map();
  for (const c of countries) {
    for (const pw of c.closed) {
      // Only single-blocker pathways are honestly "one change away".
      if (pw.blockers.length !== 1) continue;
      const b = pw.blockers[0];
      // Staying for less time is not an unlock, it is giving up the goal.
      if (b.cond.field === 'maxStayMonths') continue;
      const key = `${b.cond.field}:${b.cond.op}:${JSON.stringify(b.cond.value ?? '')}`;
      if (!byField.has(key)) {
        byField.set(key, {
          field: b.cond.field, op: b.cond.op, target: b.cond.value,
          current: b.actual, because: b.cond.because, requirement: describe(b.cond), opens: [],
        });
      }
      byField.get(key).opens.push({ country: c.country, code: c.code, pathway: pw.name, difficulty: pw.difficulty });
    }
  }
  const NUMERIC_OPS = ['gte', 'gt', 'lte', 'lt'];
  for (const u of byField.values()) {
    if (NUMERIC_OPS.includes(u.op) && typeof u.target === 'number' && typeof u.current === 'number') {
      u.gap = Math.abs(u.target - u.current);
      // Measure the gap against where the person actually stands, not against
      // the target: 8,000 → 330,000 is not "most of the way there".
      const ratio = u.gap / Math.max(Math.abs(u.current), 1);
      u.reachability = u.field === 'age' ? 'wait'          // you cannot decide to be older
        : ratio <= 0.25 ? 'close'
        : ratio <= 2 ? 'stretch'
        : 'far';
      u.summary = u.field === 'age'
        ? `age ${u.current} → ${u.target} (in ${u.gap} year${u.gap === 1 ? '' : 's'})`
        : `${u.field}: ${u.current.toLocaleString('en-US')} → ${u.target.toLocaleString('en-US')}` +
          ` (a gap of ${u.gap.toLocaleString('en-US')})`;
    } else {
      // Booleans and categories are life changes, not adjustments. Say so.
      u.reachability = 'life-change';
      u.summary = u.requirement;
    }
  }
  const REACH_RANK = { close: 0, stretch: 1, far: 2, wait: 3, 'life-change': 4 };
  const unlocks = [...byField.values()].sort((a, b) =>
    REACH_RANK[a.reachability] - REACH_RANK[b.reachability] ||
    b.opens.length - a.opens.length ||
    (a.gap ?? 0) - (b.gap ?? 0) ||
    a.field.localeCompare(b.field));

  /* --------------------------------------------------------------- facts */
  const FACTS = [
    ['Tax residency at', c => c.taxResidencyDays != null ? `${c.taxResidencyDays} days` : '—'],
    ['Taxes resident worldwide income', c => c.taxesResidentWorldwideIncome ?? '—'],
    ['US tax treaty in force', c => ({ yes: 'yes', no: 'no', 'signed-not-ratified': 'signed, never ratified' })[c.usTaxTreatyInForce] ?? '—'],
    ['US documents need', c => c.documentAuthentication === 'apostille' ? 'an apostille' : 'consular legalization'],
    ['…that changes on', c => c.documentAuthenticationChangesOn ?? 'not scheduled'],
    ['Dedicated retirement route', c => c.hasRetirementRoute ? 'yes' : 'no'],
    ['Route for remote workers', c => c.hasRemoteWorkRoute ? 'yes' : 'no'],
    ['Route to permanence', c => (c.permanenceRoute ?? 'none').replace('-', ' ')],
    ['Local banking needs a non-tourist visa', c => c.localBankingNeedsNonTouristVisa ? 'yes' : 'no'],
    ['Cheapest capital route to residence', c => c.minimumCapitalForResidenceUsd
      ? `US$${c.minimumCapitalForResidenceUsd.toLocaleString('en-US')}` : 'no capital route'],
  ];
  const facts = FACTS.map(([label, fn]) => {
    const values = Object.fromEntries(countries.map(c => [c.code, fn(c.comparables)]));
    return { label, values, differs: new Set(Object.values(values)).size > 1 };
  });

  /* -------------------------------------------------------------- verdict */
  const top = ranked[0];
  const runnerUp = ranked[1];
  let verdict;

  if (!top || top.rank[0] === 2) {
    verdict = {
      recommended: null,
      reason: 'No country in this comparison has a pathway open on the facts given. That is a real answer, and cheaper to learn now than after a deposit.',
      warnings: unlocks.slice(0, 3).map(u => `${u.requirement} would open ${u.opens.length} pathway(s).`),
    };
  } else {
    const reasons = [];
    if (top.best) reasons.push(`its most accessible open route is ${top.best.name}${top.best.matchedGroup ? ` (${top.best.matchedGroup})` : ''}, rated ${top.best.difficulty.replace('-', ' ')}`);
    if (top.openCount > 1) reasons.push(`${top.openCount} routes are open to you there, which is real optionality if one closes`);
    if (!top.unmetNeeds.length && top.needs.length) reasons.push('it meets every requirement you stated');
    verdict = {
      recommended: top.country,
      pathway: top.best?.name ?? null,
      reason: reasons.join('; ') || 'it is the only country with an open pathway',
      runnerUp: runnerUp && runnerUp.rank[0] < 2 ? { country: runnerUp.country, pathway: runnerUp.best?.name ?? null } : null,
      warnings: [
        ...top.unmetNeeds.map(n => `Even in ${top.country}, this route does not let you ${n.need}${n.detail ? ` — ${n.detail}` : ''}.`),
        ...top.needs.filter(n => n.met === 'check').map(n =>
          `Confirm before relying on it: whether this route lets you ${n.need}.${n.detail ? ` The pack says: "${n.detail}"` : ''}`),
        ...top.check.length && !top.open.length ? [`Nothing in ${top.country} is confirmed open: fill in the missing profile fields.`] : [],
      ],
    };
  }

  return { profile, countries: ranked, unlocks, facts, verdict };
}
