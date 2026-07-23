// glyphs.js — authored SVG stroke paths, 100x100 box, centered on (50,50).
// Paths, not fonts: identical rendering on every device (iOS substitutes
// zodiac codepoints with emoji — unacceptable for the manuscript register).
// v0.1 stylization; a bespoke refinement pass is queued (see README).
export const GLYPHS = {
  aries:       'M50 84 V46 M50 46 C50 20 24 14 21 34 M50 46 C50 20 76 14 79 34',
  taurus:      'M29 61 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 M24 22 C24 46 76 46 76 22',
  gemini:      'M24 22 C40 31 60 31 76 22 M24 78 C40 69 60 69 76 78 M37 28 V72 M63 28 V72',
  cancer:      'M41 38 a11 11 0 1 0 -22 0 a11 11 0 1 0 22 0 M41 33 C60 26 74 33 78 46 M59 62 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 M59 67 C40 74 26 67 22 54',
  leo:         'M46 61 a12 12 0 1 0 -24 0 a12 12 0 1 0 24 0 M40 50 C40 24 68 20 72 40 C75 54 61 58 61 68 C61 80 73 83 78 74',
  virgo:       'M24 70 V38 C24 30 34 30 34 38 V70 M34 38 C34 30 44 30 44 38 V60 C44 74 56 78 64 70 M44 52 C56 44 70 50 68 62 C66 76 50 78 42 70',
  libra:       'M20 76 H80 M20 60 H36 C36 40 64 40 64 60 H80',
  scorpio:     'M20 70 V38 C20 30 30 30 30 38 V70 M30 38 C30 30 40 30 40 38 V60 C40 72 48 76 56 70 L64 63 M64 63 L54 61 M64 63 L62 73',
  sagittarius: 'M28 72 L74 26 M74 26 H53 M74 26 V47 M36 46 L54 64',
  capricorn:   'M20 34 C24 24 34 24 36 34 L42 60 L52 30 L56 54 C58 68 72 70 74 58 C76 46 62 42 58 52 C54 62 62 72 72 70',
  aquarius:    'M20 40 L32 31 L44 40 L56 31 L68 40 L80 31 M20 65 L32 56 L44 65 L56 56 L68 65 L80 56',
  pisces:      'M33 22 C51 40 51 60 33 78 M67 22 C49 40 49 60 67 78 M28 50 H72',
  sun:         'M50 50 m-25 0 a25 25 0 1 0 50 0 a25 25 0 1 0 -50 0',
  moonBody:    'M58 12 A38 38 0 0 0 58 88 A48 48 0 0 1 58 12 Z',
};
export const SIGN_KEYS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
