// Denmark's interaction database (Danish Medicines Agency), professional and consumer versions, from its public web service with the
// access keys the agency publishes. Usage: node pipeline/dk.ts -> data/sources/dk.json
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const SERVICE = 'https://www.pidb.dk/ws/pidbws.asmx';
const KEYS = { pro: 'F104CDF58E42483B9813E1346BD511', con: '28C0BF85C72E4B6195C83FD6BBC184' };  // published in the agency's download guide
// the service is slow (about 20 minutes per file), so a copy in data/cache/dk is used when present
const download = (key: string, name: string) => {
  if (existsSync(`data/cache/dk/${name}.xml.gz`)) return gunzipSync(readFileSync(`data/cache/dk/${name}.xml.gz`)).toString();
  const id = /<ID_XML_Dokument>([^<]+)</.exec(execSync(`curl -sf -m 60 ${SERVICE}/XML_Dato_4 --data-urlencode AccessKey=${key}`).toString())![1];
  return execSync(`curl -sf --retry 3 ${SERVICE}/XML_Download --data-urlencode AccessKey=${key} --data-urlencode ID_XML_Dokument=${id}`, { maxBuffer: 1 << 28 }).toString();
};
const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<a [^>]*>([^<]*)<\/a>/g, '$1').replace(/<br\s*\/?>|<\/p>/g, '\n').replace(/<[^>]+>/g, '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
const field = (s: string, t: string) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(s); return m ? decode(m[1]) : ''; };
const rows = (xml: string, t: string) => [...xml.matchAll(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, 'g'))].map(m => m[1]);

const pro = download(KEYS.pro, 'pro'), con = download(KEYS.con, 'con');
const stof = new Map(rows(pro, 'STOF').map(r => [field(r, 'ID_Stof'), [field(r, 'Navn'), field(r, 'ID_Stoftype')]]));
const types = new Map(rows(pro, 'STOFTYPE').map(r => [field(r, 'ID_Stoftype'), field(r, 'Forkortelse')]));
const code = (t: string, key: string, value: string) => new Map(rows(pro, t).map(r => [field(r, key), field(r, value)]));
const recommendation = code('REKOMMANDATION', 'ID_Rekommandation', 'Sorteringsnr');
const significance = code('KLINISKBETYDNING', 'ID_KliniskBetydning', 'Forkortelse');
const documentation = code('DOKUMENTATIONSGRAD', 'ID_Dokumentationsgrad', 'Forkortelse');
const consumer = new Map(rows(con, 'NIVEAU3').map(r => [field(r, 'ID_Niveau3'), r]));

// a, b: [Danish name, type: LM medicine, NLM herbal, FV food, RG alcohol/tobacco, Vi vitamin, Mi mineral, Vac vaccine];
// r: recommendation 1 avoid, 2 avoid (class effect), 3 dose adjustment, 4 take at different times, 5 precautions, 7 can be used, 8 can be used with care;
// k: clinical significance (udtal pronounced, moder moderate, ringe slight, mulig possible, ingen none, uafkl unclear); e: documentation (vel, dok., begr., ringe);
// t: professional text; h: recommendation text; c: consumer texts [precautions, problems, note, side effects, recommendation] (Danish)
const records = rows(pro, 'NIVEAU3').map(r => {
  const c = consumer.get(field(r, 'ID_Niveau3')) ?? '';
  const side = (id: string) => { const [n, t] = stof.get(id) ?? ['', '']; return [n, types.get(t) ?? '']; };
  return { a: side(field(r, 'ID_Stof1')), b: side(field(r, 'ID_Stof2')), r: +(recommendation.get(field(r, 'ID_Rekommandation')) ?? 0),
    k: significance.get(field(r, 'ID_KliniskBetydning')) ?? '', e: documentation.get(field(r, 'ID_Dokumentationsgrad')) ?? '', t: field(r, 'Tekst'), h: field(r, 'Rekommandationstekst'),
    c: ['Saerlige_forholdsregler', 'Problemer_ved_samtidig_brug', 'OBS', 'Bivirkningstekst', 'Rekommandationstekst'].map(f => field(c, f)) };
}).filter(r => r.a[0] && r.b[0]);
mkdirSync('data/sources', { recursive: true });
writeFileSync('data/sources/dk.json', JSON.stringify(records));
console.log(records.length, 'interactions;', new Set(records.flatMap(r => [r.a[0], r.b[0]])).size, 'substances');
