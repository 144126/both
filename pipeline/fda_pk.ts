// FDA "Examples of Drugs that Interact with CYP Enzymes and Transporter Systems" (public domain): per drug, which enzymes or
// transporters it inhibits or induces (and how strongly) and which it depends on. Usage: node pipeline/fda_pk.ts -> data/fda_pk.json
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

export const FDA_PK_URL = 'https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems';
const html = execSync(`curl -sL -A Mozilla/5.0 ${FDA_PK_URL}`, { maxBuffer: 1 << 26 }).toString();
const cell = (c: string) => c.replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const rows = html.match(/<table[\s\S]*?<\/table>/)![0].match(/<tr[\s\S]*?<\/tr>/g)!.map(r => (r.match(/<t[dh][\s\S]*?<\/t[dh]>/g) ?? []).map(cell));

// Per drug: role -> target -> strength. Roles: i inhibitor, d inducer, s substrate (s sensitive, m moderately sensitive),
// ti transporter inhibitor, ts transporter substrate. Strengths: s strong, m moderate, w weak, '' not graded.
const out: Record<string, Record<string, Record<string, string>>> = {};
const COLUMNS: [string, string][] = [['i', 's'], ['i', 'm'], ['i', 'w'], ['d', 's'], ['d', 'm'], ['d', 'w'], ['s', 's'], ['s', 'm'], ['ti', ''], ['ts', '']];
for (const [name, ...cells] of rows.slice(1)) {
  // footnote digits stick to names ("adefovir1", "grapefruit juice9"); "&" joins fixed combinations
  const drug = name.toLowerCase().replace(/(?<=[a-z)])\d+$/, '').trim();
  cells.forEach((text, c) => {
    if (!text) return;
    const [role, strength] = COLUMNS[c];
    for (const target of text.split(/,|;|\band\b/).map(t => t.trim().split(/\s+/)[0]).filter(Boolean)) {
      ((out[drug] ??= {})[role] ??= {})[target.replace(/^CYP/i, '').toUpperCase()] = strength;
    }
  });
}
writeFileSync('data/fda_pk.json', JSON.stringify(out, null, 0));
console.log(Object.keys(out).length, 'drugs');
