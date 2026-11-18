// Interactions inferred from mechanism: each drug's own risks (from the warnings of its FDA label and from its class) and enzyme roles
// (FDA table and the label's own pharmacokinetics statements), combined by pharmacology rules. Shown as "possible, by mechanism".
// Usage: node pipeline/mechanism.ts -> data/sources/mechanism.json
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { plain } from './names.ts';
import { concept, members, resolve, roles_of, vocab } from './resolve.ts';

// Risks a label warns about in its boxed warning or warnings sections, as the drug's own property
const RISKS: Record<string, RegExp> = {
  qt: /qtc? (?:interval )?prolongation|prolongs? (?:the )?qtc?|torsades? de pointes/,
  liver: /hepatotoxicity|hepatic failure|liver failure|drug-induced liver injury|severe liver injury|hepatic injury/,
  kidney: /nephrotoxicity|acute kidney injury|renal failure|renal toxicity/,
  marrow: /myelosuppression|bone marrow suppression|agranulocytosis|neutropenia|pancytopenia/,
  sugar_low: /hypoglyc[ae]mia/,
  slow_heart: /bradycardia|bradyarrhythmia|heart block|atrioventricular block/,
  bp_low: /hypotension|orthostatic/,
  seizure: /(?:lowers?|reduces?|decreases?) (?:the )?seizure threshold|(?:can|may) cause seizures|seizures (?:have been|were) reported|risk of seizures?|(?:induce|cause)s? (?:seizures|convulsions)/,
  serotonin: /serotonin syndrome/,
  breathing: /respiratory depression/,
  bleed: /bleeding|hemorrhage/,
  k_high: /hyperkal[ae]mia/,
  k_low: /hypokal[ae]mia/,
  immune: /serious infections|immunosuppression|opportunistic infections/,
  sodium_low: /hyponatr[ae]mia|siadh/,
};
const NEGATED = /\bno (?:clinically )?(?:significant|relevant|meaningful)?\s*(?:evidence|effect|cases?|reports?)|did not (?:prolong|cause|show|result)|not associated with|was not observed|were not observed/;
const SECTIONS = ['boxed_warning', 'warnings_and_cautions', 'warnings'];

const own = new Map<string, Set<string>>();   // concept -> risks its label warns of
const roles = new Map<string, Set<string>>(); // concept -> enzyme roles "i:3A:s", from its own label
const add = (m: Map<string, Set<string>>, id: string, v: string) => (m.get(id) ?? m.set(id, new Set()).get(id)!).add(v);
const ENZ: Record<string, string> = { '3a': '3A', '3a4': '3A', '3a5': '3A', '3a4/5': '3A', '2d6': '2D6', '2c9': '2C9', '2c19': '2C19', '1a2': '1A2', '2c8': '2C8', '2b6': '2B6' };
const STRENGTH: Record<string, string> = { strong: 's', potent: 's', moderate: 'm', weak: 'w', mild: 'w' };

