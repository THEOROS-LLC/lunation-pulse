// lunation.js — the house wrapper. THIS is the reusable spine component.
// Backend: astronomy-engine 2.1.19, exact-pinned (integrity in package-lock).
// Swappable to the house kernel at any time behind this seam.
// All longitudes are geocentric ecliptic OF DATE (tropical zodiac) —
// verified vs Swiss Ephemeris 2.10.03: max delta 0.069 arcmin (see VERIFY/).
import * as A from 'astronomy-engine';

export const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const PHASES = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous',
  'Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];

const norm = d => ((d % 360) + 360) % 360;

/** Full lunation state for a moment. Everything the wheel needs, nothing more. */
export function getLunation(date = new Date()) {
  const sunLon  = norm(A.SunPosition(date).elon);      // ecliptic of date
  const moonLon = norm(A.EclipticGeoMoon(date).lon);   // ecliptic of date
  const elong   = norm(moonLon - sunLon);              // 0 new · 90 FQ · 180 full · 270 LQ
  const illum   = (1 - Math.cos(elong * Math.PI / 180)) / 2;
  const phase   = PHASES[Math.floor(((elong + 22.5) % 360) / 45)];
  const signIdx = Math.floor(moonLon / 30);
  const degIn   = moonLon % 30;
  return {
    date, sunLon, moonLon, elong, illum, phase, signIdx,
    sign: SIGN_NAMES[signIdx],
    deg: Math.floor(degIn),
    arcmin: Math.floor((degIn % 1) * 60),
  };
}

/** Zodiacal longitude -> screen angle. 0° Aries at LEFT, counterclockwise.
 *  One transform governs the entire wheel. */
export const wheelAngle = lon => (180 + norm(lon)) % 360;

/** Screen coordinates for a longitude at radius r (SVG y-down handled here). */
export function wheelXY(lon, r, c = 500) {
  const t = wheelAngle(lon) * Math.PI / 180;
  return [c + r * Math.cos(t), c - r * Math.sin(t)];
}
