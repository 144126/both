// Interaction findings from US drug labels: every sentence of the interaction-related sections that names another drug or a drug class,
// with its severity cue, effects and which drug's level changes. Deterministic; each finding keeps its sentence as evidence.
// Usage: node pipeline/extract.ts -> data/sources/fda.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { CLASSES } from './classes.ts';
import { plain } from './names.ts';
import { effects } from './effects.ts';
import { members as members_of } from './resolve.ts';

const vocab = JSON.parse(readFileSync('data/vocab.json', 'utf8'));
const norm = (s: string) => plain(s).replace(/[^a-z0-9'.-]+/g, ' ').replace(/\s+/g, ' ').trim();

// names that are mostly excipients, gases or lab values in label prose, never an interacting drug
const IGNORE = new Set(('water, sodium chloride, dextrose, glucose, oxygen, nitrogen, glycerin, petrolatum, mineral oil, lanolin, titanium dioxide, '
  + 'zinc oxide, menthol, camphor, sodium, chloride, carbon dioxide, air, lactose, sucrose, starch, ethyl alcohol, benzyl alcohol, '
  + 'urea, protein, fat, food, milk, tea, coffee, salt, sugar, vitamin, fluoride, hydrogen peroxide, talc, silicon, sulfur, nicotine replacement').split(', '));
// mineral or food words that are drugs only outside lab-value contexts ("serum potassium", "calcium channel blockers")
const AMBIGUOUS = new Set('potassium, calcium, magnesium, iron, zinc, alcohol, insulin, caffeine, grapefruit juice, aluminum, lithium, heparin, vitamin k, phosphate, bicarbonate'.split(', '));
const LAB_BEFORE = /\b(?:serum|plasma|blood|urine|urinary|total|ionized|low|high|benzyl|cetyl|stearyl|polyvinyl|isopropyl|dietary|ethyl|elemental)\s*$/;
const LAB_AFTER = /^\s*(?:levels?|concentrations?|channels?|homeostasis|balance|excretion|deficiency|monitoring|sensitivity|secretion|resistance|measurements?|stores|overload|clearance|metabolism|values?|-containing products)\b/;

const names = new Map<string, string>();
for (const c of vocab.c) {
  if (IGNORE.has(c.n)) continue;
  for (const s of [c.n, ...c.s]) { const k = norm(s); if (k.length > 3 && !IGNORE.has(k) && !names.has(k)) names.set(k, c.n); }
}
// most specific phrases first: "combined p-gp and strong cyp3a4 inhibitors" before "strong cyp3a4 inhibitors" before "cyp3a4 inhibitors"
const class_entries = Object.entries(CLASSES).filter(([id]) => !['lithium', 'methotrexate'].includes(id))
  .sort(([a], [b]) => (b.startsWith('cyp3a_pgp') ? 1 : 0) - (a.startsWith('cyp3a_pgp') ? 1 : 0) || (/_[sm]$/.test(b) ? 1 : 0) - (/_[sm]$/.test(a) ? 1 : 0));
const vocab_by_id = new Map<string, { e: string[]; a: string[] }>(vocab.c.map((c: { n: string; e: string[]; a: string[] }) => [c.n, c]));
/** The label's own drug belongs to the class: "NSAIDs cause..." in an NSAID label is about itself, not a partner. */
const self_in_class = (self: Set<string>, id: string) => [...self].some(s => {
  const k = CLASSES[id], c = vocab_by_id.get(s);
  return k.i?.includes(s) || (k.e && c?.e.some(e => k.e!.test(e))) || (k.a && c?.a.some(a => k.a!.some(p => a.startsWith(p))));
});
// outside the interaction sections a sentence must speak of taking drugs together
const TOGETHER = /concomitant|coadminist|co-administ|concurrent|in combination|combined with|combination with|together|in patients (?:receiving|taking|treated with|on)\b|when (?:used|given|taken|administered|combined) with|with (?:other|another|any)\b|(?:are|is|you are|if you are) (?:taking|receiving|using)|in addition to|added to/;
// a class the label's own drug belongs to counts only as "other" members: "avoid other NSAIDs", "dual blockade of the RAS"
const OTHER = /\b(?:other|another|additional|dual|two or more|more than one|second|multiple)\b/;
const EXAMPLES = /\be\.?g\.?|\bsuch as\b|\bincluding\b|\bfor example\b|\bfor instance\b|\bexamples?\b|\blike\b/;
const ALLERGY = /allerg|hypersensitiv|asthma|urticaria|anaphyla|cross-?(?:sensitivity|reactivity)/;

const SECTIONS = ['contraindications', 'boxed_warning', 'drug_interactions', 'drug_interactions_table', 'warnings_and_cautions', 'warnings',
  'precautions', 'dosage_and_administration', 'do_not_use', 'ask_doctor_or_pharmacist', 'ask_doctor', 'when_using'];
const OTC_LEVEL: Record<string, string> = { do_not_use: 'x', ask_doctor_or_pharmacist: 'c', ask_doctor: 'c', when_using: 'c' };

const X = /\bcontraindicated\b|\bmust not be (?:used|given|coadministered|co-administered|administered|taken)|\bdo not (?:coadminister|co-administer|use|take|administer|give|prescribe|initiate|start)\b[^.]{0,80}\b(?:with|in patients (?:taking|receiving|treated|on))\b/;
const A = /(?<!\bto |\bin order to )\bavoid(?:ed|ance)?\b|\bnot recommended\b|\bshould not be (?:used|given|coadministered|co-administered|administered|taken|combined|started|prescribed)|\bshould not (?:take|use|receive)|\bdo not (?:use|take)\b/;
const N = /\bno (?:clinically |pharmacokinetically )?(?:significant|relevant|meaningful|important|apparent|notable|appreciable|substantial)\b|\bno dose (?:adjustment|modification|change)s?\b|\bnot (?:clinically |considered )?(?:significant|relevant|meaningful)|\bdid not (?:significantly |meaningfully |substantially |appreciably )?(?:affect|alter|change|increase|decrease|influence|impact|modify|inhibit|induce)|\bno (?:effect|impact) on\b|\b(?:was|were) not (?:significantly )?(?:affected|altered|changed)|\bno (?:pharmacokinetic |drug[- ]drug |clinically relevant |significant )?interactions?\b|\bdoes not (?:affect|alter|interact|inhibit|induce)|\bnot expected to (?:affect|alter|interact|cause)|\bminimal effect/;
// words like "fatal" or "death" describe how bad a risk is; only explicit instructions (avoid, contraindicated) raise the level
const C = /\bmonitor|life[- ]threatening|\bfatal\b|\bdeaths?\b|\bprofound sedation|\bdos(?:e|age|ing) (?:adjustment|reduction|modification|titration|decrease|increase)|\b(?:reduce|adjust|decrease|increase|lower|limit|halve) (?:the )?(?:\w+ )?dos(?:e|age|ing)|\bconsider\b|\bcaution|\bseparate\b|\b(?:hours?|hrs?) (?:before|after|apart)|\btitrat|\bclosely\b|\bmay (?:increase|decrease|enhance|reduce|potentiate|result|cause|lead|alter|prolong|lower|raise|diminish)|\b(?:increase|decrease|raise|lower)(?:s|d)? (?:the )?(?:risk|exposure|concentrations?|levels?|plasma|serum|auc|cmax|effects?|efficacy|bioavailability|absorption|clearance)|\bpotentiat|\badditive\b|\benhance|\breduced? (?:the )?(?:efficacy|effectiveness|absorption)|\btoxicity\b|\binhibit|\binduc|\b(?:may|can|could|might) interact/;
const LEVEL = /\b(increase|decrease|reduce|raise|lower|elevat)(?:s|d|ion|ing)?\b[^.;]{0,40}?\b(?:exposure|concentrations?|levels?|auc|cmax|bioavailability)\b[^.;]{0,15}?\b(?:of|to|for|in)\s+([^.;,]{2,60})/g;

type Hit = { id: string; c: number };
function entities(sentence: string, self: Set<string>): Hit[] {
  let text = ` ${norm(sentence)} `;
  const hits: Hit[] = [];
  for (const [id, k] of class_entries) {
    // "systemic corticosteroid effects" or "the anticoagulant effect of warfarin" describe an effect, not a partner drug
    const all = new RegExp(`(?:${k.p.source})(\\s+(?:effects?|activity|actions?|properties|adverse|side|syndrome|toxicity|withdrawal|exposure|naive|therapy-related|responses?|response)\\b)?`, 'g');
    for (const t of [text, text.replace(/-/g, ' ')]) {
      const found = [...t.matchAll(all)];
      if (!found.length) continue;
      if (found.some(m => !m[1])) hits.push({ id, c: 1 });
      text = t.replace(all, m => ' '.repeat(m.length));
      break;
    }
  }
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    if (!words[i]) continue;
    for (let n = Math.min(6, words.length - i); n > 0; n--) {
      const key = words.slice(i, i + n).join(' ');
      const id = names.get(key);
      if (!id) continue;
      if (AMBIGUOUS.has(id) && (LAB_BEFORE.test(words.slice(Math.max(0, i - 2), i).join(' ')) || LAB_AFTER.test(words.slice(i + n, i + n + 2).join(' ')))) break;
      if (!self.has(id) && !hits.some(h => h.id === id)) hits.push({ id, c: 0 });
      i += n - 1;
      break;
    }
  }
  return hits;
}

/** Which named drugs' blood levels go up or down: "increases exposure to apixaban" -> up apixaban. */
function levels(sentence: string, self: Set<string>, self_names: string[]) {
  const up: string[] = [], down: string[] = [];
  for (const m of norm(sentence).matchAll(LEVEL)) {
    const target = ` ${m[2]} `;
    const ids = self_names.some(s => target.includes(` ${s} `)) ? [...self] : entities(m[2], new Set()).filter(h => !h.c).map(h => h.id);
    (/increase|raise|elevat/.test(m[1]) ? up : down).push(...ids);
  }
  return { up: [...new Set(up)], down: [...new Set(down)] };
}

const html_text = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/<\/(?:td|th)>/g, ' | ').replace(/<\/tr>/g, '. ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
// OTC drug facts run their headings together; each heading starts a new statement
const OTC_HEADING = /\s(?=(?:Ask a doctor or pharmacist before use|Ask a doctor before use|Do not use|Stop use and ask|When using this product|If pregnant|Keep out of reach|Liver warning|Stomach bleeding warning|Allergy alert)\b)/;
// flattened tables run rows together without a full stop ("...same time of day Antineoplastic agents usually..."): a capitalised
// class header after a lowercase word starts a new row. Label highlights end each item with its section numbers instead of a full
// stop ("...alpha blocking agents (5.2, 7.2, 12.3) Exercise caution with warfarin"): a capital after such a group starts a sentence.
const SECTION_REFS = /(?<=\(\d{1,2}(?:\.\d{1,2})?(?:\s*,\s*\d{1,2}(?:\.\d{1,2})?)*\s*\))\s+(?=[A-Z])/;
const ROW = /(?<=[a-z0-9)%])\s+(?=[A-Z][a-z]+(?:[- ][A-Za-z]+){0,2}\s(?:[Aa]gents|[Dd]rugs|[Ii]nhibitors|[Ii]nducers|[Aa]ntagonists|[Bb]lockers|[Ss]ubstrates|[Mm]edications|[Aa]nticoagulants|[Dd]iuretics)\b)/;
const sentences = (s: string) => s.replace(/\s+/g, ' ').split(OTC_HEADING).flatMap(p => p.split(ROW)).flatMap(p => p.split(SECTION_REFS)).flatMap(part => part.split(/(?<=[.;:])\s+(?=[A-Z(•●-])|\s(?=\d{1,2}\.\d{1,2}\s+[A-Z])|\s[•●]\s/)).map(x => x.trim()).filter(x => x.length > 12);

// a: label ingredients; b: other drug or class:<id>; s: x contraindicated, a avoid, c caution, n no meaningful interaction; f: effects;
// u: ingredients whose level goes up; d: ... down; q: sentence; k: section; i: label set id; t: label brand or generic name; r: route
const findings: Record<string, unknown>[] = [];
let labels = 0;
const all = gunzipSync(readFileSync(process.argv[2] ?? 'data/cache/labels.jsonl.gz')).toString().split('\n').filter(Boolean).map(l => JSON.parse(l));
// EU product information (pipeline/ema.ts): section 4.5 read like a US label's interaction section, credited to the EMA
if (existsSync('data/cache/ema.jsonl')) for (const line of readFileSync('data/cache/ema.jsonl', 'utf8').split('\n')) {
  if (!line) continue;
  const e = JSON.parse(line);
  if (e.t) all.push({ i: String(e.i).toLowerCase().split(/\s*(?:,|\/|;|\band\b)\s*/).filter(Boolean), b: [e.n], n: [], p: { drug_interactions: e.t }, s: e.k, t: 'r', r: [], src: 'eu', u: e.u });
}
const id = (i: string) => names.get(norm(i)) ?? norm(i);
// a combination label speaks for an ingredient only when that ingredient has no label of its own: Excedrin's aspirin bleeding warning
// is not about its acetaminophen, but Paxlovid's label is the only one for nirmatrelvir
const single = new Set(all.filter(l => l.i.length === 1).map(l => id(l.i[0])));
for (const l of all) {
  if (l.i.length > 6 || l.i.some((i: string) => /allergenic|extract|pollen|venom|\bmite\b|antigen|diagnostic|tuberculin/.test(i))) continue;  // skin-test instructions are not interactions
  const self = new Set<string>(l.i.map(id));
  const speaks_for = l.i.length === 1 ? [...self] : [...self].filter(s => !single.has(s));
  if (!speaks_for.length) continue;
  const self_names = [...new Set([...l.i, ...l.b, ...l.n].map(norm))].filter(s => s.length > 2);
  labels++;
  const seen = new Set<string>();
  for (const section of SECTIONS) {
    const text = l.p[section];
    if (!text) continue;
    for (const q of sentences(html_text(text))) {
      const low = norm(q);
      const together = TOGETHER.test(low);
      if (!section.startsWith('drug_interactions') && !OTC_LEVEL[section] && !together) continue;
      if (ALLERGY.test(low) && !together) continue;
      let hits = entities(q, self).filter(h => !h.c || !self_in_class(self, h.id) || OTHER.test(low));
      // "Sedative/hypnotics: orally administered midazolam, triazolam" names the members it means; "(e.g., ketoconazole)" only gives examples
      if (!EXAMPLES.test(low)) hits = hits.filter(h => !h.c || !hits.some(d => !d.c && members_of(h.id).has(d.id)));
      // EU PDFs flatten tables into long run-on lines; only short sentences there may speak for a whole class
      if (l.src === 'eu' && q.length > 300) hits = hits.filter(h => !h.c);
      if (!hits.length) continue;
      let s = X.test(low) ? 'x' : A.test(low) ? 'a' : N.test(low) ? 'n' : C.test(low) ? 'c' : OTC_LEVEL[section] ?? '';
      if (!s) continue;
      if (section === 'contraindications' && s !== 'n') s = 'x';
      if (/^ask a doctor/.test(low) && s !== 'n') s = 'c';
      if (/^do not use\b/.test(low) && s !== 'n') s = 'x';
      const { up, down } = levels(q, self, self_names);
      const f = effects(low);
      for (const h of hits) {
        if (s === 'n' && h.c) continue;  // "although X is a strong inhibitor, no dose adjustment" says nothing about the class
        const b = h.c ? `class:${h.id}` : h.id, key = `${b}|${s}|${q}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // a combination label's sentence speaks for an ingredient without its own label only when it names it ("hydrocodone and
        // homatropine" warnings are about the opioid); a single-ingredient label always speaks for its drug
        const named = l.i.length === 1 ? speaks_for : speaks_for.filter(x => low.includes(x));
        if (!named.length) continue;
        findings.push({ a: named, b, s, f, u: up, d: down, q: q.slice(0, 600), k: section, i: l.s, t: l.b[0] ?? l.n[0] ?? l.i.join(' / '), r: l.r, src: l.src, link: l.u });
      }
    }
  }
}
writeFileSync('data/sources/fda.json', JSON.stringify(findings));
const by = (s: string) => findings.filter(f => f.s === s).length;
console.log(labels, 'labels;', findings.length, 'findings: x', by('x'), 'a', by('a'), 'c', by('c'), 'n', by('n'), '; class mentions', findings.filter(f => String(f.b).startsWith('class:')).length);
