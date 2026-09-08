#!/usr/bin/env node
// Renders a country pack into the standalone HTML product that gets sold.
// Self-contained: no network, no build step, no dependencies. A buyer can open
// the file offline on a plane, and it still works.
//
// Usage: node build/render.mjs content/vietnam/pack.json dist/vietnam-guide.html

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const [, , packArg, outArg] = process.argv;
if (!packArg || !outArg) {
  console.error('usage: node build/render.mjs <pack.json> <out.html>');
  process.exit(2);
}

const pack = JSON.parse(readFileSync(resolve(packArg), 'utf8'));
const { meta } = pack;

const sourceById = new Map(pack.sources.map(s => [s.id, s]));
const cite = ids => !ids?.length ? '' :
  `<span class="cite">${ids.map(id => {
    const i = pack.sources.findIndex(s => s.id === id);
    return i < 0 ? '' : `<a href="#src-${esc(id)}" title="${esc(sourceById.get(id).title)}">${i + 1}</a>`;
  }).join('')}</span>`;

const PHASE_LABEL = {
  'decide': 'Decide', 'documents': 'Documents', 'exit-origin': `Leave ${meta.origin}`,
  'money': 'Money', 'arrival': 'Arrival', 'first-90-days': 'First 90 days',
  'ongoing': 'Ongoing', 'contingency': 'Contingency',
};

const prettyDate = d => new Date(d + 'T00:00:00Z')
  .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/* ---------------------------------------------------------------- sections */

const realityCheck = `
<section id="reality" class="band">
  <h2>Start here: what is not true</h2>
  <p class="lede">Six beliefs that cost Americans the most money on the way to ${esc(meta.country)}. We lead with these because the expensive mistakes happen before anyone files a form.</p>
  ${pack.realityCheck.map(r => `
  <article class="myth">
    <p class="myth-claim"><span class="tag tag-false">Widely believed</span>${esc(r.claim)}</p>
    <p class="myth-real"><strong>Actually:</strong> ${esc(r.reality)} ${cite(r.sourceIds)}</p>
    <p class="myth-why"><strong>Why the myth persists:</strong> ${esc(r.why)}</p>
  </article>`).join('')}
</section>`;

const treeSection = `
<section id="tree" class="band">
  <h2>Your pathway, in questions</h2>
  <p class="lede">Answer honestly rather than optimistically. Every answer narrows to exactly one route, including the routes that turn out not to exist. You can go back at any point.</p>
  <div id="tree-app">
    <ol id="breadcrumb" class="breadcrumb"></ol>
    <div id="tree-card" class="tree-card"></div>
    <div class="tree-controls">
      <button id="btn-back" type="button" class="btn btn-quiet">&larr; Back</button>
      <button id="btn-restart" type="button" class="btn btn-quiet">Start over</button>
    </div>
  </div>
  <noscript><p class="warn-box">This decision tree needs JavaScript. Every pathway it can reach is written out in full below, so you can also read them directly.</p></noscript>
</section>`;

