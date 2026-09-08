# Testing on a Mac and an iPhone

Two things to try: the **web guides** (which are finished and can be sold as they are) and the **mobile app** (a shell whose UI has never been run — see the honesty note at the end).

## 0. Get the code

```bash
git clone https://github.com/Haigray/learningsql-2875059.git
cd learningsql-2875059
git checkout claude/vietnam-relocation-guide-2ww6f7
cd relocation-os
```

You need **Node 20 or newer**:

```bash
node --version          # if this fails or is below v20:
brew install node       # or download from nodejs.org
```

Nothing else is required for the web version — no install, no build step.

---

## 1. The web version

### On the MacBook — immediately

The built files are committed, so just open them:

```bash
open dist/southeast-asia-comparison.html
open dist/thailand-relocation-guide.html
```

Worth trying in the comparison: pick the **"Remote software engineer"** preset, then change earned income from `70000` to `80000`. Thailand goes from zero open routes to the LTR — that swing is the product's core argument.

In the guides: run the decision tree to a dead end (in Thailand, choose *"I want permanent residency or citizenship"*). The honest no-answer is deliberately as prominent as the yes-answers.

### On the iPhone — over WiFi

```bash
node build/serve.mjs
```

It prints two addresses. Open the second one on the iPhone — both devices on the same WiFi, and turn any VPN off:

```
  On this machine   http://localhost:8080
  On your phone     http://192.168.1.42:8080
```

Everything runs in the browser, so the checklists, the decision tree and the live comparison all work with the laptop's terminal open. `Ctrl-C` stops it.

**Check on the phone specifically:** tables scroll sideways rather than breaking the page, the decision tree buttons are comfortably tappable, and dark mode looks right (Settings → Display & Brightness → Dark).

### Rebuilding after a content change

```bash
sh build/check.sh      # validate, test, re-render everything
```

---

## 2. The mobile app

Expo Go runs it without Xcode or a developer account.

### One-time setup

1. Install **Expo Go** from the App Store on the iPhone.
2. On the Mac:

```bash
cd app/mobile
npm install            # a few minutes the first time
```

### Run it

```bash
npx expo start
```

A QR code appears. **Point the iPhone's Camera app at it** and tap the banner — it opens in Expo Go. Same WiFi, VPN off.

If the phone cannot reach the Mac (corporate WiFi, or client isolation on a guest network):

```bash
npx expo start --tunnel     # slower, but routes around the network
```

To check layout quickly without the phone:

```bash
npx expo start --web        # opens the app in a desktop browser
```

### What to actually look at

| Screen | What matters |
|---|---|
| **Setup** | The decision tree, same content as the printed guide. Reaching a dead end should feel like a real answer, not a failure. |
| **Today** | The **"Do not order yet"** section. Pick Vietnam → work permit route, move date about nine months out. |
| **Plan** | 59 tasks grouped into eight phases. Check the phase headers stay legible while scrolling. |
| **Documents** | Tap *"I already have this"* on the criminal record check and enter an old date such as `2026-05-01`. It should immediately turn red and tell you it expires before it is needed. |
| **Compare** | The five profile chips, and whether the unlock cards read clearly on a narrow screen. |
| **Guide** | Five tabs of the pack's own content, offline. |

### Known limitations, so you can tell a bug from a design decision

- **The UI has never been run.** There is no simulator in the environment this was built in. Expect layout problems — spacing, text truncation, tab bar overlap on a notched screen. The logic underneath is tested; the pixels are not.
- **Notifications may not fire in Expo Go.** Expo has been progressively moving notification features to development builds. The scheduling logic is covered by tests independently of the OS, so if nothing arrives, that is Expo Go rather than the code. To test them properly you would need `npx expo run:ios` with Xcode installed, or an EAS development build.
- **No accounts or sync.** State lives on the device via AsyncStorage. Deleting Expo Go deletes your plan.
- **Documents record dates, not files.** Deliberate — see `app/mobile/README.md`.

### If something goes wrong

| Symptom | Cause and fix |
|---|---|
| *"Project is incompatible with this version of Expo Go"* | The SDK pin has fallen behind the App Store build. Run `npx expo install expo@latest --fix`, then `npx expo start --clear`. |
| QR scans but never connects | Not on the same WiFi, or the network blocks device-to-device traffic. Use `npx expo start --tunnel`. |
| Red screen mentioning a module | `rm -rf node_modules && npm install`, then `npx expo start --clear`. |
| Content looks stale or wrong | `node ../../build/bundle-app.mjs` from `app/mobile`, then restart with `--clear`. |
| Anything version-shaped | `npx expo-doctor` reports mismatches between your installed packages and the SDK. |

---

## 3. Running the tests

None of these need a phone:

```bash
sh build/check.sh                              # everything: 75 tests + full rebuild
node --test app/engine/plan.test.mjs           # scheduling and shelf-life logic
node --test app/mobile/src/app.test.mjs        # plan state and notification wording
node app/engine/compare-cli.mjs --profile app/profiles/retiree.json --facts
```

## What is worth your attention first

The web comparison is the piece closest to being sellable, and it is the one that answers the question people actually search. Try it on the phone before the app — that is where a real buyer would meet it.
