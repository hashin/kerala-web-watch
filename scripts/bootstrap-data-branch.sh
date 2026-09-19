#!/usr/bin/env bash
# Creates the orphan `data` branch (ADR-003) if it does not exist. Idempotent. Run from the repo root.
set -euo pipefail
origin=$(git remote get-url origin)
if git ls-remote --exit-code --heads origin data >/dev/null 2>&1; then echo "data branch exists"; exit 0; fi
tmp=$(mktemp -d)
pushd "$tmp" >/dev/null
git init -q -b data
mkdir -p results screenshots
echo '{"generated":null,"vantages":[],"totals":{},"coverage":{"deep_audited":0,"total":0,"eta":null},"sites":[]}' > summary.json
echo '{}' > outlinks.json
touch results/.gitkeep screenshots/.gitkeep
git add -A
git -c user.name="kerala-web-watch[bot]" -c user.email="kerala-web-watch[bot]@users.noreply.github.com" commit -qm "data: init"
git push "$origin" data
popd >/dev/null
rm -rf "$tmp"
echo "data branch created"
