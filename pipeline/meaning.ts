// Meaning search for the offline app: blink-8M int8 (model2vec static embeddings, per-row symmetric int8, ~/models/static-int8) plus one
// vector per drug from its name, its classes in plain words and its FDA classes. Usage: node pipeline/meaning.ts (after bundle.ts)
// -> site/static/app/<version>/meaning.bin.gz, vocab.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { CLASSES } from './classes.ts';
import { concept, resolve, vocab } from './resolve.ts';
import { embed, type Table } from '../site/src/lib/wordpiece.ts';

const MODEL = `${process.env.HOME}/models/static-int8/blink-8M-int8.safetensors`;
const TOKENIZER = `${process.env.HOME}/models/blink-8M/tokenizer.json`;
const { BASE } = await import('../site/src/lib/bundle.ts');
const dir = `site/static${BASE}`;

const buf = readFileSync(MODEL);
const n = Number(buf.readBigUInt64LE(0));
const header = JSON.parse(buf.subarray(8, 8 + n).toString());
const body = buf.subarray(8 + n);
const [rows, dim] = header.embeddings.shape;
const slice = (k: string) => body.subarray(header[k].data_offsets[0], header[k].data_offsets[1]);
const q = new Int8Array(Uint8Array.from(slice('embeddings')).buffer), s = new Float32Array(Uint8Array.from(slice('scales')).buffer);
const vocab_obj: Record<string, number> = JSON.parse(readFileSync(TOKENIZER, 'utf8')).model.vocab;
const table: Table = { vocab: new Map(Object.entries(vocab_obj)), q, s, dim };

// the words people use for each class, as a pharmacist hears them at the counter
const LAY: Record<string, string> = {
  anticoagulant: 'blood thinner, prevents blood clots, stroke prevention', antiplatelet: 'blood thinner, prevents clots, heart attack prevention',
  diuretic: 'water pill, fluid pill, swelling', loop_diuretic: 'water pill, fluid pill, swelling, heart failure', thiazide: 'water pill, blood pressure',
  k_sparing: 'water pill', benzodiazepine: 'sleeping pill, anxiety pill, nerve pill, tranquilizer', cns_depressant: 'sleeping pill, sleep aid, sedative',
  nsaid: 'pain killer, pain reliever, anti-inflammatory, arthritis, fever', opioid: 'strong pain killer, narcotic pain medicine', statin: 'cholesterol pill',
  fibrate: 'cholesterol, triglycerides', ace_inhibitor: 'blood pressure pill, heart failure', arb: 'blood pressure pill', ccb: 'blood pressure pill, chest pain',
  beta_blocker: 'blood pressure pill, heart pill, heart rate', antihypertensive: 'blood pressure pill', antiarrhythmic: 'heart rhythm pill, irregular heartbeat',
  nitrate: 'chest pain, angina', digoxin: 'heart pill, heart failure', ppi: 'heartburn, acid reflux, stomach ulcer, stomach acid',
  h2: 'heartburn, acid reflux, stomach acid', acid_reducer: 'heartburn, stomach acid', cation: 'antacid, heartburn, mineral supplement',
  antiepileptic: 'seizure medicine, epilepsy', hormonal_contraceptive: 'birth control pill, contraceptive', estrogen: 'hormone, menopause',
  antidiabetic: 'diabetes medicine, blood sugar', insulin: 'diabetes, blood sugar, injection', sulfonylurea: 'diabetes pill, blood sugar',
  ssri: 'antidepressant, depression, anxiety', snri: 'antidepressant, depression, nerve pain', tca: 'antidepressant, depression, nerve pain, sleep',
  maoi: 'antidepressant', antipsychotic: 'schizophrenia, bipolar, psychosis', thyroid: 'thyroid pill', corticosteroid: 'steroid, inflammation, asthma',
  fluoroquinolone: 'antibiotic, infection', macrolide: 'antibiotic, infection', tetracycline: 'antibiotic, infection, acne', aminoglycoside: 'antibiotic, infection',
  azole: 'antifungal, fungal infection, yeast infection', triptan: 'migraine', stimulant: 'adhd, attention, stimulant', dopamine_agonist: 'parkinson',
  cholinesterase_inhibitor: 'dementia, alzheimer, memory', muscle_relaxant: 'muscle relaxer, back spasm', alpha_blocker: 'prostate, urination',
  pde5: 'erectile dysfunction, impotence', immunosuppressant: 'transplant, immune system', antineoplastic: 'cancer, chemotherapy',
  gabapentinoid: 'nerve pain, seizures', anticholinergic: 'overactive bladder, allergy, dries secretions', protease_inhibitor: 'hiv, hepatitis c',
};

