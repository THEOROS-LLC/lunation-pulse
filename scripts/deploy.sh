#!/usr/bin/env bash
# deploy.sh — the effortless loop: rebuild (fresh sky snapshot) -> upload -> ping.
# Put in the host's cron daily and the site refreshes + re-indexes itself forever:
#   17 9 * * *  cd /path/to/lunation_pulse && INDEXNOW_KEY=... bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
# ---- your upload hook (uncomment + point at the host's docroot or rsync target)
# rsync -az --delete dist/ user@host:/path/to/docroot/
if [ -n "${INDEXNOW_KEY:-}" ]; then bash scripts/indexnow.sh "${SITE:-https://lunarpulse.ai}"; fi
echo "deployed: $(date -u +%FT%TZ)"
