// Merges every source into one interaction set over ingredient pairs. Classes expand to their members; a source's statement about the
// exact pair beats its class statement; the pair's severity is the highest any source gives. Every pair keeps its evidence.
// Usage: node pipeline/build.ts -> data/out/pairs.json, data/out/evidence.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CLASSES } from './classes.ts';
import { effects } from './effects.ts';
import { ANSM_URL_TEXT, CURATED } from './curated.ts';
import { concept, members, resolve, vocab } from './resolve.ts';
import { SOURCES } from './sources.ts';

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const SEV: Record<string, number> = { n: 0, m: 1, c: 2, a: 3, x: 4 };


// r: source; s: severity in our scale; o: source's own level words; t: English text; p: plain text written for patients; g: original text when translated; u: link;
// n: title (label, reference); c: class name when the statement was about a class; f: effects; up/dn: ingredients whose level rises/falls
type Evidence = { r: string; s: string; o: string; t: string; p?: string; g?: string; u: string; n: string; c?: string; f: string[]; up?: string[]; dn?: string[] };
const evidence: Evidence[] = [];
const evidence_key = new Map<string, number>();
// pair "a|b" (sorted) -> statements [evidence index, 1 when via class]
const pairs = new Map<string, [number, number][]>();

function state(a: string[], b: string[], ev: Evidence, via_class: number) {
  const key = `${ev.r}|${ev.s}|${ev.t}|${ev.u}|${ev.c ?? ''}`;
  let i = evidence_key.get(key);
  if (i === undefined) { i = evidence.push(ev) - 1; evidence_key.set(key, i); }
  for (const x of new Set(a)) for (const y of new Set(b)) {
    if (!x || !y || x === y) continue;
    const k = x < y ? `${x}|${y}` : `${y}|${x}`;
    const list = pairs.get(k) ?? pairs.set(k, []).get(k)!;
    if (!list.some(([e]) => e === i)) list.push([i, via_class]);
  }
}
const side = (name: string): [string[], string] => name.startsWith('class:') ? [[...members(name.slice(6))], CLASSES[name.slice(6)].n] : [[resolve(name) || name], ''];

