// cclc.js — the Central Circle Lunation Clock.
// Framework-free. Mounts into any container; idempotent; survives Astro's
// transition:persist because all state lives on the container node and in
// closures. The clock has no stored state to lose: state = f(system time).
import { getLunation, wheelAngle, wheelXY, SIGN_NAMES } from './lunation.js';
import { SIGN_COLORS, BG, RIM, INK, INK_SOFT } from './palette.js';
import { GLYPHS, SIGN_KEYS } from './glyphs.js';

const NS = 'http://www.w3.org/2000/svg';
const C = 500;                 // center
const R_RIM = 452;             // the circle that draws itself
const RING_OUT = 444;          // wedge outer radius
const RING_IN = 272;           // wedge inner radius
const R_GLYPH = 358;           // sign glyphs, mid-ring
const R_PERIM = 482;           // small outer glyphs
const R_BODIES = 414;          // Sun & Moon travel radius
const R_MOON = 100;            // bull's-eye moon disc
const R_DISC = 266;            // inner dark disc
const INTRO_TTL = 12 * 3600 * 1000;   // replay intro only after >12h away
const LS_KEY = 'cclc.introAt';

const rad = d => d * Math.PI / 180;
const P = (theta, r) => [C + r * Math.cos(rad(theta)), C - r * Math.sin(rad(theta))];
const fx = n => n.toFixed(2);

