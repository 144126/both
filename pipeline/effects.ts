// What an interaction does, as effect codes, read from English interaction text (labels, translations, VA, guidelines).
// Each code has a plain sentence for people and a short professional term; build.ts turns them into the explanations shown.
export const EFFECTS: Record<string, { p: RegExp; n: string; pro: string }> = {
  bleed: { p: /\bbleed|hemorrhag|haemorrhag|\binr\b|anticoagulant effect|bruis/, n: 'more risk of bleeding', pro: 'additive bleeding risk' },
  serotonin: { p: /serotonin syndrome|serotonin toxicity|serotonergic/, n: 'too much serotonin (serotonin syndrome: agitation, fever, shaking)', pro: 'serotonin syndrome' },
  qt: { p: /\bqtc?\b|torsade|ventricular arrhythmi|cardiac arrhythmi/, n: 'a dangerous heart rhythm problem', pro: 'QT prolongation / torsades de pointes' },
  sedation: { p: /respiratory depression|\bsedation|cns depression|central nervous system depression|somnolence|drowsiness|\bcoma\b|psychomotor/, n: 'heavy sleepiness and slowed breathing', pro: 'additive CNS and respiratory depression' },
  k_high: { p: /hyperkal[ae]mi|serum potassium|potassium (?:levels?|concentrations?) (?:increase|rise|elevat)/, n: 'too much potassium in the blood (can affect the heart)', pro: 'hyperkalemia' },
  k_low: { p: /hypokal[ae]mi/, n: 'too little potassium in the blood', pro: 'hypokalemia' },
  sugar_low: { p: /hypoglyc[ae]mi|low blood (?:sugar|glucose)/, n: 'low blood sugar', pro: 'hypoglycemia' },
  sugar_high: { p: /hyperglyc[ae]mi|loss of (?:glyc[ae]mic|blood glucose) control/, n: 'high blood sugar', pro: 'hyperglycemia' },
  bp_low: { p: /hypotensi|orthostatic|blood pressure (?:lowering|decrease|reduction)|syncope|fainting/, n: 'blood pressure dropping too low (dizziness, fainting)', pro: 'additive hypotension' },
  bp_high: { p: /hypertensive (?:crisis|reaction|episode)|blood pressure (?:increase|elevation|rise)|hypertension/, n: 'a dangerous rise in blood pressure', pro: 'hypertensive reaction' },
  slow_heart: { p: /bradycardi|heart block|\bav block|atrioventricular block|sinus arrest/, n: 'a heartbeat that is too slow', pro: 'bradycardia / AV block' },
  kidney: { p: /nephrotox|renal (?:failure|impairment|toxicity|injury|insufficiency|function)|kidney|acute renal/, n: 'kidney damage', pro: 'nephrotoxicity / renal impairment' },
  muscle: { p: /myopath|rhabdomyolys|myositis|muscle (?:pain|damage|breakdown)/, n: 'muscle damage', pro: 'myopathy / rhabdomyolysis' },
  liver: { p: /hepatotox|liver (?:injury|damage|toxicity|failure)|hepatic (?:injury|failure|toxicity)|transaminase/, n: 'liver damage', pro: 'hepatotoxicity' },
  seizure: { p: /seizure|convuls/, n: 'seizures', pro: 'lowered seizure threshold' },
  blood_counts: { p: /myelosuppress|myelotox|neutropeni|agranulocyt|bone marrow|thrombocytopeni|pancytopeni|leukopeni|an[ae]mia/, n: 'low blood cell counts (infections, bleeding)', pro: 'myelosuppression' },
  hearing: { p: /ototox|hearing loss|deafness/, n: 'hearing damage', pro: 'ototoxicity' },
  confusion: { p: /confusion|delirium|cognitive|anticholinergic (?:effects?|burden|toxicity)/, n: 'confusion, especially in older people', pro: 'additive anticholinergic / cognitive effects' },
  falls: { p: /\bfalls?\b|fracture/, n: 'falls and broken bones', pro: 'falls and fractures' },
  sodium_low: { p: /hyponatr[ae]mi|siadh/, n: 'low sodium in the blood (confusion, seizures)', pro: 'hyponatremia' },
  immune: { p: /immunosuppress|infections?\b|vaccin/, n: 'a weaker immune system and infections', pro: 'additive immunosuppression' },
  less_effective: { p: /reduced (?:efficacy|effectiveness)|less effective|loss of (?:efficacy|effect|virologic)|treatment failure|virologic(?:al)? failure|therapeutic failure|decreased (?:efficacy|effectiveness)|contraceptive failure|breakthrough bleeding/, n: 'one medicine working less well', pro: 'reduced efficacy' },
  levels_up: { p: /increase[sd]? (?:the )?(?:plasma |serum |blood |systemic )?(?:exposure|concentrations?|levels?|auc|cmax)|elevated (?:plasma |serum )?(?:concentrations?|levels)|higher (?:plasma )?(?:concentrations?|levels)|toxicity|reduced (?:clearance|metabolism)|inhibit(?:s|ed|ion of)? (?:the )?metabolism/, n: 'higher levels of a medicine in the blood (more side effects)', pro: 'increased exposure' },
  levels_down: { p: /decrease[sd]? (?:the )?(?:plasma |serum |blood |systemic )?(?:exposure|concentrations?|levels?|auc|cmax)|reduc(?:e|ed|es|tion in|tion of) (?:the )?(?:plasma |serum )?(?:exposure|concentrations?|levels?|auc|bioavailability)|lower (?:plasma )?(?:concentrations?|levels)|increased (?:clearance|metabolism)|induc(?:es|ed|tion of) (?:the )?metabolism/, n: 'lower levels of a medicine in the blood (works less well)', pro: 'decreased exposure' },
  absorption: { p: /absorption|chelat|\bbind(?:s|ing)?\b|(?:hours?|hrs?) (?:before|after|apart)|separate (?:the )?(?:administration|dosing|doses)/, n: 'one medicine blocking the other from being absorbed (take them hours apart)', pro: 'reduced absorption; separate administration' },
  lithium: { p: /lithium (?:toxicity|levels?|concentrations?)/, n: 'lithium building up to toxic levels', pro: 'lithium toxicity' },
  neuromuscular: { p: /neuromuscular block|muscle weakness|respiratory paralysis/, n: 'stronger muscle weakness', pro: 'potentiated neuromuscular blockade' },
};

export const effects = (text: string) => Object.entries(EFFECTS).filter(([, e]) => e.p.test(text)).map(([k]) => k);
