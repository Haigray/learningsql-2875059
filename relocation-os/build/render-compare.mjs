#!/usr/bin/env node
// Renders the cross-country comparison product: one self-contained HTML page
// where a buyer answers a short form and sees, live, which countries have a door
// open for them.
//
// The engine is not reimplemented for the browser — it is inlined from the same
// tested source that Node and the app use, with the one filesystem read replaced
// at build time. One source of truth, or the two drift and the comparison lies.
//
// Usage: node build/render-compare.mjs dist/southeast-asia-comparison.html

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const out = process.argv[2] ?? 'dist/southeast-asia-comparison.html';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const profileSchema = JSON.parse(readFileSync('schema/profile.schema.json', 'utf8'));
const PROFILE_FIELDS = Object.keys(profileSchema.properties);

const packs = readdirSync('content')
  .map(c => JSON.parse(readFileSync(`content/${c}/pack.json`, 'utf8')))
  .sort((a, b) => a.meta.country.localeCompare(b.meta.country));

// Only what the comparison needs travels to the browser; the full guides are
// separate products.
const slim = packs.map(p => ({
  meta: { country: p.meta.country, countryCode: p.meta.countryCode, version: p.meta.version,
          verifiedAsOf: p.meta.verifiedAsOf, comparables: p.meta.comparables },
  pathways: p.pathways.map(w => ({
    id: w.id, name: w.name, summary: w.summary, difficulty: w.difficulty,
    durationGranted: w.durationGranted, canWorkLocally: w.canWorkLocally,
    canBringFamily: w.canBringFamily, leadsToPermanentResidence: w.leadsToPermanentResidence,
    criteria: w.criteria,
  })),
}));

/* --- inline the tested engine, minus its Node-only bits --------------------- */
const strip = src => src
  .replace(/^import[^\n]*\n/gm, '')
  .replace(/^export (const|function) /gm, '$1 ');

const matchSrc = strip(readFileSync('app/engine/match.mjs', 'utf8'))
  .replace(/const PROFILE_FIELDS = new Set\([\s\S]*?\);/,
           `const PROFILE_FIELDS = new Set(${JSON.stringify(PROFILE_FIELDS)});`);
const compareSrc = strip(readFileSync('app/engine/compare.mjs', 'utf8'));

if (/node:fs|readFileSync/.test(matchSrc + compareSrc)) {
  console.error('refusing to build: Node-only code survived stripping');
  process.exit(1);
}

const verified = packs.map(p => `${p.meta.country} v${p.meta.version}`).join(' · ');

