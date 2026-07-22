# Lunar Pulse — lunarpulse.ai — v0.4

The Central Circle Lunation Clock. First gate of CIRCUMAMBULATION.
Disclosure dial: **open** (astrological vocabulary permitted in shipped code).

## Run

```bash
npm ci          # exact tree from package-lock (integrity-checked)
npm run dev     # http://localhost:4321
npm run build   # static output -> dist/
```

Node 20+. No runtime backend — every computation happens in the visitor's
browser. `dist/` is pure static files; deploy anywhere. **Deploying is a
gated human action** — nothing in this repo publishes anything.

## Pins (verify > assert)

| component | version | proof |
|---|---|---|
| astro | 7.1.1 (exact) | package-lock |
| astronomy-engine | 2.1.19 (exact) | `sha512-8yWKNf7UeNbH458h3sAJ6ZgAjE5jTXp/mNNRFoC20j2SHwZIjAQeEsBB2Q3uCFRaTCCJRv33K2XhkhZQMXoX6w==` |
| ephemeris accuracy | max Δ 0.069′ vs Swiss 2.10.03 | `VERIFY/K2_VERIFY_Jul19.md` |
| mockup instant | Sun 24°25′ ♋ · Moon 29°11′ ♌ | three-way match (mockup, engine, Swiss) |

`src/cclc/lunation.js` is the seam: the only file that touches
astronomy-engine. Swap to the house kernel behind it at any time.
It must keep using equinox-of-date calls (`SunPosition`, `EclipticGeoMoon`) —
J2000 calls would sit ~22′ off the tropical zodiac.

## Geometry law

One transform governs everything: **screen angle = (180° + λ) mod 360, CCW.**
0° Aries at left · 0° Cancer at bottom · 0° Libra at right · 0° Capricorn at
top. The Sun stands at the top of the wheel on the winter solstice.

## Structure

```
src/cclc/lunation.js   ephemeris wrapper (THE reusable spine component)
src/cclc/cclc.js       the clock: SVG build, intro, tick, phase terminator
src/cclc/palette.js    12 hexes sampled programmatically from the mockup
src/cclc/glyphs.js     authored stroke paths (fonts would emoji-fail on iOS)
src/components/Cclc.astro   persisted mount (transition:persist="cclc")
src/layouts/Base.astro      ClientRouter + persisted starfield canvas
src/pages/index.astro       clock + build-time snapshot + JSON-LD
src/pages/circle.astro      The Clairsentient Support Circle (the knight)
src/circle/record.js        record client: orbit render, cards, composer
server.js                   the record backend (serves dist + /api)
audit_record.mjs            runnable anonymity audit
record_pull.sh              SUTRA pull (LAN reaches out; nothing reaches in)
```

## Behavior contracts

- **State = f(system clock).** Nothing stored, nothing to drift. Self-correcting
  1 Hz tick aligned to the second boundary; resync on tab return.
- **Persistence:** the clock div and starfield canvas are `transition:persist` —
  the same DOM nodes move across navigations. Proof: the mount stamp shown on
  /circle/ never changes while you browse.
- **Intro (≤4.0s):** circle draws itself CCW from the Aries point → axes →
  cross duplicates twice CCW → wedges stretch outward Aries→Pisces → bull's-eye
  arrives dark, then the terminator sweeps new-moon→now. Replays only after
  >12h away (`localStorage cclc.introAt`, rolling). Reduced-motion: instant.
- **Rest:** all animation pauses when the tab is hidden.
- **Arcminute readout** is the honest precision floor (verified error ≈ 7% of
  one displayed unit). The Moon crosses 1′ every ~109 s — the sky's second hand.

## Review gates (v0.1 → v0.2)

1. **Accuracy** — PASSED (0.069′ max vs Swiss, 745 samples; VERIFY/).
2. **Performance** — mid-range phone: zero dropped frames, near-idle CPU at
   steady state. If fail: freeze grain textures static, halve starfield count.
3. **Intro** — completes ≤ 4.0 s; feels drawn, not loaded.

Miss two of three → re-pitch the rendering stack before v0.2.

## Queued (post-review, in order)

- Glyph refinement pass (current paths are v0.1 stylizations).
- Knights of the round table: hover → center swap (`api.setCenter` already live).
- Licensed manuscript display face to replace the system serif stack.
- Daily rebuild+deploy so the crawlable snapshot stays current (gated).