function h(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

/** Annulus sector for sign k (0=Aries). Outer arc runs visually CCW. */
function wedgePath(k) {
  const t1 = 180 + 30 * k, t2 = t1 + 30;
  const [ax, ay] = P(t1, RING_OUT), [bx, by] = P(t2, RING_OUT);
  const [cx2, cy2] = P(t2, RING_IN), [dx, dy] = P(t1, RING_IN);
  return `M ${fx(ax)} ${fx(ay)} A ${RING_OUT} ${RING_OUT} 0 0 0 ${fx(bx)} ${fx(by)} ` +
         `L ${fx(cx2)} ${fx(cy2)} A ${RING_IN} ${RING_IN} 0 0 1 ${fx(dx)} ${fx(dy)} Z`;
}

/** Shadow overlay for the bull's-eye moon at elongation e (degrees). */
function shadowPath(e) {
  e = ((e % 360) + 360) % 360;
  const eps = 0.03;
  if (e < eps) e = eps;
  if (e > 360 - eps) e = 360 - eps;
  const waxing = e < 180;
  const ce = Math.cos(rad(e));
  const rx = Math.max(0.5, R_MOON * Math.abs(ce));
  const top = `${C} ${C - R_MOON}`, bot = `${C} ${C + R_MOON}`;
  // Semicircle on the shadow's home side: waxing -> left (CCW, sweep 0),
  // waning -> right (CW, sweep 1). Terminator returns bottom -> top.
  const semiSweep = waxing ? 0 : 1;
  const termSweep = (waxing === (ce > 0)) ? 0 : 1;
  return `M ${top} A ${R_MOON} ${R_MOON} 0 0 ${semiSweep} ${bot} ` +
         `A ${fx(rx)} ${R_MOON} 0 0 ${termSweep} ${top} Z`;
}

const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th'
  : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th');

const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', second: '2-digit',
  hour12: true, timeZoneName: 'short',
});
const dateFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
});
function dateLine(d) {
  const p = Object.fromEntries(dateFmt.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.weekday}, ${p.month} ${ordinal(Number(p.day))}`;
}

// ---------------------------------------------------------------- build ----
function buildSVG(root) {
  const svg = h('svg', {
    viewBox: '0 0 1000 1000', class: 'cclc-svg',
    role: 'img', 'aria-label': 'Live lunation clock',
  }, root);

  // ---- defs: gradients, filters, glyph symbols
  const defs = h('defs', {}, svg);

  const moonGrad = h('radialGradient', { id: 'cc-moonsurf', cx: '42%', cy: '38%', r: '75%' }, defs);
  h('stop', { offset: '0%', 'stop-color': '#f2f0e6' }, moonGrad);
  h('stop', { offset: '55%', 'stop-color': '#cfcabc' }, moonGrad);
  h('stop', { offset: '100%', 'stop-color': '#8f8a80' }, moonGrad);

  const discGrad = h('radialGradient', { id: 'cc-disc', cx: '50%', cy: '46%', r: '72%' }, defs);
  h('stop', { offset: '0%', 'stop-color': '#181236' }, discGrad);
  h('stop', { offset: '78%', 'stop-color': '#0e0a26' }, discGrad);
  h('stop', { offset: '100%', 'stop-color': '#0a071e' }, discGrad);

  // parchment grain for the wedges (static — never animate turbulence)
  const grain = h('filter', { id: 'cc-grain', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
  h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', seed: '11', stitchTiles: 'stitch' }, grain);
  h('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0' }, grain);
  h('feComposite', { operator: 'atop', in2: 'SourceGraphic' }, grain);

  const moongrain = h('filter', { id: 'cc-moongrain', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
  h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.55', numOctaves: '3', seed: '4', stitchTiles: 'stitch' }, moongrain);
  h('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0' }, moongrain);
  h('feComposite', { operator: 'atop', in2: 'SourceGraphic' }, moongrain);

  for (const [name, glow] of [['sun', '#ffb84d'], ['moonb', '#a9b8ff'], ['lume', '#dfe6ff']]) {
    const f = h('filter', { id: `cc-glow-${name}`, x: '-80%', y: '-80%', width: '260%', height: '260%' }, defs);
    h('feDropShadow', { dx: 0, dy: 0, stdDeviation: name === 'lume' ? 10 : 7, 'flood-color': glow, 'flood-opacity': 0.85 }, f);
  }

  for (const key of SIGN_KEYS) {
    const s = h('symbol', { id: `cc-g-${key}`, viewBox: '0 0 100 100' }, defs);
    h('path', { d: GLYPHS[key], fill: 'none', stroke: 'currentColor',
      'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
  }

  // ---- layers, back to front
  const gAxes = h('g', { class: 'cc-axes' }, svg);
  const gRing = h('g', { class: 'cc-ring' }, svg);
  const gSheen = h('g', { class: 'cc-sheen' }, svg);
  const gPerim = h('g', { class: 'cc-perim' }, svg);
  const gBull = h('g', { class: 'cc-bull' }, svg);
  const gText = h('g', { class: 'cc-texts center-default' }, svg);
  const gAlt = h('g', { class: 'cc-altcenter' }, svg);
  const gBodies = h('g', { class: 'cc-bodies' }, svg);

  // the circle that draws itself — starts at the Aries point, runs CCW
  const rim = h('path', {
    class: 'cc-rimline',
    d: `M ${C - R_RIM} ${C} A ${R_RIM} ${R_RIM} 0 1 0 ${C + R_RIM} ${C} A ${R_RIM} ${R_RIM} 0 1 0 ${C - R_RIM} ${C}`,
    fill: 'none', stroke: RIM, 'stroke-width': 3, opacity: 0.85,
  }, svg);

  // three cross groups: A draws, B and C duplicate outward counterclockwise
  const axisGroups = [];
  for (let i = 0; i < 3; i++) {
    const g = h('g', { class: `cc-axis cc-axis-${i}` }, gAxes);
    g.style.transformOrigin = '500px 500px';
    h('path', { d: `M ${C - R_RIM} ${C} H ${C + R_RIM}`, stroke: RIM, 'stroke-width': 2, opacity: 0.55, class: 'ax-h' }, g);
    h('path', { d: `M ${C} ${C - R_RIM} V ${C + R_RIM}`, stroke: RIM, 'stroke-width': 2, opacity: 0.55, class: 'ax-v' }, g);
    axisGroups.push(g);
  }

  // twelve wedges + sign glyphs + perimeter glyphs
  const wedges = [], glyphsIn = [], glyphsOut = [];
  for (let k = 0; k < 12; k++) {
    const w = h('path', {
      d: wedgePath(k), fill: SIGN_COLORS[k], filter: 'url(#cc-grain)',
      stroke: RIM, 'stroke-width': 1.4, 'stroke-opacity': 0.45, class: 'cc-wedge',
    }, gRing);
    w.style.transformOrigin = '500px 500px';
    wedges.push(w);

    const mid = 180 + 30 * k + 15;
    const [gx, gy] = P(mid, R_GLYPH);
    const gi = h('use', {
      href: `#cc-g-${SIGN_KEYS[k]}`, width: 100, height: 100, class: 'cc-signglyph',
      transform: `translate(${fx(gx)} ${fx(gy)}) scale(0.56) translate(-50 -50)`,
    }, gRing);
    gi.style.color = '#ffffff';
    glyphsIn.push(gi);

    const [px, py] = P(mid, R_PERIM);
    const go = h('use', {
      href: `#cc-g-${SIGN_KEYS[k]}`, width: 100, height: 100, class: 'cc-perimglyph',
      transform: `translate(${fx(px)} ${fx(py)}) scale(0.30) translate(-50 -50)`,
    }, gPerim);
    go.style.color = RIM;
    glyphsOut.push(go);
  }

  // slow drifting sheen across the ring (rotates via CSS when .live)
  gSheen.style.transformOrigin = '500px 500px';
  const sheenGrad = h('radialGradient', { id: 'cc-sheeng', cx: '50%', cy: '50%', r: '50%' }, defs);
  h('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': 0.10 }, sheenGrad);
  h('stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': 0 }, sheenGrad);
  h('ellipse', { cx: C + 250, cy: C - 250, rx: 300, ry: 190, fill: 'url(#cc-sheeng)' }, gSheen);

  // bull's-eye: dark disc, moon, shadow, sign glyph
  h('circle', { cx: C, cy: C, r: R_DISC, fill: 'url(#cc-disc)' }, gBull);
  h('circle', { cx: C, cy: C, r: R_DISC, fill: 'none', stroke: RIM, 'stroke-width': 1.2, 'stroke-opacity': 0.35 }, gBull);
  const moonDisc = h('circle', {
    cx: C, cy: C, r: R_MOON, fill: 'url(#cc-moonsurf)',
    filter: 'url(#cc-moongrain)', class: 'cc-moondisc',
  }, gBull);
  const moonHalo = h('circle', {
    cx: C, cy: C, r: R_MOON + 4, fill: 'none', stroke: '#e9ecff',
    'stroke-width': 2.5, 'stroke-opacity': 0.35, filter: 'url(#cc-glow-lume)', class: 'cc-moonhalo',
  }, gBull);
  const shadow = h('path', {
    d: shadowPath(0.05), fill: '#0b081f', 'fill-opacity': 0.94, class: 'cc-shadow',
  }, gBull);
  shadow.style.filter = 'blur(2.5px)';
  const signOnMoon = h('use', {
    href: `#cc-g-aries`, width: 100, height: 100, class: 'cc-moonsign',
    transform: `translate(${C} ${C}) scale(0.64) translate(-50 -50)`, opacity: 0.92,
  }, gBull);

  // center texts
  const tDate = h('text', { x: C, y: 330, 'text-anchor': 'middle', class: 'cc-t cc-date' }, gText);
  const tTime = h('text', { x: C, y: 374, 'text-anchor': 'middle', class: 'cc-t cc-time' }, gText);
  const tPhase = h('text', { x: C, y: 648, 'text-anchor': 'middle', class: 'cc-t cc-phase' }, gText);
  const tDeg = h('text', { x: C, y: 690, 'text-anchor': 'middle', class: 'cc-t cc-deg' }, gText);

  // alt center (knight hover) — hidden until setCenter is used
  const tAltTitle = h('text', { x: C, y: 470, 'text-anchor': 'middle', class: 'cc-t cc-alt-title' }, gAlt);
  const tAlt1 = h('text', { x: C, y: 520, 'text-anchor': 'middle', class: 'cc-t cc-alt-line' }, gAlt);
  const tAlt2 = h('text', { x: C, y: 556, 'text-anchor': 'middle', class: 'cc-t cc-alt-line' }, gAlt);

  // Sun & Moon riding the outer ring
  const sun = h('g', { class: 'cc-body cc-sun' }, gBodies);
  h('circle', { cx: 0, cy: 0, r: 34, fill: '#ffb84d', opacity: 0.16, class: 'cc-sunhalo' }, sun);
  const sunUse = h('g', { filter: 'url(#cc-glow-sun)' }, sun);
  h('circle', { cx: 0, cy: 0, r: 22, fill: 'none', stroke: '#ff8c1a', 'stroke-width': 7 }, sunUse);
  h('circle', { cx: 0, cy: 0, r: 6, fill: '#ff8c1a' }, sunUse);

  const moonB = h('g', { class: 'cc-body cc-moonb' }, gBodies);
  h('circle', { cx: 0, cy: 0, r: 34, fill: '#a9b8ff', opacity: 0.14, class: 'cc-moonbhalo' }, moonB);
  const moonBUse = h('g', { filter: 'url(#cc-glow-moonb)' }, moonB);
  h('path', { d: GLYPHS.moonBody, fill: '#cdd7ff',
    transform: 'translate(-50 -50) scale(1.0)' }, moonBUse);
  moonBUse.setAttribute('transform', 'rotate(-24) scale(0.62) translate(-50 -50)');
  moonBUse.firstChild.removeAttribute('transform');

  return {
    svg, rim, axisGroups, wedges, glyphsIn, glyphsOut, gSheen, gBull, gText, gAlt,
    gBodies, sun, moonB, shadow, signOnMoon, tDate, tTime, tPhase, tDeg,
    tAltTitle, tAlt1, tAlt2,
  };
}

