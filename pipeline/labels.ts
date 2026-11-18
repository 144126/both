// Streams every openFDA drug label (public domain, ~1.8 GB zipped) and keeps one current label per product group
// (same ingredients, route and Rx/OTC), with only the sections that describe interactions. Nothing raw is written.
// Each part is saved as it finishes, so a rerun resumes. Usage: node pipeline/labels.ts  ->  data/cache/labels.jsonl.gz
import { execSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

const SECTIONS = ['boxed_warning', 'contraindications', 'drug_interactions', 'drug_interactions_table', 'warnings_and_cautions', 'warnings',
  'precautions', 'dosage_and_administration', 'pharmacokinetics', 'clinical_pharmacology', 'do_not_use', 'ask_doctor_or_pharmacist', 'ask_doctor', 'when_using'];
const TYPES: Record<string, string> = { 'HUMAN PRESCRIPTION DRUG': 'r', 'HUMAN OTC DRUG': 'o' };
const DIR = 'data/cache/labels';

// g: group key; s: set id; v: effective date; a: application numbers; i: ingredients; b: brands; n: generic names; r: routes; t: r Rx / o OTC;
// x: rxcuis; e: EPC classes; m: MoA classes; u: UNIIs; p: sections {name: text}
type Label = { g: string; s: string; v: string; a: string[]; i: string[]; b: string[]; n: string[]; r: string[]; t: string; x: string[]; e: string[]; m: string[]; u: string[]; p: Record<string, string> };

const rank = (l: Label) => `${l.a.some(a => /^(NDA|BLA)/.test(a)) ? 1 : 0}${l.v}`;
const uniq = (a: string[]) => [...new Set(a)].sort();
const merge = (groups: Map<string, Label>, label: Label) => {
  const old = groups.get(label.g);
  if (!old) return void groups.set(label.g, label);
  const [keep, other] = rank(label) > rank(old) ? [label, old] : [old, label];
  for (const k of ['b', 'n', 'x', 'e', 'm', 'u', 'a'] as const) keep[k] = uniq([...keep[k], ...other[k]]);
  groups.set(label.g, keep);
};
const save = (path: string, labels: Iterable<Label>) => {
  writeFileSync(`${path}.tmp`, gzipSync(Array.from(labels, l => JSON.stringify(l)).join('\n')));
  renameSync(`${path}.tmp`, path);
};
const load = (path: string): Label[] => gunzipSync(readFileSync(path)).toString().split('\n').filter(Boolean).map(l => JSON.parse(l));

// Two in three labels lack openFDA's harmonized fields (Paxlovid among them). DailyMed's RxNorm mapping names their ingredients:
// "nirmatrelvir 150 MG / ritonavir 100 MG Oral Tablet", "{20 (nirmatrelvir 150 MG Oral Tablet) / ...} Pack [Paxlovid]"
const FORMS: [RegExp, string][] = [[/\bOral\b|Tablet|Capsule|Chewable|Lozenge|Sublingual|Buccal/, 'oral'], [/Inject|Prefilled|Cartridge|Auto-Injector/, 'injection'],
  [/Topical|Cream|Ointment|Lotion|\bGel\b|Shampoo|Foam/, 'topical'], [/Ophthalmic/, 'ophthalmic'], [/Otic/, 'otic'], [/Nasal/, 'nasal'],
  [/Inhal/, 'respiratory (inhalation)'], [/Rectal|Suppository|Enema/, 'rectal'], [/Vaginal/, 'vaginal'], [/Transdermal/, 'transdermal']];
const mapped = new Map<string, { i: Set<string>; b: Set<string>; r: Set<string>; x: Set<string> }>();
for (const row of execSync('curl -sf --retry 5 https://dailymed-data.nlm.nih.gov/public-release-files/rxnorm_mappings.zip | funzip', { maxBuffer: 1 << 27 }).toString().split('\n').slice(1)) {
  const [set_id, , rxcui, text, tty] = row.split('|');
  if (!text || !/^(SCD|SBD|GPCK|BPCK)$/.test(tty)) continue;
  const m = mapped.get(set_id) ?? mapped.set(set_id, { i: new Set(), b: new Set(), r: new Set(), x: new Set() }).get(set_id)!;
  m.x.add(rxcui);
  const brand = /\[([^\]]+)\]\s*$/.exec(text)?.[1];
  if (brand) m.b.add(brand);
  for (const [re, route] of FORMS) if (re.test(text)) m.r.add(route);
  for (const part of text.replace(/\[[^\]]*\]\s*$/, '').replace(/[{}]/g, ' ').split(/\s+\/\s+/)) {
    const name = /^\s*(?:\d+\s*\(\s*)?(.*?)\s+[\d.,]+\s*(?:MG|MCG|ML|%|UNT|MEQ|MMOL|G|IU|ACTUAT|HR|BAU|PNU|AU|SQ-HDM|CELLS|MG\/ML)\b/i.exec(part)?.[1];
    if (name && !/^\d/.test(name)) m.i.add(name.toLowerCase());
  }
}

