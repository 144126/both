// European Medicines Agency product information (SmPC), section 4.5 "Interaction with other medicinal products", for every authorised
// human medicine (EMA content may be reused with acknowledgement). PDFs are streamed through pdftotext; only section 4.5 is kept.
// Resumable: finished medicines are appended to data/cache/ema.jsonl. Usage: node pipeline/ema.ts
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const OUT = 'data/cache/ema.jsonl';
const list = JSON.parse(execSync('curl -sfL -A Mozilla/5.0 https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json', { maxBuffer: 1 << 26 }).toString());
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).k) : []);
const meds = list.data.filter((m: Record<string, string>) => m.category === 'Human' && m.medicine_status === 'Authorised');
let n = 0;
for (const m of meds) {
  const slug = m.medicine_url.split('/').pop();
  if (done.has(slug)) continue;
  const url = `https://www.ema.europa.eu/en/documents/product-information/${slug}-epar-product-information_en.pdf`;
  let text = '';
  try {
    text = execSync(`curl -sfL --retry 3 -A Mozilla/5.0 '${url}' | pdftotext -layout - -`, { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch { /* missing PDF: recorded empty so the run moves on */ }
  // the first SmPC's section 4.5 runs to 4.6; the heading wording varies a little between templates
  const s = /4\.5\s+Interaction[^\n]*\n([\s\S]*?)\n\s*4\.6\s/i.exec(text)?.[1] ?? '';
  // k: EMA slug; n: medicine name; i: active substances; a: ATC; u: product information URL; t: section 4.5 text
  appendFileSync(OUT, JSON.stringify({ k: slug, n: m.name_of_medicine, i: m.active_substance, a: m.atc_code_human, u: url, t: s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() }) + '\n');
  if (++n % 25 === 0) console.log(n, 'of', meds.length - done.size);
}
console.log('done', n);