// ----------------------------------------------------------------- live ----
function makeTicker(refs) {
  let last = {};
  function render(now) {
    const L = getLunation(now);
    const dl = dateLine(now);
    if (dl !== last.dl) { refs.tDate.textContent = dl; last.dl = dl; }
    refs.tTime.textContent = timeFmt.format(now);
    if (L.phase !== last.phase) { refs.tPhase.textContent = L.phase.toUpperCase(); last.phase = L.phase; }
    const degStr = `Moon at ${L.deg}\u00b0${String(L.arcmin).padStart(2, '0')}\u2032 ${L.sign}`;
    if (degStr !== last.deg) { refs.tDeg.textContent = degStr; last.deg = degStr; }
    if (L.signIdx !== last.signIdx) {
      refs.signOnMoon.setAttribute('href', `#cc-g-${SIGN_KEYS[L.signIdx]}`);
      refs.signOnMoon.style.color = SIGN_COLORS[L.signIdx];
      refs.signOnMoon.style.filter = `drop-shadow(0 0 9px ${SIGN_COLORS[L.signIdx]})`;
      last.signIdx = L.signIdx;
    }
    const eR = Math.round(L.elong * 50);
    if (eR !== last.eR) { refs.shadow.setAttribute('d', shadowPath(L.elong)); last.eR = eR; }
    const [sx, sy] = wheelXY(L.sunLon, R_BODIES);
    refs.sun.setAttribute('transform', `translate(${fx(sx)} ${fx(sy)})`);
    const [mx, my] = wheelXY(L.moonLon, R_BODIES);
    refs.moonB.setAttribute('transform', `translate(${fx(mx)} ${fx(my)})`);
    return L;
  }
  let timer = null;
  function tick() {
    const now = new Date();
    render(now);
    timer = setTimeout(tick, 1000 - (now.getTime() % 1000) + 4);
  }
  function start() { if (timer === null) tick(); }
  function resync() { if (timer !== null) { clearTimeout(timer); timer = null; } start(); }
  return { render, start, resync };
}

