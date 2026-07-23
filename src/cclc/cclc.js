// cclc.js — the Central Circle Lunation Clock, v0.5.
// Viewport-locked: wheel sized by shorter dimension, no scrollbar ever.
// Sun & Moon ride the inner ring edge. Traveling Moon shows phase.
// Outer glyphs on cusps. Phase-sweep intro from new moon.
import { getLunation, wheelAngle, wheelXY, SIGN_NAMES } from './lunation.js';
import { SIGN_COLORS, BG, RIM, INK, INK_SOFT } from './palette.js';
import { GLYPHS, SIGN_KEYS } from './glyphs.js';

const NS = 'http://www.w3.org/2000/svg';
const C = 500;
const R_RIM = 452;
const RING_OUT = 444;
const RING_IN = 272;
const R_GLYPH = 358;
const R_PERIM = 482;
const R_BODIES = RING_IN;          // v0.5: ride the inner ring edge
const R_MOON = 100;
const R_DISC = 266;
const INTRO_TTL = 12 * 3600 * 1000;
const LS_KEY = 'cclc.introAt';
const BODY_MOON_R = 18;            // radius of the traveling moon disc

const rad = d => d * Math.PI / 180;
const P = (theta, r) => [C + r * Math.cos(rad(theta)), C - r * Math.sin(rad(theta))];
const fx = n => n.toFixed(2);

