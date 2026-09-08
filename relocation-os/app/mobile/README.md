# Relocation OS — mobile shell

Expo / React Native. The guide is read once before the move; this is opened for two years during it.

```bash
cd app/mobile
npm install
npm start          # then i / a / w for iOS, Android, web
```

Content is bundled, so it works with no network from first launch:

```bash
node build/bundle-packs.mjs    # content/*/pack.json -> src/data/packs.generated.js
```

## What is verified, and what is not

**Verified here, in Node, with no simulator:**

```bash
node --test app/mobile/src/app.test.mjs      # 21 tests — plan state, notification wording
node --test app/mobile/src/syntax.test.mjs   #  6 tests — JSX parses, imports resolve, bundle fresh
```

- Every reducer path, including hydrating state written by an older build.
- Every notification's date, category, priority and copy, across all 24 pathways of all three packs.
- That every source file parses as valid JSX, every relative import resolves, no screen reaches for a Node API that will not exist on a phone, and every bare import is declared in `package.json`.
- That the bundled content matches `content/*/pack.json` — a stale bundle fails the test.

**Not verified:** the rendered UI. There is no simulator in this environment, so layout, navigation and gestures have never been run. Treat the screens as a reviewed first draft; the logic beneath them is tested.

## Architecture

```
App.jsx                      navigation: five tabs, plus setup as a modal
src/PlanContext.jsx          load, persist, and rebuild the plan on every change
src/state/store.js           pure reducer — the only place plan state changes
src/notifications/schedule.js  plan -> dated notification requests (pure, tested)
src/notifications/register.js  hands those to Expo (the only OS-facing file)
src/screens/                 Today, Plan, Documents, Compare, Guide, Setup
src/data/packs.generated.js  bundled content — generated, never edited
```

The engines are imported directly from `../engine` rather than copied; `metro.config.js` watches above the project root so Metro can resolve them. One tested engine, not a fork.

## Decisions worth knowing

**A plan pins its pack version.** When a newer pack ships, the app surfaces it as something to review and accept — it never re-times someone's schedule underneath them mid-move. `pendingPackUpdate()` detects it; only `PACK_UPDATE_ACCEPTED` moves the pin.

**Only critical tasks notify.** A phone that buzzes for all 59 tasks is a phone with notifications switched off. Everything else lives on the Today screen. Notifications fire at 9am local, and iOS caps pending local notifications at 64, so the app schedules the soonest 60 and re-syncs on every launch.

**"Do not order yet" is a first-class screen section**, not a warning buried in a detail view. It is the feature that justifies keeping the app installed:

> **Order between 2026-10-11 and 2027-03-16**
> Valid 180 days · needed 2027-04-02 for your employer files the work permit dossier

**Documents track dates, not files.** Passport scans and criminal record checks are sensitive enough that encrypted storage and easy deletion are a deliberate later step rather than a quick one. Recording an issue date is what powers the expiry warnings, and that is the part with the value.

**No chat feature, deliberately.** The moment the app answers "what should I do in my situation" in free text, it is giving immigration advice. That is a different business with a different licence — see `business/LAUNCHING-WITHOUT-AN-ADVISER.md`.

## Next

- Encrypted document storage (expo-secure-store for keys, expo-file-system for files).
- Accounts and sync, so a plan survives a lost phone. The state object is already serialisable and flat.
- Household plans — different family members hold different documents, and today that is coordinated over text message and fails constantly.
