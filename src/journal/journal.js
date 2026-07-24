// journal.js — The Lunation Journal + Lunar Expressions.
// The interior of the open wheel. The clock never stops around it.
const SECTIONS = [
  { key: 'dream',      label: 'Dreams',      color: '#6ea8ff' },
  { key: 'mood',       label: 'Moods',       color: '#e87aa0' },
  { key: 'experience', label: 'Experiences', color: '#35d0b0' },
  { key: 'story',      label: 'Stories',     color: '#ffcc66' },
];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.key, s]));
const $ = id => document.getElementById(id);
const pad2 = n => String(n).padStart(2, '0');

const api = {
  async call(path, opts = {}) {
    const r = await fetch(path, {
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, ...d };
  },
  me: () => api.call('/api/auth/me'),
  signup: (b) => api.call('/api/auth/signup', { method: 'POST', body: b }),
  login: (b) => api.call('/api/auth/login', { method: 'POST', body: b }),
  logout: () => api.call('/api/auth/logout', { method: 'POST' }),
  entries: (dir) => api.call('/api/journal/entries' + (dir ? `?directory=${encodeURIComponent(dir)}` : '')),
  post: (b) => api.call('/api/journal/entry', { method: 'POST', body: b }),
  patch: (b) => api.call('/api/journal/patch', { method: 'POST', body: b }),
  dirs: () => api.call('/api/journal/dirs'),
  mkdir: (name) => api.call('/api/journal/dir', { method: 'POST', body: { name } }),
  expressions: (s) => api.call(`/api/expressions?section=${s}`),
  comments: (id) => api.call(`/api/expressions/comments?entry=${encodeURIComponent(id)}`),
  comment: (b) => api.call('/api/expressions/comment', { method: 'POST', body: b }),
};

const skyStamp = e =>
  `Moon ${e.moon_deg}\u00b0${pad2(e.moon_arcmin)}\u2032 ${e.moon_sign} \u00b7 ${e.phase}`;
const whenStamp = iso => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(iso));

// ------------------------------------------------------------ components --
function authPanel(onAuthed) {
  const el = document.createElement('div');
  el.className = 'jr-auth';
  el.innerHTML = `
    <h2 class="jr-h">The Lunation Journal</h2>
    <p class="jr-sub">Your record, kept under the actual Moon.</p>
    <div class="jr-tabs" role="tablist">
      <button class="jr-tab on" data-t="in">Sign in</button>
      <button class="jr-tab" data-t="up">Begin a journal</button>
    </div>
    <form class="jr-form">
      <input name="email" type="email" placeholder="email" required autocomplete="email" />
      <input name="password" type="password" placeholder="password" required autocomplete="current-password" />
      <input name="name" type="text" placeholder="name (optional \u2014 blank stays anonymous)" class="jr-namefield" hidden />
      <button type="submit" class="cta">Enter</button>
      <p class="jr-msg" role="status"></p>
    </form>`;
  let mode = 'in';
  const msg = el.querySelector('.jr-msg');
  el.querySelectorAll('.jr-tab').forEach(t => t.addEventListener('click', () => {
    mode = t.dataset.t;
    el.querySelectorAll('.jr-tab').forEach(x => x.classList.toggle('on', x === t));
    el.querySelector('.jr-namefield').hidden = mode === 'in';
    msg.textContent = '';
  }));
  el.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = { email: f.get('email'), password: f.get('password'), name: f.get('name') };
    const r = mode === 'up' ? await api.signup(body) : await api.login(body);
    if (!r.ok) { msg.textContent = r.error || 'something slipped'; return; }
    onAuthed(r.member);
  });
  return el;
}