// ---------------------------------------------------------------- intro ----
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

function playIntro(refs, ticker) {
  const A = (el, kf, opts) => el.animate(kf, { fill: 'both', ...opts });
  const rimLen = 2 * Math.PI * R_RIM;
  refs.rim.style.strokeDasharray = `${rimLen}`;
  A(refs.rim, { strokeDashoffset: [rimLen, 0] }, { duration: 820, easing: 'cubic-bezier(.4,0,.2,1)' });

  // axes draw, then the medicine wheel duplicates counterclockwise
  refs.axisGroups.forEach((g, i) => { if (i > 0) g.style.opacity = 0; });
  for (const g of refs.axisGroups) {
    for (const p of g.children) {
      const len = 2 * R_RIM;
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = i0(g) === 0 ? `${len}` : '0';
    }
  }
  function i0(g) { return refs.axisGroups.indexOf(g); }
  const [axH, axV] = refs.axisGroups[0].children;
  A(axH, { strokeDashoffset: [2 * R_RIM, 0] }, { duration: 250, delay: 830, easing: 'ease-out' });
  A(axV, { strokeDashoffset: [2 * R_RIM, 0] }, { duration: 250, delay: 1090, easing: 'ease-out' });
  A(refs.axisGroups[1], { opacity: [0, 1], transform: ['rotate(0deg)', 'rotate(-30deg)'] },
    { duration: 570, delay: 1360, easing: 'cubic-bezier(.3,.7,.3,1)' });
  A(refs.axisGroups[2], { opacity: [0, 1], transform: ['rotate(0deg)', 'rotate(-60deg)'] },
    { duration: 570, delay: 1440, easing: 'cubic-bezier(.3,.7,.3,1)' });

  // wedges stretch inner->outer, Aries -> Pisces, a counterclockwise spiral
  refs.wedges.forEach((w, k) => {
    w.style.opacity = 0;
    A(w, { opacity: [0, 1], transform: ['scale(0.62)', 'scale(1)'] },
      { duration: 360, delay: 1980 + 52 * k, easing: 'cubic-bezier(.25,.9,.3,1)' });
  });
  refs.glyphsIn.forEach((g, k) => {
    g.style.opacity = 0;
    A(g, { opacity: [0, 1] }, { duration: 300, delay: 2080 + 52 * k });
  });
  refs.glyphsOut.forEach((g, k) => {
    g.style.opacity = 0;
    A(g, { opacity: [0, 0.9] }, { duration: 300, delay: 2220 + 52 * k });
  });
  A(refs.axisGroups[0].parentNode, { opacity: [1, 0] }, { duration: 420, delay: 2720 });

  // bull's-eye appears dark, then the sky catches up: new moon -> now
  refs.gBull.style.opacity = 0;
  refs.gText.style.opacity = 0;
  refs.gBodies.style.opacity = 0;
  refs.shadow.setAttribute('d', shadowPath(0.05));
  A(refs.gBull, { opacity: [0, 1] }, { duration: 300, delay: 2980, easing: 'ease-out' });
  A(refs.gBodies, { opacity: [0, 1] }, { duration: 480, delay: 3080, easing: 'ease-out' });
  [refs.tDate, refs.tTime, refs.tPhase, refs.tDeg].forEach((t, i) => {
    t.style.opacity = 0;
    A(t, { opacity: [0, 1] }, { duration: 380, delay: 3120 + 80 * i, easing: 'ease-out' });
  });
  A(refs.gText, { opacity: [0, 1] }, { duration: 10, delay: 3100 });

  const targetE = getLunation(new Date()).elong;
  const t0 = performance.now() + 3050, dur = 900;
  function sweep(nowT) {
    const t = Math.min(1, Math.max(0, (nowT - t0) / dur));
    if (t > 0) refs.shadow.setAttribute('d', shadowPath(0.05 + easeOutCubic(t) * (targetE - 0.05)));
    if (t < 1) requestAnimationFrame(sweep);
  }
  requestAnimationFrame(sweep);

  setTimeout(() => { refs.svg.classList.add('live'); ticker.resync(); }, 3960);
}

