#!/usr/bin/env bash
# regen-all.sh — Regenerate all pages in manifest.json
#
# Usage:
#   ./regen-all.sh              # regenerate all (batches of 5)
#   ./regen-all.sh --no-push    # regenerate without pushing
#
# Reads repos/manifest.json and regenerates every entry in batches
# of 5 (the MAX_REPOS limit per run).

set -euo pipefail
cd "$(dirname "$0")"

EXTRA_FLAGS="${*}"

if [ ! -f repos/manifest.json ]; then
  echo "❌ No repos/manifest.json found. Nothing to regenerate."
  exit 1
fi

# Extract all fullName entries
REPOS=$(node -e "
  const m = require('./repos/manifest.json');
  m.generated.forEach(e => console.log(e.fullName));
")

if [ -z "$REPOS" ]; then
  echo "❌ No repos found in manifest."
  exit 1
fi

TOTAL=$(echo "$REPOS" | wc -l | tr -d ' ')
echo "🔄 Regenerating $TOTAL repos in batches of 5…"
echo ""

BATCH=()
BATCH_NUM=1

while IFS= read -r repo; do
  BATCH+=("$repo")
  if [ ${#BATCH[@]} -eq 5 ]; then
    echo "━━━ Batch $BATCH_NUM: ${BATCH[*]} ━━━"
    node generate.js ${EXTRA_FLAGS} "${BATCH[@]}"
    echo ""
    BATCH=()
    BATCH_NUM=$((BATCH_NUM + 1))
  fi
done <<< "$REPOS"

# Remaining repos
if [ ${#BATCH[@]} -gt 0 ]; then
  echo "━━━ Batch $BATCH_NUM: ${BATCH[*]} ━━━"
  node generate.js ${EXTRA_FLAGS} "${BATCH[@]}"
fi

echo ""
echo "✅ All $TOTAL repos regenerated!"
