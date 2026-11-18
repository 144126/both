// One vocabulary of ingredients for every source: US labels, the FDA enzyme table, Norway, France, VA and Wikidata.
// Concept id = US (USAN) ingredient name without salt. Foreign spellings join by ATC code or by spelling skeleton.
// Usage: node pipeline/vocab.ts -> data/vocab.json
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { base, plain, skeleton, US_NAME } from './names.ts';

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const lines = (path: string) => gunzipSync(readFileSync(path)).toString().split('\n').filter(Boolean);

// n: display name; s: synonyms (plain lowercase); a: ATC codes; x: RxNorm ingredient ids; u: UNIIs; e: FDA EPC classes; m: FDA MoA classes;
// l: label set ids; f: 1 when only foreign sources know it
type Concept = { n: string; s: Set<string>; a: Set<string>; x: Set<string>; u: Set<string>; e: Set<string>; m: Set<string>; l: Set<string>; f: number };
const concepts = new Map<string, Concept>();
const by_skeleton = new Map<string, Set<string>>();
const by_atc = new Map<string, Set<string>>();
const id_of = (name: string) => { const b = base(name); return US_NAME[b] ?? US_NAME[plain(name)] ?? b; };

function add(name: string, extra: Partial<Record<'a' | 'x' | 'u' | 'e' | 'm' | 'l', string[]>> = {}, foreign = 0): string {
  const id = id_of(name);
  if (!id || id.length < 3 || /^[\d\s.,-]+$/.test(id)) return '';  // parse leftovers like "11" or "or"
  let c = concepts.get(id);
  if (!c) {
    c = { n: id, s: new Set(), a: new Set(), x: new Set(), u: new Set(), e: new Set(), m: new Set(), l: new Set(), f: foreign };
    concepts.set(id, c);
    (by_skeleton.get(skeleton(id)) ?? by_skeleton.set(skeleton(id), new Set()).get(skeleton(id))!).add(id);
  }
  if (!foreign) c.f = 0;
  c.s.add(id); c.s.add(plain(name)); c.s.add(base(name));
  for (const [k, values] of Object.entries(extra)) for (const v of values ?? []) if (v) c[k as 'a'].add(v);
  for (const a of extra.a ?? []) (by_atc.get(a) ?? by_atc.set(a, new Set()).get(a)!).add(id);
  return id;
}

/** A foreign name joins, in order: its English name's concept, the one concept with the same spelling skeleton (English name first,
 * then the foreign one), the ATC code's single concept; otherwise it becomes a new concept. */
function add_foreign(name: string, atc = '', english = ''): string {
  const join = (id: string) => {
    const c = concepts.get(id)!;
    c.s.add(plain(name));
    if (english) c.s.add(plain(english));
    if (atc) { c.a.add(atc); (by_atc.get(atc) ?? by_atc.set(atc, new Set()).get(atc)!).add(id); }
    return id;
  };
  for (const n of english ? [english, name] : [name]) {
    if (concepts.has(id_of(n))) return join(id_of(n));
    const twins = by_skeleton.get(skeleton(id_of(n)));
    if (twins?.size === 1) return join([...twins][0]);
  }
  const by_code = atc ? by_atc.get(atc) : undefined;
  if (by_code?.size === 1) return join([...by_code][0]);
  return add(english || name, { a: atc ? [atc] : [] }, 1);
}

// products: brand or generic product name -> ingredient ids. One brand covers many products (Tylenol, Tylenol PM, Tylenol first aid
// cream), so a name means the ingredient set most labels with that name share; a tie goes to the simpler set.
const product_sets = new Map<string, Map<string, number>>();
const product = (name: string, ids: string[]) => {
  const k = plain(name), set = [...new Set(ids.filter(Boolean))].sort().join('|');
  if (k.length < 3 || !set) return;
  const counts = product_sets.get(k) ?? product_sets.set(k, new Map()).get(k)!;
  counts.set(set, (counts.get(set) ?? 0) + 1);
};

for (const line of lines('data/cache/labels.jsonl.gz')) {
  const l = JSON.parse(line);
  if (l.i.length > 12) continue;  // homeopathic and multivitamin mixtures name dozens of substances
  const ids = l.i.map((i: string) => add(i, { u: l.i.length === 1 ? l.u : [], e: l.i.length === 1 ? l.e : [], m: l.i.length === 1 ? l.m : [], l: [l.s] }));
  // "Paxlovid 5-Day" and "Paxlovid 150 MG / 100 MG Dose Pack" are also just "paxlovid"
  for (const b of l.b) { product(b, ids); const head = b.split(/\s+\d/)[0].trim(); if (head !== b) product(head, ids); }
  for (const n of l.n) product(n, ids);
}
for (const drug of Object.keys(json('data/fda_pk.json'))) for (const part of drug.split(/\s*&\s*/)) add(part);
for (const row of lines('data/cache/wd.csv.gz').slice(1)) {
  const [, label, atc, rxnorm, unii] = row.split(',');
  if (label && /^[A-Z]\d\d[A-Z]{2}\d\d$/.test(atc) && !/^Q\d+$/.test(label) && concepts.has(id_of(label))) add(label, { a: [atc], x: [rxnorm], u: [unii] });
}
for (const r of json('data/sources/ndfrt.json')) { add(r.a); add(r.b); }

// Norway: English names come from the substance register; combinations ("simvastatin og ezetimib") are split into parts
const register = new Map<string, string>();
for (const r of json('data/sources/fest.json')) for (const side of r.g) for (const [no, en] of side) if (en) register.set(plain(no), en);
for (const r of json('data/sources/fest.json')) for (const side of r.g) for (const [no, en, atc] of side) {
  if (atc.length !== 7) continue;  // class rows (C03, C03CA) list their members separately
  if (en) add_foreign(no, atc, en);
  else for (const part of no.split(/\s+og\s+|,\s*/).filter(p => !/kombinasjon|midler|derivater|usammensatte|andre|psykoleptika/i.test(p))) { const e = register.get(plain(part)); e ? add_foreign(part, '', e) : add_foreign(part); }
}

// France: drug headings, partners and class members are French names
const ansm = json('data/sources/ansm.json');
const french = new Set<string>([...Object.values(ansm.c).flat() as string[]]);
for (const r of ansm.r) for (const name of [r[0], r[1]]) if (!ansm.c[name] && !/\b(IMAO|MEDICAMENTS?|MÉDICAMENTS?|INHIBITEURS|INDUCTEURS|ANTI|VACCINS|SUBSTANCES|SELS|DERIVES|DÉRIVÉS)\b/.test(name)) french.add(name.toLowerCase());
for (const name of french) add_foreign(name.replace(/\s*\(.*$/, ''));

const products = new Map([...product_sets].map(([k, counts]) => [k,
  [...counts].sort((a, b) => b[1] - a[1] || a[0].split('|').length - b[0].split('|').length)[0][0].split('|')]));
const out = [...concepts.values()].map(c => ({ n: c.n, s: [...c.s].filter(s => s !== c.n), a: [...c.a], x: [...c.x], u: [...c.u], e: [...c.e], m: [...c.m], l: c.l.size, f: c.f }));
writeFileSync('data/vocab.json', JSON.stringify({ c: out, p: Object.fromEntries(products) }));
console.log(out.length, 'concepts;', out.filter(c => !c.f).length, 'known in the US;', out.filter(c => c.a.length).length, 'with ATC;', products.size, 'product names');
