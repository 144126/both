// Repairs machine translations: a drug named in the original but missing from the English is put back in place of the closest word
// ("Warfarins" -> "Warfare" -> "warfarin's"), and unknown-token marks become dashes. Usage: node pipeline/repair.ts (edits data/sources/*.en.json)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { plain } from './names.ts';

const names: Record<string, string> = JSON.parse(readFileSync('data/cache/names.json', 'utf8'));
const lookup = new Map(Object.entries(names).map(([k, v]) => [plain(k), v]));
const distance = (a: string, b: string) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) { const next = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = next; }
  }
  return row[b.length];
};

for (const file of ['fest', 'dk', 'ansm']) {
  const path = `data/sources/${file}.en.json`;
  if (!existsSync(path)) continue;
  const map: Record<string, string> = JSON.parse(readFileSync(path, 'utf8'));
  let fixed = 0;
  for (const [src, en] of Object.entries(map)) {
    let out = en.replace(/\s*<unk>\s*/g, ' – ');
    // each mention counts: "warfarin" elsewhere in the text must not hide one that became "Warfare"
    const wanted = new Map<string, number>();
    for (const w of plain(src).split(/[^a-z0-9-]+/)) { const n = lookup.get(w) ?? lookup.get(w.replace(/'?s$/, '')); if (n) wanted.set(n, (wanted.get(n) ?? 0) + 1); }
    for (const [n, count] of wanted) {
      if (n.includes(' ')) continue;
      for (let have = plain(out).split(/[^a-z0-9-]+/).filter(w => w === n || w === `${n}s`).length; have < count; have++) {
        const words = out.split(/(\s+)/);
        let best = -1, score = 99;
        words.forEach((w, i) => { const k = plain(w).replace(/[^a-z]/g, ''); const d = distance(k, n); if (k !== n && k !== `${n}s` && d < score && d <= Math.max(2, n.length / 3)) { best = i; score = d; } });
        if (best < 0) break;
        words[best] = words[best].replace(/[A-Za-z][A-Za-z'-]*/, n);
        out = words.join('');
        fixed++;
      }
    }
    map[src] = out;
  }
  writeFileSync(path, JSON.stringify(map));
  console.log(file, 'names restored:', fixed);
}
