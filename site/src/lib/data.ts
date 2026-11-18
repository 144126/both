// Loads the static API, searches medicine names and works out what happens when medicines are taken together. Runs in the browser.

// i: version; c: concepts [name, slug]; t: terms [term, concept indexes...]; k: class names; s: sources {code: [name, url, licence]}; f: effects {code: words}
export type Index = { i: string; c: [string, string][]; t: (string | number)[][]; k: Record<string, string>; s: Record<string, [string, string, string]>; f: Record<string, string> };
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

/** JSON with two retries; a failure is never cached, so the next check tries again. */
async function get<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (attempt >= 2) throw new Error(`${r.status} ${url}`);
    } catch (e) {
      if (attempt >= 2) throw e;
    }
    await new Promise(done => setTimeout(done, 400 * (attempt + 1)));
  }
}
const cached = <T>(map: Map<string | number, Promise<T>>, key: string | number, url: string) => {
  if (!map.has(key)) map.set(key, get<T>(url).catch(e => { map.delete(key); throw e; }));
  return map.get(key)!;
};

const indexes = new Map<string, Promise<Index>>();
export const load_index = () => cached(indexes, 'index', '/api/v1/index.json');

const drugs = new Map<string | number, Promise<Drug>>();
const maps = new WeakMap<Drug, Map<number, Drug['p'][number]>>();
export const load_drug = (ix: Index, n: number) => cached(drugs, n, `/api/v1/drug/${ix.c[n][1]}.json`);
const partners = (d: Drug) => maps.get(d) ?? (maps.set(d, new Map(d.p.map(p => [p[0], p]))), maps.get(d)!);

const chunks = new Map<string | number, Promise<Text[]>>();
/** Text and patient text of evidence, from the shared text files (200 per file). */
export async function load_texts(ids: number[]): Promise<Map<number, Text>> {
  const out = new Map<number, Text>();
  await Promise.all([...new Set(ids.map(i => Math.floor(i / 200)))].map(async k => {
    const rows = await cached(chunks, k, `/api/v1/text/${k}.json`);
    for (const i of ids) if (Math.floor(i / 200) === k) out.set(i, rows[i % 200]);
  }));
  return out;
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
