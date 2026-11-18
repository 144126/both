// Norway's national interaction database from FEST (Norwegian Medical Products Agency, NLOD licence: free reuse with attribution).
// Usage: node pipeline/fest.ts -> data/sources/fest.json
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

export const FEST_URL = 'https://www.dmp.no/globalassets/documents/om-oss/distribusjon-av-legemiddeldata/fest/festfiler/fest251.zip';
const xml = execSync(`curl -sf --retry 3 ${FEST_URL} | funzip`, { maxBuffer: 1 << 28 }).toString();
const text = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
const tag = (s: string, t: string) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(s); return m ? text(m[1]) : ''; };
const attr = (s: string, t: string) => new RegExp(`<${t} V="([^"]*)"`).exec(s)?.[1] ?? '';

// Norwegian substance name -> English name, from the substance register
const english = new Map<string, string>();
for (const m of xml.matchAll(/<Virkestoff [^>]*>[\s\S]*?<Navn>([^<]*)<\/Navn>\s*<NavnEngelsk>([^<]*)<\/NavnEngelsk>/g)) english.set(text(m[1]).toLowerCase(), text(m[2]).toLowerCase());

// i: id; d: last change; s: 1 avoid, 2 take precautions, 3 no action needed; e: evidence 1 interaction studies, 2 case reports,
// 3 both, 4 indirect data; c: clinical consequence; k: mechanism; h: handling (all Norwegian); r: references [source, link];
// g: two sides, each a list of substances [Norwegian name, English name, ATC]
const records = [];
for (const m of xml.matchAll(/<OppfInteraksjon>([\s\S]*?)<\/OppfInteraksjon>/g)) {
  const o = m[1];
  if (attr(o, 'Status') !== 'A') continue;
  const g = [...o.matchAll(/<Substansgruppe>([\s\S]*?)<\/Substansgruppe>/g)].map(sg =>
    [...sg[1].matchAll(/<Substans>\s*<Substans>([^<]*)<\/Substans>\s*(?:<Atc V="([^"]*)")?/g)].map(s => [text(s[1]), english.get(text(s[1]).toLowerCase()) ?? '', s[2] ?? '']));
  if (g.length !== 2) continue;
  records.push({ i: tag(o, 'Id'), d: tag(o, 'Tidspunkt').slice(0, 10), s: +attr(o, 'Relevans'), e: +attr(o, 'Kildegrunnlag') || 0,
    c: tag(o, 'KliniskKonsekvens'), k: tag(o, 'Interaksjonsmekanisme'), h: tag(o, 'Handtering'),
    r: [...o.matchAll(/<Referanse>([\s\S]*?)<\/Referanse>/g)].map(r => [tag(r[1], 'Kilde'), attr(r[1], 'Lenke')]), g });
}
mkdirSync('data/sources', { recursive: true });
writeFileSync('data/sources/fest.json', JSON.stringify(records));
const missing = new Set(records.flatMap(r => r.g.flat().filter(s => !s[1]).map(s => s[0])));
console.log(records.length, 'interactions;', english.size, 'english names;', missing.size, 'substances without english name:', [...missing].slice(0, 30).join(', '));