function h(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function wedgePath(k) {
  const t1 = 180 + 30 * k, t2 = t1 + 30;
  const [ax, ay] = P(t1, RING_OUT), [bx, by] = P(t2, RING_OUT);
  const [cx2, cy2] = P(t2, RING_IN), [dx, dy] = P(t1, RING_IN);
  return `M ${fx(ax)} ${fx(ay)} A ${RING_OUT} ${RING_OUT} 0 0 0 ${fx(bx)} ${fx(by)} ` +
         `L ${fx(cx2)} ${fx(cy2)} A ${RING_IN} ${RING_IN} 0 0 1 ${fx(dx)} ${fx(dy)} Z`;
}

/** Shadow for the bull's-eye moon */
function shadowPath(e, r = R_MOON) {
  e = ((e % 360) + 360) % 360;
  const eps = 0.03;
  if (e < eps) e = eps;
  if (e > 360 - eps) e = 360 - eps;
  const waxing = e < 180;
  const ce = Math.cos(rad(e));
  const rx = Math.max(0.5, r * Math.abs(ce));
  const top = `${C} ${C - r}`, bot = `${C} ${C + r}`;
  const semiSweep = waxing ? 0 : 1;
  const termSweep = (waxing === (ce > 0)) ? 0 : 1;
  return `M ${top} A ${r} ${r} 0 0 ${semiSweep} ${bot} ` +
         `A ${fx(rx)} ${r} 0 0 ${termSweep} ${top} Z`;
}

/** Small traveling moon phase path — positioned at (0,0) */
function travelMoonShadow(e, r = BODY_MOON_R) {
  e = ((e % 360) + 360) % 360;
  const eps = 0.03;
  if (e < eps) e = eps;
  if (e > 360 - eps) e = 360 - eps;
  const waxing = e < 180;
  const ce = Math.cos(rad(e));
  const rx = Math.max(0.3, r * Math.abs(ce));
  const top = `0 ${-r}`, bot = `0 ${r}`;
  const semiSweep = waxing ? 0 : 1;
  const termSweep = (waxing === (ce > 0)) ? 0 : 1;
  return `M ${top} A ${r} ${r} 0 0 ${semiSweep} ${bot} ` +
         `A ${fx(rx)} ${r} 0 0 ${termSweep} ${top} Z`;
}

const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th'
  : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th');

const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', second: '2-digit',
  hour12: true,
});
const tzFmt = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' });
function timeParts(d) {
  const digits = timeFmt.format(d);                         // "4:31:10 AM"
  const tz = tzFmt.formatToParts(d).find(p => p.type === 'timeZoneName')?.value || '';
  // split off AM/PM
  const m = digits.match(/^([\d:]+)\s*(AM|PM)$/i);
  if (m) return { nums: m[1], suffix: ` ${m[2]} ${tz}` };
  return { nums: digits, suffix: ` ${tz}` };
}
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

  const defs = h('defs', {}, svg);

  const moonGrad = h('radialGradient', { id: 'cc-moonsurf', cx: '42%', cy: '38%', r: '75%' }, defs);
  h('stop', { offset: '0%', 'stop-color': '#f5eed4' }, moonGrad);
  h('stop', { offset: '55%', 'stop-color': '#d4c9a0' }, moonGrad);
  h('stop', { offset: '100%', 'stop-color': '#9a8e6a' }, moonGrad);

  const discGrad = h('radialGradient', { id: 'cc-disc', cx: '50%', cy: '46%', r: '72%' }, defs);
  h('stop', { offset: '0%', 'stop-color': '#181236' }, discGrad);
  h('stop', { offset: '78%', 'stop-color': '#0e0a26' }, discGrad);
  h('stop', { offset: '100%', 'stop-color': '#0a071e' }, discGrad);

  const grain = h('filter', { id: 'cc-grain', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
  h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', seed: '11', stitchTiles: 'stitch' }, grain);
  h('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0' }, grain);
  h('feComposite', { operator: 'atop', in2: 'SourceGraphic' }, grain);

  const moongrain = h('filter', { id: 'cc-moongrain', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
  h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.55', numOctaves: '3', seed: '4', stitchTiles: 'stitch' }, moongrain);
  h('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.32 0' }, moongrain);
  h('feComposite', { operator: 'atop', in2: 'SourceGraphic' }, moongrain);

  for (const [name, glow, sd] of [['sun', '#ffffff', 14], ['moonb', '#ffffff', 14], ['lume', '#dfe6ff', 10]]) {
    const f = h('filter', { id: `cc-glow-${name}`, x: '-100%', y: '-100%', width: '300%', height: '300%' }, defs);
    h('feDropShadow', { dx: 0, dy: 0, stdDeviation: sd, 'flood-color': glow, 'flood-opacity': 0.9 }, f);
  }

  for (const key of SIGN_KEYS) {
    const s = h('symbol', { id: `cc-g-${key}`, viewBox: '0 0 100 100' }, defs);
    h('path', { d: GLYPHS[key], fill: 'none', stroke: 'currentColor',
      'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
  }

  const gAxes = h('g', { class: 'cc-axes' }, svg);
  const gRing = h('g', { class: 'cc-ring' }, svg);
  const gSheen = h('g', { class: 'cc-sheen' }, svg);
  const gPerim = h('g', { class: 'cc-perim' }, svg);
  const gBull = h('g', { class: 'cc-bull' }, svg);
  const gText = h('g', { class: 'cc-texts center-default' }, svg);
  const gAlt = h('g', { class: 'cc-altcenter' }, svg);
  const gBodies = h('g', { class: 'cc-bodies' }, svg);  // topmost layer

  const rim = h('path', {
    class: 'cc-rimline',
    d: `M ${C - R_RIM} ${C} A ${R_RIM} ${R_RIM} 0 1 0 ${C + R_RIM} ${C} A ${R_RIM} ${R_RIM} 0 1 0 ${C - R_RIM} ${C}`,
    fill: 'none', stroke: RIM, 'stroke-width': 3, opacity: 0.85,
  }, svg);

  const axisGroups = [];
  for (let i = 0; i < 3; i++) {
    const g = h('g', { class: `cc-axis cc-axis-${i}` }, gAxes);
    g.style.transformOrigin = '500px 500px';
    h('path', { d: `M ${C - R_RIM} ${C} H ${C + R_RIM}`, stroke: RIM, 'stroke-width': 2, opacity: 0.55, class: 'ax-h' }, g);
    h('path', { d: `M ${C} ${C - R_RIM} V ${C + R_RIM}`, stroke: RIM, 'stroke-width': 2, opacity: 0.55, class: 'ax-v' }, g);
    axisGroups.push(g);
  }

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

    // v0.5: outer glyphs on CUSPS (sign boundaries), not centers
    const cusp = 180 + 30 * k;   // 0=Aries cusp, 30=Taurus cusp, etc.
    const [px, py] = P(cusp, R_PERIM);
    const go = h('use', {
      href: `#cc-g-${SIGN_KEYS[k]}`, width: 100, height: 100, class: 'cc-perimglyph',
      transform: `translate(${fx(px)} ${fx(py)}) scale(0.30) translate(-50 -50)`,
    }, gPerim);
    go.style.color = RIM;
    glyphsOut.push(go);
  }

  gSheen.style.transformOrigin = '500px 500px';
  const sheenGrad = h('radialGradient', { id: 'cc-sheeng', cx: '50%', cy: '50%', r: '50%' }, defs);
  h('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': 0.10 }, sheenGrad);
  h('stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': 0 }, sheenGrad);
  h('ellipse', { cx: C + 250, cy: C - 250, rx: 300, ry: 190, fill: 'url(#cc-sheeng)' }, gSheen);

  // bull's-eye
  h('circle', { cx: C, cy: C, r: R_DISC, fill: 'url(#cc-disc)' }, gBull);
  h('circle', { cx: C, cy: C, r: R_DISC, fill: 'none', stroke: RIM, 'stroke-width': 1.2, 'stroke-opacity': 0.35 }, gBull);
  const moonDisc = h('circle', {
    cx: C, cy: C, r: R_MOON, fill: 'url(#cc-moonsurf)',
    filter: 'url(#cc-moongrain)', class: 'cc-moondisc',
  }, gBull);
  const moonHalo = h('circle', {
    cx: C, cy: C, r: R_MOON + 4, fill: 'none', stroke: '#e9ecff',
    'stroke-width': 2.5, 'stroke-opacity': 0, filter: 'url(#cc-glow-lume)', class: 'cc-moonhalo',
  }, gBull);
  const shadow = h('path', {
    d: shadowPath(0.05), fill: '#0b081f', 'fill-opacity': 0.94, class: 'cc-shadow',
  }, gBull);
  shadow.style.filter = 'blur(2.5px)';
  const signOnMoon = h('use', {
    href: `#cc-g-aries`, width: 100, height: 100, class: 'cc-moonsign',
    transform: `translate(${C} ${C}) scale(0.64) translate(-50 -50)`, opacity: 0,
  }, gBull);

  // center texts — sizes now relative, set via CSS
  const tDate = h('text', { x: C, y: 340, 'text-anchor': 'middle', class: 'cc-t cc-date' }, gText);
  const tTime = h('text', { x: C, y: 378, 'text-anchor': 'middle', class: 'cc-t cc-time' }, gText);
  const tTimeDigits = h('tspan', { class: 'cc-time-digits' }, tTime);
  const tTimeSuffix = h('tspan', { class: 'cc-time-suffix' }, tTime);
  const tPhase = h('text', { x: C, y: 640, 'text-anchor': 'middle', class: 'cc-t cc-phase' }, gText);
  const tDeg = h('text', { x: C, y: 676, 'text-anchor': 'middle', class: 'cc-t cc-deg' }, gText);

  const tAltTitle = h('text', { x: C, y: 470, 'text-anchor': 'middle', class: 'cc-t cc-alt-title' }, gAlt);
  const tAlt1 = h('text', { x: C, y: 520, 'text-anchor': 'middle', class: 'cc-t cc-alt-line' }, gAlt);
  const tAlt2 = h('text', { x: C, y: 556, 'text-anchor': 'middle', class: 'cc-t cc-alt-line' }, gAlt);

  // Sun body — solid white fill, circumpunct on top, two rotating ray layers
  const sun = h('g', { class: 'cc-body cc-sun' }, gBodies);
  // rays: two groups of 12 lines each, rotating opposite directions via CSS
  for (const cls of ['cc-sunrays-a', 'cc-sunrays-b']) {
    const rg = h('g', { class: cls }, sun);
    for (let i = 0; i < 12; i++) {
      const ang = (i * 30) * Math.PI / 180;
      const x1 = Math.cos(ang) * (BODY_MOON_R + 5), y1 = Math.sin(ang) * (BODY_MOON_R + 5);
      const x2 = Math.cos(ang) * (BODY_MOON_R + 18), y2 = Math.sin(ang) * (BODY_MOON_R + 18);
      h('line', { x1: fx(x1), y1: fx(y1), x2: fx(x2), y2: fx(y2),
        stroke: '#ffcc66', 'stroke-width': i % 2 === 0 ? 2.2 : 1.2,
        'stroke-opacity': i % 2 === 0 ? 0.22 : 0.12, 'stroke-linecap': 'round' }, rg);
    }
  }
  h('circle', { cx: 0, cy: 0, r: 30, fill: '#ffffff', opacity: 0.18, class: 'cc-sunhalo', filter: 'url(#cc-glow-sun)' }, sun);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R, fill: '#ffffff' }, sun);  // solid white backing
  const sunInner = h('g', {}, sun);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R, fill: 'none', stroke: '#ff8c1a', 'stroke-width': 5 }, sunInner);
  h('circle', { cx: 0, cy: 0, r: 4.5, fill: '#ff8c1a' }, sunInner);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.8, 'stroke-opacity': 0.7 }, sun);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R + 4, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.2, 'stroke-opacity': 0.5, filter: 'url(#cc-glow-sun)' }, sun);

  // Traveling Moon — phase-accurate disc, three breathing halo layers
  const moonB = h('g', { class: 'cc-body cc-moonb' }, gBodies);
  h('circle', { cx: 0, cy: 0, r: 34, fill: '#ffffff', opacity: 0.10, class: 'cc-moonbhalo cc-mh-1', filter: 'url(#cc-glow-moonb)' }, moonB);
  h('circle', { cx: 0, cy: 0, r: 28, fill: '#ffffff', opacity: 0.14, class: 'cc-moonbhalo cc-mh-2', filter: 'url(#cc-glow-moonb)' }, moonB);
  h('circle', { cx: 0, cy: 0, r: 24, fill: '#e8ecff', opacity: 0.08, class: 'cc-moonbhalo cc-mh-3' }, moonB);
  const moonBDisc = h('circle', { cx: 0, cy: 0, r: BODY_MOON_R, fill: '#e8ecff', class: 'cc-moonb-lit' }, moonB);
  const moonBShadow = h('path', { d: travelMoonShadow(0.05), fill: '#0b081f', 'fill-opacity': 0.92, class: 'cc-moonb-shadow' }, moonB);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.8, 'stroke-opacity': 0.7 }, moonB);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R + 4, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.2, 'stroke-opacity': 0.4, filter: 'url(#cc-glow-moonb)' }, moonB);

  return {
    svg, rim, axisGroups, wedges, glyphsIn, glyphsOut, gSheen, gBull, gText, gAlt,
    gBodies, sun, moonB, moonBShadow, shadow, signOnMoon, moonHalo,
    tDate, tTime, tTimeDigits, tTimeSuffix, tPhase, tDeg, tAltTitle, tAlt1, tAlt2,
  };
}

