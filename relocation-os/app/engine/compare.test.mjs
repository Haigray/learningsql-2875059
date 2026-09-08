// Run: node --test app/engine/compare.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { matchPathway, matchPack, PROFILE_FIELDS } from './match.mjs';
import { compareCountries } from './compare.mjs';

const packs = readdirSync('content').map(c => JSON.parse(readFileSync(`content/${c}/pack.json`, 'utf8')));
const pack = name => packs.find(p => p.meta.country.toLowerCase() === name);

/* ---------------------------------------------------------- matching */

test('an unknown field is "check", never a rejection', () => {
  const pw = { criteria: { all: [{ field: 'age', op: 'gte', value: 50 }] } };
  assert.equal(matchPathway(pw, {}).status, 'check');
  assert.equal(matchPathway(pw, { age: 62 }).status, 'open');
  assert.equal(matchPathway(pw, { age: 40 }).status, 'closed');
});

test('a failing condition reports the reason the author wrote', () => {
  const pw = { criteria: { all: [
    { field: 'age', op: 'gte', value: 55, because: 'the ER extension is age-gated at 55' }] } };
  const r = matchPathway(pw, { age: 40 });
  assert.equal(r.status, 'closed');
  assert.equal(r.blockers[0].cond.because, 'the ER extension is age-gated at 55');
  assert.equal(r.blockers[0].actual, 40);
});

test('any-groups open a pathway when one category matches, and name it', () => {
  const pw = { criteria: { all: [{ field: 'age', op: 'gte', value: 50 }], any: [
    { label: 'Deposit', all: [{ field: 'liquidSavingsUsd', op: 'gte', value: 25000 }] },
    { label: 'Income',  all: [{ field: 'passiveIncomeUsd', op: 'gte', value: 24000 }] }] } };
  const r = matchPathway(pw, { age: 62, liquidSavingsUsd: 1000, passiveIncomeUsd: 30000 });
  assert.equal(r.status, 'open');
  assert.equal(r.matchedGroup, 'Income');
});

test('when every category fails, the closest one is reported as the realistic target', () => {
  const pw = { criteria: { any: [
    { label: 'Rich',  all: [{ field: 'netWorthUsd', op: 'gte', value: 1000000 },
                            { field: 'investableCapitalUsd', op: 'gte', value: 500000 }] },
    { label: 'Earner', all: [{ field: 'annualIncomeUsd', op: 'gte', value: 80000 }] }] } };
  const r = matchPathway(pw, { netWorthUsd: 10, investableCapitalUsd: 10, annualIncomeUsd: 70000 });
  assert.equal(r.status, 'closed');
  assert.equal(r.closestGroup, 'Earner', 'one missing condition beats two');
});

test('a pathway with no criteria is "check", not silently open', () => {
  assert.equal(matchPathway({}, { age: 30 }).status, 'check');
});

test('every criteria field in every shipped pack exists in the profile schema', () => {
  for (const p of packs) {
    for (const pw of p.pathways) {
      const conds = [...(pw.criteria?.all ?? []), ...(pw.criteria?.any ?? []).flatMap(g => g.all)];
      for (const c of conds) {
        assert.ok(PROFILE_FIELDS.has(c.field),
          `${p.meta.country}/${pw.id}: "${c.field}" is not a profile field`);
      }
    }
  }
});

/* -------------------------------------------------------- comparison */

const remoteWorker = {
  age: 34, annualIncomeUsd: 70000, passiveIncomeUsd: 0, liquidSavingsUsd: 22000,
  investableCapitalUsd: 8000, netWorthUsd: 120000, familyTie: 'none', retired: false,
  hasLocalJobOffer: false, enrollingInStudy: false, remoteWorkForForeignEmployer: true,
  isEmployee: true, hasDegree: true, yearsExperience: 8, sector: 'tech',
  needsWorkAuthorization: false, needsLocalBanking: true, bringingFamily: false,
  wantsPermanence: false, maxStayMonths: 36,
};

test('a remote worker who needs banking is steered away from the DTV', () => {
  const r = compareCountries(packs, remoteWorker);
  const th = r.countries.find(c => c.code === 'TH');
  const dtv = th.closed.find(p => p.pathwayId === 'dtv');
  assert.ok(dtv, 'the DTV must be ruled out, not offered');
  assert.ok(dtv.blockers.some(b => b.cond.field === 'needsLocalBanking'));
});

