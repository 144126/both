// Name, ATC and class lookups over data/vocab.json, shared by the build steps.
import { readFileSync } from 'node:fs';
import { CLASSES } from './classes.ts';
import { base, plain, skeleton, US_NAME } from './names.ts';

type Concept = { n: string; s: string[]; a: string[]; x: string[]; u: string[]; e: string[]; m: string[]; l: number; f: number };
export const vocab: { c: Concept[]; p: Record<string, string[]> } = JSON.parse(readFileSync('data/vocab.json', 'utf8'));
export const concept = new Map(vocab.c.map(c => [c.n, c]));

const by_name = new Map<string, string>();
const by_skeleton = new Map<string, Set<string>>();
for (const c of vocab.c) for (const s of [c.n, ...c.s]) {
  if (!by_name.has(s)) by_name.set(s, c.n);
  (by_skeleton.get(skeleton(s)) ?? by_skeleton.set(skeleton(s), new Set()).get(skeleton(s))!).add(c.n);
}
const by_atc = new Map<string, string[]>();
for (const c of vocab.c) for (const a of c.a) (by_atc.get(a) ?? by_atc.set(a, []).get(a)!).push(c.n);

/** Concept id for a drug name in any of the vocabulary's languages, or '' when unknown or ambiguous. */
export function resolve(name: string): string {
  const p = plain(name), b = base(name);
  for (const k of [p, b, US_NAME[p], US_NAME[b]]) if (k && by_name.has(k)) return by_name.get(k)!;
  const twins = by_skeleton.get(skeleton(b));
  return twins?.size === 1 ? [...twins][0] : '';
}
export const atc_members = (prefix: string) => [...by_atc.entries()].filter(([a]) => a.startsWith(prefix)).flatMap(([, ids]) => ids);

// FDA enzyme table roles by concept: "i:3A:s" (strong CYP3A inhibitor), "ts:P-GP:" (P-gp substrate)
const pk = JSON.parse(readFileSync('data/fda_pk.json', 'utf8')) as Record<string, Record<string, Record<string, string>>>;
const roles = new Map<string, Set<string>>();
for (const [drug, by_role] of Object.entries(pk)) for (const part of drug.split(/\s*&\s*/)) {
  const id = resolve(part);
  if (!id) continue;
  for (const [role, targets] of Object.entries(by_role)) for (const [target, strength] of Object.entries(targets))
    (roles.get(id) ?? roles.set(id, new Set()).get(id)!).add(`${role}:${target}:${strength}`);
}
export const roles_of = (id: string) => roles.get(id) ?? new Set<string>();

const member_cache = new Map<string, Set<string>>();
/** Every concept in a class: by FDA class, ATC prefix, explicit list or enzyme role. */
export function members(class_id: string): Set<string> {
  if (member_cache.has(class_id)) return member_cache.get(class_id)!;
  const k = CLASSES[class_id], out = new Set<string>();
  for (const name of k.i ?? []) { const id = resolve(name); if (id) out.add(id); }
  for (const prefix of k.a ?? []) for (const id of atc_members(prefix)) out.add(id);
  if (k.r) for (const c of vocab.c) if (k.r.test(c.n)) out.add(c.n);
  if (k.e) for (const c of vocab.c) if ([...c.e, ...c.m].some(e => k.e!.test(e))) out.add(c.n);
  if (k.k) for (const [id, r] of roles) if (k.k.some(want => r.has(want))) out.add(id);
  if (class_id === 'cyp3a_pgp_i_s') {  // must block P-gp too; strong CYP3A inducers induce P-gp as well, so the inducer class needs no filter
    for (const id of [...out]) if (!roles_of(id).has('ti:P-GP:') && !CLASSES.pgp_i.i!.includes(id)) out.delete(id);
  }
  member_cache.set(class_id, out);
  return out;
}