function instantReveal(refs, ticker) {
  refs.axisGroups.forEach((g, i) => { if (i > 0) { g.style.opacity = 1; g.style.transform = `rotate(${-30 * i}deg)`; } });
  refs.axisGroups[0].parentNode.style.opacity = 0;
  refs.svg.classList.add('live');
  ticker.start();
}

// ---------------------------------------------------------------- mount ----
export function mountCCLC(container) {
  if (container.__cclc) return container.__cclc;

  const refs = buildSVG(container);
  const ticker = makeTicker(refs);
  ticker.render(new Date());   // first paint is already correct

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastIntro = 0;
  try { lastIntro = Number(localStorage.getItem(LS_KEY) || 0); } catch {}
  const fresh = Date.now() - lastIntro > INTRO_TTL;
  try { localStorage.setItem(LS_KEY, String(Date.now())); } catch {}

  if (fresh && !reduced) playIntro(refs, ticker);
  else instantReveal(refs, ticker);
  ticker.start();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) ticker.resync();
    document.documentElement.classList.toggle('cc-paused', document.hidden);
  });

  const api = {
    setCenter(alt) {
      if (!alt) { refs.svg.classList.remove('center-alt'); return; }
      refs.tAltTitle.textContent = alt.title || '';
      refs.tAlt1.textContent = (alt.lines && alt.lines[0]) || '';
      refs.tAlt2.textContent = (alt.lines && alt.lines[1]) || '';
      refs.svg.classList.add('center-alt');
    },
    lunation: getLunation,
  };
  container.__cclc = api;
  container.dataset.mountedAt = timeFmt.format(new Date());
  return api;
}