const pathwaySection = `
<section id="pathways" class="band">
  <h2>The pathways in full</h2>
  <p class="lede">Every legal route, whether or not the tree sent you there. Read your own first, then read the one you would fall back to.</p>
  ${pack.pathways.map(p => `
  <article class="pathway" id="pathway-${esc(p.id)}">
    <header class="pathway-head">
      <h3>${esc(p.name)}</h3>
      <p class="codes">${(p.visaCodes ?? []).map(c => `<code>${esc(c)}</code>`).join(' ')}
        <span class="diff diff-${esc(p.difficulty)}">${esc(p.difficulty.replace('-', ' '))}</span></p>
      <p class="summary">${esc(p.summary)}</p>
    </header>

    <dl class="facts">
      ${p.bestFor ? `<dt>Best for</dt><dd>${esc(p.bestFor)}</dd>` : ''}
      ${p.durationGranted ? `<dt>You get</dt><dd>${esc(p.durationGranted)}</dd>` : ''}
      ${p.renewable ? `<dt>Renewable</dt><dd>${esc(p.renewable)}</dd>` : ''}
      ${p.canWorkLocally ? `<dt>Work locally</dt><dd>${esc(p.canWorkLocally)}</dd>` : ''}
      ${p.canBringFamily ? `<dt>Family</dt><dd>${esc(p.canBringFamily)}</dd>` : ''}
      ${p.leadsToPermanentResidence ? `<dt>Toward permanent residence</dt><dd>${esc(p.leadsToPermanentResidence)}</dd>` : ''}
      ${p.timeline ? `<dt>Realistic timeline</dt><dd>${esc(p.timeline)}</dd>` : ''}
    </dl>

    ${p.verification?.length ? `
    <div class="verify">
      <h4 class="verify-h">Verify this yourself before spending money</h4>
      <p class="verify-lede">Under an hour of work. This is the check that matters — not our word, and not an agency's.</p>
      ${p.verification.map(v => `
      <div class="verify-item">
        <p class="v-check">${esc(v.check)}</p>
        <p class="v-who"><b>Ask:</b> ${esc(v.authority)}</p>
        <p class="v-how">${esc(v.how)} ${v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.url.replace(/^https?:\/\//, ''))}</a>` : ''} ${cite(v.sourceIds)}</p>
        ${v.expectAnswer ? `<p class="v-expect"><b>A real answer sounds like:</b> ${esc(v.expectAnswer)}</p>` : ''}
      </div>`).join('')}
    </div>` : ''}

    <h4>Hard requirements</h4>
    <ul class="reqs">
      ${p.eligibility.map(e => `<li><strong>${esc(e.requirement)}</strong>${e.detail ? ` — ${esc(e.detail)}` : ''} ${cite(e.sourceIds)}</li>`).join('')}
    </ul>

    ${p.costs?.length ? `
    <h4>What it costs</h4>
    <table class="costs">
      <thead><tr><th>Item</th><th>Amount</th><th>Note</th></tr></thead>
      <tbody>${p.costs.map(c => `<tr><td>${esc(c.item)}</td><td class="amt">${esc(c.amount)}</td><td>${esc(c.note ?? '')} ${cite(c.sourceIds)}</td></tr>`).join('')}</tbody>
    </table>` : ''}

    <h4>Step by step</h4>
    <ol class="steps">
      ${p.steps.map(s => `
      <li>
        <p class="step-title">${esc(s.title)}</p>
        <p>${esc(s.detail)} ${cite(s.sourceIds)}</p>
        <p class="step-meta">
          ${s.who ? `<span><b>Who:</b> ${esc(s.who)}</span>` : ''}
          ${s.where ? `<span><b>Where:</b> ${esc(s.where)}</span>` : ''}
          ${s.takes ? `<span><b>Takes:</b> ${esc(s.takes)}</span>` : ''}
        </p>
        ${s.blocker ? `<p class="step-blocker"><b>Blocked by:</b> ${esc(s.blocker)}</p>` : ''}
      </li>`).join('')}
    </ol>

    ${p.failureModes?.length ? `
    <h4>How this goes wrong</h4>
    <div class="failures">
      ${p.failureModes.map(f => `
      <div class="failure">
        <p class="f-mistake">${esc(f.mistake)}</p>
        <p class="f-conseq"><b>Consequence:</b> ${esc(f.consequence)}</p>
        <p class="f-avoid"><b>Avoid it:</b> ${esc(f.avoid)}</p>
      </div>`).join('')}
    </div>` : ''}
  </article>`).join('')}
</section>`;

const moduleSection = `
<section id="checklists" class="band">
  <h2>The move itself, phase by phase</h2>
  <p class="lede">Eight phases, in order. These apply whichever pathway you took; items marked with a pathway only appear for that route. Your ticks are saved in this browser.</p>
  <div class="phase-nav">${pack.modules.map(m => `<a href="#module-${esc(m.id)}">${esc(PHASE_LABEL[m.phase] ?? m.phase)}</a>`).join('')}</div>
  ${pack.modules.map(m => `
  <article class="module" id="module-${esc(m.id)}">
    <h3>${esc(m.title)}</h3>
    ${m.window ? `<p class="window">${esc(m.window)}</p>` : ''}
    ${m.intro ? `<p class="mod-intro">${esc(m.intro)}</p>` : ''}
    <ul class="checklist">
      ${m.items.map((it, i) => {
        const id = it.key ?? `${m.id}-${i}`;
        const scoped = (it.appliesTo ?? []).filter(x => x !== '*');
        return `<li${it.critical ? ' class="critical"' : ''}${scoped.length ? ` data-pathways="${esc(scoped.join(' '))}"` : ''}>
          <input type="checkbox" id="chk-${esc(id)}" data-key="${esc(id)}">
          <label for="chk-${esc(id)}">
            <span class="task">${esc(it.task)}${it.critical ? '<span class="tag tag-critical">critical</span>' : ''}</span>
            ${it.detail ? `<span class="detail">${esc(it.detail)} ${cite(it.sourceIds)}</span>` : ''}
            ${it.why ? `<span class="why"><b>Why:</b> ${esc(it.why)}</span>` : ''}
            ${scoped.length ? `<span class="scope">Applies to: ${scoped.map(s => esc(pack.pathways.find(p => p.id === s)?.name ?? s)).join(', ')}</span>` : ''}
          </label>
        </li>`;
      }).join('')}
    </ul>
  </article>`).join('')}
</section>`;

const gotchaSection = !pack.gotchas?.length ? '' : `
<section id="gotchas" class="band">
  <h2>Ten traps</h2>
  <p class="lede">Cross-cutting failures that belong to no single pathway. If you read only one section of this guide, read this one.</p>
  ${pack.gotchas.map((g, i) => `
  <article class="gotcha sev-${esc(g.severity ?? 'annoying')}">
    <h3><span class="gnum">${i + 1}</span>${esc(g.title)}</h3>
    ${g.severity ? `<p class="sev-label">${esc(g.severity.replace('-', ' '))}</p>` : ''}
    <p><strong>The trap.</strong> ${esc(g.trap)}</p>
    <p><strong>Do this instead.</strong> ${esc(g.doThis)} ${cite(g.sourceIds)}</p>
    ${g.expires ? `<p class="expires">Tied to a rule change — re-check this after ${esc(prettyDate(g.expires))}.</p>` : ''}
  </article>`).join('')}
</section>`;

const contestedSection = !pack.contested?.length ? '' : `
<section id="contested" class="band">
  <h2>Where the sources disagree</h2>
  <p class="lede">Questions credible sources answer differently. We publish the disagreement rather than picking a side and hoping — a guide that hides a genuine conflict is more dangerous than one that names it.</p>
  ${pack.contested.map(c => `
  <article class="contested">
    <h3>${esc(c.question)}</h3>
    <div class="positions">
      ${c.positions.map((pos, i) => `
      <div class="position">
        <p class="pos-num">Position ${i + 1}</p>
        <p class="pos-text">${esc(pos.position)} ${cite(pos.sourceIds)}</p>
        <p class="pos-who">Held by: ${esc(pos.heldBy)}</p>
      </div>`).join('')}
    </div>
    ${c.practicalEffect ? `<p class="c-effect"><b>What this actually means for you.</b> ${esc(c.practicalEffect)}</p>` : ''}
    <p class="c-resolve"><b>How to settle it for your own case.</b> ${esc(c.howToResolve)} ${cite(c.sourceIds)}</p>
  </article>`).join('')}
</section>`;

const WATCH_LABEL = {
  'proposed': 'Proposed only', 'passed-not-in-force': 'Passed, not yet in force',
  'in-force-unclear': 'In force, details unclear', 'rumoured': 'Rumoured — no traceable instrument',
  'enforcement-shift': 'Enforcement shifting',
};

const watchSection = !pack.watchlist?.length ? '' : `
<section id="watchlist" class="band">
  <h2>What we are watching</h2>
  <p class="lede">Rules that are moving, or expected to. Each carries the date we next check it. When one lands, this guide is updated and you get the new edition — that is what your purchase actually buys beyond the first read.</p>
  ${pack.watchlist.map(w => `
  <article class="watch impact-${esc(w.impact)}">
    <h3>${esc(w.title)}</h3>
    <p class="watch-meta">
      <span class="wstatus">${esc(WATCH_LABEL[w.status] ?? w.status)}</span>
      <span class="wimpact">Impact if it lands: ${esc(w.impact.replace('-', ' '))}</span>
      ${w.checkBy ? `<span class="wcheck">We re-check by ${esc(prettyDate(w.checkBy))}</span>` : ''}
    </p>
    <p>${esc(w.whatChanges)} ${cite(w.sourceIds)}</p>
    ${w.affectsPathways?.length ? `<p class="waffects">Affects: ${w.affectsPathways.map(id => esc(pack.pathways.find(x => x.id === id)?.name ?? id)).join(', ')}</p>` : ''}
  </article>`).join('')}
</section>`;

const changelogSection = !pack.changelog?.length ? '' : `
<section id="changelog" class="band">
  <h2>What has changed</h2>
  <p class="lede">Every edition of this guide, and what moved in it.</p>
  ${pack.changelog.map(e => `
  <article class="release">
    <h3>v${esc(e.version)} <span class="rel-date">${esc(prettyDate(e.date))}</span></h3>
    ${e.summary ? `<p class="rel-sum">${esc(e.summary)}</p>` : ''}
    <ul class="rel-changes">
      ${e.changes.map(c => `<li><span class="ckind">${esc(c.kind.replace('-', ' '))}</span> ${esc(c.what)}
        ${c.actionRequired ? `<span class="c-action"><b>What to do:</b> ${esc(c.actionRequired)}</span>` : ''}</li>`).join('')}
    </ul>
  </article>`).join('')}
</section>`;

const sourceSection = `
<section id="sources" class="band">
  <h2>Sources, and how much to trust each one</h2>
  <p class="lede">Every factual claim above is numbered to this list. Tiers are marked honestly: a law firm's summary of a decree is not the decree, and we do not pretend otherwise. Verify anything that will cost you money before you act on it.</p>
  <ol class="sources">
    ${pack.sources.map(s => `
    <li id="src-${esc(s.id)}">
      <span class="tier tier-${esc(s.tier)}">${esc(s.tier.replace('-', ' '))}</span>
      ${s.url ? `<a href="${esc(s.url)}" rel="noopener noreferrer" target="_blank">${esc(s.title)}</a>` : esc(s.title)}
      <span class="checked">checked ${esc(prettyDate(s.checkedOn))}</span>
      ${s.note ? `<span class="src-note">${esc(s.note)}</span>` : ''}
    </li>`).join('')}
  </ol>
</section>`;

/* ------------------------------------------------------------------- page */

const html = `<title>${esc(meta.country)} Relocation Guide</title>
<style>
:root{
  --bg:#fbfaf8; --surface:#fff; --ink:#1c1a17; --muted:#5f5a52; --faint:#8a837a;
  --line:#e3ded6; --line-strong:#cfc7bb; --accent:#8a3324; --accent-soft:#f5ebe8;
  --ok:#2f6a4a; --warn:#8a6a1f; --warn-soft:#fbf3e0; --danger:#a3301f; --danger-soft:#fbeceb;
  --radius:10px; --measure:none;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#16151a; --surface:#1e1d23; --ink:#eceaf0; --muted:#a8a3b0; --faint:#7d7889;
  --line:#2e2c36; --line-strong:#413e4c; --accent:#e08a72; --accent-soft:#2c2020;
  --ok:#7fc4a0; --warn:#e0bd72; --warn-soft:#2b2519; --danger:#f0897a; --danger-soft:#2e1e1c;
}}
:root[data-theme="dark"]{
  --bg:#16151a; --surface:#1e1d23; --ink:#eceaf0; --muted:#a8a3b0; --faint:#7d7889;
  --line:#2e2c36; --line-strong:#413e4c; --accent:#e08a72; --accent-soft:#2c2020;
  --ok:#7fc4a0; --warn:#e0bd72; --warn-soft:#2b2519; --danger:#f0897a; --danger-soft:#2e1e1c;
}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);margin:0;
  font:16px/1.65 ui-serif,Georgia,'Iowan Old Style','Times New Roman',serif;}
.wrap{max-width:52rem;margin:0 auto;padding:0 1.25rem}
h1,h2,h3,h4{line-height:1.2;letter-spacing:-.012em}
h2{font-size:1.75rem;margin:0 0 .35rem}
h3{font-size:1.2rem;margin:2rem 0 .3rem}
h4{font-size:.82rem;text-transform:uppercase;letter-spacing:.09em;color:var(--faint);
  margin:1.75rem 0 .5rem;font-family:ui-sans-serif,system-ui,sans-serif;font-weight:650}
p{margin:0 0 .8rem}
a{color:var(--accent)}
code{font:.85em ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--accent-soft);
  color:var(--accent);padding:.1em .4em;border-radius:4px}
.lede{color:var(--muted);font-size:1.05rem;margin-bottom:1.5rem;max-width:42rem}

/* header */
header.top{border-bottom:1px solid var(--line-strong);background:var(--surface);padding:3.5rem 0 2.25rem}
.eyebrow{font:600 .72rem/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.16em;
  text-transform:uppercase;color:var(--accent);margin-bottom:1rem}
h1{font-size:clamp(2.1rem,6vw,3.1rem);margin:0 0 .6rem}
.tagline{font-size:1.15rem;color:var(--muted);max-width:38rem;margin-bottom:1.5rem}
.stamp{display:flex;flex-wrap:wrap;gap:.5rem;font:.78rem/1.4 ui-sans-serif,system-ui,sans-serif}
.stamp span{border:1px solid var(--line-strong);border-radius:999px;padding:.3rem .75rem;color:var(--muted)}
.stamp b{color:var(--ink);font-weight:650}

/* trust notice */
.notice{background:var(--warn-soft);border:1px solid var(--line-strong);border-left:3px solid var(--warn);
  border-radius:var(--radius);padding:1rem 1.15rem;margin:2rem 0;
  font:.9rem/1.6 ui-sans-serif,system-ui,sans-serif;color:var(--muted)}
.notice b{color:var(--ink)}
.warn-box{background:var(--warn-soft);border:1px solid var(--line-strong);border-radius:var(--radius);padding:1rem}

/* bands */
.band{padding:3rem 0;border-bottom:1px solid var(--line)}
.band:last-of-type{border-bottom:0}

/* reality check */
.myth{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  padding:1.15rem 1.25rem;margin-bottom:.85rem}
.myth-claim{font-size:1.05rem;font-weight:600;margin-bottom:.5rem}
.myth-why{color:var(--muted);font-size:.92rem;margin-bottom:0}
.tag{display:inline-block;font:600 .66rem/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.07em;
  text-transform:uppercase;padding:.28em .55em;border-radius:4px;margin-right:.55rem;vertical-align:.12em}
.tag-false{background:var(--danger-soft);color:var(--danger)}
.tag-critical{background:var(--danger-soft);color:var(--danger);margin-left:.5rem;margin-right:0}

/* decision tree */
.tree-card{background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius);
  padding:1.5rem;min-height:12rem}
.q-text{font-size:1.3rem;font-weight:600;margin-bottom:.5rem}
.q-help{color:var(--muted);font-size:.94rem;margin-bottom:1.2rem}
.answers{display:flex;flex-direction:column;gap:.6rem}
.answer{display:block;width:100%;text-align:left;background:var(--bg);border:1px solid var(--line-strong);
  border-radius:var(--radius);padding:.85rem 1rem;cursor:pointer;font:inherit;color:inherit;
  transition:border-color .12s,background .12s}
.answer:hover{border-color:var(--accent);background:var(--accent-soft)}
.answer b{display:block;margin-bottom:.15rem}
.answer i{font-style:normal;color:var(--muted);font-size:.88rem}
.breadcrumb{list-style:none;display:flex;flex-wrap:wrap;gap:.4rem;padding:0;margin:0 0 .9rem;
  font:.8rem/1.4 ui-sans-serif,system-ui,sans-serif;color:var(--faint)}
.breadcrumb li::after{content:" ›";color:var(--line-strong)}
.breadcrumb li:last-child::after{content:""}
.tree-controls{display:flex;gap:.6rem;margin-top:.9rem}
.btn{font:600 .85rem ui-sans-serif,system-ui,sans-serif;padding:.5rem .9rem;border-radius:8px;
  border:1px solid var(--line-strong);background:var(--surface);color:var(--muted);cursor:pointer}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.btn[hidden]{display:none}
.result-kicker{font:600 .72rem/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;
  text-transform:uppercase;color:var(--accent);margin-bottom:.6rem}
.result-dead .result-kicker{color:var(--danger)}
.alts{margin:.6rem 0 0;padding-left:1.1rem}
.alts li{margin-bottom:.35rem}

/* pathways */
.pathway{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  padding:1.5rem;margin-bottom:1.25rem}
.pathway-head h3{margin-top:0}
.codes{font:.8rem ui-sans-serif,system-ui,sans-serif;margin-bottom:.6rem}
.diff{display:inline-block;margin-left:.4rem;padding:.25em .6em;border-radius:999px;
  font:600 .68rem/1 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em}
.diff-low{background:#e7f2ec;color:var(--ok)} .diff-moderate{background:var(--warn-soft);color:var(--warn)}
.diff-high,.diff-very-high{background:var(--danger-soft);color:var(--danger)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .diff-low{background:#1d2b24}}
.summary{color:var(--muted)}
.facts{display:grid;grid-template-columns:minmax(9rem,auto) 1fr;gap:.35rem .9rem;margin:1.1rem 0;
  padding:1rem;background:var(--bg);border-radius:var(--radius);font-size:.93rem}
.facts dt{font:650 .78rem/1.5 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;
  letter-spacing:.05em;color:var(--faint)}
.facts dd{margin:0}
.reqs{padding-left:1.1rem} .reqs li{margin-bottom:.5rem}
.costs{width:100%;border-collapse:collapse;font-size:.9rem;margin-bottom:.5rem}
.costs th{text-align:left;font:650 .72rem/1.5 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;
  letter-spacing:.06em;color:var(--faint);border-bottom:1px solid var(--line-strong);padding:.4rem .5rem}
.costs td{border-bottom:1px solid var(--line);padding:.55rem .5rem;vertical-align:top}
.costs .amt{white-space:nowrap;font-weight:600}
.steps{padding-left:1.3rem} .steps li{margin-bottom:1.1rem}
.step-title{font-weight:650;margin-bottom:.2rem}
.step-meta{font:.82rem ui-sans-serif,system-ui,sans-serif;color:var(--faint);display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:0}
.step-blocker{font-size:.88rem;color:var(--warn);margin:.35rem 0 0}
.failures{display:grid;gap:.7rem}
.failure{border-left:3px solid var(--danger);background:var(--danger-soft);
  border-radius:0 var(--radius) var(--radius) 0;padding:.85rem 1rem}
.failure p{margin-bottom:.3rem;font-size:.93rem} .failure p:last-child{margin-bottom:0}
.f-mistake{font-weight:650}

/* checklists */
.phase-nav{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1.5rem}
.phase-nav a{font:600 .78rem ui-sans-serif,system-ui,sans-serif;text-decoration:none;color:var(--muted);
  border:1px solid var(--line-strong);border-radius:999px;padding:.35rem .8rem}
.phase-nav a:hover{border-color:var(--accent);color:var(--accent)}
.module{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  padding:1.4rem;margin-bottom:1rem;scroll-margin-top:1rem}
.module h3{margin-top:0}
.window{font:600 .78rem ui-sans-serif,system-ui,sans-serif;color:var(--accent);
  text-transform:uppercase;letter-spacing:.06em;margin-bottom:.6rem}
.mod-intro{color:var(--muted);font-size:.95rem}
.checklist{list-style:none;padding:0;margin:1rem 0 0}
.checklist li{display:flex;gap:.7rem;padding:.75rem 0;border-top:1px solid var(--line)}
.checklist li.critical{border-left:3px solid var(--danger);padding-left:.7rem;margin-left:-.7rem}
.checklist input{margin-top:.35rem;width:1.05rem;height:1.05rem;flex-shrink:0;accent-color:var(--accent)}
.checklist label{display:block;cursor:pointer}
.checklist .task{display:block;font-weight:600}
.checklist .detail,.checklist .why,.checklist .scope{display:block;color:var(--muted);font-size:.9rem;margin-top:.2rem}
.checklist .scope{font:.8rem ui-sans-serif,system-ui,sans-serif;color:var(--faint)}
.checklist input:checked + label .task{text-decoration:line-through;color:var(--faint)}
.checklist li[hidden]{display:none}

/* gotchas */
.gotcha{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--line-strong);
  border-radius:0 var(--radius) var(--radius) 0;padding:1.2rem 1.35rem;margin-bottom:.85rem}
.gotcha.sev-expensive{border-left-color:var(--warn)}
.gotcha.sev-trip-ending{border-left-color:var(--danger)}
.gotcha h3{margin:0 0 .15rem;font-size:1.12rem}
.gnum{display:inline-block;min-width:1.6rem;color:var(--faint);font-family:ui-sans-serif,system-ui,sans-serif}
.sev-label{font:650 .68rem/1 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;
  letter-spacing:.08em;color:var(--faint);margin:0 0 .7rem 1.6rem}
.gotcha p{font-size:.95rem}
.expires{color:var(--warn);font-size:.86rem;margin-bottom:0}

/* sources */
.sources{padding-left:1.5rem;font-size:.9rem}
.sources li{margin-bottom:.75rem;padding-left:.25rem}
.tier{display:inline-block;font:650 .64rem/1 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;
  letter-spacing:.06em;padding:.28em .5em;border-radius:4px;margin-right:.5rem;vertical-align:.1em}
.tier-primary-law{background:var(--accent-soft);color:var(--accent)}
.tier-government{background:#e7f2ec;color:var(--ok)}
.tier-professional{background:var(--warn-soft);color:var(--warn)}
.tier-community{background:var(--bg);color:var(--faint);border:1px solid var(--line-strong)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .tier-government{background:#1d2b24}}
.checked,.src-note{display:block;color:var(--faint);font-size:.8rem;margin-top:.15rem}
.cite{font-size:.7em;vertical-align:super;white-space:nowrap}
.cite a{text-decoration:none;padding:0 .12em;font-family:ui-sans-serif,system-ui,sans-serif;font-weight:650}


/* verify-it-yourself — the block that replaces "trust us" */
.verify{background:var(--accent-soft);border:1px solid var(--line-strong);border-radius:var(--radius);
  padding:1.15rem 1.25rem;margin:1.25rem 0}
.verify-h{margin:0 0 .2rem;color:var(--accent)}
.verify-lede{color:var(--muted);font-size:.9rem;margin-bottom:1rem}
.verify-item{border-top:1px solid var(--line-strong);padding-top:.8rem;margin-top:.8rem}
.verify-item:first-of-type{border-top:0;padding-top:0;margin-top:0}
.verify-item p{font-size:.93rem;margin-bottom:.3rem}
.v-check{font-weight:650}
.v-who{color:var(--muted)}
.v-expect{color:var(--muted);font-style:italic;margin-bottom:0}
.v-how a{word-break:break-all}

/* contested claims */
.contested{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  padding:1.4rem;margin-bottom:1rem}
.contested h3{margin-top:0}
.positions{display:grid;gap:.7rem;margin:1rem 0}
@media(min-width:44rem){.positions{grid-template-columns:1fr 1fr}}
.position{background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);padding:.9rem 1rem}
.pos-num{font:650 .68rem/1 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;
  letter-spacing:.09em;color:var(--faint);margin-bottom:.45rem}
.pos-text{font-size:.93rem}
.pos-who{font-size:.84rem;color:var(--faint);margin-bottom:0}
.c-effect{background:var(--warn-soft);border-left:3px solid var(--warn);border-radius:0 6px 6px 0;
  padding:.8rem 1rem;font-size:.95rem}
.c-resolve{font-size:.95rem;margin-bottom:0}

/* watchlist */
.watch{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--line-strong);
  border-radius:0 var(--radius) var(--radius) 0;padding:1.1rem 1.3rem;margin-bottom:.8rem}
.watch.impact-significant{border-left-color:var(--warn)}
.watch.impact-pathway-changing{border-left-color:var(--danger)}
.watch h3{margin:0 0 .5rem;font-size:1.08rem}
.watch-meta{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.7rem;
  font:600 .7rem/1 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em}
.watch-meta span{border:1px solid var(--line-strong);border-radius:999px;padding:.35em .7em;color:var(--muted)}
.wstatus{background:var(--warn-soft);color:var(--warn)!important;border-color:transparent!important}
.watch p{font-size:.94rem}
.waffects{color:var(--faint);font-size:.85rem;margin-bottom:0}

/* changelog */
.release{border-left:2px solid var(--line-strong);padding:0 0 .5rem 1.1rem;margin-bottom:1.2rem}
.release h3{margin:0 0 .3rem;font-size:1.05rem}
.rel-date{font:400 .8rem ui-sans-serif,system-ui,sans-serif;color:var(--faint);margin-left:.4rem}
.rel-sum{color:var(--muted);font-size:.94rem}
.rel-changes{list-style:none;padding:0;margin:.5rem 0 0}
.rel-changes li{font-size:.92rem;margin-bottom:.6rem}
.ckind{display:inline-block;font:650 .64rem/1 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;
  letter-spacing:.06em;background:var(--bg);border:1px solid var(--line-strong);color:var(--faint);
  padding:.3em .5em;border-radius:4px;margin-right:.45rem;vertical-align:.1em}
.c-action{display:block;color:var(--accent);margin-top:.25rem}

/* edition badge */
.stamp .ed{background:var(--accent-soft);color:var(--accent);border-color:transparent;font-weight:650}

footer{padding:2.5rem 0 4rem;color:var(--faint);font:.85rem/1.6 ui-sans-serif,system-ui,sans-serif}
@media print{
  .tree-controls,.phase-nav,#tree-app .answers{display:none}
  .band{page-break-inside:auto;border:0} .pathway,.gotcha,.module,.contested,.watch{page-break-inside:avoid}
  body{background:#fff;color:#000;font-size:11pt}
}
@media (max-width:34rem){ .facts{grid-template-columns:1fr;gap:.1rem .5rem} .facts dt{margin-top:.5rem} }
</style>

<header class="top"><div class="wrap">
  <p class="eyebrow">${esc(meta.origin)} &rarr; ${esc(meta.country)}</p>
  <h1>The ${esc(meta.country)} Relocation Guide</h1>
  <p class="tagline">${esc(meta.tagline ?? '')}</p>
  <div class="stamp">
    <span>Edition <b>v${esc(meta.version)}</b></span>
    <span>Verified <b>${esc(prettyDate(meta.verifiedAsOf))}</b></span>
    ${meta.reviewDue ? `<span>Next review <b>${esc(prettyDate(meta.reviewDue))}</b></span>` : ''}
    <span><b>${pack.pathways.length}</b> pathways</span>
    <span><b>${pack.sources.length}</b> cited sources</span>
    <span class="ed">${meta.edition === 'reviewed' ? 'Professionally reviewed' : 'Navigator edition'}</span>
  </div>
</div></header>

<div class="wrap">
  <div class="notice">
    <p><b>Read this before you rely on anything here.</b> This is researched reference material, not legal or tax advice, and no lawyer-client relationship is created by buying it. Immigration rules change without notice and are applied with discretion by individual officers. Every claim is numbered to a source you can check yourself, and each source is labelled with how much weight it carries.</p>
    <p>${meta.edition === 'reviewed'
      ? `<b>Reviewed edition.</b> ${esc(meta.reviewedBy ?? '')}`
      : '<b>Navigator edition.</b> This guide was researched against public primary and government sources by its publisher. No licensed practitioner in ' + esc(meta.country) + ' has reviewed it, and we do not pretend otherwise. That is exactly why every pathway carries its own <a href="#pathways">verify-this-yourself</a> steps, naming the office that can answer, the question to ask, and what a real answer sounds like. Run them. They cost an hour and they are worth more than our assurance.'}</p>
    <p style="margin-bottom:0"><b>Everything here was verified on ${esc(prettyDate(meta.verifiedAsOf))}.</b> Before you spend money or book a flight, confirm the specific rule against the cited source or with a licensed Vietnamese immigration adviser. ${esc(meta.fxNote ?? '')}</p>
  </div>
  ${realityCheck}
  ${treeSection}
  ${pathwaySection}
  ${gotchaSection}
  ${contestedSection}
  ${moduleSection}
  ${watchSection}
  ${sourceSection}
  ${changelogSection}
  <footer>
    <p>${esc(meta.country)} Relocation Guide, edition v${esc(meta.version)}, verified ${esc(prettyDate(meta.verifiedAsOf))}. Built on the Relocation OS country-pack format.</p>
    <p>Licensed for personal use by the purchaser. Not legal, immigration, or tax advice.</p>
  </footer>
</div>

<script>
const PACK = ${JSON.stringify({ tree: pack.tree, pathways: pack.pathways.map(p => ({ id: p.id, name: p.name, summary: p.summary, difficulty: p.difficulty })) }).replace(/</g, '\\u003c')};

/* ---- decision tree ---- */
(function () {
  const nodes = new Map(PACK.tree.nodes.map(n => [n.id, n]));
  const pathways = new Map(PACK.pathways.map(p => [p.id, p]));
  const card = document.getElementById('tree-card');
  const crumbs = document.getElementById('breadcrumb');
  const back = document.getElementById('btn-back');
  const restart = document.getElementById('btn-restart');
  if (!card) return;

  let path = [PACK.tree.entry];   // node ids
  let picks = [];                 // answer labels

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function scopeChecklists(pathwayId) {
    document.querySelectorAll('.checklist li[data-pathways]').forEach(li => {
      li.hidden = pathwayId ? !li.dataset.pathways.split(' ').includes(pathwayId) : false;
    });
    try { pathwayId ? localStorage.setItem('vn-pathway', pathwayId) : localStorage.removeItem('vn-pathway'); } catch (e) {}
  }

  function render() {
    const node = nodes.get(path[path.length - 1]);
    crumbs.innerHTML = picks.map(p => '<li>' + esc(p) + '</li>').join('');
    back.hidden = path.length < 2;

    if (node.type === 'question') {
      scopeChecklists(null);
      card.className = 'tree-card';
      card.innerHTML =
        '<p class="q-text">' + esc(node.question) + '</p>' +
        (node.help ? '<p class="q-help">' + esc(node.help) + '</p>' : '') +
        '<div class="answers">' + node.answers.map((a, i) =>
          '<button type="button" class="answer" data-i="' + i + '"><b>' + esc(a.label) + '</b>' +
          (a.note ? '<i>' + esc(a.note) + '</i>' : '') + '</button>').join('') + '</div>';
      card.querySelectorAll('.answer').forEach(btn => btn.addEventListener('click', () => {
        const a = node.answers[+btn.dataset.i];
        picks.push(a.label);
        path.push(a.next);
        render();
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }));
      return;
    }

    if (node.type === 'outcome') {
      const p = pathways.get(node.pathwayId);
      scopeChecklists(p.id);
      card.className = 'tree-card';
      card.innerHTML =
        '<p class="result-kicker">Your pathway</p>' +
        '<p class="q-text">' + esc(p.name) + '</p>' +
        '<p class="q-help">' + esc(p.summary) + '</p>' +
        '<p><a class="btn" href="#pathway-' + p.id + '">Read the full pathway &rarr;</a></p>' +
        '<p class="q-help" style="margin-top:1rem">The phase checklists below are now filtered to this pathway.</p>';
      return;
    }

    scopeChecklists(null);
    card.className = 'tree-card result-dead';
    card.innerHTML =
      '<p class="result-kicker">No pathway fits &mdash; here is the honest answer</p>' +
      '<p class="q-help" style="font-size:1rem;color:var(--ink)">' + esc(node.verdict) + '</p>' +
      (node.alternatives && node.alternatives.length
        ? '<p style="font-weight:650;margin-top:1rem">What to actually consider:</p><ul class="alts">' +
          node.alternatives.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>'
        : '');
  }

  back.addEventListener('click', () => { if (path.length > 1) { path.pop(); picks.pop(); render(); } });
  restart.addEventListener('click', () => { path = [PACK.tree.entry]; picks = []; render(); });
  render();
})();

/* ---- checklist persistence ---- */
(function () {
  const KEY = 'vn-guide-progress';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  document.querySelectorAll('.checklist input[data-key]').forEach(box => {
    if (saved[box.dataset.key]) box.checked = true;
    box.addEventListener('change', () => {
      saved[box.dataset.key] = box.checked;
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
    });
  });
})();
</script>`;

mkdirSync(dirname(resolve(outArg)), { recursive: true });
writeFileSync(resolve(outArg), html, 'utf8');
console.log(`Rendered ${meta.country} v${meta.version} -> ${outArg} (${(html.length / 1024).toFixed(0)} KB)`);
