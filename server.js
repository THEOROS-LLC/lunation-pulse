// server.js — The Clairsentient Support Circle: the Record.
// One process: serves ./dist (the static site) + /api (the record).
//
// ANONYMITY CONTRACT (auditable by grep):
//   The INSERT below is the complete universe of what is remembered:
//   id · created_utc · charge · body · link · sun/moon longitudes ·
//   sign · degree · arcminute · phase · elongation.
//   There is no users table. There will never be a users table.
//   No IP, cookie, header, or account is ever written to disk.
//   Rate limiting lives in process memory only and dies with the process.
//
// MEMBERSHIP: one shared circle word proves *is a member*, never *which*.
//   Stored as scrypt hash. Rotate at will (New Moon ritual recommended).
// ADMIN: single ADMIN_KEY (env) — delete, rotate, export. Total capability.
//
// ENV:  PORT (default 8787) · ADMIN_KEY (required) · DB_PATH (default ./record.db)
//       PUBLIC_READ=true to open reads to the world (default: members only)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { getLunation } from './src/cclc/lunation.js';

const PORT = Number(process.env.PORT || 8787);
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DB_PATH = process.env.DB_PATH || './record.db';
const PUBLIC_READ = process.env.PUBLIC_READ === 'true';
const DIST = path.resolve('./dist');
if (!ADMIN_KEY) { console.error('ADMIN_KEY is required.'); process.exit(1); }

