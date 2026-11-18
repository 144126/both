// Searches medicine names and works out what happens when medicines are taken together, entirely on the device: the data is
// downloaded once (install) and read from the browser's cache from then on.
import { BASE, FILES, PAIRS, TEXT_CHUNK, VERSION } from './bundle';
import { embed, type Table } from './wordpiece';

// i: version; c: concepts [name, slug]; t: terms [term, concept indexes...]; k: class names; s: sources {code: [name, url, licence]}; f: effects {code: words}; n: text files
export type Index = { i: string; c: [string, string][]; t: (string | number)[][]; k: Record<string, string>; s: Record<string, [string, string, string]>; f: Record<string, string>; n: number };
// source, severity, source's words, via class, effects, raises (concept indexes), lowers, text id
export type Evidence = [string, string, string, string, string[], number[], number[], number];
// text, patient text, link, title
export type Text = [string, string, string, string];
// i id; a ATC; x RxNorm; u UNII; e FDA classes; k classes; p [partner, severity, sources, evidence indexes]; v evidence
export type Drug = { i: string; a: string[]; x: string[]; u: string[]; e: string[]; k: string[]; p: [number, string, string, number[]][]; v: Evidence[] };
export type Medicine = { t: string; ids: number[] };
export type Finding = { a: Medicine; b: Medicine; x: number; y: number; s: string; r: string[]; ev: Evidence[]; same?: boolean };

export const ORDER = 'xacmn';
export const HEADLINE: Record<string, string> = {
  x: 'do not take together', a: 'avoid taking together', c: 'take care', m: 'minor', n: 'no meaningful interaction',
};
export const ADVICE: Record<string, string> = {
  x: 'talk to your doctor or pharmacist before you take both. there is usually a safer choice.',
  a: 'ask your doctor or pharmacist before you take both. they may switch one, change a dose or watch you closely.',
  c: 'they can often be taken together, but a dose may need changing or you may need checks. tell your pharmacist you take both.',
  m: 'usually no action is needed. mention it at your next check-up.',
  n: 'studies found no meaningful interaction between these two.',
};

const CACHE = `both-${VERSION}`;

/** Downloads the data once into the device's cache, reporting progress 0..1; later visits find it there and download nothing. */
export async function install(progress: (share: number) => void) {
  const cache = await caches.open(CACHE);
  const have = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
  const missing = FILES.map(f => `${BASE}/${f}`).filter(u => !have.has(u));
  let done = FILES.length - missing.length;
  progress(done / FILES.length);
  const queue = [...missing];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      for (let attempt = 0; ; attempt++) {
        const r = await fetch(url).catch(() => null);
        if (r?.ok) { await cache.put(url, r); break; }
        if (attempt === 2) throw new Error(`could not download ${url}`);
      }
      progress(++done / FILES.length);
    }
  }));
  await navigator.storage?.persist?.();
  for (const key of await caches.keys()) if (key.startsWith('both-2') && key !== CACHE) await caches.delete(key);
}

let installing: Promise<void> | undefined;
const listeners = new Set<(share: number) => void>();
/** The data on this device, downloading it first if needed; every page waits on this one promise. */
export function ready(progress?: (share: number) => void) {
  if (progress) listeners.add(progress);
  return (installing ??= install(share => listeners.forEach(l => l(share))).catch(e => { installing = undefined; throw e; }));
}

/** A data file from the device only; never the network. */
async function local(file: string): Promise<Response> {
  const r = await (await caches.open(CACHE)).match(`${BASE}/${file}`);
  if (!r) throw new Error(`not on this device: ${file}`);
  return r;
}

/** A local file's bytes, unpacked if gzip (some servers already unpack .gz on the way: gzip starts with 1f 8b). */
async function bytes(file: string): Promise<ArrayBuffer> {
  const buf = await (await local(file)).arrayBuffer();
  const head = new Uint8Array(buf, 0, 2);
  return head[0] === 0x1f && head[1] === 0x8b ? new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : buf;
}

let index: Promise<Index> | undefined;
export const load_index = () => (index ??= local('index.json').then(r => r.json()));