function composer({ dirs, onPosted, defaultSection }) {
  const el = document.createElement('form');
  el.className = 'jr-composer';
  const pills = SECTIONS.map((s, i) =>
    `<label class="jr-pill" style="--pc:${s.color}">
       <input type="radio" name="section" value="${s.key}" ${s.key === (defaultSection || 'dream') ? 'checked' : ''} />
       <span>${s.label.replace(/s$/, '')}</span></label>`).join('');
  const dirOpts = ['<option value="">\u2014 no directory \u2014</option>']
    .concat(dirs.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`)).join('');
  el.innerHTML = `
    <div class="jr-pills">${pills}</div>
    <textarea name="body" rows="3" maxlength="4000" required
      placeholder="What the Moon held\u2026 stamped with her exact place the moment you press Express."></textarea>
    <div class="jr-comprow">
      <select name="directory_id" class="jr-select">${dirOpts}</select>
      <label class="jr-vis"><input type="checkbox" name="pub" />
        <span>Share to the circle</span></label>
      <button type="submit" class="cta">Express</button>
    </div>
    <p class="jr-msg" role="status"></p>`;
  el.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(el);
    const r = await api.post({
      section: f.get('section'), body: f.get('body'),
      visibility: f.get('pub') ? 'public' : 'private',
      directory_id: f.get('directory_id') || null,
    });
    const msg = el.querySelector('.jr-msg');
    if (!r.ok) { msg.textContent = r.error || 'the journal is unreachable'; return; }
    el.querySelector('textarea').value = '';
    msg.textContent = r.entry.visibility === 'public'
      ? 'Expressed \u2014 kept in your journal and shared to the circle.'
      : 'Kept. Yours alone.';
    onPosted(r.entry);
  });
  return el;
}

function escapeHtml(s) {
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

function entryCard(e, { mine, dirs, onChanged, onOpenThread }) {
  const s = SEC[e.section] || SEC.dream;
  const el = document.createElement('article');
  el.className = 'jr-card';
  el.style.setProperty('--pc', s.color);
  const head = document.createElement('header');
  head.innerHTML = `<span class="jr-sec">${s.label.replace(/s$/, '')}</span>
    <span class="jr-when">${whenStamp(e.created_utc)}</span>`;
  const body = document.createElement('p');
  body.className = 'jr-body';
  body.textContent = e.body;
  const stamp = document.createElement('p');
  stamp.className = 'jr-stamp';
  stamp.textContent = skyStamp(e) + (e.display_name != null && !mine
    ? ` \u00b7 ${e.display_name || 'a member'}` : '');
  el.append(head, body, stamp);
  if (mine) {
    const row = document.createElement('div');
    row.className = 'jr-cardrow';
    const vis = document.createElement('button');
    vis.type = 'button';
    vis.className = 'jr-mini';
    vis.textContent = e.visibility === 'public' ? 'Shared \u2014 make private' : 'Private \u2014 share it';
    vis.addEventListener('click', async () => {
      const r = await api.patch({ id: e.id, visibility: e.visibility === 'public' ? 'private' : 'public' });
      if (r.ok) { e.visibility = r.entry.visibility; onChanged(); }
    });
    row.append(vis);
    if (e.visibility === 'public') {
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'jr-mini';
      view.textContent = 'View in Expressions \u2192';
      view.addEventListener('click', () => onOpenThread(e));
      row.append(view);
    }
    el.append(row);
  } else if (onOpenThread) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => onOpenThread(e));
    const cc = document.createElement('p');
    cc.className = 'jr-ccount';
    cc.textContent = e.comments === 1 ? '1 reflection' : `${e.comments || 0} reflections`;
    el.append(cc);
  }
  return el;
}

function threadView(entry, { back }) {
  const el = document.createElement('div');
  el.className = 'jr-thread';
  const backBtn = document.createElement('button');
  backBtn.className = 'jr-mini';
  backBtn.textContent = '\u2190 back';
  backBtn.addEventListener('click', back);
  el.append(backBtn);
  el.append(entryCard(entry, { mine: false, onOpenThread: null }));
  const list = document.createElement('div');
  list.className = 'jr-comments';
  el.append(list);
  const form = document.createElement('form');
  form.className = 'jr-commentform';
  form.innerHTML = `
    <textarea name="body" rows="2" maxlength="2000" required placeholder="Reflect back\u2026"></textarea>
    <button type="submit" class="cta">Reflect</button>`;
  el.append(form);
  async function load() {
    const r = await api.comments(entry.id);
    list.textContent = '';
    for (const c of (r.comments || [])) {
      const card = document.createElement('div');
      card.className = 'jr-comment';
      const b = document.createElement('p');
      b.textContent = c.body;
      const st = document.createElement('p');
      st.className = 'jr-stamp';
      st.textContent = `${c.display_name || 'a member'} \u00b7 ${skyStamp(c)} \u00b7 ${whenStamp(c.created_utc)}`;
      card.append(b, st);
      list.append(card);
    }
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = new FormData(form).get('body');
    const r = await api.comment({ entry_id: entry.id, body });
    if (r.ok) { form.querySelector('textarea').value = ''; load(); }
  });
  load();
  return el;
}

// ------------------------------------------------------------------ pages --
export async function initJournal() {
  const page = $('journalPage');
  if (!page || page.__init) return;
  page.__init = true;
  const room = $('room');
  const clockEl = document.getElementById('cclc');
  const clock = clockEl && clockEl.__cclc;

  const me = await api.me();
  if (!me.ok) {
    if (clock) clock.setClock();
    room.textContent = '';
    room.append(authPanel(() => { page.__init = false; initJournal(); }));
    return;
  }

  let dirs = (await api.dirs()).directories || [];
  let activeDir = null;
  let entries = [];
  let activeSection = 'dream';

  if (clock) clock.setOpen({
    sections: [], active: null, onSelect: () => {},
  });

  async function load() {
    entries = (await api.entries(activeDir)).entries || [];
    render();
  }

  function render() {
    if (clock) clock.setOpen({ sections: [], active: null, onSelect: () => {} });
    room.textContent = '';
    // header row: identity + logout
    const top = document.createElement('div');
    top.className = 'jr-top';
    top.innerHTML = `<span>${escapeHtml(me.member.name || 'anonymous journal')}</span>`;
    const out = document.createElement('button');
    out.className = 'jr-mini'; out.textContent = 'sign out';
    out.addEventListener('click', async () => { await api.logout(); location.reload(); });
    top.append(out);
    room.append(top);
    // composer
    room.append(composer({ dirs, defaultSection: activeSection, onPosted: () => load() }));
    // directory chips
    const chips = document.createElement('div');
    chips.className = 'jr-chips';
    const mk = (label, id) => {
      const c = document.createElement('button');
      c.className = 'jr-chip' + (activeDir === id ? ' on' : '');
      c.textContent = label;
      c.addEventListener('click', () => { activeDir = id; load(); });
      return c;
    };
    chips.append(mk('All', null));
    for (const d of dirs) chips.append(mk(d.name, d.id));
    const add = document.createElement('button');
    add.className = 'jr-chip';
    add.textContent = '+ directory';
    add.addEventListener('click', async () => {
      const name = prompt('Name the directory:');
      if (!name) return;
      const r = await api.mkdir(name);
      if (r.ok) { dirs.push(r.directory); render(); }
    });
    chips.append(add);
    room.append(chips);
    // entries
    const list = document.createElement('div');
    list.className = 'jr-list';
    for (const e of entries) {
      list.append(entryCard(e, {
        mine: true, dirs, onChanged: render,
        onOpenThread: (entry) => { location.href = `/expressions/#${entry.section}:${entry.id}`; },
      }));
    }
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'jr-sub';
      empty.textContent = 'The journal is open. Express the first entry.';
      list.append(empty);
    }
    room.append(list);
  }
  await load();
}

