// audit_record.mjs — prove what the record is capable of remembering.
// Run any time, against any copy of the DB:  node audit_record.mjs [path]
import Database from 'better-sqlite3';
const db = new Database(process.argv[2] || './record.db', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
for (const t of tables)
  console.log(`${t}:`, db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name).join(' '));
const banned = ['ip', 'email', 'user', 'name', 'cookie', 'session', 'agent', 'account', 'phone'];
const cols = tables.flatMap(t => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name.toLowerCase()));
const hits = cols.filter(c => banned.some(b => c.includes(b)));
console.log(hits.length ? `IDENTITY-CAPABLE COLUMNS FOUND: ${hits}` : 'AUDIT PASS: no identity-capable column exists in this database.');
