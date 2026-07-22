# RESEARCH — Stack Audit + Discovery Frontier
**2026-07-20 · verified by live web research this session · custody: repo `RESEARCH/`**

## I. STACK VERDICT: we are on the frontier

| Layer | Ours | Frontier status |
|---|---|---|
| Framework | **Astro 7.1.1** | Astro 7.0 shipped **June 22, 2026** (Rust compiler, Vite 8 + Rolldown bundler, 15–61% faster builds, Sätteri markdown pipeline). We are on the newest line, four weeks after release. Astro was acquired by Cloudflare Jan 2026; direction is edge-native. Node 22.12+ required — we run 22.22. |
| Rendering | Zero-JS-default islands, server-rendered HTML, client clock on top | **Exactly what citation data rewards**: JS-rendered content gets cited at only **23%** (Erlin 2026). Our pages are static HTML; the live clock is enhancement, not payload. |
| Interop | Vanilla SVG + WAAPI, no UI framework | Optimal. Nothing to remove. |
| Backend | Node 22 + better-sqlite3, one process | Boring-correct at this scale. Astro 7's stable route-caching/Advanced Routing (`src/fetch.ts`) could absorb the static-serving half later — noted, not needed. |
| Ephemeris | astronomy-engine 2.1.19, 0.069′ vs Swiss | No web-deployable alternative is more accurate. |

**Verdict: no rebuild warranted anywhere.** The stack is younger than most of the articles reviewing it.

## II. DISCOVERY FRONTIER — what changed since the doctrine was written

1. **Bing/IndexNow → ChatGPT: still THE lever, now sharper.** Bing powers **87%+ of ChatGPT citations**; ~73% result overlap. IndexNow cuts indexing from days-weeks to **hours** (multiple 2026 sources). New nuance: ChatGPT **cites only ~15% of pages it retrieves** (AirOps, Mar 2026, 548k pages) — retrieval gets you in the pool; *extractable structure* wins the cut. AI-referred visitors convert at **7.1%**, second only to paid search (Similarweb Apr–May 2026). Adobe: AI-referred traffic **+393% YoY** Q1 2026. Doctrine confirmed and strengthened.

2. **The one-line entry fee:** `robots.txt` must explicitly allow **OAI-SearchBot** (ChatGPT search), plus GPTBot, PerplexityBot, and Anthropic's trio — **ClaudeBot** (training), **Claude-SearchBot** (Claude search index), **Claude-User** (live fetch). Anthropic docs updated Feb 20, 2026: blocking Claude-SearchBot reduces visibility in Claude answers.

3. **llms.txt: verdict rendered.** ~10% domain adoption (SE Ranking, 300k domains); crawler requests to it **statistically negligible** across 515M logged AI-bot events (Limy); Google on record refusing it; no major LLM provider committed. **Ship the 5-minute static file, expect nothing** — the doctrine's "cheap, low-impact" is now measured fact. Do NOT build markdown mirrors of pages (duplicate-content risk).

4. **Schema after Google's March 2026 core update:** FAQ rich results **retired May 7, 2026**; abused FAQ/HowTo/Review markup demoted. But clean **entity schema became a trust signal in AI Mode** — sites with accurate entity graphs saw improved citation rates. 2026 practice: single JSON-LD `@graph` block (WebSite + Organization + type-of-page), fill the optional fields (**dateModified**, description, sameAs), never decorate. Ahrefs 2026: schema *alone* lifts nothing — extractable content does; schema amplifies.

5. **Princeton GEO levers still canon:** statistics + citations + quotable structure ≈ **+30–40% citation rate**, and *front-loaded answers* in the first 40–60 words. Our arcminute readouts ARE statistics — the site's native language is the winning format.

## III. IMPLEMENTED THIS SESSION (v0.4)

1. `@astrojs/sitemap` — auto-generated on every build (Bing requires it; GSC submissions don't transfer to Bing).
2. **IndexNow automation** — `scripts/indexnow.sh`: writes the key file into `dist/`, pings `api.indexnow.org` with every sitemap URL. Zero SaaS, zero subscription — the protocol is free.
3. **`scripts/deploy.sh`** — build → (your upload hook) → IndexNow ping. One command; put it in the host's cron **daily** and the build-time sky snapshot self-refreshes → freshness signal + instant re-index, forever, unattended. *This is the automation layer.*
4. `robots.txt` — explicit allows for OAI-SearchBot, GPTBot, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Google-Extended, Bingbot + `Sitemap:` line.
5. `llms.txt` — minimal, honest, forgotten.
6. JSON-LD upgraded to `@graph` (WebSite + Organization + WebApplication) with `dateModified` = build moment.
7. `<head>` hygiene: canonical URL, Open Graph, theme-color.
8. Crawlable sky block on index — the front-loaded, statistic-dense sentence the Princeton levers reward, refreshed by every cron build.
9. `404.astro` — crawl hygiene.

## IV. DECLINED (resource discipline)

AI-visibility SaaS subscriptions (measure with Bing Webmaster Tools + logs first) · llms-full page mirrors · FAQ-schema decoration (retired) · any Google Indexing API paid service. Open item, Timothy's election: analytics (GA4 AI-traffic channel per doctrine) — not installed; zero tracking currently ships, which is also a stance.

## V. BENCHMARK THAT CHANGES THIS PLAN

Day-45 after deploy (standing doctrine): ≥1 logged AI citation (ChatGPT/Perplexity/Claude naming lunarpulse.ai) or 100+ weekly Bing impressions trending up. Miss both → the site content layer (not the stack) is the suspect: add the daily lunation page with per-day URLs before touching anything else.

### Sources (fetched 2026-07-20)
astro.build/blog/astro-7 · erlin.ai chatgpt-search-optimization · pressonify.ai chatgpt-cited-2026 · stackmatix.com bing-webmaster-chatgpt · limy.ai llms-txt-2026 · linkbuildinghq llms-txt (SE Ranking 300k study) · elementera.com llms-txt-guide (Anthropic crawler docs, Yext 6.8M citations, Adobe Q2-2026) · digitalapplied.com schema-march-2026 · vyncedigital schema-2026 (FAQ retirement, Ahrefs) · oltre.ai indexnow-geo
