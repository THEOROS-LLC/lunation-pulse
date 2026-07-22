#!/usr/bin/env bash
# record_pull.sh — pull the Circle record from the public host into local custody.
# Pull-only: the LAN reaches out; nothing ever reaches in. (HARD LAW 1 intact.)
# Usage:  bash record_pull.sh https://lunarpulse.ai "$ADMIN_KEY" /your/elected/dest
set -euo pipefail
BASE="${1:?usage: record_pull.sh BASE_URL ADMIN_KEY DEST_DIR}"
KEY="${2:?admin key required}"
DEST="${3:?destination directory required — you elect the path}"
mkdir -p "$DEST"
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$DEST/record_${TS}.jsonl"
curl -fsS -H "x-admin-key: $KEY" "$BASE/api/admin/export" -o "$OUT"
N=$(wc -l < "$OUT")
ln -sfn "$OUT" "$DEST/record_latest.jsonl"
echo "pulled $N charges -> $OUT"
echo "sha256: $(sha256sum "$OUT" | cut -d' ' -f1)"