mkdirSync(DIR, { recursive: true });
const manifest = JSON.parse(execSync('curl -s --retry 5 https://api.fda.gov/download.json', { maxBuffer: 1 << 26 }).toString());  // node fetch times out on this host
const parts: { file: string; display_name: string }[] = manifest.results.drug.label.partitions;
for (const [n, part] of parts.entries()) {
  const path = `${DIR}/${n}.jsonl.gz`;
  if (existsSync(path)) continue;
  const groups = new Map<string, Label>();
  const unzip = spawn('sh', ['-c', `curl -sf --retry 5 ${part.file} | funzip`], { stdio: ['ignore', 'pipe', 'inherit'] });
  let buffer: string[] | null = null, seen = 0;
  for await (const line of createInterface({ input: unzip.stdout, crlfDelay: Infinity })) {
    if (line === '    {') { buffer = [line]; continue; }
    if (!buffer) continue;
    buffer.push(line);
    if (line !== '    },' && line !== '    }') continue;
    const raw = JSON.parse(buffer.join('\n').replace(/,$/, ''));
    buffer = null; seen++;
    const f = raw.openfda ?? {}, m = mapped.get(raw.set_id);
    if (!f.substance_name?.length && m?.i.size) {
      Object.assign(f, { substance_name: [...m.i], brand_name: [...m.b], generic_name: [], route: [...m.r], rxcui: [...m.x],
        product_type: [raw.purpose || raw.active_ingredient ? 'HUMAN OTC DRUG' : 'HUMAN PRESCRIPTION DRUG'] });
    }
    const t = TYPES[f.product_type?.[0]];
    if (!t || !f.substance_name?.length) continue;
    const p: Record<string, string> = {};
    for (const s of SECTIONS) if (raw[s]?.length) p[s] = raw[s].join('\n');
    const label: Label = { g: '', s: raw.set_id, v: raw.effective_time ?? '', a: f.application_number ?? [], i: uniq(f.substance_name.map((s: string) => s.toLowerCase())),
      b: f.brand_name ?? [], n: f.generic_name ?? [], r: uniq((f.route ?? []).map((r: string) => r.toLowerCase())), t, x: f.rxcui ?? [], e: f.pharm_class_epc ?? [], m: f.pharm_class_moa ?? [], u: f.unii ?? [], p };
    label.g = `${label.i.join('+')}|${label.r.join('+')}|${t}`;
    merge(groups, label);
  }
  if (seen < 1000) throw new Error(`${part.display_name}: only ${seen} labels, download failed`);
  save(path, groups.values());
  console.log(part.display_name, seen, groups.size);
}

const groups = new Map<string, Label>();
for (const n of parts.keys()) for (const label of load(`${DIR}/${n}.jsonl.gz`)) merge(groups, label);
save('data/cache/labels.jsonl.gz', groups.values());
rmSync(DIR, { recursive: true });
console.log('groups', groups.size);