export async function initExpressions() {
  const page = $('expressionsPage');
  if (!page || page.__init) return;
  page.__init = true;
  const room = $('room');
  const clockEl = document.getElementById('cclc');
  const clock = clockEl && clockEl.__cclc;

  const me = await api.me();
  if (!me.ok) {
    if (clock) clock.setClock();
    room.textContent = '';
    room.append(authPanel(() => { page.__init = false; initExpressions(); }));
    return;
  }

  let activeSection = 'dream';
  let openEntry = null;
  const hash = location.hash.slice(1);
  if (hash) {
    const [sec, eid] = hash.split(':');
    if (SEC[sec]) activeSection = sec;
    if (eid) openEntry = { id: eid, pending: true };
  }

  function syncWheel() {
    if (clock) clock.setOpen({
      sections: SECTIONS, active: activeSection,
      onSelect: (key) => { activeSection = key; openEntry = null; load(); },
    });
  }

  async function load() {
    syncWheel();
    const r = await api.expressions(activeSection);
    const entries = r.entries || [];
    if (openEntry && openEntry.pending) {
      const found = entries.find(e => e.id === openEntry.id);
      openEntry = found || null;
    }
    render(entries);
  }

  function render(entries) {
    room.textContent = '';
    const s = SEC[activeSection];
    const head = document.createElement('h2');
    head.className = 'jr-h';
    head.style.color = s.color;
    head.textContent = s.label;
    room.append(head);
    if (openEntry) {
      room.append(threadView(openEntry, { back: () => { openEntry = null; render(entries); } }));
      return;
    }
    const list = document.createElement('div');
    list.className = 'jr-list';
    for (const e of entries) {
      list.append(entryCard(e, {
        mine: false,
        onOpenThread: (entry) => { openEntry = entry; render(entries); },
      }));
    }
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'jr-sub';
      empty.textContent = `No ${s.label.toLowerCase()} shared yet under this Moon.`;
      list.append(empty);
    }
    room.append(list);
  }
  await load();
}
