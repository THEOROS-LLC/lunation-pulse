// record.js — The Clairsentient Support Circle, client side.
// The clock stays steady at center; the record walks around it.
// Every node sits at the Moon's longitude at the moment it was charged.
import { SIGN_COLORS } from '../cclc/palette.js';

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NS = 'http://www.w3.org/2000/svg';
const OC = 660;                        // overlay center (viewBox 1320)
const R_BASE = 500, R_STEP = 30;       // orbit bands outside the clock rim
const wheelAngle = lon => (180 + ((lon % 360) + 360) % 360) % 360;   // mirrors the geometry law
const MARK = {
  dream:   'M4 -5 A7 7 0 1 0 4 5 A5.4 5.4 0 0 1 4 -5 Z',            // crescent
  day:     'M0 0 m-3.2 0 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0',// sun-dot
  emotion: 'M0 5 C-6 0 -4 -5.5 0 -2.5 C4 -5.5 6 0 0 5 Z',            // small heart
};
const CHARGE_LABEL = { dream: 'A Dream', day: 'A Day', emotion: 'An Emotion' };

const $ = id => document.getElementById(id);
const word = {
  get: () => { try { return sessionStorage.getItem('circle.word') || ''; } catch { return ''; } },
  set: w => { try { sessionStorage.setItem('circle.word', w); } catch {} },
};
const admin = {
  get: () => { try { return sessionStorage.getItem('circle.admin') || ''; } catch { return ''; } },
  set: k => { try { sessionStorage.setItem('circle.admin', k); } catch {} },
};

let items = [];
let selected = null;

// ------------------------------------------------------------ formatting --
const dms = lon => {
  const idx = Math.floor((((lon % 360) + 360) % 360) / 30);
  const d = ((lon % 360) + 360) % 360 % 30;
  return { sign: SIGNS[idx], idx, deg: Math.floor(d), min: Math.floor((d % 1) * 60) };
};
const pad2 = n => String(n).padStart(2, '0');
const stampMoon = c => `Moon ${c.moon_deg}\u00b0${pad2(c.moon_arcmin)}\u2032 ${c.moon_sign} \u00b7 ${c.phase}`;
const stampSun = c => { const s = dms(c.sun_lon); return `Sun ${s.deg}\u00b0${pad2(s.min)}\u2032 ${s.sign}`; };
const stampWhen = c => new Intl.DateTimeFormat('en-US', {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(c.created_utc));

// ----------------------------------------------------------------- cards --
function cardEl(c, { withDelete } = {}) {
  const el = document.createElement('article');
  el.className = 'charge-card';
  el.dataset.id = c.id;
  const head = document.createElement('header');
  const kind = document.createElement('span');
  kind.className = `charge-kind kind-${c.charge}`;
  kind.textContent = CHARGE_LABEL[c.charge] || c.charge;
  const when = document.createElement('span');
  when.className = 'charge-when';
  when.textContent = stampWhen(c);
  head.append(kind, when);
  const body = document.createElement('p');
  body.className = 'charge-body';
  body.textContent = c.body;                       // textContent only — always
  el.append(head, body);
  if (c.link && /^https?:\/\//i.test(c.link)) {
    const a = document.createElement('a');
    a.className = 'charge-link';
    a.href = c.link; a.rel = 'nofollow noopener ugc'; a.target = '_blank';
    a.textContent = c.link.replace(/^https?:\/\//i, '').slice(0, 60);
    el.append(a);
  }
  const stamp = document.createElement('p');
  stamp.className = 'charge-stamp';
  const dot = document.createElement('span');
  dot.className = 'stamp-dot';
  dot.style.background = SIGN_COLORS[dms(c.moon_lon).idx];
  stamp.append(dot, document.createTextNode(`${stampMoon(c)} \u00b7 ${stampSun(c)}`));
  el.append(stamp);
  if (withDelete && admin.get()) {
    const del = document.createElement('button');
    del.className = 'charge-del';
    del.textContent = 'remove from the record';
    del.addEventListener('click', async () => {
      const r = await fetch('/api/admin/delete', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: admin.get(), id: c.id }),
      }).then(r => r.json()).catch(() => ({}));
      if (r.deleted) { items = items.filter(x => x.id !== c.id); renderAll(); }
    });
    el.append(del);
  }
  return el;
}

