// Recall against DDInter 2.0 (CC BY-NC-SA, used only as a yardstick, never copied into the dataset): of DDInter's pairs whose two drugs
// we know, how many we flag, and how severities line up. Usage: node pipeline/evaluate.ts
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from './resolve.ts';

const pairs: [string, string, string, string][] = JSON.parse(readFileSync('data/out/pairs.json', 'utf8'));
const ours = new Map(pairs.map(p => [`${p[0]}|${p[1]}`, p[2]]));
const seen = new Set<string>();
const tally: Record<string, Record<string, number>> = {};
for (const f of readdirSync('data/cache/ddinter').filter(f => f.endsWith('.csv'))) {
  for (const row of readFileSync(`data/cache/ddinter/${f}`, 'utf8').split(/\r?\n/).slice(1)) {
    const c = row.split(',');
    if (c.length < 5) continue;
    const a = resolve(c[1]), b = resolve(c[3]), level = c[4].trim();
    if (!a || !b || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = tally[level] ??= {};
    const s = ours.get(key) ?? '-';
    t[s] = (t[s] ?? 0) + 1;
  }
}
for (const [level, t] of Object.entries(tally)) {
  const total = Object.values(t).reduce((x, y) => x + y, 0), found = total - (t['-'] ?? 0);
  console.log(`${level.padEnd(8)} ${total} pairs, we flag ${(100 * found / total).toFixed(1)}%  (x ${t.x ?? 0}, a ${t.a ?? 0}, c ${t.c ?? 0}, m ${t.m ?? 0}, n ${t.n ?? 0}, none ${t['-'] ?? 0})`);
}
