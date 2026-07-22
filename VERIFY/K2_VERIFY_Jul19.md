# K2 EPHEMERIS VERIFICATION — astronomy-engine vs Swiss Ephemeris
**Date:** 2026-07-19 · **Project:** lunarpulse.ai cclc (CIRCUMAMBULATION Gate 1)
**Custody:** Timothy elects NAS path · suggested alongside eval runs

## Method
- Candidate: astronomy-engine **v2.1.19** (npm), of-date calls: `SunPosition`, `EclipticGeoMoon`, `MoonPhase`
- Reference: Swiss Ephemeris **2.10.03** via pyswisseph, `FLG_MOSEPH`, apparent longitudes, true equinox of date
- Sweep: 745 hourly samples, 2026-08-01 00:00 → 2026-09-01 00:00 UTC
- Plus one cross-check at the mockup instant: 2026-07-16 22:43 UTC (6:43 PM EDT)

## Results
| Metric | Value | Gate | Verdict |
|---|---|---|---|
| max \|ΔSun\| over sweep | **0.016′** (~1″) | ≤3′ | PASS |
| max \|ΔMoon\| over sweep | **0.069′** (~4″) | ≤3′ | PASS |
| Moon cusp-timing bound | **~6 seconds** of clock time | ≤5 min | PASS |

## Mockup-instant three-way check (Jul 16 2026, 6:43 PM EDT)
| Body | astronomy-engine | Swiss | Mockup (Photoshop proto) |
|---|---|---|---|
| Sun | 24°24.7′ Cancer | 24°24.7′ Cancer | 24° ♋ 25′ ✓ |
| Moon | 29°10.5′ Leo | 29°10.5′ Leo | 29° ♌ 11′ ✓ |
| Phase | Waxing Crescent (elong 34.76°) | — | Waxing Crescent ✓ |

Three independent sources agree to the arcminute.

## Decision
K2 (astronomy-engine 2.1.19) **elected and gate-passed** as the swappable backend
behind the house-authored `lunation.js` wrapper. Vendored into the repo, version-pinned,
no runtime CDN. Of-date functions confirmed correct (J2000 error mode ruled out —
would have shown ~22′ systematic offset; observed max 0.069′).

Backend remains swappable to the house kernel at any time via the `lunation.js` seam.
