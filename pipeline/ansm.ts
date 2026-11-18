// France's national interaction thesaurus (ANSM, September 2023, final edition; public information reused with attribution).
// Two-column PDF: left column is the risk and mechanism, right column the level and what to do.
// Usage: node pipeline/ansm.ts -> data/sources/ansm.json
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

export const ANSM_URL = 'https://ansm.sante.fr/uploads/2023/09/15/20230915-thesaurus-interactions-medicamenteuses-septembre-2023.pdf';
const lines = execSync(`curl -sfL -A Mozilla/5.0 ${ANSM_URL} | pdftotext -layout - -`, { maxBuffer: 1 << 27 }).toString().split('\n');
const LEVELS: [RegExp, string][] = [[/^CONTRE-INDICATION/, 'x'], [/^Association DECONSEILLEE/, 'a'], [/^Précaution d'emploi/, 'p'], [/^A prendre en compte/, 'c']];
const HEADING = /^[A-ZÉÈÀÂÎÔÛÇÏ0-9][A-ZÉÈÀÂÎÔÛÇÏ0-9 ,.'’()/+-]*$/;

// c: classes {name: members}; r: [heading, partner, level x contraindicated / a avoid / p precaution / c take into account, risk, what to do]
const classes: Record<string, string[]> = {};
const records: [string, string, string, string, string][] = [];
let heading = '', partner = '', left: string[] = [], right: string[] = [];
const flush = () => {
  if (heading && partner && right.length) {
    const text = right.join(' ').replace(/\s+/g, ' ').trim();
    const level = LEVELS.find(([re]) => re.test(text));
    if (level) records.push([heading, partner, level[1], left.join(' ').replace(/\s+/g, ' ').trim(), text.replace(level[0], '').trim()]);
  }
  left = []; right = [];
};
for (let n = 0; n < lines.length; n++) {
  const line = lines[n].replace(/\f/g, '');
  if (!line.trim() || /^\s*\d+\s*$/.test(line) || /Anatole France|www\.ansm\.sante\.fr/.test(line)) continue;
  if (line.startsWith('+ ')) { flush(); partner = line.slice(2).trim(); continue; }
  if (HEADING.test(line) && !line.startsWith(' ') && line.length < 90) {
    flush(); heading = line.trim(); partner = '';
    // a class heading is followed by its members in brackets, possibly over several lines and with nested brackets
    if (/^\s+\(/.test(lines[n + 1] ?? '')) {
      let list = '', depth = 0;
      for (let k = n + 1; k < n + 12 && lines[k]?.startsWith(' '); k++) {
        for (const ch of lines[k].trim() + ' ') {
          if (ch === '(') depth++;
          if (ch === ')') depth--;
          list += ch;
          if (depth === 0 && list.trim()) break;
        }
        if (depth === 0) break;
      }
      if (depth === 0) {
        const members: string[] = [];
        let level = 0, item = '';
        for (const ch of list.trim().slice(1, -1) + ',') {
          if (ch === '(') level++;
          if (ch === ')') level--;
          if (ch === ',' && level === 0) { if (item.trim()) members.push(item.trim().toLowerCase()); item = ''; } else item += ch;
        }
        classes[heading] = members;
      }
    }
    continue;
  }
  if (!partner || /^\s*Voir aussi/.test(line)) continue;
  // split at the widest gap: text starting past column 60 belongs to the right column
  const m = /^(.*?\S)\s{3,}(\S.*)$/.exec(line);
  const start = line.search(/\S/);
  if (m && line.indexOf(m[2], m[1].length) >= 60) { left.push(m[1].trim()); right.push(m[2].trim()); }
  else if (start >= 60) right.push(line.trim());
  else left.push(line.trim());
}
flush();
mkdirSync('data/sources', { recursive: true });
writeFileSync('data/sources/ansm.json', JSON.stringify({ c: classes, r: records }));
const count = (l: string) => records.filter(r => r[2] === l).length;
console.log(records.length, 'records:', LEVELS.map(([, l]) => `${l} ${count(l)}`).join(', '), ';', Object.keys(classes).length, 'classes');