for (const line of gunzipSync(readFileSync('data/cache/labels.jsonl.gz')).toString().split('\n')) {
  if (!line) continue;
  const l = JSON.parse(line);
  if (l.i.length !== 1 || l.t !== 'r') continue;
  const id = resolve(l.i[0]);
  if (!id) continue;
  for (const s of SECTIONS) {
    const text = plain(l.p[s] ?? '');
    for (const sentence of text.split(/(?<=[.;])\s+/)) {
      if (NEGATED.test(sentence)) continue;
      for (const [risk, re] of Object.entries(RISKS)) if (re.test(sentence)) add(own, id, risk);
    }
  }
  // "X is a strong inhibitor of CYP3A4", "a moderate CYP2D6 inhibitor", "is a sensitive CYP3A substrate", "metabolized primarily by CYP3A4"
  const pk = plain(`${l.p.drug_interactions ?? ''} ${l.p.pharmacokinetics ?? ''} ${l.p.clinical_pharmacology ?? ''}`);
  const names = [id, ...l.b.map(plain), ...l.n.map(plain)].filter(n => n.length > 3).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const self = `(?:${names}|it|this drug)`;
  for (const m of pk.matchAll(new RegExp(`\\b${self} (?:is|acts as) an? (strong|potent|moderate|weak|mild) (?:and time-dependent |time-dependent |mechanism-based |reversible )?(inhibitor|inducer) of (?:human )?cyp ?(3a4\\/5|3a4|3a5|3a|2d6|2c9|2c19|1a2|2c8|2b6)`, 'g')))
    add(roles, id, `${m[2] === 'inhibitor' ? 'i' : 'd'}:${ENZ[m[3]]}:${STRENGTH[m[1]]}`);
  for (const m of pk.matchAll(new RegExp(`\\b${self} is an? (strong|potent|moderate|weak|mild) cyp ?(3a4\\/5|3a4|3a5|3a|2d6|2c9|2c19|1a2|2c8|2b6) (inhibitor|inducer)`, 'g')))
    add(roles, id, `${m[3] === 'inhibitor' ? 'i' : 'd'}:${ENZ[m[2]]}:${STRENGTH[m[1]]}`);
  for (const m of pk.matchAll(new RegExp(`\\b${self} is an? sensitive (?:cyp ?)?(3a4\\/5|3a4|3a5|3a|2d6|2c9|2c19|1a2|2c8|2b6) substrate|\\b${self} is (?:primarily|predominantly|mainly|extensively) metabolized by cyp ?(3a4\\/5|3a4|3a5|3a|2d6|2c9|2c19|1a2|2c8|2b6)`, 'g')))
    add(roles, id, `s:${ENZ[m[1] ?? m[2]]}:m`);
}
const role = (id: string) => new Set([...roles_of(id), ...(roles.get(id) ?? [])]);

// property sets: own label warnings, plus class membership for drugs known by class
const prop = (risk: string, ...classes: string[]) => {
  const out = new Set<string>();
  for (const [id, r] of own) if (r.has(risk)) out.add(id);
  for (const c of classes) for (const id of members(c)) out.add(id);
  return out;
};
const P = {
  qt: prop('qt', 'qt'), k_low: prop('k_low', 'hypokalemic'), cns: prop('breathing', 'cns_depressant'), serotonin: prop('serotonin', 'serotonergic'),
  immune: prop('immune', 'immunosuppressant'), live: members('live_vaccine'), k_high: prop('k_high', 'hyperkalemic'), kidney: prop('kidney', 'nephrotoxic'),
  liver: prop('liver'), marrow: prop('marrow', 'antineoplastic'), sugar_low: prop('sugar_low', 'insulin', 'sulfonylurea'),
  bp_low: prop('bp_low', 'antihypertensive', 'alpha_blocker', 'nitrate', 'pde5'), slow_heart: prop('slow_heart', 'beta_blocker', 'nondhp_ccb', 'digoxin'),
  seizure: prop('seizure', 'seizure_threshold'), bleed: new Set([...members('anticoagulant'), ...members('antiplatelet'), ...members('thrombolytic')]),
  bleed_minor: new Set([...members('nsaid'), ...members('ssri'), ...members('snri')]), anticholinergic: members('anticholinergic'),
  cholinergic: members('cholinesterase_inhibitor'), sympathomimetic: members('stimulant'), cation: members('cation'),
  chelates: new Set([...members('fluoroquinolone'), ...members('tetracycline'), ...['dolutegravir', 'bictegravir', 'raltegravir', 'cabotegravir', 'elvitegravir',
    'levothyroxine', 'alendronate', 'risedronate', 'ibandronate', 'mycophenolate mofetil', 'penicillamine', 'eltrombopag', 'deferiprone', 'trientine', 'baloxavir marboxil'].map(resolve).filter(Boolean)]),
};