test('the top unlock is reachable, not a life change', () => {
  const r = compareCountries(packs, remoteWorker);
  assert.equal(r.unlocks[0].reachability, 'close');
  assert.equal(r.unlocks[0].field, 'annualIncomeUsd');
  assert.ok(r.unlocks[0].opens.some(o => o.code === 'TH'), 'US$80k opens Thailand’s LTR');
});

test('shortening the trip is never offered as an unlock', () => {
  const r = compareCountries(packs, remoteWorker);
  assert.equal(r.unlocks.filter(u => u.field === 'maxStayMonths').length, 0);
});

test('age is ranked as something to wait for, not to adjust', () => {
  const r = compareCountries(packs, remoteWorker);
  const age = r.unlocks.find(u => u.field === 'age');
  if (age) assert.equal(age.reachability, 'wait');
});

test('a retiree finds the countries that have retirement routes and not the one that does not', () => {
  const retiree = { age: 62, retired: true, passiveIncomeUsd: 30000, liquidSavingsUsd: 40000,
    investableCapitalUsd: 20000, familyTie: 'none', hasLocalJobOffer: false, enrollingInStudy: false,
    needsWorkAuthorization: false, needsLocalBanking: false, bringingFamily: false,
    wantsPermanence: false, maxStayMonths: 120 };
  const r = compareCountries(packs, retiree);
  const open = c => r.countries.find(x => x.code === c).open.map(p => p.pathwayId);
  assert.ok(open('KH').includes('retirement-er'), 'Cambodia ER at 55+');
  assert.ok(open('TH').includes('retirement'), 'Thailand retirement at 50+');
  assert.equal(open('VN').length, 0, 'Vietnam has no retirement route at all');
  assert.ok(['Cambodia', 'Thailand'].includes(r.verdict.recommended));
});

test('someone with a Vietnamese parent is routed to the cheap family route', () => {
  const r = compareCountries(packs, { age: 40, familyTie: 'ancestry', maxStayMonths: 60,
    retired: false, hasLocalJobOffer: false, enrollingInStudy: false, needsWorkAuthorization: false,
    needsLocalBanking: false, bringingFamily: false, wantsPermanence: false,
    liquidSavingsUsd: 5000, investableCapitalUsd: 1000, annualIncomeUsd: 50000, passiveIncomeUsd: 0 });
  const vn = r.countries.find(c => c.code === 'VN');
  assert.ok(vn.open.some(p => p.pathwayId === 'vec-5year'),
    'the 5-year exemption certificate is the whole point of asking about ancestry');
});

test('an unmet stated need is surfaced as a warning, not buried', () => {
  const r = compareCountries(packs, { ...remoteWorker, wantsPermanence: true, needsLocalBanking: false });
  assert.ok(r.verdict.recommended);
  const top = r.countries[0];
  assert.ok(top.needs.some(n => n.need.includes('permanent')));
});

test('someone with nothing still finds Cambodia, and is warned what it does not give them', () => {
  // Cambodia's ordinary E-class visa genuinely is open to everyone. That is the
  // real finding — and the honest product says so while flagging the catch.
  const r = compareCountries(packs, {
    age: 30, retired: false, familyTie: 'none', hasLocalJobOffer: false, enrollingInStudy: false,
    liquidSavingsUsd: 0, investableCapitalUsd: 0, annualIncomeUsd: 0, passiveIncomeUsd: 0,
    netWorthUsd: 0, needsWorkAuthorization: true, needsLocalBanking: true,
    bringingFamily: false, wantsPermanence: false, maxStayMonths: 60 });
  assert.equal(r.verdict.recommended, 'Cambodia');
  assert.equal(r.verdict.pathway, 'Ordinary (E-class) Visa — the gateway');
  assert.equal(r.countries.find(c => c.code === 'VN').open.length, 0);
  assert.equal(r.countries.find(c => c.code === 'TH').open.length, 0);
  // They said they need to work. The gateway visa does not grant that.
  assert.ok(r.verdict.warnings.some(w => /work legally/.test(w)),
    'must warn that the recommended route does not carry work rights');
});

test('a stated need the pathway prose cannot confirm is flagged, not assumed met', () => {
  const r = compareCountries(packs, {
    age: 30, familyTie: 'none', hasLocalJobOffer: false, enrollingInStudy: false, retired: false,
    liquidSavingsUsd: 0, investableCapitalUsd: 0, annualIncomeUsd: 0, passiveIncomeUsd: 0,
    needsWorkAuthorization: true, needsLocalBanking: false, bringingFamily: false,
    wantsPermanence: false, maxStayMonths: 60 });
  const top = r.countries[0];
  const workNeed = top.needs.find(n => n.need.includes('work legally'));
  assert.ok(workNeed);
  assert.ok(['no', 'check'].includes(workNeed.met));
});

