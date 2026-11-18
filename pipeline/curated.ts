// Guideline rules written out by hand, each with its citation: 2023 AGS Beers Criteria Table 5 and the ONC high-priority list's classes
// (the ONC pair list itself is loaded from data). Sides are ingredients or class:<id> from classes.ts.
export const ANSM_URL_TEXT = 'https://ansm.sante.fr/documents/reference/thesaurus-des-interactions-medicamenteuses-1';

// r: source; a, b: sides; s: severity; o: the guideline's own words; t: what happens and what to do; n: citation; c: class description
export type Rule = { r: string; a: string[]; b: string[]; s: string; o: string; t: string; n: string; c?: string };
const BEERS = '2023 AGS Beers Criteria, Table 5';
const ONC = 'ONC high-priority drug-drug interactions (Phansalkar et al., JAMIA 2012)';
import { QT_KNOWN } from './classes.ts';

export const CURATED: Rule[] = [
  { r: 'beers', a: ['class:opioid'], b: ['class:benzodiazepine'], s: 'a', o: 'avoid', n: BEERS, c: 'opioids with benzodiazepines',
    t: 'Increased risk of overdose: profound sedation, respiratory depression and death. Avoid; if both are needed, use the lowest doses, monitor breathing and keep naloxone at hand.' },
  { r: 'beers', a: ['class:opioid'], b: ['class:gabapentinoid'], s: 'a', o: 'avoid', n: BEERS, c: 'opioids with gabapentin or pregabalin',
    t: 'Increased risk of severe sedation-related adverse events, including respiratory depression and death. Avoid, except when moving from an opioid to a gabapentinoid or using one to lower the opioid dose.' },
  { r: 'beers', a: ['class:anticholinergic'], b: ['class:anticholinergic'], s: 'a', o: 'avoid; minimize the number of anticholinergic drugs', n: BEERS, c: 'two strongly anticholinergic drugs',
    t: 'Increased risk of cognitive decline, delirium, falls and fractures in older adults. Avoid; reduce the number of anticholinergic drugs.' },
  { r: 'beers', a: ['class:raas', 'amiloride', 'triamterene'], b: ['class:raas', 'amiloride', 'triamterene'], s: 'c', o: 'avoid routine use in CKD stage 3a or worse', n: BEERS, c: 'two RAS blockers, or a RAS blocker with amiloride or triamterene',
    t: 'Increased risk of hyperkalemia (high potassium). Avoid routine use in chronic kidney disease stage 3a or worse; check potassium and kidney function.' },
  { r: 'beers', a: ['lithium'], b: ['class:ace_inhibitor', 'class:arb', 'sacubitril'], s: 'a', o: 'avoid; monitor lithium concentrations', n: BEERS, c: 'ACE inhibitors, ARBs and ARNIs',
    t: 'Increased risk of lithium toxicity. Avoid; if used together, monitor lithium concentrations.' },
  { r: 'beers', a: ['lithium'], b: ['class:loop_diuretic'], s: 'a', o: 'avoid; monitor lithium concentrations', n: BEERS, c: 'loop diuretics',
    t: 'Increased risk of lithium toxicity. Avoid; if used together, monitor lithium concentrations.' },
  { r: 'beers', a: ['doxazosin', 'prazosin', 'terazosin'], b: ['class:loop_diuretic'], s: 'c', o: 'avoid in older women unless both are needed', n: BEERS, c: 'peripheral alpha-1 blockers with loop diuretics',
    t: 'Increased risk of urinary incontinence in older women. Avoid in older women unless conditions warrant both drugs.' },
  { r: 'beers', a: ['phenytoin', 'fosphenytoin'], b: ['sulfamethoxazole', 'trimethoprim'], s: 'a', o: 'avoid', n: BEERS,
    t: 'Increased risk of phenytoin toxicity. Avoid.' },
  { r: 'beers', a: ['theophylline', 'aminophylline'], b: ['cimetidine', 'ciprofloxacin'], s: 'a', o: 'avoid', n: BEERS,
    t: 'Increased risk of theophylline toxicity. Avoid.' },
  { r: 'beers', a: ['warfarin'], b: ['amiodarone', 'ciprofloxacin', 'clarithromycin', 'erythromycin', 'sulfamethoxazole', 'trimethoprim', 'class:ssri'], s: 'a', o: 'avoid when possible; if used together, monitor INR closely', n: BEERS,
    t: 'Increased risk of bleeding. Avoid when possible; if used together, monitor INR closely.' },
  { r: 'onc', a: ['atazanavir'], b: ['class:ppi'], s: 'a', o: 'high priority', n: ONC, c: 'proton pump inhibitors', t: 'Atazanavir levels fall sharply, so HIV treatment can fail. Avoid.' },
  { r: 'onc', a: ['febuxostat'], b: ['azathioprine', 'mercaptopurine'], s: 'x', o: 'high priority (contraindicated)', n: ONC, t: 'Azathioprine or mercaptopurine build up and suppress the bone marrow. Contraindicated.' },
  { r: 'onc', a: ['irinotecan'], b: ['class:3A_i_s', 'class:3A_d_s'], s: 'a', o: 'high priority', n: ONC, c: 'strong CYP3A4 inhibitors or inducers', t: 'Irinotecan exposure changes a lot: toxicity with inhibitors, loss of effect with inducers. Avoid.' },
  { r: 'onc', a: ['simvastatin', 'lovastatin'], b: ['class:3A_i_s'], s: 'x', o: 'high priority (contraindicated)', n: ONC, c: 'strong CYP3A4 inhibitors', t: 'Statin levels rise many-fold, with risk of myopathy and rhabdomyolysis. Contraindicated.' },
  { r: 'onc', a: ['ergotamine', 'dihydroergotamine', 'methylergonovine'], b: ['class:3A_i_s'], s: 'x', o: 'high priority (contraindicated)', n: ONC, c: 'strong CYP3A4 inhibitors', t: 'Ergotism: severe narrowing of blood vessels with risk of limb or organ ischemia. Contraindicated.' },
  { r: 'onc', a: ['ramelteon'], b: ['fluvoxamine'], s: 'x', o: 'high priority (contraindicated)', n: ONC, t: 'Ramelteon levels rise about 190-fold. Contraindicated.' },
  { r: 'onc', a: ['tizanidine'], b: ['fluvoxamine', 'ciprofloxacin'], s: 'x', o: 'high priority (contraindicated)', n: ONC, t: 'Tizanidine levels rise many-fold: severe low blood pressure and sedation. Contraindicated.' },
  { r: 'onc', a: ['class:protease_inhibitor'], b: ['class:3A_d_s'], s: 'a', o: 'high priority', n: ONC, c: 'protease inhibitors with strong CYP3A4 inducers', t: 'Protease inhibitor levels fall, so HIV or hepatitis C treatment can fail and resistance can develop. Avoid.' },
  { r: 'onc', a: ['class:maoi'], b: ['class:ssri', 'class:snri', 'class:tca', 'class:triptan', 'meperidine', 'methadone', 'tramadol', 'tapentadol', 'fentanyl', 'dextromethorphan', 'class:stimulant', "st. john's wort", 'buspirone', 'mirtazapine', 'bupropion'], s: 'x', o: 'high priority (contraindicated)', n: ONC, c: 'MAO inhibitors with serotonergic or sympathomimetic drugs',
    t: 'Serotonin syndrome or hypertensive crisis, which can be fatal. Contraindicated; allow a washout (usually 14 days) when switching.' },
  { r: 'onc', a: ['tranylcypromine', 'phenelzine', 'isocarboxazid'], b: ['procarbazine'], s: 'x', o: 'high priority (contraindicated)', n: ONC, t: 'Hypertensive crisis. Contraindicated.' },
  { r: 'onc', a: QT_KNOWN, b: QT_KNOWN, s: 'a', o: 'high priority', n: ONC, c: 'two drugs with known risk of torsades de pointes',
    t: 'Additive QT prolongation with risk of torsades de pointes, a dangerous heart rhythm. Avoid when possible; if needed, check an ECG and keep potassium and magnesium normal.' },
];