// US labels
for (const f of json('data/sources/fda.json')) {
  const [b, cls] = side(f.b);
  const a = f.a.map((x: string) => resolve(x) || x).filter((x: string) => concept.has(x));
  if (!b.length || !a.length) continue;
  state(a, b.filter(x => concept.has(x)), { r: 'us', s: f.s, o: { x: 'contraindicated', a: 'avoid', c: 'use with care', n: 'no meaningful interaction' }[f.s as string]!, t: f.q,
    u: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${f.i}`, n: `${f.t} label, ${f.k.replace(/_/g, ' ')}`, c: cls || undefined, f: f.f, up: f.u, dn: f.d }, cls ? 1 : 0);
}

// Norway
const fest_en: Record<string, string> = existsSync('data/sources/fest.en.json') ? json('data/sources/fest.en.json') : {};
const FEST_LEVEL: Record<number, [string, string]> = { 1: ['a', 'should be avoided'], 2: ['c', 'take precautions'], 3: ['m', 'no action needed'] };
const FEST_EVIDENCE = ['', 'interaction studies', 'case reports', 'interaction studies and case reports', 'indirect data'];
for (const r of json('data/sources/fest.json')) {
  const sides = r.g.map((g: [string, string, string][]) => g.filter(([, , atc]) => atc.length === 7 || !atc).map(([no, en]) => resolve(en) || resolve(no)).filter(Boolean));
  if (sides.some((s: string[]) => !s.length)) continue;
  const [s, o] = FEST_LEVEL[r.s];
  const en = (t: string) => fest_en[t] ?? '';
  const t = [en(r.c), en(r.k) && `Mechanism: ${en(r.k)}`, en(r.h) && `What to do: ${en(r.h)}`, r.e && `Evidence: ${FEST_EVIDENCE[r.e]}.`].filter(Boolean).join(' ');
  const ref = r.r.find(([, link]: string[]) => link)?.[1];
  state(sides[0], sides[1], { r: 'no', s, o, t: t || o, g: [r.c, r.k, r.h].filter(Boolean).join(' | '), u: ref ?? SOURCES.no[1], n: `FEST ${r.d}`,
    f: effects(`${en(r.c)} ${en(r.k)}`.toLowerCase()) }, sides.some((x: string[]) => x.length > 3) ? 1 : 0);
}

// France
const ansm = json('data/sources/ansm.json');
const ansm_en: Record<string, string> = existsSync('data/sources/ansm.en.json') ? json('data/sources/ansm.en.json') : {};
const ANSM_LEVEL: Record<string, [string, string]> = { x: ['x', 'contre-indication'], a: ['a', 'association déconseillée'], p: ['c', "précaution d'emploi"], c: ['m', 'à prendre en compte'] };
// ANSM classes described in prose rather than listed, matched to the same classes used for labels
const ANSM_CLASS: Record<string, string> = { 'inhibiteurs puissants du cyp3a4': '3A_i_s', 'inducteurs enzymatiques': '3A_d', 'inhibiteurs de protéases boostés par ritonavir': 'protease_inhibitor',
  'substances susceptibles de donner des torsades de pointes': 'qt', 'médicaments atropiniques': 'anticholinergic', 'médicaments sédatifs': 'cns_depressant',
  'anti-inflammatoires non stéroïdiens': 'nsaid', 'médicaments néphrotoxiques': 'nephrotoxic', 'médicaments ototoxiques': 'ototoxic',
  'médicaments abaissant le seuil épileptogène': 'seizure_threshold', "médicaments à l'origine d'un syndrome sérotoninergique": 'serotonergic', 'médicaments à l\'origine d\'atteintes musculaires': 'statin' };
const french = (name: string): string[] => ANSM_CLASS[name.toLowerCase().replace(/^autres /, '')] ? [...members(ANSM_CLASS[name.toLowerCase().replace(/^autres /, '')])] : ansm.c[name] ? ansm.c[name].map((m: string) => resolve(m.replace(/\s*\(.*$/, ''))).filter(Boolean) : [resolve(name.replace(/\s*\(.*$/, '').toLowerCase())].filter(Boolean);
for (const [head, partner, level, risk, todo] of ansm.r) {
  const a = french(head), b = french(partner);
  if (!a.length || !b.length) continue;
  const via_class = ansm.c[head] || ansm.c[partner] || ANSM_CLASS[head.toLowerCase().replace(/^autres /, '')] || ANSM_CLASS[partner.toLowerCase().replace(/^autres /, '')];
  const [s, o] = ANSM_LEVEL[level];
  const t = [ansm_en[risk], ansm_en[todo] && `What to do: ${ansm_en[todo]}`].filter(Boolean).join(' ');
  state(a, b, { r: 'fr', s, o, t: t || o, g: [risk, todo].filter(Boolean).join(' | '), u: ANSM_URL_TEXT, n: `ANSM thesaurus: ${head.toLowerCase()} + ${partner.toLowerCase()}`,
    c: via_class ? [head, partner].filter(n => n !== head || a.length > 1).join(' + ').toLowerCase() : undefined, f: effects(`${ansm_en[risk] ?? ''}`.toLowerCase()) }, via_class ? 1 : 0);
}

// Denmark: professional text plus the consumer version's plain explanation
const dk_en: Record<string, string> = existsSync('data/sources/dk.en.json') ? json('data/sources/dk.en.json') : {};
const DK_LEVEL: Record<number, [string, string]> = { 1: ['a', 'the combination should be avoided'], 2: ['a', 'the combination should be avoided (class effect)'],
  3: ['c', 'can be used with dose adjustment'], 4: ['c', 'can be used if taken at different times'], 5: ['c', 'can be used with certain precautions'],
  7: ['m', 'can be used'], 8: ['m', 'can be used, with attention'] };
const DK_SIGNIFICANCE: Record<string, string> = { udtal: 'pronounced', moder: 'moderate', ringe: 'slight', mulig: 'possible', ingen: 'none', uafkl: 'unclear' };
const DK_DOCUMENTATION: Record<string, string> = { vel: 'well documented', 'dok.': 'documented', 'begr.': 'limited documentation', ringe: 'poorly documented' };
for (const r of json('data/sources/dk.json')) {
  const a = resolve(r.a[0]), b = resolve(r.b[0]);
  if (!a || !b || !DK_LEVEL[r.r]) continue;
  let [s, o] = DK_LEVEL[r.r];
  if (s === 'm' && r.k === 'ingen') s = 'n';
  const en = (t: string) => (t && dk_en[t]) || '';
  const t = [en(r.t), en(r.h) && `What to do: ${en(r.h)}`, `Clinical significance: ${DK_SIGNIFICANCE[r.k] ?? 'unknown'}; ${DK_DOCUMENTATION[r.e] ?? ''}.`].filter(Boolean).join(' ');
  state([a], [b], { r: 'dk', s, o, t, p: [en(r.c[1]), en(r.c[0])].filter(Boolean).join(' ') || undefined, g: [r.t, r.h].filter(Boolean).join(' | '),
    u: SOURCES.dk[1], n: `Danish interaction database: ${r.a[0]} + ${r.b[0]}`, f: effects(`${en(r.t)} ${en(r.c[1])}`.toLowerCase()) }, 0);
}

// US Veterans Affairs
for (const r of json('data/sources/ndfrt.json')) {
  if (!r.v) continue;
  const s = r.s === 'c' ? 'a' : 'c';
  state([resolve(r.a)], [resolve(r.b)], { r: 'va', s, o: r.s === 'c' ? 'critical' : 'significant', t: `Listed as a ${r.s === 'c' ? 'critical' : 'significant'} drug interaction in the VA National Drug File.`, u: SOURCES.va[1], n: 'VA NDF-RT 2014', f: [] }, 0);
}

// ONC lists
for (const [file, s, o] of [['ONC_High_Priority_Mapped.csv', 'a', 'high priority'], ['ONC_Non_Interuptive_Mapped.csv', 'm', 'non-interruptive']]) {
  for (const row of readFileSync(`data/cache/pddi/${file}`, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const [x, , y] = row.split('$');
    if (x && y) state([resolve(x)], [resolve(y)], { r: 'onc', s, o, t: o === 'high priority' ? 'On the ONC list of high-priority drug-drug interactions that should always alert prescribers.' : 'On the ONC list of interactions judged not to need an interruptive alert.', u: SOURCES.onc[1], n: `ONC ${o} list`, f: [] }, 0);
  }
}

// Wikidata: no severity given, so it only counts as "reported" (caution) and never raises a pair other sources rate
for (const row of readFileSync('data/cache/wd_p769.csv.gz').length ? (await import('node:zlib')).gunzipSync(readFileSync('data/cache/wd_p769.csv.gz')).toString().split('\n').slice(1) : []) {
  const cols = row.split(',');
  if (cols.length < 4) continue;
  const a = resolve(cols[1]), b = resolve(cols[3]);
  if (a && b) state([a], [b], { r: 'wd', s: 'c', o: 'listed', t: 'Listed as a significant drug interaction in Wikidata (no severity given).', u: `${cols[0]}`, n: 'Wikidata', f: [] }, 0);
}

// Guideline rules written here (Beers, ONC classes)
for (const rule of CURATED) {
  const expand = (names: string[]) => names.flatMap(n => n.startsWith('class:') ? [...members(n.slice(6))] : [resolve(n)]).filter(Boolean);
  state(expand(rule.a), expand(rule.b), { r: rule.r, s: rule.s, o: rule.o, t: rule.t, u: SOURCES[rule.r][1], n: rule.n, f: effects(rule.t.toLowerCase()), c: rule.c }, 1);
}

// Mechanism: one evidence per rule, shared by every pair it covers
const mech = json('data/sources/mechanism.json');
const mech_ev = mech.m.map(([r, s, c, t]: string[]) => ({ r: 'mech', s, o: 'possible, by mechanism', t, u: SOURCES.mech[1], n: `Mechanism rule: ${r}`, c, f: effects(t.toLowerCase()) }));
for (const [a, b, k] of mech.p) state([a], [b], mech_ev[k], 1);

// Merge: per source, statements about the exact pair replace that source's class statements; then the highest severity wins.
// p: [a, b, severity, sources, evidence indexes (strongest first, at most 12)]
const out: [string, string, string, string, number[]][] = [];
for (const [key, list] of pairs) {
  const [a, b] = key.split('|');
  const by_source = new Map<string, [number, number][]>();
  for (const st of list) { const r = evidence[st[0]].r; (by_source.get(r) ?? by_source.set(r, []).get(r)!).push(st); }
  let severity = -1;
  const kept: number[] = [];
  for (const [r, sts] of by_source) {
    const direct = sts.filter(([, c]) => !c);
    const use = direct.length ? direct : sts;
    const levels = use.map(([e]) => SEV[evidence[e].s]);
    const level = levels.some(l => l > 0) ? Math.max(...levels) : 0;
    // Wikidata (unrated) and mechanism inference count only when no documented source covers the pair
    const documented = [...by_source.keys()].some(x => x !== 'wd' && x !== 'mech');
    if (documented ? r !== 'wd' && r !== 'mech' : r === 'mech' || !by_source.has('mech')) severity = Math.max(severity, level);
    kept.push(...use.map(([e]) => e));
  }
  // a label's table often repeats its text word for word: keep one of each
  const seen_text = new Set<string>();
  const unique = kept.filter(e => { const k = `${evidence[e].r}|${evidence[e].t.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 160)}`; return !seen_text.has(k) && seen_text.add(k); });
  kept.length = 0;
  kept.push(...unique);
  kept.sort((x, y) => SEV[evidence[y].s] - SEV[evidence[x].s] || (evidence[x].c ? 1 : 0) - (evidence[y].c ? 1 : 0));
  out.push([a, b, 'nmcax'[severity], [...by_source.keys()].join(','), kept.slice(0, 12)]);
}
mkdirSync('data/out', { recursive: true });
writeFileSync('data/out/pairs.json', JSON.stringify(out));
writeFileSync('data/out/evidence.json', JSON.stringify(evidence));
const count = (s: string) => out.filter(p => p[2] === s).length;
console.log(out.length, 'pairs: x', count('x'), 'a', count('a'), 'c', count('c'), 'm', count('m'), 'n', count('n'), ';', evidence.length, 'evidence;', vocab.c.length, 'concepts');
for (const r of Object.keys(SOURCES)) console.log(r, out.filter(p => p[3].split(',').includes(r)).length, 'pairs', out.filter(p => p[3] === r).length, 'only here');