// pairs as typed arrays, and for each drug the pairs it is in (a compressed sparse row list built once on load)
type Pairs = { a: Uint16Array; b: Uint16Array; s: Uint8Array; r: Uint16Array; start: Uint32Array; count: Uint8Array; refs: Uint16Array; at: Uint32Array; list: Uint32Array };
let pairs: Promise<Pairs> | undefined;
const load_pairs = () => (pairs ??= (async () => {
  const buf = await bytes('pairs.bin.gz');
  const [n, m] = new Uint32Array(buf, 0, 2);
  if (n !== PAIRS) throw new Error('pairs file does not match this version');
  let o = 8;
  const u16 = (len: number) => { const v = new Uint16Array(buf, o, len); o += len * 2; return v; };
  const a = u16(n), b = u16(n), r = u16(n), refs = u16(m);
  const s = new Uint8Array(buf, o, n), count = new Uint8Array(buf, o + n, n);
  const start = new Uint32Array(n);
  for (let i = 1; i < n; i++) start[i] = start[i - 1] + count[i - 1];
  let drugs = 0;
  for (let i = 0; i < n; i++) drugs = Math.max(drugs, a[i], b[i]);
  drugs += 2;
  const at = new Uint32Array(drugs + 1);
  for (let i = 0; i < n; i++) { at[a[i] + 1]++; at[b[i] + 1]++; }
  for (let d = 0; d < drugs; d++) at[d + 1] += at[d];
  const fill = at.slice(), list = new Uint32Array(2 * n);
  for (let i = 0; i < n; i++) { list[fill[a[i]]++] = i; list[fill[b[i]]++] = i; }
  return { a, b, s, r, start, count, refs, at, list };
})());

let evidence: Promise<[string, string, string, string, string[], number[], number[]][]> | undefined;
const load_evidence = () => (evidence ??= local('evidence.json').then(r => r.json()));

const drugs = new Map<number, Promise<Drug>>();
const maps = new WeakMap<Drug, Map<number, Drug['p'][number]>>();
/** One drug's interactions, in the shape of /api/v1/drug/<slug>.json, built from the data on the device. */
export function load_drug(ix: Index & { m?: string[][] }, n: number): Promise<Drug> {
  if (!drugs.has(n)) drugs.set(n, Promise.all([load_pairs(), load_evidence()]).then(([P, E]) => {
    const sources = Object.keys(ix.s), local_ids = new Map<number, number>(), v: Evidence[] = [];
    const ref = (id: number) => local_ids.get(id) ?? (local_ids.set(id, v.push([...E[id], id] as Evidence) - 1), v.length - 1);
    const p: Drug['p'] = [];
    for (let k = P.at[n]; k < P.at[n + 1]; k++) {
      const i = P.list[k];
      const ev = Array.from(P.refs.subarray(P.start[i], P.start[i] + P.count[i]), ref);
      p.push([P.a[i] === n ? P.b[i] : P.a[i], ORDER[P.s[i]], sources.filter((_, bit) => P.r[i] & (1 << bit)).join(','), ev]);
    }
    p.sort((x, y) => ORDER.indexOf(x[1]) - ORDER.indexOf(y[1]));
    return { i: ix.c[n][0], a: [], x: [], u: [], e: [], k: ix.m?.[n] ?? [], p, v };
  }));
  return drugs.get(n)!;
}
const partners = (d: Drug) => maps.get(d) ?? (maps.set(d, new Map(d.p.map(p => [p[0], p]))), maps.get(d)!);

const chunks = new Map<number, Promise<Text[]>>();
/** Text, patient text, link and title of evidence, from the text files on the device. */
export async function load_texts(_ix: Index, ids: number[]): Promise<Map<number, Text>> {
  const out = new Map<number, Text>();
  await Promise.all([...new Set(ids.map(i => Math.floor(i / TEXT_CHUNK)))].map(async k => {
    if (!chunks.has(k)) chunks.set(k, local(`text/${k}.json`).then(r => r.json()));
    const rows = await chunks.get(k)!;
    for (const i of ids) if (Math.floor(i / TEXT_CHUNK) === k) out.set(i, rows[i % TEXT_CHUNK]);
  }));
  return out;
}

// Meaning search: blink-8M int8 static embeddings and one vector per drug (see pipeline/meaning.ts for the layout)
type Meaning = { table: Table; ids: Uint16Array; ts: Float32Array; tq: Int8Array; w: Uint8Array };
let meaning: Promise<Meaning> | undefined;
export const load_meaning = () => (meaning ??= (async () => {
  const [buf, words] = await Promise.all([bytes('meaning.bin.gz'), local('vocab.txt').then(r => r.text())]);
  const [rows, dim, T] = new Uint32Array(buf, 0, 3);
  let o = 16;
  const s = new Float32Array(buf, o, rows); o += rows * 4;
  const ts = new Float32Array(buf, o, T); o += T * 4;
  const ids = new Uint16Array(buf, o, T); o += T * 2 + (T % 2 ? 2 : 0);
  const q = new Int8Array(buf, o, rows * dim); o += rows * dim;
  const tq = new Int8Array(buf, o, T * dim); o += T * dim;
  return { table: { vocab: new Map(words.split('\n').map((t, i) => [t, i])), q, s, dim }, ids, ts, tq, w: new Uint8Array(buf, o, T) };
})());

/** Drugs whose description matches what was typed in meaning ("blood thinner" -> warfarin), common drugs first among close matches.
 * Scores under 0.55 are noise (gibberish scores about 0.45). */
