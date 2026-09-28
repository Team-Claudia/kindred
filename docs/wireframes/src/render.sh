#!/usr/bin/env bash
# Renders each screen in wireframes.html to docs/wireframes/NN-<id>.png with headless Chrome.
# Usage: docs/wireframes/src/render.sh            (all screens)
#        docs/wireframes/src/render.sh home       (one screen, by id)
# Needs Google Chrome and an internet connection (for the Google Fonts).
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$(dirname "$SRC")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

# Order sets the file number. Keep in step with README.md.
SCREENS=(
  welcome sign-in-email enter-code setup-your-name setup-loved-one setup-invite-circle
  home this-week updates weekly-summary
  quick-add new-task new-appointment new-update
  assign-to task-awaiting-you task-detail task-overdue notifications
  care-circle-settings
)

n=0
for id in "${SCREENS[@]}"; do
  n=$((n + 1))
  [[ $# -gt 0 && "$1" != "$id" ]] && continue
  h=$(grep -o "id=\"$id\" data-h=\"[0-9]*\"" "$SRC/wireframes.html" | grep -o '[0-9]*"$' | tr -d '"')
  file="$OUT/$(printf '%02d' "$n")-$id.png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1.5 \
    --window-size="390,$h" --virtual-time-budget=5000 \
    --screenshot="$file" "file://$SRC/wireframes.html#$id" 2>/dev/null
  echo "$file"
done
