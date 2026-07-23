// aspects.js — Sun-Moon planetary aspects.
// Each aspect: exact degree, name, glyph (Unicode or label), color, orb.
// Detection returns the tightest in-orb aspect with approaching/separating.
export const ASPECTS = [
  { deg: 0,      name: 'Conjunction',    glyph: '\u260c', color: '#4dd97a', orb: 10, noLine: true },
  { deg: 30,     name: 'Semisextile',    glyph: '\u26ba', color: '#4dd97a', orb: 5 },
  { deg: 45,     name: 'Semi-square',    glyph: '\u2220', color: '#e88a3a', orb: 5 },
  { deg: 60,     name: 'Sextile',        glyph: '\u26b9', color: '#4dd97a', orb: 10 },
  { deg: 72,     name: 'Quintile',       glyph: '\u2b20', color: '#b366ff', orb: 5 },
  { deg: 90,     name: 'Square',         glyph: '\u25a1', color: '#e84040', orb: 10 },
  { deg: 102.86, name: 'Bi-Septile',     glyph: 'S\u2082', color: '#a8d940', orb: 5 },
  { deg: 120,    name: 'Trine',          glyph: '\u25b3', color: '#4dd97a', orb: 10 },
  { deg: 135,    name: 'Sesquiquadrate', glyph: '\u26bc', color: '#e88a3a', orb: 5 },
  { deg: 144,    name: 'BiQuintile',     glyph: '\u2b202', color: '#b366ff', orb: 5 },
  { deg: 150,    name: 'Quincunx',       glyph: '\u26bb', color: '#3a6ee8', orb: 3 },
  { deg: 154.29, name: 'Triseptile',     glyph: 'S\u2083', color: '#a8d940', orb: 5 },
  { deg: 180,    name: 'Opposition',     glyph: '\u260d', color: '#e84040', orb: 10 },
];

const norm = d => ((d % 360) + 360) % 360;

// Ptolemaic aspect degrees for VOC check
const PTOLEMAIC = [0, 60, 90, 120, 180];

/**
 * Find the active Sun-Moon aspect, if any.
 * @param {number} elong - Moon-Sun elongation in degrees (0-360)
 * @returns {null | { aspect, delta, approaching, waxing }}
 */
export function findAspect(elong) {
  elong = norm(elong);
  let best = null;
  for (const asp of ASPECTS) {
    const dWax = elong - asp.deg;
    if (Math.abs(dWax) <= asp.orb) {
      const tightness = Math.abs(dWax);
      if (!best || tightness < best.tightness) {
        best = { aspect: asp, delta: dWax, approaching: dWax < 0, waxing: true, tightness };
      }
    }
    if (asp.deg > 0 && asp.deg < 180) {
      const mirror = 360 - asp.deg;
      const dWan = elong - mirror;
      if (Math.abs(dWan) <= asp.orb) {
        const tightness = Math.abs(dWan);
        if (!best || tightness < best.tightness) {
          best = { aspect: asp, delta: dWan, approaching: dWan < 0, waxing: false, tightness };
        }
      }
    }
  }
  return best;
}

/**
 * Compute Void of Course status using astronomy-engine.
 * VOC = Moon makes no more Ptolemaic aspects to traditional planets
 * before leaving its current sign.
 * @param {object} AstroEngine - the astronomy-engine module
 * @param {Date} now
 * @returns {{ isVOC: boolean, until?: Date }}
 */
export function computeVOC(A, now) {
  const PLANETS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const moonNow = A.EclipticGeoMoon(now);
  const currentSign = Math.floor(norm(moonNow.lon) / 30);
  const nextBound = ((currentSign + 1) % 12) * 30;

  // find ingress: step 30 min, then refine to 1 min
  let ingress = null;
  let t = new Date(now);
  for (let i = 0; i < 180; i++) {  // up to ~3.75 days
    t = new Date(t.getTime() + 1800000);
    const ml = norm(A.EclipticGeoMoon(t).lon);
    if (Math.floor(ml / 30) !== currentSign) {
      // refine backward in 1-min steps
      let fine = new Date(t.getTime() - 1800000);
      for (let j = 0; j < 35; j++) {
        fine = new Date(fine.getTime() + 60000);
        const ml2 = norm(A.EclipticGeoMoon(fine).lon);
        if (Math.floor(ml2 / 30) !== currentSign) { ingress = fine; break; }
      }
      if (!ingress) ingress = t;
      break;
    }
  }
  if (!ingress) return { isVOC: false };  // shouldn't happen

  // check: will any Ptolemaic aspect perfect before ingress?
  // sample every 20 min from now to ingress
  const span = ingress.getTime() - now.getTime();
  const step = Math.max(1200000, Math.min(span / 100, 1200000)); // 20 min steps
  const samples = Math.ceil(span / step);
  for (let i = 1; i <= samples; i++) {
    const st = new Date(now.getTime() + i * step);
    if (st > ingress) break;
    const moonLon = norm(A.EclipticGeoMoon(st).lon);
    for (const planet of PLANETS) {
      const pv = A.GeoVector(planet, st, true);
      const pe = A.Ecliptic(pv);
      const pLon = norm(pe.elon);
      const elong2 = norm(moonLon - pLon);
      for (const exact of PTOLEMAIC) {
        if (Math.abs(elong2 - exact) < 1.5) return { isVOC: false };
        if (exact > 0 && exact < 180) {
          if (Math.abs(elong2 - (360 - exact)) < 1.5) return { isVOC: false };
        }
      }
    }
  }
  return { isVOC: true, until: ingress };
}
