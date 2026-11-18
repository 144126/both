// The whole dataset as one SQLite/Turso database: open it with Turso, sqlite3 or any SQLite library, or in the browser, fully offline.
// Usage: node pipeline/db.ts -> site/static/download/both.db.gz
import { DatabaseSync } from 'node:sqlite';
import { createReadStream, createWriteStream, readFileSync, rmSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { CLASSES } from './classes.ts';
import { EFFECTS } from './effects.ts';
import { plain } from './names.ts';
import { members, vocab } from './resolve.ts';
import { SOURCES } from './sources.ts';
import { connect } from '@tursodatabase/database';

const PATH = 'data/out/both.db';
const pairs: [string, string, string, string, number[]][] = JSON.parse(readFileSync('data/out/pairs.json', 'utf8'));
const evidence = JSON.parse(readFileSync('data/out/evidence.json', 'utf8'));
const index = JSON.parse(readFileSync('site/static/api/v1/index.json', 'utf8')) as { i: string; c: [string, string][]; t: (string | number)[][] };
const id = new Map(index.c.map(([n], i) => [n, i]));
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t);

rmSync(PATH, { force: true });
const db = new DatabaseSync(PATH);
db.exec(`
  PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA page_size = 4096;
  -- meta: dataset version and licence
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
  -- drug: one ingredient; id matches the index in /api/v1/index.json; atc, rxcui, unii, epc and classes are comma-separated
  CREATE TABLE drug (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT, atc TEXT, rxcui TEXT, unii TEXT, epc TEXT, classes TEXT);
  -- name: every searchable name (brands, other languages), lowercase without accents
  CREATE TABLE name (term TEXT NOT NULL, drug INTEGER NOT NULL);
  -- pair: a < b; severity x contraindicated, a avoid, c use with care, m minor, n no meaningful interaction; evidence: ids, strongest first
  CREATE TABLE pair (a INTEGER NOT NULL, b INTEGER NOT NULL, severity TEXT NOT NULL, sources TEXT NOT NULL, evidence TEXT NOT NULL);
  -- evidence: source, its severity and own words, text, patient text, link, title, class it spoke of, effects, drugs whose level rises or falls
  CREATE TABLE evidence (id INTEGER PRIMARY KEY, source TEXT, severity TEXT, words TEXT, text TEXT, plain TEXT, link TEXT, title TEXT, via TEXT, effects TEXT, raises TEXT, lowers TEXT);
  CREATE TABLE source (code TEXT PRIMARY KEY, name TEXT, url TEXT, licence TEXT);
  CREATE TABLE effect (code TEXT PRIMARY KEY, words TEXT);
  CREATE TABLE class (id TEXT PRIMARY KEY, name TEXT);
`);
db.exec('BEGIN');
const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
meta.run('version', index.i);
meta.run('licence', 'CC BY 4.0: credit "both" (https://both.apexlinks.org) and the sources in the source table');
const class_of = new Map<string, string[]>();
for (const k of Object.keys(CLASSES)) for (const m of members(k)) (class_of.get(m) ?? class_of.set(m, []).get(m)!).push(k);
const drug = db.prepare('INSERT INTO drug VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const concept = new Map(vocab.c.map(c => [c.n, c]));
index.c.forEach(([n, slug], i) => {
  const c = concept.get(n)!;
  drug.run(i, n, slug || null, c.a.join(','), c.x.join(','), c.u.join(','), c.e.join(','), (class_of.get(n) ?? []).join(','));
});
const name = db.prepare('INSERT INTO name VALUES (?, ?)');
for (const [t, ...ids] of index.t as [string, ...number[]][]) for (const d of ids) name.run(t, d);
const ev = db.prepare('INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const ids = (list?: string[]) => (list ?? []).filter(x => id.has(x)).map(x => id.get(x)).join(',');
evidence.forEach((e: Record<string, string & string[]>, i: number) =>
  ev.run(i, e.r, e.s, e.o, cut(e.t, 900), e.p ?? null, e.u, e.n, e.c ?? null, e.f.join(','), ids(e.up), ids(e.dn)));
const pair = db.prepare('INSERT INTO pair VALUES (?, ?, ?, ?, ?)');
for (const [a, b, s, r, e] of pairs) {
  const [x, y] = [id.get(a)!, id.get(b)!].sort((p, q) => p - q);
  pair.run(x, y, s, r, e.slice(0, 5).join(','));
}
const insert = (sql: string, rows: unknown[][]) => { const st = db.prepare(sql); for (const row of rows) st.run(...(row as never[])); };
insert('INSERT INTO source VALUES (?, ?, ?, ?)', Object.entries(SOURCES).map(([k, v]) => [k, ...v]));
insert('INSERT INTO effect VALUES (?, ?)', Object.entries(EFFECTS).map(([k, e]) => [k, e.n]));
insert('INSERT INTO class VALUES (?, ?)', Object.entries(CLASSES).map(([k, c]) => [k, c.n]));
db.exec('COMMIT');
db.exec(`CREATE INDEX name_term ON name (term); CREATE UNIQUE INDEX pair_ab ON pair (a, b); CREATE INDEX pair_b ON pair (b); VACUUM;`);
db.close();

// every build proves the file opens and answers in Turso, not only in SQLite
const turso = await connect(PATH, { readonly: true });
const [x, y] = ['warfarin', 'aspirin'].map(n => id.get(n)!).sort((p, q) => p - q);
const check = await turso.prepare('SELECT severity FROM pair WHERE a = ? AND b = ?').get(x, y) as { severity?: string } | undefined;
if (!check?.severity) throw new Error('Turso could not read warfarin + aspirin from both.db');
await turso.close();

await pipeline(createReadStream(PATH), createGzip({ level: 9 }), createWriteStream('site/static/download/both.db.gz'));
console.log(pairs.length, 'pairs,', evidence.length, 'evidence,', index.c.length, 'drugs;', plain('done'));
