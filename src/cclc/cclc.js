// cclc.js — the Central Circle Lunation Clock, v0.5.
// Viewport-locked: wheel sized by shorter dimension, no scrollbar ever.
// Sun & Moon ride the inner ring edge. Traveling Moon shows phase.
// Outer glyphs on cusps. Phase-sweep intro from new moon.
import { getLunation, wheelAngle, wheelXY, SIGN_NAMES } from './lunation.js';
import { SIGN_COLORS, BG, RIM, INK, INK_SOFT } from './palette.js';
import { GLYPHS, SIGN_KEYS } from './glyphs.js';
import { findAspect, computeVOC } from './aspects.js';
import * as AstroEngine from 'astronomy-engine';

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
    const f = h('filter', { id: `cc-glow-${name}`, x: '-250%', y: '-250%', width: '600%', height: '600%' }, defs);
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
  // ---- aspect overlay (shown on Sun/Moon hover) — BEFORE gBodies so lines are behind the hands
  const gAspect = h('g', { class: 'cc-aspect', opacity: 0 }, svg);
  const gAspLines = h('g', { class: 'cc-asplines' }, gAspect);
  const aspectLine = h('line', { x1: C, y1: C, x2: C, y2: C,
    stroke: '#ffffff', 'stroke-width': 2.5, 'stroke-opacity': 0.85,
    'stroke-linecap': 'round', class: 'cc-al1' }, gAspLines);
  const aspectLine2 = h('line', { x1: C, y1: C, x2: C, y2: C,
    stroke: '#ffffff', 'stroke-width': 2, 'stroke-opacity': 0,
    'stroke-linecap': 'round', class: 'cc-al2' }, gAspLines);
  const aspectGlyph = h('text', { x: C, y: C + 12, 'text-anchor': 'middle',
    class: 'cc-t cc-aspect-glyph', 'font-size': '60' }, gAspect);
  const aspectName = h('text', { x: C, y: C - 50, 'text-anchor': 'middle',
    class: 'cc-t cc-aspect-name', 'font-size': '18' }, gAspect);
  const aspectDeg = h('text', { x: C, y: C + 60, 'text-anchor': 'middle',
    class: 'cc-t cc-aspect-deg', 'font-size': '22' }, gAspect);

  const gBodies = h('g', { class: 'cc-bodies' }, svg);  // topmost layer

  // THE LUNAR PULSE — absolute front: ripple from the Moon into deep space
  const gPulse = h('g', { class: 'cc-pulse-layer' }, svg);
  const pulseRing = h('circle', { cx: 0, cy: 0, r: 24, fill: 'none',
    stroke: '#dfe6ff', 'stroke-width': 2, opacity: 0,
    'vector-effect': 'non-scaling-stroke', class: 'cc-pulse-ring' }, gPulse);

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

  // Sun body — simple two-layer rays, white glow outline, dark orange circumpunct
  const sun = h('g', { class: 'cc-body cc-sun' }, gBodies);
  // layer A: 12 rays, CW, more opaque
  const rgA = h('g', { class: 'cc-sunrays-a' }, sun);
  for (let i = 0; i < 12; i++) {
    const ang = (i * 30) * Math.PI / 180;
    const x1 = Math.cos(ang) * (BODY_MOON_R + 3), y1 = Math.sin(ang) * (BODY_MOON_R + 3);
    const x2 = Math.cos(ang) * (BODY_MOON_R + 16), y2 = Math.sin(ang) * (BODY_MOON_R + 16);
    h('line', { x1: fx(x1), y1: fx(y1), x2: fx(x2), y2: fx(y2),
      stroke: '#ffcc66', 'stroke-width': 1.6,
      'stroke-opacity': 0.14, 'stroke-linecap': 'round' }, rgA);
  }
  // layer B: 12 rays offset, CCW, less opaque
  const rgB = h('g', { class: 'cc-sunrays-b' }, sun);
  for (let i = 0; i < 12; i++) {
    const ang = (i * 30 + 15) * Math.PI / 180;
    const x1 = Math.cos(ang) * (BODY_MOON_R + 4), y1 = Math.sin(ang) * (BODY_MOON_R + 4);
    const x2 = Math.cos(ang) * (BODY_MOON_R + 14), y2 = Math.sin(ang) * (BODY_MOON_R + 14);
    h('line', { x1: fx(x1), y1: fx(y1), x2: fx(x2), y2: fx(y2),
      stroke: '#ffcc66', 'stroke-width': 1.0,
      'stroke-opacity': 0.08, 'stroke-linecap': 'round' }, rgB);
  }
  // white glow outline
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R + 4, fill: 'none', stroke: '#ffffff',
    'stroke-width': 2.5, 'stroke-opacity': 0.35, filter: 'url(#cc-glow-sun)', class: 'cc-sun-outline' }, sun);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R, fill: '#ffffff' }, sun);
  const SUN_ORANGE = '#d97014';
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R - 1, fill: 'none', stroke: SUN_ORANGE, 'stroke-width': 4.5 }, sun);
  h('circle', { cx: 0, cy: 0, r: 4, fill: SUN_ORANGE }, sun);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.8, 'stroke-opacity': 0.7 }, sun);

  // Traveling Moon — phase-accurate disc, three breathing halo layers
  const moonB = h('g', { class: 'cc-body cc-moonb' }, gBodies);
  h('circle', { cx: 0, cy: 0, r: 34, fill: '#ffffff', opacity: 0.06, class: 'cc-moonbhalo cc-mh-1', filter: 'url(#cc-glow-moonb)' }, moonB);
  h('circle', { cx: 0, cy: 0, r: 28, fill: '#ffffff', opacity: 0.10, class: 'cc-moonbhalo cc-mh-2', filter: 'url(#cc-glow-moonb)' }, moonB);
  h('circle', { cx: 0, cy: 0, r: 24, fill: '#e8ecff', opacity: 0.05, class: 'cc-moonbhalo cc-mh-3' }, moonB);
  const moonBDisc = h('circle', { cx: 0, cy: 0, r: BODY_MOON_R, fill: '#e8ecff', class: 'cc-moonb-lit' }, moonB);
  const moonBShadow = h('path', { d: travelMoonShadow(0.05), fill: '#0b081f', 'fill-opacity': 0.92, class: 'cc-moonb-shadow' }, moonB);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.8, 'stroke-opacity': 0.7 }, moonB);
  h('circle', { cx: 0, cy: 0, r: BODY_MOON_R + 4, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.2, 'stroke-opacity': 0.4, filter: 'url(#cc-glow-moonb)' }, moonB);

  // ---- OPEN WHEEL elements (hidden until setOpen) ----
  const gSlim = h('g', { class: 'cc-slimband', opacity: 0 }, svg);
  const SLIM_IN = 424, SLIM_OUT = 444;
  for (let k = 0; k < 12; k++) {
    const t1 = 180 + 30 * k, t2 = t1 + 30;
    const [ax, ay] = P(t1, SLIM_OUT), [bx, by] = P(t2, SLIM_OUT);
    const [cx2, cy2] = P(t2, SLIM_IN), [dx, dy] = P(t1, SLIM_IN);
    h('path', {
      d: `M ${fx(ax)} ${fx(ay)} A ${SLIM_OUT} ${SLIM_OUT} 0 0 0 ${fx(bx)} ${fx(by)} ` +
         `L ${fx(cx2)} ${fx(cy2)} A ${SLIM_IN} ${SLIM_IN} 0 0 1 ${fx(dx)} ${fx(dy)} Z`,
      fill: SIGN_COLORS[k], 'fill-opacity': 0.85,
      stroke: RIM, 'stroke-width': 1, 'stroke-opacity': 0.35,
    }, gSlim);
  }
  const gQuarters = h('g', { class: 'cc-quarters', opacity: 0 }, svg);
  const Q_IN = 380, Q_OUT = 418;
  const quarterEls = [];
  for (let q = 0; q < 4; q++) {
    const t1 = 90 * q, t2 = t1 + 90;
    const [ax, ay] = P(t1, Q_OUT), [bx, by] = P(t2, Q_OUT);
    const [cx2, cy2] = P(t2, Q_IN), [dx, dy] = P(t1, Q_IN);
    const grp = h('g', { class: 'cc-quarter', tabindex: 0, role: 'tab' }, gQuarters);
    const arc = h('path', {
      d: `M ${fx(ax)} ${fx(ay)} A ${Q_OUT} ${Q_OUT} 0 0 0 ${fx(bx)} ${fx(by)} ` +
         `L ${fx(cx2)} ${fx(cy2)} A ${Q_IN} ${Q_IN} 0 0 1 ${fx(dx)} ${fx(dy)} Z`,
      fill: '#1a1440', 'fill-opacity': 0.55, stroke: RIM, 'stroke-width': 1,
      'stroke-opacity': 0.3, class: 'cc-qarc',
    }, grp);
    const mid = t1 + 45;
    const [lx, ly] = P(mid, (Q_IN + Q_OUT) / 2);
    const lbl = h('text', { x: fx(lx), y: fx(ly + 7), 'text-anchor': 'middle',
      class: 'cc-t cc-qlabel', 'font-size': '19' }, grp);
    quarterEls.push({ grp, arc, lbl });
  }
  const gCompact = h('g', { class: 'cc-compact', opacity: 0,
    transform: `translate(${C} 236)` }, svg);
  h('circle', { cx: 0, cy: 0, r: 30, fill: 'url(#cc-moonsurf)', filter: 'url(#cc-moongrain)' }, gCompact);
  const compactShadow = h('path', { d: travelMoonShadow(0.05, 30), fill: '#0b081f', 'fill-opacity': 0.94 }, gCompact);
  h('circle', { cx: 0, cy: 0, r: 30, fill: 'none', stroke: '#e9ecff', 'stroke-width': 1.5, 'stroke-opacity': 0.4 }, gCompact);
  const compactSign = h('use', { href: '#cc-g-aries', width: 100, height: 100,
    transform: 'scale(0.38) translate(-50 -50)', opacity: 0.92 }, gCompact);

  return {
    svg, rim, axisGroups, wedges, glyphsIn, glyphsOut, gSheen, gBull, gText, gAlt,
    gBodies, sun, moonB, moonBShadow, shadow, signOnMoon, moonHalo, moonDisc,
    gPulse, tDate, tTime, tTimeDigits, tTimeSuffix, tPhase, tDeg, tAltTitle, tAlt1, tAlt2,
    gAspect, gAspLines, aspectLine, aspectLine2, aspectGlyph, aspectName, aspectDeg,
    gSlim, gQuarters, quarterEls, gCompact, compactShadow, compactSign,
  };
}