const html = `<title>Vietnam, Cambodia or Thailand</title>
<style>
:root{
  --bg:#fbfaf8;--surface:#fff;--ink:#1c1a17;--muted:#5f5a52;--faint:#8a837a;
  --line:#e3ded6;--line-strong:#cfc7bb;--accent:#8a3324;--accent-soft:#f5ebe8;
  --ok:#2f6a4a;--ok-soft:#e7f2ec;--warn:#8a6a1f;--warn-soft:#fbf3e0;
  --danger:#a3301f;--danger-soft:#fbeceb;--radius:10px;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#16151a;--surface:#1e1d23;--ink:#eceaf0;--muted:#a8a3b0;--faint:#7d7889;
  --line:#2e2c36;--line-strong:#413e4c;--accent:#e08a72;--accent-soft:#2c2020;
  --ok:#7fc4a0;--ok-soft:#1d2b24;--warn:#e0bd72;--warn-soft:#2b2519;
  --danger:#f0897a;--danger-soft:#2e1e1c;
}}
:root[data-theme="dark"]{
  --bg:#16151a;--surface:#1e1d23;--ink:#eceaf0;--muted:#a8a3b0;--faint:#7d7889;
  --line:#2e2c36;--line-strong:#413e4c;--accent:#e08a72;--accent-soft:#2c2020;
  --ok:#7fc4a0;--ok-soft:#1d2b24;--warn:#e0bd72;--warn-soft:#2b2519;
  --danger:#f0897a;--danger-soft:#2e1e1c;
}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);margin:0;
  font:16px/1.65 ui-serif,Georgia,'Iowan Old Style','Times New Roman',serif}
.wrap{max-width:56rem;margin:0 auto;padding:0 1.25rem}
h1,h2,h3{line-height:1.2;letter-spacing:-.012em;margin:0}
a{color:var(--accent)}
.sans{font-family:ui-sans-serif,system-ui,sans-serif}

header.top{border-bottom:1px solid var(--line-strong);background:var(--surface);padding:3rem 0 2rem}
.eyebrow{font:600 .72rem/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.16em;
  text-transform:uppercase;color:var(--accent);margin:0 0 .9rem}
h1{font-size:clamp(2rem,5.5vw,2.9rem);margin-bottom:.6rem}
.tagline{font-size:1.1rem;color:var(--muted);max-width:40rem;margin:0 0 1.3rem}
.stamp{display:flex;flex-wrap:wrap;gap:.5rem;font:.78rem/1.4 ui-sans-serif,system-ui,sans-serif}
.stamp span{border:1px solid var(--line-strong);border-radius:999px;padding:.3rem .75rem;color:var(--muted)}

.band{padding:2.5rem 0;border-bottom:1px solid var(--line)}
h2{font-size:1.6rem;margin-bottom:.3rem}
.lede{color:var(--muted);max-width:44rem;margin:0 0 1.4rem}

/* form */
.form{background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius);padding:1.4rem}
.presets{display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:1.3rem}
.preset{font:600 .8rem ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--muted);
  border:1px solid var(--line-strong);border-radius:999px;padding:.4rem .85rem;cursor:pointer}
.preset:hover,.preset[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.grid{display:grid;gap:1rem 1.4rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}
fieldset{border:0;padding:0;margin:0}
legend{font:650 .72rem/1 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;
  letter-spacing:.09em;color:var(--faint);margin-bottom:.6rem;padding:0}
label{display:block;font:.86rem ui-sans-serif,system-ui,sans-serif;color:var(--muted);margin-bottom:.7rem}
label span{display:block;margin-bottom:.2rem}
input[type=number],select{width:100%;font:inherit;font-size:.95rem;padding:.45rem .6rem;
  background:var(--bg);color:var(--ink);border:1px solid var(--line-strong);border-radius:7px}
.check{display:flex;gap:.5rem;align-items:flex-start;margin-bottom:.55rem;
  font:.86rem ui-sans-serif,system-ui,sans-serif;color:var(--muted)}
.check input{margin-top:.25rem;accent-color:var(--accent)}

/* verdict */
.verdict{background:var(--ok-soft);border:1px solid var(--line-strong);border-left:3px solid var(--ok);
  border-radius:0 var(--radius) var(--radius) 0;padding:1.3rem 1.5rem;margin-bottom:1.2rem}
.verdict.none{background:var(--warn-soft);border-left-color:var(--warn)}
.v-kicker{font:600 .72rem/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;
  text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
.v-country{font-size:1.6rem;font-weight:650;margin-bottom:.15rem}
.v-path{font-size:1.05rem;color:var(--muted);margin-bottom:.7rem}
.v-reason{font-size:.95rem;margin-bottom:.5rem}
.v-warn{background:var(--warn-soft);border-radius:7px;padding:.6rem .8rem;font-size:.9rem;margin-top:.5rem}

/* country cards */
.countries{display:grid;gap:.9rem}
.country{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:1.2rem 1.35rem}
.country.has-open{border-left:3px solid var(--ok)}
.country.no-open{border-left:3px solid var(--line-strong)}
.c-head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;margin-bottom:.8rem}
.c-name{font-size:1.25rem;font-weight:650}
.c-tally{font:.8rem ui-sans-serif,system-ui,sans-serif;color:var(--faint)}
.pw{padding:.55rem 0;border-top:1px solid var(--line)}
.pw:first-of-type{border-top:0}
.pw-name{font-weight:600;font-size:.97rem}
.pw-meta{font:.8rem ui-sans-serif,system-ui,sans-serif;color:var(--faint);margin-top:.1rem}
.pw-why{font-size:.88rem;color:var(--muted);margin-top:.2rem}
.tick{color:var(--ok);font-weight:700;margin-right:.35rem}
.qm{color:var(--warn);font-weight:700;margin-right:.35rem}
.cross{color:var(--faint);margin-right:.35rem}
.group{display:inline-block;font:600 .68rem/1 ui-sans-serif,system-ui,sans-serif;background:var(--ok-soft);
  color:var(--ok);padding:.28em .5em;border-radius:4px;margin-left:.4rem;vertical-align:.1em}
details.closed-list{margin-top:.6rem}
details.closed-list summary{cursor:pointer;font:.82rem ui-sans-serif,system-ui,sans-serif;color:var(--faint)}

/* unlocks */
.unlock{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  padding:.9rem 1.1rem;margin-bottom:.6rem;display:flex;gap:.9rem;align-items:flex-start}
.reach{flex-shrink:0;font:600 .66rem/1 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;
  letter-spacing:.06em;padding:.35em .55em;border-radius:4px;margin-top:.15rem}
.reach-close{background:var(--ok-soft);color:var(--ok)}
.reach-stretch{background:var(--warn-soft);color:var(--warn)}
.reach-far,.reach-wait,.reach-life-change{background:var(--bg);color:var(--faint);border:1px solid var(--line-strong)}
.u-summary{font-weight:600;font-size:.95rem}
.u-opens{font:.84rem ui-sans-serif,system-ui,sans-serif;color:var(--muted);margin-top:.2rem}

/* facts */
.tablewrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.9rem;min-width:34rem}
th{text-align:left;font:650 .72rem/1.5 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;
  letter-spacing:.06em;color:var(--faint);border-bottom:1px solid var(--line-strong);padding:.5rem .6rem}
td{border-bottom:1px solid var(--line);padding:.55rem .6rem;vertical-align:top}
td.label{color:var(--muted)}
tr.differs td.label{color:var(--ink);font-weight:600}
tr.same{opacity:.55}

.notice{background:var(--warn-soft);border:1px solid var(--line-strong);border-left:3px solid var(--warn);
  border-radius:var(--radius);padding:1rem 1.15rem;margin:1.5rem 0;
  font:.9rem/1.6 ui-sans-serif,system-ui,sans-serif;color:var(--muted)}
.notice b{color:var(--ink)}
footer{padding:2.5rem 0 4rem;color:var(--faint);font:.85rem/1.6 ui-sans-serif,system-ui,sans-serif}
@media print{.form,.presets{display:none}}
</style>

<header class="top"><div class="wrap">
  <p class="eyebrow">United States &rarr; Southeast Asia</p>
  <h1>Vietnam, Cambodia or Thailand?</h1>
  <p class="tagline">Answer eight questions and see which of the three actually has a door open for you &mdash; which route, what it costs you, and what single change would open the most doors.</p>
  <div class="stamp">
    <span><b>3</b> countries</span>
    <span><b>${packs.reduce((n, p) => n + p.pathways.length, 0)}</b> pathways</span>
    <span>Verified ${esc(packs[0].meta.verifiedAsOf)}</span>
    <span>${esc(verified)}</span>
  </div>
</div></header>

<div class="wrap">
  <div class="notice">
    <p style="margin:0 0 .6rem"><b>What this is.</b> A triage tool, not advice. It filters published eligibility rules against what you tell it, and it is only as current as its packs &mdash; every one carries its verification date above. Nothing here is legal or tax advice, and no practitioner has reviewed it.</p>
    <p style="margin:0"><b>It never rules you out on a guess.</b> Leave a field blank and the affected routes are marked <em>needs checking</em> rather than closed. Telling you a door is shut when it is merely unverified would be the worst thing this could do.</p>
  </div>

  <section class="band">
    <h2>Your situation</h2>
    <p class="lede">Nothing is sent anywhere &mdash; this runs entirely in your browser.</p>
    <div class="form">
      <div class="presets" id="presets"></div>
      <div class="grid">
        <fieldset>
          <legend>You</legend>
          <label><span>Age</span><input type="number" id="age" min="18" max="99"></label>
          <div class="check"><input type="checkbox" id="retired"><label for="retired" style="margin:0">Retired, and able to evidence it</label></div>
          <label><span>Family connection</span>
            <select id="familyTie">
              <option value="none">None</option>
              <option value="spouse">Married to a citizen</option>
              <option value="ancestry">Heritage or former nationality</option>
              <option value="child">Citizen child</option>
            </select></label>
        </fieldset>
        <fieldset>
          <legend>Money (US$ per year, or total)</legend>
          <label><span>Earned income</span><input type="number" id="annualIncomeUsd" min="0" step="1000"></label>
          <label><span>Passive income &mdash; pension, benefits, rent</span><input type="number" id="passiveIncomeUsd" min="0" step="1000"></label>
          <label><span>Liquid savings you can park and evidence</span><input type="number" id="liquidSavingsUsd" min="0" step="1000"></label>
          <label><span>Capital you would commit and leave in place</span><input type="number" id="investableCapitalUsd" min="0" step="5000"></label>
          <label><span>Total net worth</span><input type="number" id="netWorthUsd" min="0" step="10000"></label>
        </fieldset>
        <fieldset>
          <legend>Work</legend>
          <div class="check"><input type="checkbox" id="hasLocalJobOffer"><label for="hasLocalJobOffer" style="margin:0">I have, or expect, a local job offer</label></div>
          <div class="check"><input type="checkbox" id="employerIsLocalEntity"><label for="employerIsLocalEntity" style="margin:0">That employer is a registered local entity</label></div>
          <div class="check"><input type="checkbox" id="employerIsLargeEnough"><label for="employerIsLargeEnough" style="margin:0">It clears local headcount and capital tests</label></div>
          <div class="check"><input type="checkbox" id="remoteWorkForForeignEmployer"><label for="remoteWorkForForeignEmployer" style="margin:0">I work remotely for a foreign employer or clients</label></div>
          <div class="check"><input type="checkbox" id="enrollingInStudy"><label for="enrollingInStudy" style="margin:0">I will genuinely enrol and study</label></div>
          <label><span>Years of relevant experience</span><input type="number" id="yearsExperience" min="0" max="60"></label>
          <label><span>Sector</span>
            <select id="sector">
              <option value="">—</option><option value="tech">Technology</option>
              <option value="finance">Finance</option><option value="education">Education</option>
              <option value="healthcare">Healthcare</option><option value="other">Other</option>
            </select></label>
          <div class="check"><input type="checkbox" id="hasDegree"><label for="hasDegree" style="margin:0">I hold a university degree</label></div>
        </fieldset>
        <fieldset>
          <legend>What you need</legend>
          <label><span>How long do you want to stay? (months)</span><input type="number" id="maxStayMonths" min="1" max="360"></label>
          <div class="check"><input type="checkbox" id="needsWorkAuthorization"><label for="needsWorkAuthorization" style="margin:0">I need to work legally for a local employer</label></div>
          <div class="check"><input type="checkbox" id="needsLocalBanking"><label for="needsLocalBanking" style="margin:0">I need a local bank account</label></div>
          <div class="check"><input type="checkbox" id="bringingFamily"><label for="bringingFamily" style="margin:0">I am bringing family</label></div>
          <div class="check"><input type="checkbox" id="wantsPermanence"><label for="wantsPermanence" style="margin:0">Permanent residence or citizenship is the goal</label></div>
        </fieldset>
      </div>
    </div>
  </section>

  <section class="band"><h2>The answer</h2><div id="verdict"></div></section>
  <section class="band"><h2>Country by country</h2><div class="countries" id="countries"></div></section>
  <section class="band" id="unlocks-band"><h2>What would open more doors</h2>
    <p class="lede">Every route currently closed to you that is one change away, ordered by how reachable that change actually is from where you stand.</p>
    <div id="unlocks"></div></section>
  <section class="band"><h2>How the three differ</h2>
    <p class="lede">Facts that hold regardless of your situation. Rows where all three agree are dimmed.</p>
    <div class="tablewrap"><table id="facts"></table></div></section>

  <footer>
    <p>Southeast Asia comparison &mdash; ${esc(verified)}, verified ${esc(packs[0].meta.verifiedAsOf)}.</p>
    <p>Researched reference material, not legal, immigration or tax advice. Every underlying claim is cited in the individual country guides.</p>
  </footer>
</div>

<script type="module">
const PACKS = ${JSON.stringify(slim).replace(/</g, '\\u003c')};

${matchSrc}
${compareSrc}

const PRESETS = ${JSON.stringify(
  readdirSync('app/profiles').map(f => JSON.parse(readFileSync(`app/profiles/${f}`, 'utf8')))
).replace(/</g, '\\u003c')};

const NUM = ['age','annualIncomeUsd','passiveIncomeUsd','liquidSavingsUsd','investableCapitalUsd',
             'netWorthUsd','yearsExperience','maxStayMonths'];
const BOOL = ['retired','hasLocalJobOffer','employerIsLocalEntity','employerIsLargeEnough',
              'remoteWorkForForeignEmployer','enrollingInStudy','hasDegree',
              'needsWorkAuthorization','needsLocalBanking','bringingFamily','wantsPermanence'];
const SEL = ['familyTie','sector'];

const el = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function readProfile() {
  const p = {};
  for (const k of NUM)  { const v = el(k).value; if (v !== '') p[k] = Number(v); }
  for (const k of BOOL) { if (el(k).checked) p[k] = true; }
  for (const k of SEL)  { const v = el(k).value; if (v) p[k] = v; }
  // An unticked box is a deliberate "no" for the things people are asked to opt into.
  for (const k of ['needsWorkAuthorization','needsLocalBanking','bringingFamily','wantsPermanence','retired'])
    if (p[k] === undefined) p[k] = false;
  return p;
}

function applyPreset(preset) {
  for (const k of NUM)  el(k).value = preset[k] ?? '';
  for (const k of BOOL) el(k).checked = preset[k] === true;
  for (const k of SEL)  el(k).value = preset[k] ?? '';
  render();
}

function render() {
  const profile = readProfile();
  const r = compareCountries(PACKS, profile);

  /* verdict */
  const v = r.verdict;
  el('verdict').innerHTML = v.recommended
    ? \`<div class="verdict">
         <p class="v-kicker">Best fit on what you have told us</p>
         <p class="v-country">\${esc(v.recommended)}</p>
         <p class="v-path">\${esc(v.pathway ?? '')}</p>
         <p class="v-reason">\${esc(v.reason)}</p>
         \${v.runnerUp ? \`<p class="v-reason" style="color:var(--muted)">Runner-up: \${esc(v.runnerUp.country)} — \${esc(v.runnerUp.pathway ?? '')}</p>\` : ''}
         \${v.warnings.map(w => \`<p class="v-warn">\${esc(w)}</p>\`).join('')}
       </div>\`
    : \`<div class="verdict none">
         <p class="v-kicker">No open pathway</p>
         <p class="v-country">None of the three fits, yet</p>
         <p class="v-reason">\${esc(v.reason)}</p>
         \${v.warnings.map(w => \`<p class="v-warn">\${esc(w)}</p>\`).join('')}
       </div>\`;

  /* countries */
  el('countries').innerHTML = r.countries.map(c => \`
    <article class="country \${c.open.length ? 'has-open' : 'no-open'}">
      <div class="c-head">
        <span class="c-name">\${esc(c.country)}</span>
        <span class="c-tally">\${c.open.length} open · \${c.check.length} to check · \${c.closed.length} closed</span>
      </div>
      \${c.open.map(p => \`<div class="pw">
          <div class="pw-name"><span class="tick">✓</span>\${esc(p.name)}\${p.matchedGroup ? \`<span class="group">\${esc(p.matchedGroup)}</span>\` : ''}</div>
          <div class="pw-meta">\${esc(p.difficulty.replace('-', ' '))} · \${esc(p.durationGranted ?? '')}</div>
        </div>\`).join('')}
      \${c.check.map(p => \`<div class="pw">
          <div class="pw-name"><span class="qm">?</span>\${esc(p.name)}</div>
          <div class="pw-meta">needs checking: \${esc(p.unknown.map(u => u.cond.field).join(', '))}</div>
        </div>\`).join('')}
      \${!c.open.length && !c.check.length ? '<p class="pw-why">Nothing open on these facts.</p>' : ''}
      \${c.closed.length ? \`<details class="closed-list"><summary>\${c.closed.length} closed — why</summary>
        \${c.closed.map(p => \`<div class="pw"><div class="pw-name"><span class="cross">✕</span>\${esc(p.name)}</div>
          <div class="pw-why">\${esc(p.blockers.map(b => b.cond.because || b.cond.field).join('; '))}</div></div>\`).join('')}
      </details>\` : ''}
    </article>\`).join('');

  /* unlocks */
  const REACH = { close: 'within reach', stretch: 'a stretch', far: 'far off',
                  wait: 'time', 'life-change': 'life change' };
  el('unlocks-band').hidden = !r.unlocks.length;
  el('unlocks').innerHTML = r.unlocks.slice(0, 6).map(u => \`
    <div class="unlock">
      <span class="reach reach-\${esc(u.reachability)}">\${esc(REACH[u.reachability])}</span>
      <div>
        <div class="u-summary">\${esc(u.summary)}</div>
        \${u.because ? \`<div class="u-opens">\${esc(u.because)}</div>\` : ''}
        <div class="u-opens">Opens: \${u.opens.map(o => esc(o.country) + ' — ' + esc(o.pathway)).join(' · ')}</div>
      </div>
    </div>\`).join('');

  /* facts */
  const codes = r.countries.map(c => c.code);
  const names = Object.fromEntries(r.countries.map(c => [c.code, c.country]));
  el('facts').innerHTML =
    \`<thead><tr><th></th>\${codes.map(c => \`<th>\${esc(names[c])}</th>\`).join('')}</tr></thead>
     <tbody>\${r.facts.map(f => \`<tr class="\${f.differs ? 'differs' : 'same'}">
        <td class="label">\${esc(f.label)}</td>
        \${codes.map(c => \`<td>\${esc(f.values[c])}</td>\`).join('')}
      </tr>\`).join('')}</tbody>\`;
}

/* presets */
el('presets').innerHTML = PRESETS.map((p, i) =>
  \`<button type="button" class="preset" data-i="\${i}">\${esc(p.label)}</button>\`).join('');
el('presets').addEventListener('click', e => {
  const btn = e.target.closest('.preset');
  if (!btn) return;
  document.querySelectorAll('.preset').forEach(b => b.setAttribute('aria-pressed', b === btn));
  applyPreset(PRESETS[+btn.dataset.i]);
});

for (const k of [...NUM, ...BOOL, ...SEL]) {
  el(k).addEventListener(el(k).type === 'checkbox' || el(k).tagName === 'SELECT' ? 'change' : 'input', render);
}

applyPreset(PRESETS[0]);
document.querySelector('.preset')?.setAttribute('aria-pressed', 'true');
</script>`;

mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(resolve(out), html, 'utf8');
console.log(`Rendered comparison of ${packs.length} countries -> ${out} (${(html.length / 1024).toFixed(0)} KB)`);
