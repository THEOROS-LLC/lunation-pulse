// gathering.js — The Gathering: the monthly circle, announced.
// Same word as the record; same admin key; the clock steady at center.
import { getLunation } from '../cclc/lunation.js';   // shared chunk with the clock — no extra weight

const $ = id => document.getElementById(id);
const pad2 = n => String(n).padStart(2, '0');
const word = {
  get: () => { try { return sessionStorage.getItem('circle.word') || ''; } catch { return ''; } },
  set: w => { try { sessionStorage.setItem('circle.word', w); } catch {} },
};
const admin = {
  get: () => { try { return sessionStorage.getItem('circle.admin') || ''; } catch { return ''; } },
  set: k => { try { sessionStorage.setItem('circle.admin', k); } catch {} },
};

let items = [];

const whenLong = iso => new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
}).format(new Date(iso));
const whenTime = iso => new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(iso));
const postedStamp = g => `Posted under Moon ${g.moon_deg}\u00b0${pad2(g.moon_arcmin)}\u2032 ${g.moon_sign} \u00b7 ${g.phase}`;
const meetingSky = iso => {
  const L = getLunation(new Date(iso));
  return `Under Moon ${L.deg}\u00b0${pad2(L.arcmin)}\u2032 ${L.sign} \u00b7 ${L.phase}`;
};

function delBtn(g) {
  const b = document.createElement('button');
  b.className = 'charge-del';
  b.textContent = 'remove';
  b.addEventListener('click', async () => {
    const r = await fetch('/api/admin/gathering_delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: admin.get(), id: g.id }),
    }).then(r => r.json()).catch(() => ({}));
    if (r.deleted) { items = items.filter(x => x.id !== g.id); render(); }
  });
  return b;
}

function render() {
  const now = Date.now();
  const future = items.filter(g => new Date(g.meeting_utc) >= now)
                      .sort((a, b) => new Date(a.meeting_utc) - new Date(b.meeting_utc));
  const past = items.filter(g => new Date(g.meeting_utc) < now);
  const next = future[0];

  const hero = $('nextGathering');
  hero.textContent = '';
  if (next) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'g-eyebrow'; eyebrow.textContent = 'The Next Gathering';
    const date = document.createElement('p');
    date.className = 'g-date'; date.textContent = whenLong(next.meeting_utc);
    const time = document.createElement('p');
    time.className = 'g-time'; time.textContent = `${whenTime(next.meeting_utc)} \u2014 your local time`;
    const sky = document.createElement('p');
    sky.className = 'g-sky'; sky.textContent = meetingSky(next.meeting_utc);
    const body = document.createElement('p');
    body.className = 'charge-body'; body.textContent = next.body;
    hero.append(eyebrow, date, time, sky, body);
    if (next.link && /^https?:\/\//i.test(next.link)) {
      const a = document.createElement('a');
      a.className = 'cta'; a.href = next.link; a.rel = 'noopener'; a.target = '_blank';
      a.textContent = 'Join the circle';
      hero.append(a);
    }
    const posted = document.createElement('p');
    posted.className = 'g-posted'; posted.textContent = postedStamp(next);
    hero.append(posted);
    if (admin.get()) hero.append(delBtn(next));
    hero.hidden = false;
  } else {
    const q = document.createElement('p');
    q.className = 'prose'; q.textContent = 'No gathering is announced yet. The clock keeps turning.';
    hero.append(q); hero.hidden = false;
  }

  const list = $('pastList');
  list.textContent = '';
  const rest = [...future.slice(1), ...past];
  for (const g of rest) {
    const el = document.createElement('article');
    el.className = 'charge-card';
    const head = document.createElement('header');
    const k = document.createElement('span');
    k.className = 'charge-kind';
    k.textContent = new Date(g.meeting_utc) >= now ? 'Upcoming' : 'Held';
    const w = document.createElement('span');
    w.className = 'charge-when';
    w.textContent = `${whenLong(g.meeting_utc)} \u00b7 ${whenTime(g.meeting_utc)}`;
    head.append(k, w);
    const body = document.createElement('p');
    body.className = 'charge-body'; body.textContent = g.body;
    const stamp = document.createElement('p');
    stamp.className = 'charge-stamp'; stamp.textContent = `${meetingSky(g.meeting_utc)} \u00b7 ${postedStamp(g)}`;
    el.append(head, body, stamp);
    if (admin.get()) el.append(delBtn(g));
    list.append(el);
  }
  $('pastH').hidden = rest.length === 0;
}

async function fetchGatherings() {
  const r = await fetch('/api/gatherings', { headers: { 'x-circle-word': word.get() } });
  if (r.status === 401) return false;
  items = (await r.json()).gatherings || [];
  return true;
}

function showLocked(msg) { $('locked').hidden = false; $('unlocked').hidden = true; if (msg) $('lockMsg').textContent = msg; }
function showUnlocked() {
  $('locked').hidden = true; $('unlocked').hidden = false;
  $('composerWrap').hidden = !admin.get();
  render();
}

function wireComposer() {
  $('gComposer').addEventListener('submit', async e => {
    e.preventDefault();
    $('gMsg').textContent = '';
    const dtLocal = $('gWhen').value;                     // admin's local wall time
    const payload = {
      key: admin.get(),
      meeting_utc: dtLocal ? new Date(dtLocal).toISOString() : '',
      body: $('gBody').value,
      link: $('gLink').value,
    };
    const r = await fetch('/api/admin/gathering', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json()).catch(() => ({ error: 'unreachable' }));
    if (r.error) { $('gMsg').textContent = r.error; return; }
    items.unshift(r.gathering);
    $('gBody').value = ''; $('gLink').value = '';
    $('gMsg').textContent = 'Announced.';
    render();
  });
}

export function initGathering() {
  const page = $('gatheringPage');
  if (!page || page.__init) return;
  page.__init = true;
  if (location.hash === '#admin' && !admin.get()) {
    const k = prompt('Admin key:');
    if (k) admin.set(k);
  }
  $('unlockForm').addEventListener('submit', e => {
    e.preventDefault();
    word.set($('wordInput').value.trim());
    fetchGatherings().then(ok => ok ? showUnlocked() : showLocked('That is not the circle word.'));
  });
  wireComposer();
  if (word.get()) fetchGatherings().then(ok => ok ? showUnlocked() : showLocked(''));
  else showLocked('');
}