// r: rule id; a, b: sets; s: severity; t: explanation (both directions); c: what the drugs have in common
type Rule = { r: string; a: Set<string>; b: Set<string>; s: string; t: string; c: string };
const RULES: Rule[] = [
  { r: 'qt', a: P.qt, b: P.qt, s: 'c', c: 'both can prolong the QT interval', t: 'Both drugs can prolong the QT interval of the heartbeat; together they add to the risk of torsades de pointes, a dangerous rhythm. Check whether both are needed; consider an ECG and keep potassium and magnesium normal.' },
  { r: 'k_low_qt', a: P.k_low, b: P.qt, s: 'c', c: 'one lowers potassium, the other prolongs QT', t: 'Low potassium from one drug makes the QT-prolonging effect of the other more dangerous. Monitor potassium and magnesium.' },
  { r: 'cns', a: P.cns, b: P.cns, s: 'c', c: 'both slow the brain and breathing', t: 'Both drugs slow the central nervous system; together they cause more sleepiness, dizziness, falls and slowed breathing. Use the lowest doses and avoid alcohol.' },
  { r: 'serotonin', a: P.serotonin, b: P.serotonin, s: 'c', c: 'both raise serotonin', t: 'Both drugs raise serotonin; together they can cause serotonin syndrome (agitation, sweating, fever, tremor, fast heartbeat). Watch for these signs, especially when starting or raising a dose.' },
  { r: 'immune', a: P.immune, b: P.immune, s: 'c', c: 'both weaken the immune system', t: 'Both drugs suppress the immune system; together they raise the risk of serious infections. Combine only when intended and watch for infection.' },
  { r: 'live_vaccine', a: P.immune, b: P.live, s: 'a', c: 'a live vaccine with an immune-suppressing drug', t: 'A live vaccine can cause the infection it protects against when the immune system is suppressed. Avoid live vaccines during treatment.' },
  { r: 'k_high', a: P.k_high, b: P.k_high, s: 'c', c: 'both raise potassium', t: 'Both drugs raise blood potassium; together they can cause hyperkalemia, which affects the heart. Check potassium and kidney function.' },
  { r: 'kidney', a: P.kidney, b: P.kidney, s: 'c', c: 'both can harm the kidneys', t: 'Both drugs can damage the kidneys; together the risk adds up. Monitor kidney function and keep well hydrated.' },
  { r: 'liver', a: P.liver, b: P.liver, s: 'c', c: 'both can harm the liver', t: 'Both drugs can injure the liver; together the risk adds up. Monitor liver tests.' },
  { r: 'marrow', a: P.marrow, b: P.marrow, s: 'c', c: 'both can lower blood counts', t: 'Both drugs can suppress the bone marrow; together they raise the risk of infection, anemia and bleeding. Monitor blood counts.' },
  { r: 'bleed', a: P.bleed, b: P.bleed, s: 'c', c: 'both affect blood clotting', t: 'Both drugs reduce blood clotting; together they raise the risk of bleeding. Confirm the combination is intended and watch for bleeding.' },
  { r: 'bleed_minor', a: P.bleed, b: P.bleed_minor, s: 'c', c: 'a blood thinner with a drug that adds bleeding risk', t: 'The second drug adds to the bleeding risk of the blood thinner (stomach bleeding in particular). Watch for bleeding; consider stomach protection.' },
  { r: 'bp_low', a: P.bp_low, b: P.bp_low, s: 'm', c: 'both lower blood pressure', t: 'Both drugs lower blood pressure; together they can cause dizziness or fainting, especially when standing up. Usually intended; rise slowly.' },
  { r: 'slow_heart', a: P.slow_heart, b: P.slow_heart, s: 'c', c: 'both slow the heart', t: 'Both drugs slow the heart rate or conduction; together they can cause a heartbeat that is too slow or heart block. Monitor pulse.' },
  { r: 'seizure', a: P.seizure, b: P.seizure, s: 'c', c: 'both can lower the seizure threshold', t: 'Both drugs can make seizures more likely; together the risk adds up, especially with a seizure history.' },
  { r: 'sugar', a: P.sugar_low, b: P.sugar_low, s: 'c', c: 'both lower blood sugar', t: 'Both drugs lower blood sugar; together they raise the risk of hypoglycemia. Check blood sugar more often.' },
  { r: 'cholinergic', a: P.anticholinergic, b: P.cholinergic, s: 'c', c: 'opposite effects on acetylcholine', t: 'The anticholinergic drug works against the dementia drug, so one or both can work less well.' },
  { r: 'stimulant', a: P.sympathomimetic, b: P.sympathomimetic, s: 'c', c: 'both stimulate the heart and blood pressure', t: 'Both drugs stimulate the sympathetic nervous system; together they can raise heart rate and blood pressure.' },
  { r: 'contrast_metformin', a: members('contrast'), b: new Set([resolve('metformin')]), s: 'c', c: 'iodinated contrast with metformin', t: 'Contrast dye can strain the kidneys, and metformin can then build up and cause lactic acidosis. Metformin is usually paused at the time of the scan and restarted 48 hours later once kidney function is confirmed.' },
  { r: 'steroid_quinolone', a: members('corticosteroid'), b: members('fluoroquinolone'), s: 'c', c: 'a corticosteroid with a quinolone antibiotic', t: 'Quinolone antibiotics can rupture tendons, and the risk is higher with corticosteroids, especially in people over 60. Stop and seek advice at the first sign of tendon pain.' },
  { r: 'steroid_nsaid', a: members('corticosteroid'), b: members('nsaid'), s: 'c', c: 'a corticosteroid with an NSAID', t: 'Together they raise the risk of stomach ulcers and bleeding. Use the lowest doses for the shortest time; consider stomach protection.' },
  { r: 'chelation', a: P.cation, b: P.chelates, s: 'c', c: 'a mineral or antacid with a drug it binds', t: 'Aluminum, calcium, iron, magnesium or zinc bind the other drug in the gut so less is absorbed and it may not work. Take them several hours apart.' },
];

