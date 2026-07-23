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

/**
 * Find the active Sun-Moon aspect, if any.
 * @param {number} elong - Moon-Sun elongation in degrees (0-360)
 * @returns {null | { aspect, delta, approaching, waxing }}
 *   delta: signed degrees from exact (negative = approaching)
 *   approaching: true if Moon hasn't reached exact yet
 *   waxing: true if on the waxing (0-180) side
 */
export function findAspect(elong) {
  elong = norm(elong);
  let best = null;
  for (const asp of ASPECTS) {
    // waxing side: elongation near asp.deg
    const dWax = elong - asp.deg;
    if (Math.abs(dWax) <= asp.orb) {
      const tightness = Math.abs(dWax);
      if (!best || tightness < best.tightness) {
        best = { aspect: asp, delta: dWax, approaching: dWax < 0, waxing: true, tightness };
      }
    }
    // waning side: elongation near (360 - asp.deg), except conjunction (0) and opposition (180)
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