// ----------------------------------------------------------------- orbit --
function renderOrbit() {
  const svg = $('orbit');
  if (!svg) return;
  svg.textContent = '';
  const buckets = new Map();
  for (const c of items) {
    const ang = wheelAngle(c.moon_lon);
    const cell = Math.round(ang / 4) * 4;
    const n = buckets.get(cell) || 0;
    buckets.set(cell, n + 1);
    const r = R_BASE + R_STEP * Math.min(n, 2);
    const t = ang * Math.PI / 180;
    const x = OC + r * Math.cos(t), y = OC - r * Math.sin(t);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'orb-node' + (selected === c.id ? ' sel' : ''));
    g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${CHARGE_LABEL[c.charge]} \u2014 ${stampMoon(c)}`);
    const halo = document.createElementNS(NS, 'circle');
    halo.setAttribute('r', '15'); halo.setAttribute('class', 'orb-halo');
    halo.setAttribute('fill', SIGN_COLORS[dms(c.moon_lon).idx]);
    const dotEl = document.createElementNS(NS, 'circle');
    dotEl.setAttribute('r', '10.5');
    dotEl.setAttribute('fill', SIGN_COLORS[dms(c.moon_lon).idx]);
    dotEl.setAttribute('class', 'orb-dot');
    const mark = document.createElementNS(NS, 'path');
    mark.setAttribute('d', MARK[c.charge] || MARK.day);
    mark.setAttribute('class', 'orb-mark');
    g.append(halo, dotEl, mark);
    const open = () => select(c.id);
    g.addEventListener('click', open);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    svg.append(g);
  }
}

function select(id) {
  selected = id;
  const c = items.find(x => x.id === id);
  const panel = $('reading');
  panel.textContent = '';
  if (c) { panel.append(cardEl(c, { withDelete: true })); panel.hidden = false; }
  renderOrbit();
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderList() {
  const list = $('recordList');
  list.textContent = '';
  for (const c of items) list.append(cardEl(c, { withDelete: true }));
  $('recordNote').textContent = items.length >= 200
    ? 'The orbit shows the latest 200 charges. The full record is kept.'
    : items.length ? '' : 'The record is open. Charge the first entry.';
}

function renderAll() { renderOrbit(); renderList(); if (selected && !items.find(x => x.id === selected)) { selected = null; $('reading').hidden = true; } }

// ------------------------------------------------------------------ flow --
async function fetchRecord() {
  const r = await fetch('/api/record', { headers: { 'x-circle-word': word.get() } });
  if (r.status === 401) return false;
  const d = await r.json();
  items = d.charges || [];
  return true;
}

function showLocked(msg) {
  $('locked').hidden = false;
  $('unlocked').hidden = true;
  if (msg) $('lockMsg').textContent = msg;
}
function showUnlocked() {
  $('locked').hidden = true;
  $('unlocked').hidden = false;
  renderAll();
}

async function tryUnlock(w) {
  word.set(w);
  if (await fetchRecord()) { showUnlocked(); return true; }
  showLocked('That is not the circle word.');
  return false;
}

function wireComposer() {
  const form = $('composer');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('chargeBtn');
    btn.disabled = true; $('composeMsg').textContent = '';
    const payload = {
      word: word.get(),
      charge: (form.querySelector('input[name=charge]:checked') || {}).value,
      body: $('chargeBody').value,
      link: $('chargeLink').value,
    };
    const r = await fetch('/api/charge', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json()).catch(() => ({ error: 'the record is unreachable' }));
    btn.disabled = false;
    if (r.error) { $('composeMsg').textContent = r.error; return; }
    items.unshift(r.charge);
    $('chargeBody').value = ''; $('chargeLink').value = '';
    renderAll();
    select(r.charge.id);
    $('composeMsg').textContent = 'Received. The sky was stamped at the moment the record took it.';
  });
}

export function initRecord() {
  const page = $('circlePage');
  if (!page || page.__init) return;
  page.__init = true;

  if (location.hash === '#admin' && !admin.get()) {
    const k = prompt('Admin key:');
    if (k) admin.set(k);
  }

  $('unlockForm').addEventListener('submit', e => {
    e.preventDefault();
    tryUnlock($('wordInput').value.trim());
  });
  wireComposer();

  if (word.get()) {
    fetchRecord().then(ok => ok ? showUnlocked() : showLocked(''));
  } else showLocked('');
}