// enzyme rules: a perpetrator's role against a victim that depends on the same enzyme
const enzymes = ['3A', '2D6', '2C9', '2C19', '1A2', '2C8', '2B6'];
const by_role = (want: (r: Set<string>) => boolean) => new Set(vocab.c.map(c => c.n).filter(id => want(role(id))));
for (const e of enzymes) {
  const sensitive = by_role(r => r.has(`s:${e}:s`)), moderate = by_role(r => r.has(`s:${e}:m`));
  const strong_i = by_role(r => r.has(`i:${e}:s`)), mod_i = by_role(r => r.has(`i:${e}:m`));
  const strong_d = by_role(r => r.has(`d:${e}:s`)), mod_d = by_role(r => r.has(`d:${e}:m`));
  const name = `CYP${e}`;
  RULES.push(
    { r: `${e}_i_s`, a: strong_i, b: sensitive, s: 'a', c: `strong ${name} inhibitor with a drug that depends on ${name}`, t: `The first drug strongly blocks ${name}, the liver enzyme that clears the second; its levels can rise several-fold, with more side effects. Avoid, or lower the dose of the affected drug and monitor.` },
    { r: `${e}_i_m`, a: mod_i, b: sensitive, s: 'c', c: `moderate ${name} inhibitor with a drug that depends on ${name}`, t: `The first drug blocks ${name}, which clears the second; its levels can rise. A lower dose and monitoring may be needed.` },
    { r: `${e}_i_s2`, a: strong_i, b: moderate, s: 'c', c: `strong ${name} inhibitor with a drug partly cleared by ${name}`, t: `The first drug strongly blocks ${name}, which helps clear the second; its levels can rise. Monitor for side effects.` },
    { r: `${e}_d_s`, a: strong_d, b: new Set([...sensitive, ...moderate]), s: 'a', c: `strong ${name} inducer with a drug cleared by ${name}`, t: `The first drug strongly speeds up ${name}, so the second is cleared faster and can stop working. Avoid, or monitor the effect closely.` },
    { r: `${e}_d_m`, a: mod_d, b: sensitive, s: 'c', c: `moderate ${name} inducer with a drug that depends on ${name}`, t: `The first drug speeds up ${name}, so the second can be cleared faster and work less well. Monitor the effect.` },
  );
}

// m: [rule id, severity, what they share, explanation]; p: pairs [a, b, rule index]
const out: { m: [string, string, string, string][]; p: [string, string, number][] } = { m: [], p: [] };
for (const rule of RULES) {
  const k = out.m.push([rule.r, rule.s, rule.c, rule.t]) - 1;
  for (const a of rule.a) for (const b of rule.b) if (a !== b && concept.has(a) && concept.has(b)) out.p.push([a, b, k]);
}
writeFileSync('data/sources/mechanism.json', JSON.stringify(out));
console.log(out.p.length, 'mechanism statements;', Object.entries(P).map(([k, v]) => `${k} ${v.size}`).join(', '), '; label roles', roles.size);
