// US Veterans Affairs drug interactions from NDF-RT (public domain, July 2014 release, mirrored by dbmi-pitt/public-PDDI-analysis).
// Usage: node pipeline/ndfrt.ts -> data/sources/ndfrt.json
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

export const NDFRT_URL = 'https://raw.githubusercontent.com/dbmi-pitt/public-PDDI-analysis/master/PDDI-Datasets/Ndf-rt/NDF-RT_XML.zip';
const xml = execSync(`curl -sfL ${NDFRT_URL} | funzip`, { maxBuffer: 1 << 28 }).toString();
const names = new Map<string, string>();
const concepts = [...xml.matchAll(/<conceptDef><name>([^<]*)<\/name><code>([^<]*)<\/code>[\s\S]*?<\/conceptDef>/g)];
for (const c of concepts) names.set(c[2], c[1].replace(/\s*\[[^\]]*\]$/, '').toLowerCase());

// a, b: ingredient names; s: c critical / s significant; v: 1 active in the VA file, 0 inactive
const records = [];
for (const c of concepts) {
  if (!c[0].includes('<kind>C28120789352836</kind>')) continue;
  const sides = [...c[0].matchAll(/<association><name>[^<]*<\/name><value>([^<]*)<\/value><\/association>/g)].map(a => names.get(a[1]));
  const severity = /<name>C60<\/name><value>([^<]*)</.exec(c[0])?.[1];
  if (sides.length !== 2 || !severity || sides.some(s => !s)) continue;
  records.push({ a: sides[0], b: sides[1], s: severity[0].toLowerCase(), v: /\^Inactive</.test(c[0]) ? 0 : 1 });
}
mkdirSync('data/sources', { recursive: true });
writeFileSync('data/sources/ndfrt.json', JSON.stringify(records));
console.log(records.length, 'interactions;', records.filter(r => r.v).length, 'active;', records.filter(r => r.s === 'c').length, 'critical');