export function search_meaning(m: Meaning, query: string, skip: Set<number>, limit = 5): number[] {
  const v = embed(query, m.table), dim = m.table.dim, out: [number, number][] = [];
  for (let r = 0; r < m.ids.length; r++) {
    let d = 0;
    for (let k = 0; k < dim; k++) d += v[k] * m.tq[r * dim + k];
    const score = d * m.ts[r] + (0.3 * m.w[r]) / 255;
    if (score >= 0.55 && !skip.has(m.ids[r])) out.push([score, m.ids[r]]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, id]) => id);
}

export const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length];
}

export type Match = { value: string; label: string; ids: number[]; hint: string };
/** Best names for what was typed: exact, then starts with, then a word starts with, then contains, then close spellings. */
export function search(ix: Index, query: string, limit = 12): Match[] {
  const q = plain(query);
  if (!q) return [];
  const scored: [number, string, number[]][] = [];
  for (const [t, ...ids] of ix.t as [string, ...number[]][]) {
    const score = t === q ? 0 : t.startsWith(q) ? 1 : t.includes(` ${q}`) ? 2 : t.includes(q) ? 3 : -1;
    if (score >= 0) scored.push([score * 1000 + t.length + (ids.length > 1 ? 50 : 0) + (ix.c[ids[0]][0] === t ? 0 : 20), t, ids]);
  }
  if (scored.length < limit && q.length >= 4) {
    const allowed = q.length >= 8 ? 2 : 1;
    for (const [t, ...ids] of ix.t as [string, ...number[]][]) {
      const d = distance(q, t.slice(0, q.length));
      if (d && d <= allowed && !scored.some(s => s[1] === t)) scored.push([4000 + d * 100 + t.length, t, ids]);
    }
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, limit).map(([, t, ids]) => {
    const names = ids.map(i => ix.c[i][0]);
    return { value: t, label: t, ids, hint: names.length === 1 && names[0] === t ? '' : names.join(' + ') };
  });
}

/** Every pair of ingredients from two different medicines, with what the data says about it; the same ingredient twice is a finding too. */
// unknown: medicines with no interaction data at all; failed: data that could not be loaded, so the result is incomplete
export async function check(ix: Index, meds: Medicine[]): Promise<{ findings: Finding[]; unknown: Medicine[]; failed: Medicine[] }> {
  const ids = [...new Set(meds.flatMap(m => m.ids))];
  const broken = new Set<number>();
  const loaded = new Map(await Promise.all(ids.map(async n => [n, ix.c[n][1] ? await load_drug(ix, n).catch(() => (broken.add(n), null)) : null] as const)));
  const findings: Finding[] = [];
  for (let i = 0; i < meds.length; i++) for (let j = i + 1; j < meds.length; j++) {
    for (const x of meds[i].ids) for (const y of meds[j].ids) {
      if (x === y) { findings.push({ a: meds[i], b: meds[j], x, y, s: 'a', r: [], ev: [], same: true }); continue; }
      const d = loaded.get(x), hit = d && partners(d).get(y);
      if (hit) findings.push({ a: meds[i], b: meds[j], x, y, s: hit[1], r: hit[2].split(','), ev: hit[3].map(e => d!.v[e]) });
    }
  }
  findings.sort((p, q) => ORDER.indexOf(p.s) - ORDER.indexOf(q.s));
  return { findings, unknown: meds.filter(m => m.ids.every(n => !ix.c[n][1])), failed: meds.filter(m => m.ids.some(n => broken.has(n))) };
}

/** Plain words for what can happen: the effects the sources name, and whose blood level goes up or down. */
export function what_happens(ix: Index, f: Finding): string[] {
  const out: string[] = [];
  const name = (n: number) => ix.c[n][0];
  for (const e of f.ev) {
    for (const n of e[5]) if ((n === f.x || n === f.y) && !out.some(o => o.startsWith(`${name(n === f.x ? f.y : f.x)} can raise`)))
      out.push(`${name(n === f.x ? f.y : f.x)} can raise the amount of ${name(n)} in the blood, which can mean more side effects of ${name(n)}.`);
    for (const n of e[6]) if ((n === f.x || n === f.y) && !out.some(o => o.startsWith(`${name(n === f.x ? f.y : f.x)} can lower`)))
      out.push(`${name(n === f.x ? f.y : f.x)} can lower the amount of ${name(n)} in the blood, so ${name(n)} may work less well.`);
  }
  const effects = [...new Set(f.ev.flatMap(e => e[4]))].filter(k => !(k === 'levels_up' || k === 'levels_down') || !out.length).slice(0, 4);
  if (effects.length) out.push(`it can cause ${effects.map(k => ix.f[k]).join('; ')}.`);
  return out;
}

export const only_mechanism = (f: Finding) => f.r.length === 1 && f.r[0] === 'mech';