// ----------------------------------------------------------------- live ----
function makeTicker(refs) {
  let last = {};
  const state = { bodyR: R_BODIES };   // animatable: bodies migrate to rim in open mode
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
      refs.compactSign.setAttribute('href', `#cc-g-${SIGN_KEYS[L.signIdx]}`);
      refs.compactSign.style.color = SIGN_COLORS[L.signIdx];
      last.signIdx = L.signIdx;
    }
    const eR = Math.round(L.elong * 50);
    if (eR !== last.eR) {
      refs.shadow.setAttribute('d', shadowPath(L.elong));
      refs.moonBShadow.setAttribute('d', travelMoonShadow(L.elong));
      refs.compactShadow.setAttribute('d', travelMoonShadow(L.elong, 30));
      last.eR = eR;
    }
    const [sx, sy] = wheelXY(L.sunLon, state.bodyR);
    refs.sun.setAttribute('transform', `translate(${fx(sx)} ${fx(sy)})`);
    const [mx, my] = wheelXY(L.moonLon, state.bodyR);
    refs.moonB.setAttribute('transform', `translate(${fx(mx)} ${fx(my)})`);
    refs.gPulse.setAttribute('transform', `translate(${fx(mx)} ${fx(my)})`);
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
  return { render, start, resync, state };
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

  // ---- aspect hover: Sun or Moon → phase-out the moon only; text stays ALWAYS ON
  let aspectShowing = false;
  let sweepRaf = null;
  const vocTimeFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  const COLOR_FAMILY = {
    '#e84040': 'red', '#e88a3a': 'orange', '#4dd97a': 'green',
    '#b366ff': 'purple', '#a8d940': 'yg', '#3a6ee8': 'blue',
  };

  function showAspect() {
    if (aspectShowing) return;
    aspectShowing = true;
    const L = getLunation(new Date());
    const hit = findAspect(L.elong);

    // phase-out: sign + halo fade, shadow sweeps to new-moon dark, then disc dissolves
    const startE = L.elong;
    const t0 = performance.now();
    const dur = 500;
    refs.signOnMoon.style.transition = 'opacity .3s ease';
    refs.signOnMoon.style.opacity = '0';
    refs.moonHalo.style.transition = 'stroke-opacity .3s ease';
    refs.moonHalo.style.strokeOpacity = '0';

    function sweepOut(nowT) {
      const p = Math.min(1, (nowT - t0) / dur);
      const e = easeOutCubic(p);
      refs.shadow.setAttribute('d', shadowPath(startE * (1 - e) + 0.05 * e));
      if (p < 1) { sweepRaf = requestAnimationFrame(sweepOut); return; }
      // moon is dark — dissolve it, reveal the aspect
      refs.moonDisc.style.transition = 'opacity .25s ease';
      refs.shadow.style.transition = 'opacity .25s ease';
      refs.moonDisc.style.opacity = '0';
      refs.shadow.style.opacity = '0';
      populateAspect(hit, L);
      refs.gAspect.style.transition = 'opacity .3s ease';
      refs.gAspect.style.opacity = '1';
    }
    sweepRaf = requestAnimationFrame(sweepOut);
  }

  function populateAspect(hit, L) {
    const setFills = (color) => {
      refs.aspectName.style.fill = color;
      refs.aspectGlyph.style.fill = color;
      refs.aspectDeg.style.fill = color;
    };
    if (hit) {
      const color = hit.aspect.color;
      const family = COLOR_FAMILY[color] || 'green';
      const app = hit.approaching;
      // thickness by exactness: 10px at exact, 1px at orb edge
      const w = 1 + 9 * (1 - hit.tightness / hit.aspect.orb);
      if (!hit.aspect.noLine) {
        const [mx, my] = wheelXY(L.moonLon, R_BODIES);
        const [sx, sy] = wheelXY(L.sunLon, R_BODIES);
        for (const ln of [refs.aspectLine, refs.aspectLine2]) {
          ln.setAttribute('x1', fx(mx)); ln.setAttribute('y1', fx(my));
          ln.setAttribute('x2', fx(sx)); ln.setAttribute('y2', fx(sy));
        }
        refs.gAspLines.setAttribute('class',
          `cc-asplines asp-${family} ${app ? 'app' : 'sep'}`);
        refs.gAspLines.style.filter = `drop-shadow(0 0 6px ${color})`;
        refs.aspectLine.setAttribute('stroke', color);
        refs.aspectLine.setAttribute('stroke-width', fx(w));
        refs.aspectLine.setAttribute('stroke-opacity', '0.9');
        if (app) {
          refs.aspectLine.removeAttribute('stroke-dasharray');
          if (family === 'purple' || family === 'yg') {
            // sparkle overlay drifting along the solid line
            refs.aspectLine2.setAttribute('stroke', '#ffffff');
            refs.aspectLine2.setAttribute('stroke-width', fx(Math.min(w, 2)));
            refs.aspectLine2.setAttribute('stroke-dasharray', family === 'purple' ? '1.5 15' : '1 22');
            refs.aspectLine2.setAttribute('stroke-opacity', family === 'purple' ? '0.55' : '0.35');
            refs.aspectLine2.setAttribute('class', family === 'purple' ? 'cc-al2 sparkle' : 'cc-al2 sparkle-slow');
          } else {
            refs.aspectLine2.setAttribute('stroke-opacity', '0');
            refs.aspectLine2.setAttribute('class', 'cc-al2');
          }
        } else {
          // separating: two counter-flowing dashed lines
          refs.aspectLine.setAttribute('stroke-dasharray', '8 6');
          refs.aspectLine.setAttribute('class', 'cc-al1 flow');
          refs.aspectLine2.setAttribute('stroke', color);
          refs.aspectLine2.setAttribute('stroke-width', fx(Math.max(1, w * 0.7)));
          refs.aspectLine2.setAttribute('stroke-dasharray', '8 6');
          refs.aspectLine2.setAttribute('stroke-dashoffset', '7');
          refs.aspectLine2.setAttribute('stroke-opacity', '0.55');
          refs.aspectLine2.setAttribute('class', 'cc-al2 flow-r');
        }
        if (app) refs.aspectLine.setAttribute('class', 'cc-al1');
      } else {
        // conjunction — no line
        refs.aspectLine.setAttribute('stroke-opacity', '0');
        refs.aspectLine2.setAttribute('stroke-opacity', '0');
      }
      const label = app ? 'APPROACHING' : 'SEPARATING';
      refs.aspectName.textContent = hit.aspect.noLine
        ? 'The Moon is in' : `The Moon is ${label}`;
      refs.aspectGlyph.textContent = hit.aspect.glyph;
      refs.aspectGlyph.setAttribute('font-size', '60');
      refs.aspectDeg.textContent = hit.aspect.noLine
        ? `${hit.aspect.name} with the Sun` : `${hit.aspect.name} the Sun`;
      setFills(color);
    } else {
      // no Sun-Moon aspect — check Void of Course
      refs.aspectLine.setAttribute('stroke-opacity', '0');
      refs.aspectLine2.setAttribute('stroke-opacity', '0');
      const voc = computeVOC(AstroEngine, new Date());
      if (voc.isVOC) {
        refs.aspectName.textContent = 'The Moon is currently';
        refs.aspectGlyph.textContent = 'Void of Course';
        refs.aspectGlyph.setAttribute('font-size', '24');
        refs.aspectDeg.textContent = `Until ${vocTimeFmt.format(voc.until)}`;
        setFills('#e86a3a');
      } else {
        refs.aspectName.textContent = '';
        refs.aspectGlyph.textContent = 'No major aspect';
        refs.aspectGlyph.setAttribute('font-size', '20');
        refs.aspectDeg.textContent = '';
        setFills(INK_SOFT);
      }
    }
  }

  function hideAspect() {
    if (!aspectShowing) return;
    if (sweepRaf) { cancelAnimationFrame(sweepRaf); sweepRaf = null; }
    aspectShowing = false;
    refs.gAspect.style.transition = 'opacity .25s ease';
    refs.gAspect.style.opacity = '0';
    // moon returns: disc fades in dark, then phase sweeps back to now
    refs.moonDisc.style.opacity = '1';
    refs.shadow.style.opacity = '1';
    refs.shadow.setAttribute('d', shadowPath(0.05));
    const L = getLunation(new Date());
    const targetE = L.elong;
    const t0 = performance.now();
    const dur = 400;
    function sweepIn(nowT) {
      const p = Math.min(1, (nowT - t0) / dur);
      const e = easeOutCubic(p);
      refs.shadow.setAttribute('d', shadowPath(0.05 + e * (targetE - 0.05)));
      if (p < 1) requestAnimationFrame(sweepIn);
      else {
        refs.signOnMoon.style.opacity = '0.92';
        refs.moonHalo.style.strokeOpacity = '0.35';
      }
    }
    requestAnimationFrame(sweepIn);
  }

  for (const body of [refs.sun, refs.moonB]) {
    body.style.cursor = 'pointer';
    body.addEventListener('mouseenter', showAspect);
    body.addEventListener('mouseleave', hideAspect);
    body.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (aspectShowing) hideAspect(); else showAspect();
    }, { passive: false });
  }

  const api = {
    setCenter(alt) {
      if (!alt) { refs.svg.classList.remove('center-alt'); return; }
      refs.tAltTitle.textContent = alt.title || '';
      refs.tAlt1.textContent = (alt.lines && alt.lines[0]) || '';
      refs.tAlt2.textContent = (alt.lines && alt.lines[1]) || '';
      refs.svg.classList.add('center-alt');
    },
    lunation: getLunation,
    mode: 'clock',

    /** OPEN WHEEL: ring contracts to a slim band, four-fold nav appears,
     *  interior opens for content. Sun & Moon migrate to the rim.
     *  sections: [{key,label,color}], onSelect(key) */
    setOpen(opts = {}) {
      if (api.mode === 'open') { api._updateQuarters(opts); return; }
      api.mode = 'open';
      const D = 550;
      const fade = (el, to, dur = D) => el.animate(
        { opacity: [getComputedStyle(el).opacity, to] },
        { duration: dur, fill: 'both', easing: 'ease-in-out' });
      // wedges shrink to slim band
      for (const w of refs.wedges) fade(w, 0, 400);
      for (const g of refs.glyphsIn) fade(g, 0, 350);
      fade(refs.gSheen, 0, 350);
      fade(refs.gSlim, 1);
      // bull's-eye moon + sign glyph fade out completely; text stays
      fade(refs.moonDisc, 0, 400);
      fade(refs.shadow, 0, 400);
      fade(refs.signOnMoon, 0, 300);
      refs.moonHalo.style.transition = 'stroke-opacity .4s ease';
      refs.moonHalo.style.strokeOpacity = '0';
      // hide quarters
      fade(refs.gQuarters, 0, 200);
      // bodies migrate ABOVE the ring (outer perimeter)
      const t0 = performance.now(), from = ticker.state.bodyR, to = R_PERIM;
      (function mig(nowT) {
        const p = Math.min(1, (nowT - t0) / 600);
        ticker.state.bodyR = from + (to - from) * easeOutCubic(p);
        ticker.render(new Date());
        if (p < 1) requestAnimationFrame(mig);
      })(t0);
      api._updateQuarters(opts);
    },

    _updateQuarters({ sections = [], active = null, onSelect = null } = {}) {
      refs.quarterEls.forEach((q, i) => {
        const s = sections[i];
        if (!s) { q.grp.style.display = 'none'; return; }
        q.grp.style.display = '';
        q.lbl.textContent = s.label.toUpperCase();
        q.lbl.style.fill = s.key === active ? s.color : INK_SOFT;
        q.arc.setAttribute('stroke', s.key === active ? s.color : RIM);
        q.arc.setAttribute('stroke-opacity', s.key === active ? '0.9' : '0.3');
        q.arc.setAttribute('fill-opacity', s.key === active ? '0.75' : '0.5');
        q.arc.style.filter = s.key === active ? `drop-shadow(0 0 8px ${s.color})` : '';
        q.grp.style.cursor = 'pointer';
        q.grp.onclick = () => onSelect && onSelect(s.key);
        q.grp.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect && onSelect(s.key); } };
      });
    },

    setClock() {
      if (api.mode === 'clock') return;
      api.mode = 'clock';
      const fade = (el, to, dur = 450) => el.animate(
        { opacity: [getComputedStyle(el).opacity, to] },
        { duration: dur, fill: 'both', easing: 'ease-in-out' });
      for (const w of refs.wedges) fade(w, 1);
      for (const g of refs.glyphsIn) fade(g, 1);
      fade(refs.gSheen, 1);
      fade(refs.gSlim, 0, 350);
      fade(refs.gQuarters, 0, 300);
      // restore bull's-eye
      fade(refs.moonDisc, 1, 500);
      fade(refs.shadow, 1, 500);
      fade(refs.signOnMoon, 0.92, 500);
      refs.moonHalo.style.strokeOpacity = '0.35';
      // bodies return to inner ring
      const t0 = performance.now(), from = ticker.state.bodyR, to = R_BODIES;
      (function mig(nowT) {
        const p = Math.min(1, (nowT - t0) / 600);
        ticker.state.bodyR = from + (to - from) * easeOutCubic(p);
        ticker.render(new Date());
        if (p < 1) requestAnimationFrame(mig);
      })(t0);
    },
  };
  container.__cclc = api;
  container.dataset.mountedAt = timeFmt.format(new Date());
  return api;
}
