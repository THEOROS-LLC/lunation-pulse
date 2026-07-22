#!/usr/bin/env bash
# indexnow.sh — instant Bing/AI-surface indexing via the free IndexNow protocol.
# Bing powers ~87% of ChatGPT citations; this turns days-weeks into hours.
# Usage:  INDEXNOW_KEY=yourkey bash scripts/indexnow.sh [site]
# Key: any 8-128 char hex/alnum string you invent once; keep it in the host env.
set -euo pipefail
SITE="${1:-https://lunarpulse.ai}"
KEY="${INDEXNOW_KEY:?set INDEXNOW_KEY (any 8-128 char key you invent; keep it stable)}"
HOST=$(echo "$SITE" | sed 's|https\?://||; s|/.*||')
# the protocol requires the key served at the site root — write it into dist/
echo "$KEY" > "dist/${KEY}.txt"
# collect URLs from the built sitemap(s)
URLS=$(grep -ohE '<loc>[^<]+</loc>' dist/sitemap*.xml | sed 's|</\?loc>||g' | grep -v '\.xml$' | sort -u)
[ -n "$URLS" ] || { echo "no urls found in dist/sitemap*.xml — build first"; exit 1; }
LIST=$(echo "$URLS" | sed 's/^/    "/; s/$/",/' | sed '$ s/,$//')
PAYLOAD=$(printf '{\n  "host": "%s",\n  "key": "%s",\n  "keyLocation": "%s/%s.txt",\n  "urlList": [\n%s\n  ]\n}' "$HOST" "$KEY" "$SITE" "$KEY" "$LIST")
CODE=$(curl -s -o /tmp/indexnow_resp -w '%{http_code}' -X POST 'https://api.indexnow.org/indexnow' \
  -H 'content-type: application/json; charset=utf-8' -d "$PAYLOAD")
echo "IndexNow -> HTTP $CODE ($(echo "$URLS" | wc -l) urls)"
[ "$CODE" = 200 ] || [ "$CODE" = 202 ] || { cat /tmp/indexnow_resp; exit 1; }
