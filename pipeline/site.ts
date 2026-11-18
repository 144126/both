// Writes the static API and downloads from data/out: one search index, one file per ingredient, the full dataset as CSV and JSON.
// Usage: node pipeline/site.ts -> site/static/api/v1/, site/static/download/
import { mkdirSync, readFileSync, rmSync, writeFileSync, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { CLASSES } from './classes.ts';
import { plain } from './names.ts';
import { members, vocab } from './resolve.ts';
import { SOURCES } from './sources.ts';
import { EFFECTS } from './effects.ts';

const pairs: [string, string, string, string, number[]][] = JSON.parse(readFileSync('data/out/pairs.json', 'utf8'));
const evidence = JSON.parse(readFileSync('data/out/evidence.json', 'utf8'));
const API = 'site/static/api/v1';
const version = new Date().toISOString().slice(0, 16);  // minute stamp: two deploys a day must not share a version
const cut = (t: string, n: number) => t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t;
rmSync(API, { recursive: true, force: true });
mkdirSync(`${API}/drug`, { recursive: true });
mkdirSync('site/static/download', { recursive: true });

// every concept is searchable; only those in at least one pair get a file (slug '' otherwise), so the app can say "no data for X"
const used = new Set(pairs.flatMap(p => [p[0], p[1]]));
const concepts = [...vocab.c].sort((a, b) => a.n.localeCompare(b.n));
const index = new Map(concepts.map((c, i) => [c.n, i]));
const slugs = new Set<string>();
const slug = concepts.map(c => {
  let s = plain(c.n).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
  while (slugs.has(s)) s += '-';
  slugs.add(s);
  return used.has(c.n) ? s : '';
});
const class_of = new Map<string, string[]>();
for (const id of Object.keys(CLASSES)) for (const m of members(id)) if (index.has(m)) (class_of.get(m) ?? class_of.set(m, []).get(m)!).push(id);

// search terms: names and synonyms in every language, and product names (a combination brand names several ingredients)
const terms = new Map<string, Set<number>>();
const term = (t: string, ids: number[]) => { const k = plain(t); if (k.length > 1 && ids.length) for (const i of ids) (terms.get(k) ?? terms.set(k, new Set()).get(k)!).add(i); };
for (const c of concepts) for (const s of [c.n, ...c.s]) term(s, [index.get(c.n)!]);
for (const [name, ids] of Object.entries(vocab.p)) term(name, ids.filter(id => index.has(id)).map(id => index.get(id)!));

// i: version date; c: concepts [name, slug]; t: search terms [term, concept indexes...]; k: class names {id: plain name}; s: sources {code: [name, url, licence]};
// f: effects {code: plain words}; n: number of text files (text/0.json … text/<n-1>.json)
writeFileSync(`${API}/index.json`, JSON.stringify({ i: version, c: concepts.map((c, i) => [c.n, slug[i]]), t: [...terms].map(([t, ids]) => [t, ...ids]),
  k: Object.fromEntries(Object.entries(CLASSES).map(([id, k]) => [id, k.n])), s: SOURCES, f: Object.fromEntries(Object.entries(EFFECTS).map(([k, e]) => [k, e.n])), n: Math.ceil(evidence.length / 200) }));

// per ingredient: w data version (must equal the index's i, or ids may point at other drugs); i id; a ATC; x RxNorm; u UNII; e FDA classes; k our classes; p interactions [partner index, severity, sources, evidence indexes];
// v evidence [source, severity, source's words, via class, effects, raises, lowers, text id]. Texts are stored once, in
// text/<id / 200>.json as [text, plain text, link, title], since one label sentence about a class backs thousands of pairs.
const CHUNK = 200;
mkdirSync(`${API}/text`, { recursive: true });
for (let k = 0; k * CHUNK < evidence.length; k++)
  writeFileSync(`${API}/text/${k}.json`, JSON.stringify({ w: version, r: evidence.slice(k * CHUNK, (k + 1) * CHUNK).map((x: { t: string; p?: string; u: string; n: string }) => [cut(x.t, 900), x.p ?? '', x.u, x.n]) }));
const by_drug = new Map<string, [string, string, string, number[]][]>();
for (const [a, b, s, r, ev] of pairs) {
  (by_drug.get(a) ?? by_drug.set(a, []).get(a)!).push([b, s, r, ev]);
  (by_drug.get(b) ?? by_drug.set(b, []).get(b)!).push([a, s, r, ev]);
}
const ORDER = 'xacmn';
let bytes = 0;
for (const c of concepts) {
  if (!used.has(c.n)) continue;
  const list = (by_drug.get(c.n) ?? []).sort((x, y) => ORDER.indexOf(x[1]) - ORDER.indexOf(y[1]));
  const local = new Map<number, number>(), v: unknown[] = [];
  const at = (e: number) => {
    if (!local.has(e)) {
      const x = evidence[e];
      local.set(e, v.push([x.r, x.s, x.o, x.c ?? '', x.f, (x.up ?? []).filter((i: string) => index.has(i)).map((i: string) => index.get(i)),
        (x.dn ?? []).filter((i: string) => index.has(i)).map((i: string) => index.get(i)), e]) - 1);
    }
    return local.get(e)!;
  };
  const body = JSON.stringify({ w: version, i: c.n, a: c.a, x: c.x, u: c.u, e: c.e, k: class_of.get(c.n) ?? [], p: list.map(([b, s, r, ev]) => [index.get(b), s, r, ev.slice(0, 5).map(at)]), v });
  bytes += body.length;
  writeFileSync(`${API}/drug/${slug[index.get(c.n)!]}.json`, body);
}

// downloads: every pair with its evidence, as CSV and JSON lines (gzip)
const csv = createGzip(), jsonl = createGzip();
csv.pipe(createWriteStream('site/static/download/both-interactions.csv.gz'));
jsonl.pipe(createWriteStream('site/static/download/both-interactions.jsonl.gz'));
const q = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
csv.write('drug_a,drug_b,severity,sources,evidence_source,evidence_severity,evidence_level_words,evidence_text,plain_text,link,title,via_class\n');
for (const [a, b, s, r, ev] of pairs) {
  jsonl.write(JSON.stringify({ a, b, severity: s, sources: r.split(','), evidence: ev.map(e => evidence[e]) }) + '\n');
  for (const e of ev) { const x = evidence[e]; csv.write([a, b, s, r, x.r, x.s, x.o, x.t, x.p, x.u, x.n, x.c].map(q).join(',') + '\n'); }
}
csv.end(); jsonl.end();
console.log(used.size, 'drug files,', (bytes / 1e6).toFixed(0), 'MB;', terms.size, 'search terms; version', version);
