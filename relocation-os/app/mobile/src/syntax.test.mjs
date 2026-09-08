// Run: node --test app/mobile/src/syntax.test.mjs
//
// The screens need a simulator to run, which this environment does not have. What
// it CAN prove is that every file parses as valid JSX/ESM, that imports resolve to
// files that exist, and that the generated data is in step with the packs.
// Without these, a typo in a screen would only surface on someone's phone.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let parse;
try { ({ parse } = require('../../../.tooling/node_modules/@babel/parser')); }
catch { /* parser unavailable — the tests below skip themselves */ }

const ROOT = 'app/mobile';
const walk = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : walk(p);
  return ['.js', '.jsx'].includes(extname(f)) ? [p] : [];
});
const sources = walk(ROOT).filter(f => !f.endsWith('.generated.js') && !f.includes('profiles.js'));

test('every app source parses as valid JSX and ES modules', { skip: !parse }, () => {
  assert.ok(sources.length >= 10, `expected the app tree, found ${sources.length} files`);
  for (const file of sources) {
    const code = readFileSync(file, 'utf8');
    const isCommonJS = /^module\.exports|^const .* = require\(/m.test(code);
    try {
      parse(code, {
        sourceType: isCommonJS ? 'script' : 'module',
        plugins: isCommonJS ? [] : ['jsx'],
      });
    } catch (e) {
      assert.fail(`${file}:${e.loc?.line ?? '?'} — ${e.message}`);
    }
  }
});

test('every relative import points at a file that exists', { skip: !parse }, () => {
  const tryResolve = (from, spec) => {
    const base = resolve(dirname(from), spec);
    for (const c of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, join(base, 'index.js')]) {
      if (existsSync(c) && statSync(c).isFile()) return true;
    }
    return false;
  };
  for (const file of sources) {
    const ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    for (const node of ast.program.body) {
      const spec = node.source?.value;
      if (!spec?.startsWith('.')) continue;
      assert.ok(tryResolve(file, spec), `${file} imports "${spec}", which does not exist`);
    }
  }
});

test('no screen reaches past the engines into Node-only territory', { skip: !parse }, () => {
  for (const file of sources) {
    if (file.endsWith('metro.config.js') || file.endsWith('babel.config.js')) continue;
    const code = readFileSync(file, 'utf8');
    assert.equal(/require\('node:|from 'node:|process\.exit/.test(code), false,
      `${file} uses Node-only APIs that will not exist on a phone`);
  }
});

test('bundled content is in step with the packs it was generated from', async () => {
  const { PACKS, MANIFEST } = await import('./data/packs.generated.js');
  const onDisk = readdirSync('content')
    .map(c => JSON.parse(readFileSync(`content/${c}/pack.json`, 'utf8')));
  assert.equal(PACKS.length, onDisk.length, 'run: node build/bundle-packs.mjs');
  for (const pack of onDisk) {
    const bundled = PACKS.find(p => p.meta.countryCode === pack.meta.countryCode);
    assert.ok(bundled, `${pack.meta.country} is missing from the bundle`);
    assert.equal(bundled.meta.version, pack.meta.version,
      `${pack.meta.country} bundle is stale — run node build/bundle-packs.mjs`);
    assert.equal(bundled.pathways.length, pack.pathways.length);
  }
  assert.equal(MANIFEST.length, onDisk.length);
});

test('bundled profiles match the shared examples', async () => {
  const profiles = (await import('./data/profiles.js')).default;
  const onDisk = readdirSync('app/profiles').filter(f => f.endsWith('.json'));
  assert.equal(profiles.length, onDisk.length, 'run: node build/bundle-packs.mjs');
  assert.ok(profiles.every(p => p.label), 'every profile needs a label for the picker');
});

test('the app declares every runtime dependency it imports', () => {
  const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8'));
  const declared = new Set(Object.keys(pkg.dependencies));
  const bare = new Set();
  for (const file of sources) {
    for (const m of readFileSync(file, 'utf8').matchAll(/from '([^.'][^']*)'/g)) {
      const name = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
      bare.add(name);
    }
  }
  for (const name of bare) {
    assert.ok(declared.has(name), `"${name}" is imported but not in package.json dependencies`);
  }
});

/* ------------------------------------- the bundled engines are the same engines */

test('bundled engines carry no Node-only code onto the device', () => {
  for (const f of ['plan', 'match', 'compare']) {
    const src = readFileSync(`${ROOT}/src/engine/${f}.generated.mjs`, 'utf8');
    assert.equal(/node:fs|readFileSync|process\./.test(src), false,
      `${f}.generated.mjs would crash on a phone`);
  }
});

test('the bundled plan engine is byte-identical to its source', () => {
  const bundled = readFileSync(`${ROOT}/src/engine/plan.generated.mjs`, 'utf8');
  const source = readFileSync('app/engine/plan.mjs', 'utf8');
  const withoutBanner = bundled.slice(bundled.indexOf('\n\n') + 2);
  assert.equal(withoutBanner, source, 'run: node build/bundle-app.mjs');
});

test('the bundled match engine inlines exactly the schema fields, and nothing else changed', () => {
  const bundled = readFileSync(`${ROOT}/src/engine/match.generated.mjs`, 'utf8');
  const fields = Object.keys(
    JSON.parse(readFileSync('schema/profile.schema.json', 'utf8')).properties);
  for (const f of fields) assert.ok(bundled.includes(`"${f}"`), `${f} missing from the bundle`);

  // Everything after the PROFILE_FIELDS line must match the source verbatim.
  const source = readFileSync('app/engine/match.mjs', 'utf8');
  const tail = s => s.slice(s.indexOf('const OPS = {'));
  assert.equal(tail(bundled), tail(source), 'run: node build/bundle-app.mjs');
});

test('the bundled engines behave identically to the tested ones', async () => {
  const [bundledCompare, sourceCompare, profiles] = await Promise.all([
    import(`../../../${ROOT}/src/engine/compare.generated.mjs`),
    import('../../engine/compare.mjs'),
    import('./data/profiles.js'),
  ]);
  const { PACKS } = await import('./data/packs.generated.js');
  const onDisk = readdirSync('content')
    .map(c => JSON.parse(readFileSync(`content/${c}/pack.json`, 'utf8')));

  for (const profile of profiles.default) {
    const a = bundledCompare.compareCountries(PACKS, profile);
    const b = sourceCompare.compareCountries(onDisk, profile);
    assert.equal(a.verdict.recommended, b.verdict.recommended, `${profile.label}: verdict differs`);
    assert.deepEqual(
      a.countries.map(c => [c.code, c.open.map(p => p.pathwayId)]),
      b.countries.map(c => [c.code, c.open.map(p => p.pathwayId)]),
      `${profile.label}: open pathways differ`);
  }
});

test('package.json targets an Expo SDK that Expo Go can actually open', () => {
  const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8'));
  const sdk = Number(pkg.dependencies.expo.replace(/[^0-9.]/g, '').split('.')[0]);
  // Expo Go on the App Store ships only the current SDK. Falling far behind is
  // not a cosmetic problem — the app simply will not launch on a phone.
  assert.ok(sdk >= 57, `expo ~${sdk} is too old for current Expo Go; bump the SDK`);
  assert.equal(pkg.main, 'index.js', 'SDK 52+ expects an explicit entry point');
});