Custody: `/mnt/THEOROS-H-SUTRA/projects/lunation_pulse`

## The Record — The Clairsentient Support Circle

The first knight of the round table. `/circle/` is a member forum that orbits
the clock: every charge (a dream, a day, an emotion) is pinned to the wheel at
the Moon's longitude **at the moment the server received it** — computed by the
same pinned `lunation.js`, so client clocks cannot spoof the record. Over a
month, the posts complete a circuit of the zodiac.

### The anonymity contract

What is remembered, in full: `id · created_utc · charge · body · link ·
sun_lon · moon_lon · elong · moon_sign · moon_deg · moon_arcmin · phase`.
There is no users table. No IP, cookie, account, or header is written to disk.
Rate limiting lives in process RAM and dies with the process.
Prove it any time: `node audit_record.mjs record.db`

### Membership & admin

- One shared **circle word** proves *is a member*, never *which member*.
  Stored as scrypt hash; distribute via the Circle's channel; rotate at the
  New Moon if the ritual pleases.
- Admin = you, total capability, via `ADMIN_KEY`:
  - delete: visit `/circle/#admin`, enter the key once → remove buttons appear
  - rotate the word:
    `curl -X POST https://HOST/api/admin/rotate -H 'content-type: application/json' -d '{"key":"KEY","word":"NEWWORD"}'`
  - export the corpus: `curl -H 'x-admin-key: KEY' https://HOST/api/admin/export`
- Reads are member-gated (`PUBLIC_READ=false`). Flip the env to open a window.

### Deploy (professional host, Node 20+)

```bash
npm ci && npm run build
ADMIN_KEY='long-random-secret' PORT=8787 node server.js
# put your host's HTTPS proxy in front of :8787; keep the process alive
# (pm2 / systemd / Passenger). SQLite lives at ./record.db — back it up.
# First act: rotate in the inaugural circle word (curl above).
```

### Custody sync (HARD LAW 1)

`bash record_pull.sh https://lunarpulse.ai "$ADMIN_KEY" DEST_DIR` — run from
your side of the drawbridge on your schedule. Timestamped JSONL + sha256 +
`record_latest.jsonl` symlink. The Larder grows; the LAN stays sealed.

### v1 boundaries (start simple, built to expand)

Text + link only (images mean EXIF-stripping and scanning obligations — v1.1
with eyes open). Latest 200 on the orbit; full record always in export. The
`charge` field and schema leave room for new kinds without migration.

## Discovery layer (v0.4 — research-verified 2026-07-20)

Full brief with sources: `RESEARCH/RESEARCH_STACK_SEO_Jul20.md`. The short form:
stack confirmed frontier (Astro 7 shipped 2026-06-22; we run 7.1.1); the
Bing/IndexNow → ChatGPT pipeline confirmed as the fast lever (87%+ of ChatGPT
citations resolve through Bing); JS-only content gets cited at ~23%, which is
why the build-time sky paragraph exists and refreshes on every build.

**The effortless loop** (set once, runs forever):
```bash
# host cron — daily rebuild refreshes the sky text + pings IndexNow:
17 9 * * *  cd /path/to/lunation_pulse && INDEXNOW_KEY=yourkey bash scripts/deploy.sh
```
Invent the IndexNow key once (8–128 chars, keep it stable); the script writes
`dist/KEY.txt` and pings api.indexnow.org with every page. Uncomment the rsync
line in `scripts/deploy.sh` to point at the docroot.

**One-time human steps (gated, ~10 min):** verify the domain in Bing Webmaster
Tools (bing.com/webmasters — GSC import is one click) and submit
`https://lunarpulse.ai/sitemap-index.xml`. That is the entire entry fee.

Shipped: sitemap integration · robots.txt with explicit allows for
OAI-SearchBot, GPTBot, ClaudeBot, Claude-SearchBot, Claude-User,
PerplexityBot, Google-Extended · llms.txt (cheap, expectations calibrated by
data) · canonical + Open Graph · @graph JSON-LD with dateModified · 404.
Declined on evidence: llms-full mirrors, FAQ-schema decoration (rich results
retired 2026-05-07), any indexing SaaS.