// ----------------------------------------------------------------- live ----
function makeTicker(refs) {
  let last = {};
  function render(now) {
    const L = getLunation(now);
    const dl = dateLine(now);
    if (dl !== last.dl) { refs.tDate.textContent = dl; last.dl = dl; }
    const tp = timeParts(now);
    refs.tTimeDigits.textContent = tp.nums;
    refs.tTimeSuffix.textContent = tp.suffix;
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
    if (eR !== last.eR) {
      refs.shadow.setAttribute('d', shadowPath(L.elong));
      refs.moonBShadow.setAttribute('d', travelMoonShadow(L.elong));
      last.eR = eR;
    }
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

  refs.axisGroups.forEach((g, i) => { if (i > 0) g.style.opacity = 0; });
  for (const g of refs.axisGroups) {
    for (const p of g.children) {
      const len = 2 * R_RIM;
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = axIdx(g) === 0 ? `${len}` : '0';
    }
  }
  function axIdx(g) { return refs.axisGroups.indexOf(g); }
  const [axH, axV] = refs.axisGroups[0].children;
  A(axH, { strokeDashoffset: [2 * R_RIM, 0] }, { duration: 250, delay: 830, easing: 'ease-out' });
  A(axV, { strokeDashoffset: [2 * R_RIM, 0] }, { duration: 250, delay: 1090, easing: 'ease-out' });
  A(refs.axisGroups[1], { opacity: [0, 1], transform: ['rotate(0deg)', 'rotate(-30deg)'] },
    { duration: 570, delay: 1360, easing: 'cubic-bezier(.3,.7,.3,1)' });
  A(refs.axisGroups[2], { opacity: [0, 1], transform: ['rotate(0deg)', 'rotate(-60deg)'] },
    { duration: 570, delay: 1440, easing: 'cubic-bezier(.3,.7,.3,1)' });

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

  // v0.5: bull's-eye phase sweep from new moon to current
  refs.gBull.style.opacity = 0;
  refs.gText.style.opacity = 0;
  refs.gBodies.style.opacity = 0;
  refs.shadow.setAttribute('d', shadowPath(0.05));
  refs.moonHalo.setAttribute('stroke-opacity', '0');
  refs.signOnMoon.setAttribute('opacity', '0');

  A(refs.gBull, { opacity: [0, 1] }, { duration: 300, delay: 2980, easing: 'ease-out' });

  const targetE = getLunation(new Date()).elong;
  const sweepStart = 3050, sweepDur = 1200;
  function sweep(nowT) {
    const t = Math.min(1, Math.max(0, (nowT - (performance.now() - nowT + sweepStart)) / sweepDur));
    const elapsed = nowT - sweepAnchor;
    const progress = Math.min(1, Math.max(0, elapsed / sweepDur));
    const eased = easeOutCubic(progress);
    const currentE = 0.05 + eased * (targetE - 0.05);
    refs.shadow.setAttribute('d', shadowPath(currentE));
    refs.moonBShadow.setAttribute('d', travelMoonShadow(currentE));
    if (progress < 1) requestAnimationFrame(sweep);
    else {
      // phase landed — fade in glow, outline, sign
      A(refs.moonHalo, { strokeOpacity: [0, 0.35] }, { duration: 500, easing: 'ease-out' });
      A(refs.signOnMoon, { opacity: [0, 0.92] }, { duration: 500, easing: 'ease-out' });
    }
  }
  let sweepAnchor = 0;
  setTimeout(() => { sweepAnchor = performance.now(); requestAnimationFrame(sweep); }, sweepStart);

  A(refs.gBodies, { opacity: [0, 1] }, { duration: 480, delay: 3200, easing: 'ease-out' });
  [refs.tDate, refs.tTime, refs.tPhase, refs.tDeg].forEach((t, i) => {
    t.style.opacity = 0;
    A(t, { opacity: [0, 1] }, { duration: 380, delay: 3400 + 80 * i, easing: 'ease-out' });
  });
  A(refs.gText, { opacity: [0, 1] }, { duration: 10, delay: 3380 });

  setTimeout(() => { refs.svg.classList.add('live'); ticker.resync(); }, 4300);
}

function instantReveal(refs, ticker) {
  refs.axisGroups.forEach((g, i) => { if (i > 0) { g.style.opacity = 1; g.style.transform = `rotate(${-30 * i}deg)`; } });
  refs.axisGroups[0].parentNode.style.opacity = 0;
  refs.moonHalo.setAttribute('stroke-opacity', '0.35');
  refs.signOnMoon.setAttribute('opacity', '0.92');
  refs.svg.classList.add('live');
  ticker.start();
}

// ---------------------------------------------------------------- mount ----
export function mountCCLC(container) {
  if (container.__cclc) return container.__cclc;

  const refs = buildSVG(container);
  const ticker = makeTicker(refs);
  ticker.render(new Date());

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
