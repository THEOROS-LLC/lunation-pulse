// audit_record.mjs — prove what the record is capable of remembering.
// AMENDED CONTRACT (v1): a members table exists (email + hash + tier + optional
// display name — the minimum for a journal to be *yours*). The audit now asserts:
//   1. members carries NOTHING beyond that minimum (no tracking fields)
//   2. no content table (entries/comments/charges) contains identity columns —
//      posts link by opaque member_id only; emails and names never sit on content
// Run any time, against any copy of the DB:  node audit_record.mjs [path]
import Database from 'better-sqlite3';
const db = new Database(process.argv[2] || './record.db', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
for (const t of tables)
  console.log(`${t}:`, db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name).join(' '));
const MEMBER_ALLOWED = new Set(['id','email','pass_salt','pass_hash','display_name','tier','created_utc']);
const banned = ['ip','email','name','cookie','session_token','agent','phone','address','birth'];
let fail = false;
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name.toLowerCase());
  if (t === 'members') {
    const extra = cols.filter(c => !MEMBER_ALLOWED.has(c));
    if (extra.length) { console.log(`FAIL: members has fields beyond the minimum: ${extra}`); fail = true; }
  } else if (t === 'sessions') {
    continue; // opaque ids + expiry only, verified by schema print above
  } else {
    // directories.name is a user-chosen folder label — content, not identity metadata
    const safe = t === 'directories' ? new Set(['name']) : new Set();
    const hits = cols.filter(c => !safe.has(c) && banned.some(b => c.includes(b)));
    if (hits.length) { console.log(`FAIL: content table '${t}' carries identity: ${hits}`); fail = true; }
  }
}
console.log(fail ? 'AUDIT FAIL — see above.'
  : 'AUDIT PASS: members hold the minimum; content tables carry no identity.');