// ---------------------------------------------------------------- store ----
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS charges (
    id TEXT PRIMARY KEY,
    created_utc TEXT NOT NULL,
    charge TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    sun_lon REAL NOT NULL,
    moon_lon REAL NOT NULL,
    elong REAL NOT NULL,
    moon_sign TEXT NOT NULL,
    moon_deg INTEGER NOT NULL,
    moon_arcmin INTEGER NOT NULL,
    phase TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_created ON charges(created_utc DESC);
  CREATE INDEX IF NOT EXISTS idx_sign ON charges(moon_sign);
  CREATE TABLE IF NOT EXISTS gatherings (
    id TEXT PRIMARY KEY,
    created_utc TEXT NOT NULL,
    meeting_utc TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    sun_lon REAL NOT NULL,
    moon_lon REAL NOT NULL,
    elong REAL NOT NULL,
    moon_sign TEXT NOT NULL,
    moon_deg INTEGER NOT NULL,
    moon_arcmin INTEGER NOT NULL,
    phase TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_meeting ON gatherings(meeting_utc DESC);
  CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`);
const getConf = db.prepare('SELECT v FROM config WHERE k=?');
const setConf = db.prepare('INSERT INTO config(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v');
const insert = db.prepare(`INSERT INTO charges
  (id,created_utc,charge,body,link,sun_lon,moon_lon,elong,moon_sign,moon_deg,moon_arcmin,phase)
  VALUES (@id,@created_utc,@charge,@body,@link,@sun_lon,@moon_lon,@elong,@moon_sign,@moon_deg,@moon_arcmin,@phase)`);
const listQ = db.prepare(`SELECT * FROM charges WHERE created_utc < ? ORDER BY created_utc DESC LIMIT ?`);
const delQ = db.prepare('DELETE FROM charges WHERE id=?');
const allQ = db.prepare('SELECT * FROM charges ORDER BY created_utc ASC');
const gInsert = db.prepare(`INSERT INTO gatherings
  (id,created_utc,meeting_utc,body,link,sun_lon,moon_lon,elong,moon_sign,moon_deg,moon_arcmin,phase)
  VALUES (@id,@created_utc,@meeting_utc,@body,@link,@sun_lon,@moon_lon,@elong,@moon_sign,@moon_deg,@moon_arcmin,@phase)`);
const gList = db.prepare('SELECT * FROM gatherings ORDER BY meeting_utc DESC LIMIT 60');
const gDel = db.prepare('DELETE FROM gatherings WHERE id=?');

// ------------------------------------------------------------ circle word --
function hashWord(word, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const h = crypto.scryptSync(word.normalize('NFKC'), salt, 32);
  return { salt: salt.toString('hex'), hash: h.toString('hex') };
}
function wordOK(word) {
  if (typeof word !== 'string' || !word) return false;
  const saltHex = getConf.get('word_salt')?.v;
  const hashHex = getConf.get('word_hash')?.v;
  if (!saltHex || !hashHex) return false;           // no word set yet
  const { hash } = hashWord(word, saltHex);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashHex, 'hex'));
}
function adminOK(key) {
  if (typeof key !== 'string' || !key) return false;
  const a = crypto.createHash('sha256').update(key).digest();
  const b = crypto.createHash('sha256').update(ADMIN_KEY).digest();
  return crypto.timingSafeEqual(a, b);
}

// -------------------------------------------------- rate limit (RAM only) --
const buckets = new Map();   // ip -> [timestamps]  — never persisted, ever
function limited(ip, max = 12, windowMs = 3600e3) {
  const now = Date.now();
  const arr = (buckets.get(ip) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { buckets.set(ip, arr); return true; }
  arr.push(now); buckets.set(ip, arr); return false;
}
setInterval(() => { for (const [k, v] of buckets) if (!v.length) buckets.delete(k); }, 600e3).unref();

// ---------------------------------------------------------------- helpers --
const CHARGES = new Set(['dream', 'day', 'emotion']);
function json(res, code, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(b);
}
function readBody(req, limit = 32768) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
function cleanLink(s) {
  if (!s) return null;
  s = String(s).trim().slice(0, 300);
  if (!/^https?:\/\/[^\s]+$/i.test(s)) return null;
  return s;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.txt': 'text/plain', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function serveStatic(req, res, urlPath) {
  let p = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  try {
    let st = fs.statSync(file, { throwIfNoEntry: false });
    if (st?.isDirectory()) { file = path.join(file, 'index.html'); st = fs.statSync(file, { throwIfNoEntry: false }); }
    if (!st) {
      const asDir = path.join(DIST, p, 'index.html');
      if (fs.existsSync(asDir)) { file = asDir; }
      else { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(500); res.end(); }
}

// ------------------------------------------------------------------ http ---
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const ip = req.socket.remoteAddress || '?';   // RAM rate-limit only — never stored

  try {
    // ---- the record: read
    if (req.method === 'GET' && u.pathname === '/api/record') {
      const word = req.headers['x-circle-word'];
      if (!PUBLIC_READ && !wordOK(word)) return json(res, 401, { error: 'circle word required' });
      const before = u.searchParams.get('before') || '9999';
      const rows = listQ.all(before, 200);
      return json(res, 200, { charges: rows });
    }

    // ---- the record: write (members only, sky computed HERE, at receipt)
    if (req.method === 'POST' && u.pathname === '/api/charge') {
      if (limited(ip)) return json(res, 429, { error: 'the record rests a moment — try again soon' });
      const b = await readBody(req);
      if (!wordOK(b.word)) return json(res, 401, { error: 'that is not the circle word' });
      const charge = String(b.charge || '').toLowerCase();
      if (!CHARGES.has(charge)) return json(res, 400, { error: 'charge must be dream, day, or emotion' });
      const body = String(b.body || '').trim();
      if (body.length < 3 || body.length > 2000) return json(res, 400, { error: 'the charge needs 3–2000 characters' });
      const now = new Date();
      const L = getLunation(now);           // server truth — client clocks cannot spoof the sky
      const row = {
        id: crypto.randomBytes(8).toString('base64url'),
        created_utc: now.toISOString(),
        charge, body,
        link: cleanLink(b.link),
        sun_lon: L.sunLon, moon_lon: L.moonLon, elong: L.elong,
        moon_sign: L.sign, moon_deg: L.deg, moon_arcmin: L.arcmin, phase: L.phase,
      };
      insert.run(row);
      return json(res, 201, { charge: row });
    }

    // ---- admin: total capability
    if (req.method === 'POST' && u.pathname === '/api/admin/delete') {
      const b = await readBody(req);
      if (!adminOK(b.key)) return json(res, 401, { error: 'no' });
      const r = delQ.run(String(b.id || ''));
      return json(res, 200, { deleted: r.changes });
    }
    if (req.method === 'POST' && u.pathname === '/api/admin/rotate') {
      const b = await readBody(req);
      if (!adminOK(b.key)) return json(res, 401, { error: 'no' });
      const w = String(b.word || '');
      if (w.length < 4) return json(res, 400, { error: 'word too short' });
      const { salt, hash } = hashWord(w);
      setConf.run('word_salt', salt); setConf.run('word_hash', hash);
      return json(res, 200, { rotated: true });
    }
    if (req.method === 'GET' && u.pathname === '/api/admin/export') {
      // key via header preferred — query strings land in host access logs
      if (!adminOK(req.headers['x-admin-key'] || u.searchParams.get('key'))) return json(res, 401, { error: 'no' });
      res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
      for (const row of allQ.iterate()) res.write(JSON.stringify(row) + '\n');
      return res.end();
    }

    // ---- the gathering: member read · admin write (same word, same key)
    if (req.method === 'GET' && u.pathname === '/api/gatherings') {
      const w = req.headers['x-circle-word'];
      if (!PUBLIC_READ && !wordOK(w)) return json(res, 401, { error: 'circle word required' });
      return json(res, 200, { gatherings: gList.all() });
    }
    if (req.method === 'POST' && u.pathname === '/api/admin/gathering') {
      const b = await readBody(req);
      if (!adminOK(b.key)) return json(res, 401, { error: 'no' });
      const body = String(b.body || '').trim();
      if (body.length < 3 || body.length > 2000) return json(res, 400, { error: 'announcement needs 3\u20132000 characters' });
      const mt = new Date(String(b.meeting_utc || ''));
      if (isNaN(mt) || Math.abs(mt - Date.now()) > 2 * 365 * 864e5)
        return json(res, 400, { error: 'meeting time missing or out of range' });
      const now = new Date();
      const L = getLunation(now);
      const row = {
        id: crypto.randomBytes(8).toString('base64url'),
        created_utc: now.toISOString(),
        meeting_utc: mt.toISOString(),
        body, link: cleanLink(b.link),
        sun_lon: L.sunLon, moon_lon: L.moonLon, elong: L.elong,
        moon_sign: L.sign, moon_deg: L.deg, moon_arcmin: L.arcmin, phase: L.phase,
      };
      gInsert.run(row);
      return json(res, 201, { gathering: row });
    }
    if (req.method === 'POST' && u.pathname === '/api/admin/gathering_delete') {
      const b = await readBody(req);
      if (!adminOK(b.key)) return json(res, 401, { error: 'no' });
      return json(res, 200, { deleted: gDel.run(String(b.id || '')).changes });
    }

    if (u.pathname.startsWith('/api/')) return json(res, 404, { error: 'unknown' });
    return serveStatic(req, res, u.pathname);
  } catch (e) {
    return json(res, e.message === 'too large' ? 413 : 400, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`the record is listening on :${PORT}  (public_read=${PUBLIC_READ})`));