// targets: every drug with interactions, described in words people use
const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8')) as { c: [string, string][]; m: string[][] };
const targets: number[] = [], vectors: Float32Array[] = [];
index.c.forEach(([name, slug], i) => {
  if (!slug) return;
  const c = concept.get(name);
  const words = [name, ...(index.m[i] ?? []).flatMap(k => [CLASSES[k].n, LAY[k] ?? '']).filter(Boolean), ...[...(c?.e ?? []), ...(c?.m ?? [])].map(e => e.replace(/\s*\[[^\]]*\]$/, ''))];
  targets.push(i);
  vectors.push(embed([...new Set(words)].join('. '), table));
});
// w: how common the drug is, 0..255, so warfarin ranks above fluindione for "blood thinner": US prescription fills (AHRQ MEPS 2017-2023,
// from rxfill's meps.json, keys "name|strength|unit|form") plus a small share for each product name sold with it
const fills = new Map<string, number>();
for (const [key, by_day] of Object.entries(JSON.parse(readFileSync(`${process.env.HOME}/models/rxfill/meps.json`, 'utf8')) as Record<string, Record<string, number>>)) {
  const total = Object.values(by_day).reduce((x, y) => x + y, 0);
  for (const part of key.split('|')[0].split(/[-/;]| and /)) { const id = resolve(part.trim()); if (id) fills.set(id, (fills.get(id) ?? 0) + total); }
}
const products = new Map<string, number>();
for (const ids of Object.values(vocab.p)) for (const id of ids) products.set(id, (products.get(id) ?? 0) + 1);
const common = targets.map(i => { const n = index.c[i][0]; return Math.log1p((fills.get(n) ?? 0) + 5 * (products.get(n) ?? 0)); });
const top = Math.max(...common);
const w = Uint8Array.from(common, c => Math.round((255 * c) / top));
const T = targets.length;
const tq = new Int8Array(T * dim), ts = new Float32Array(T);
vectors.forEach((v, r) => {
  let m = 0;
  for (const x of v) m = Math.max(m, Math.abs(x));
  ts[r] = m / 127 || 1;
  for (let d = 0; d < dim; d++) tq[r * dim + d] = Math.round(v[d] / ts[r]);
});

// meaning.bin (gzip): u32 [rows, dim, targets, 0]; f32 scales[rows]; f32 target scales[T]; u16 target drug ids[T] (+2 pad bytes when T is odd);
// i8 table[rows * dim]; i8 target vectors[T * dim]; u8 commonness[T]
const ids = Uint16Array.from(targets);
const parts = [Uint32Array.of(rows, dim, T, 0), s, ts, ids, ...(T % 2 ? [new Uint16Array(1)] : []), q, tq, w];
writeFileSync(`${dir}/meaning.bin.gz`, gzipSync(Buffer.concat(parts.map(p => Buffer.from(p.buffer, p.byteOffset, p.byteLength))), { level: 9 }));
const tokens: string[] = [];
for (const [t, id] of Object.entries(vocab_obj)) tokens[id] = t;
writeFileSync(`${dir}/vocab.txt`, tokens.join('\n'));
console.log(rows, 'x', dim, 'table;', T, 'drug vectors');