test('the recommended pathway fits the person, not merely the difficulty tier', () => {
  // Regression: a retiree was once recommended Cambodia's job-seeker visa, because
  // it tied with the retirement extension on difficulty and won on alphabet.
  const retiree = { age: 62, retired: true, passiveIncomeUsd: 30000, liquidSavingsUsd: 40000,
    investableCapitalUsd: 15000, familyTie: 'none', hasLocalJobOffer: false, enrollingInStudy: false,
    needsWorkAuthorization: false, needsLocalBanking: true, bringingFamily: true,
    wantsPermanence: false, maxStayMonths: 120 };
  const r = compareCountries(packs, retiree);
  const kh = r.countries.find(c => c.code === 'KH');
  assert.equal(kh.best.pathwayId, 'retirement-er',
    'the retirement route must outrank the job-seeker route for a retiree');
  assert.ok(kh.best.specificity > kh.open[1].specificity);
});

test('countries are ranked open-first, and the ordering is explainable', () => {
  const r = compareCountries(packs, remoteWorker);
  for (let i = 1; i < r.countries.length; i++) {
    assert.ok(r.countries[i - 1].rank[0] <= r.countries[i].rank[0], 'open countries must sort first');
  }
});

test('the facts table flags which rows actually differ', () => {
  const r = compareCountries(packs, remoteWorker);
  const byLabel = Object.fromEntries(r.facts.map(f => [f.label, f]));
  assert.equal(byLabel['US documents need'].differs, true,
    'Vietnam accepts apostilles; Cambodia and Thailand do not');
  assert.equal(byLabel['US documents need'].values.VN, 'an apostille');
  assert.equal(byLabel['US documents need'].values.KH, 'consular legalization');
  assert.equal(byLabel['Dedicated retirement route'].values.VN, 'no');
  assert.equal(byLabel['Dedicated retirement route'].values.KH, 'yes');
});

test('comparison is stable and total: every pathway lands in exactly one bucket', () => {
  const r = compareCountries(packs, remoteWorker);
  for (const c of r.countries) {
    const pack = packs.find(p => p.meta.countryCode === c.code);
    assert.equal(c.open.length + c.check.length + c.closed.length, pack.pathways.length,
      `${c.country}: pathways lost or double-counted`);
  }
});

/* ------------------------------------------- the browser bundle is the same engine */

test('the inlined browser engine gives byte-identical answers to the Node one', async () => {
  // The comparison product inlines match.mjs and compare.mjs into a single HTML
  // file. If that copy ever drifts from the tested source, the product quietly
  // starts lying. So: run the shipped bundle's own code and compare.
  const { execSync } = await import('node:child_process');
  execSync('node build/render-compare.mjs /tmp/_cmp.html', { stdio: 'pipe' });
  const html = readFileSync('/tmp/_cmp.html', 'utf8');

  const script = html.slice(html.indexOf('<script type="module">') + 22, html.lastIndexOf('</script>'));
  const engine = script.slice(0, script.indexOf('const PRESETS'));
  const mod = await import(`data:text/javascript,${encodeURIComponent(
    engine.replace(/const PACKS = /, 'export const PACKS = ') + '\nexport { compareCountries };'
  )}`);

  for (const file of readdirSync('app/profiles')) {
    const profile = JSON.parse(readFileSync(`app/profiles/${file}`, 'utf8'));
    const inBrowser = mod.compareCountries(mod.PACKS, profile);
    const inNode = compareCountries(packs, profile);

    assert.equal(inBrowser.verdict.recommended, inNode.verdict.recommended, `${file}: verdict differs`);
    assert.equal(inBrowser.verdict.pathway, inNode.verdict.pathway, `${file}: pathway differs`);
    assert.deepEqual(
      inBrowser.countries.map(c => [c.code, c.open.map(p => p.pathwayId)]),
      inNode.countries.map(c => [c.code, c.open.map(p => p.pathwayId)]),
      `${file}: open pathways differ`);
    assert.deepEqual(
      inBrowser.unlocks.map(u => [u.field, u.reachability]),
      inNode.unlocks.map(u => [u.field, u.reachability]),
      `${file}: unlocks differ`);
  }
});

test('no Node-only code survives into the browser bundle', () => {
  const html = readFileSync('/tmp/_cmp.html', 'utf8');
  const script = html.slice(html.indexOf('<script type="module">'));
  assert.equal(/node:fs|readFileSync|process\./.test(script), false);
});
