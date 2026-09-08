#!/bin/sh
# Everything, in the order that fails fastest. Run before shipping anything.
set -e
cd "$(dirname "$0")/.."

for c in content/*/; do node build/validate.mjs "$c/pack.json"; done
node build/watch.mjs

for t in app/engine/plan.test.mjs app/engine/compare.test.mjs \
         app/mobile/src/app.test.mjs app/mobile/src/syntax.test.mjs; do
  printf '%-38s' "$t"
  node --test "$t" 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' '
  echo
done

for c in content/*/; do
  name=$(basename "$c")
  node build/render.mjs "$c/pack.json" "dist/$name-relocation-guide.html"
done
node build/render-compare.mjs dist/southeast-asia-comparison.html
node build/bundle-app.mjs
