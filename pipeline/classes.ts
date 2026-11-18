// Drug classes as labels and references name them. A class matches a concept by FDA established pharmacologic class (EPC) or mechanism
// (MoA), by ATC code prefix (for drugs sold outside the US), by an explicit ingredient list, or by enzyme role from the FDA table.
// p: phrases that name the class in label text; n: plain name shown to people; e: EPC/MoA pattern; a: ATC prefixes; i: ingredients;
// r: pattern on the ingredient name; k: enzyme or transporter role "role:target:strength" (role i inhibitor, d inducer, s substrate; strength s strong, m moderate, w weak, * any)
export type DrugClass = { n: string; p: RegExp; e?: RegExp; a?: string[]; i?: string[]; r?: RegExp; k?: string[] };

const list = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
const ENZYMES: [string, string, string][] = [['3A', 'cyp ?3a4?(?:/5)?', 'CYP3A'], ['2D6', 'cyp ?2d6', 'CYP2D6'], ['2C9', 'cyp ?2c9', 'CYP2C9'],
  ['2C19', 'cyp ?2c19', 'CYP2C19'], ['1A2', 'cyp ?1a2', 'CYP1A2'], ['2C8', 'cyp ?2c8', 'CYP2C8'], ['2B6', 'cyp ?2b6', 'CYP2B6']];

const enzyme_classes: Record<string, DrugClass> = {};
for (const [code, pattern, name] of ENZYMES) {
  for (const [role, word] of [['i', 'inhibitors?'], ['d', 'inducers?']]) {
    const what = role === 'i' ? 'blocks' : 'speeds up';
    enzyme_classes[`${code}_${role}_s`] = { n: `strong ${name} ${role === 'i' ? 'inhibitor' : 'inducer'} (${what} the liver enzyme ${name} a lot)`,
      p: new RegExp(`\\b(?:strong|potent)\\s+(?:and\\s+moderate\\s+)?${pattern}\\s+${word}`), k: [`${role}:${code}:s`] };
    enzyme_classes[`${code}_${role}_m`] = { n: `moderate ${name} ${role === 'i' ? 'inhibitor' : 'inducer'}`,
      p: new RegExp(`\\bmoderate\\s+${pattern}\\s+${word}`), k: [`${role}:${code}:m`] };
    enzyme_classes[`${code}_${role}`] = { n: `${name} ${role === 'i' ? 'inhibitor' : 'inducer'} (${what} the liver enzyme ${name})`,
      p: new RegExp(`\\b${pattern}\\s+${word}`), k: [`${role}:${code}:s`, `${role}:${code}:m`] };
  }
  enzyme_classes[`${code}_s`] = { n: `drug cleared mainly by ${name}`, p: new RegExp(`\\b(?:sensitive\\s+)?${pattern}\\s+substrates?`), k: [`s:${code}:s`, `s:${code}:m`] };
}

const OPIOID = list('alfentanil, benzhydrocodone, buprenorphine, butorphanol, codeine, dihydrocodeine, fentanyl, hydrocodone, hydromorphone, levorphanol, meperidine, methadone, morphine, nalbuphine, oliceridine, oxycodone, oxymorphone, pentazocine, remifentanil, sufentanil, tapentadol, tramadol, tilidine, dextropropoxyphene, piritramide');
const BENZO = list('alprazolam, bromazepam, chlordiazepoxide, clobazam, clonazepam, clorazepate, diazepam, estazolam, flunitrazepam, flurazepam, lorazepam, lormetazepam, midazolam, nitrazepam, oxazepam, quazepam, remimazolam, temazepam, triazolam');
const SSRI = list('citalopram, escitalopram, fluoxetine, fluvoxamine, paroxetine, sertraline, vilazodone, vortioxetine');
const SNRI = list('desvenlafaxine, duloxetine, levomilnacipran, milnacipran, venlafaxine');
const TCA = list('amitriptyline, amoxapine, clomipramine, desipramine, dothiepin, doxepin, imipramine, lofepramine, maprotiline, nortriptyline, protriptyline, trimipramine');
const MAOI = list('isocarboxazid, linezolid, methylene blue, moclobemide, phenelzine, procarbazine, rasagiline, safinamide, selegiline, tranylcypromine');
const TRIPTAN = list('almotriptan, eletriptan, frovatriptan, naratriptan, rizatriptan, sumatriptan, zolmitriptan');
const ANTIPSYCHOTIC_EPC = /antipsychotic/i;
const SEDATING_ANTIHISTAMINE = list('brompheniramine, carbinoxamine, chlorpheniramine, clemastine, cyproheptadine, dexchlorpheniramine, dimenhydrinate, diphenhydramine, doxylamine, hydroxyzine, meclizine, promethazine, triprolidine');
// 2023 AGS Beers Criteria Table 7: strongly anticholinergic drugs
const ANTICHOLINERGIC = list('amitriptyline, amoxapine, atropine, belladonna, benztropine, brompheniramine, carbinoxamine, chlorpheniramine, chlorpromazine, clemastine, clidinium, clomipramine, clozapine, cyclobenzaprine, cyproheptadine, darifenacin, desipramine, dicyclomine, dimenhydrinate, diphenhydramine, doxepin, doxylamine, fesoterodine, flavoxate, glycopyrrolate, homatropine, hydroxyzine, hyoscyamine, imipramine, loxapine, meclizine, methscopolamine, nortriptyline, olanzapine, orphenadrine, oxybutynin, paroxetine, perphenazine, prochlorperazine, promethazine, propantheline, protriptyline, pyrilamine, scopolamine, solifenacin, thioridazine, tolterodine, trifluoperazine, trihexyphenidyl, trimipramine, triprolidine, trospium');

// drugs with a well-established risk of torsades de pointes at usual doses (ONC "QT-prolonging agents"; ANSM "substances susceptibles de donner des torsades de pointes")
export const QT_KNOWN = list('amiodarone, arsenic trioxide, azithromycin, chloroquine, chlorpromazine, cisapride, citalopram, clarithromycin, disopyramide, dofetilide, donepezil, dronedarone, droperidol, erythromycin, escitalopram, flecainide, fluconazole, haloperidol, hydroxychloroquine, ibutilide, levofloxacin, methadone, moxifloxacin, ondansetron, pentamidine, pimozide, procainamide, quinidine, sevoflurane, sotalol, thioridazine, vandetanib, propofol, ciprofloxacin, mesoridazine, halofantrine, levomethadyl, gatifloxacin, sparfloxacin, grepafloxacin, dolasetron, bedaquiline, vernakalant, ivabradine, oxaliplatin, anagrelide, cilostazol, bepridil, terfenadine, astemizole, sulpiride, papaverine');

export const CLASSES: Record<string, DrugClass> = {
  ...enzyme_classes,
  cyp3a_pgp_i_s: { n: 'drug that strongly blocks both CYP3A and P-gp', p: /\bcombined\s+p-?gp\s+and\s+strong\s+cyp ?3a4?\s+inhibitors?/, k: ['i:3A:s'] },
  cyp3a_pgp_d_s: { n: 'drug that strongly speeds up both CYP3A and P-gp', p: /\bcombined\s+p-?gp\s+and\s+strong\s+cyp ?3a4?\s+inducers?/, k: ['d:3A:s'] },
  pgp_i: { n: 'P-gp inhibitor (blocks a pump that removes drugs from the body)', p: /\bp-?(?:gp|glycoprotein)\s+inhibitors?/, k: ['ti:P-GP:'],
    i: list('amiodarone, carvedilol, clarithromycin, cyclosporine, dronedarone, erythromycin, itraconazole, ketoconazole, lapatinib, quinidine, ranolazine, ritonavir, verapamil, glecaprevir, velpatasvir') },
  pgp_s: { n: 'drug moved by the P-gp pump', p: /\bp-?(?:gp|glycoprotein)\s+substrates?/, k: ['ts:P-GP:'], i: list('dabigatran, digoxin, fexofenadine, colchicine, edoxaban, apixaban, rivaroxaban') },
  oatp_i: { n: 'OATP1B1/1B3 inhibitor', p: /\boatp1b[13](?:\/1b3)?\s+inhibitors?/, k: ['ti:OATP1B1:', 'ti:OATP1B3:'] },
  oatp_s: { n: 'drug taken into the liver by OATP1B1/1B3', p: /\boatp1b[13](?:\/1b3)?\s+substrates?/, k: ['ts:OATP1B1:', 'ts:OATP1B3:'] },
  bcrp_i: { n: 'BCRP inhibitor', p: /\bbcrp\s+inhibitors?/, k: ['ti:BCRP:'] },
  nsaid: { n: 'NSAID pain reliever (like ibuprofen or naproxen)', p: /\bnsaids?\b|non-?steroidal anti-?inflammatory/, e: /nonsteroidal anti-inflammatory|cyclooxygenase inhibitor/i, a: ['M01A', 'N02BA'] },
  anticoagulant: { n: 'blood thinner (anticoagulant)', p: /\banticoagulants?\b|\bblood thinners?\b|\bvitamin k antagonists?\b/,
    e: /anticoagulant|factor xa inhibitor|thrombin inhibitor|vitamin k antagonist/i, a: ['B01AA', 'B01AB', 'B01AE', 'B01AF'],
    i: list('apixaban, argatroban, bivalirudin, dabigatran, dalteparin, edoxaban, enoxaparin, fondaparinux, heparin, rivaroxaban, tinzaparin, warfarin, acenocoumarol, phenprocoumon') },
  antiplatelet: { n: 'antiplatelet drug (stops blood clotting cells)', p: /\bantiplatelets?\b|\bplatelet (?:aggregation )?inhibitors?\b|\bp2y12 inhibitors?/,
    e: /platelet aggregation inhibitor|p2y12/i, a: ['B01AC'], i: list('aspirin, cilostazol, clopidogrel, dipyridamole, prasugrel, ticagrelor, ticlopidine, vorapaxar') },
  thrombolytic: { n: 'clot-dissolving drug', p: /\bthrombolytics?\b|\bfibrinolytics?\b/, e: /tissue plasminogen activator|thrombolytic/i, a: ['B01AD'] },
  ssri: { n: 'SSRI antidepressant', p: /\bssris?\b|selective serotonin re-?uptake inhibitors?/, e: /selective serotonin reuptake inhibitor/i, a: ['N06AB'], i: SSRI },
  snri: { n: 'SNRI antidepressant', p: /\bsnris?\b|serotonin(?: and |-)norepinephrine re-?uptake inhibitors?/, e: /serotonin and norepinephrine reuptake inhibitor/i, i: SNRI },
  tca: { n: 'tricyclic antidepressant', p: /\btricyclic antidepressants?|\btcas?\b/, e: /tricyclic antidepressant/i, a: ['N06AA'], i: TCA },
  maoi: { n: 'MAO inhibitor', p: /\bmaois?\b|monoamine oxidase inhibitors?|\bmao inhibitors?/, e: /monoamine oxidase inhibitor/i, a: ['N06AF', 'N06AG', 'N04BD'], i: MAOI },
  triptan: { n: 'triptan migraine drug', p: /\btriptans?\b|5-?ht1[bdf]? (?:receptor )?agonists?/, e: /serotonin-1b and serotonin-1d receptor agonist/i, a: ['N02CC'], i: TRIPTAN },
  serotonergic: { n: 'drug that raises serotonin', p: /\bserotonergic (?:drugs?|agents?|medications?)/, e: /selective serotonin reuptake|serotonin and norepinephrine reuptake|tricyclic antidepressant|monoamine oxidase inhibitor|serotonin-1b/i,
    a: ['N06AB', 'N06AA', 'N06AF', 'N06AG', 'N02CC'],
    i: [...SSRI, ...SNRI, ...TCA, ...MAOI, ...TRIPTAN, ...list("tramadol, tapentadol, fentanyl, meperidine, methadone, lithium, buspirone, st. john's wort, tryptophan, trazodone, nefazodone, mirtazapine, dextromethorphan, lasmiditan, amphetamine, dextroamphetamine, lisdexamfetamine, methamphetamine, sibutramine, lorcaserin, fenfluramine")] },
  opioid: { n: 'opioid pain medicine', p: /\bopioids?\b(?! antagonist)|\bopioid analgesics?|\bnarcotics?\b/, e: /opioid agonist|opioid partial agonist/i, a: ['N02A'], i: OPIOID },
  benzodiazepine: { n: 'benzodiazepine (sedative)', p: /\bbenzodiazepines?\b/, e: /^benzodiazepine \[/i, a: ['N05BA', 'N05CD'], i: BENZO },
  cns_depressant: { n: 'drug that slows the brain (sedative)', p: /\bcns depressants?\b|central nervous system depressants?|\bsedatives?\b|\bhypnotics?\b|other depressants/,
    e: /opioid agonist|^benzodiazepine \[|antipsychotic|barbiturate|central nervous system depressant|orexin receptor antagonist/i,
    a: ['N02A', 'N05A', 'N05BA', 'N05C', 'N03AA'],
    i: [...OPIOID, ...BENZO, ...SEDATING_ANTIHISTAMINE, ...list('alcohol, zolpidem, zaleplon, eszopiclone, zopiclone, gabapentin, pregabalin, phenobarbital, butalbital, primidone, carisoprodol, cyclobenzaprine, methocarbamol, metaxalone, baclofen, tizanidine, chlorzoxazone, sodium oxybate, ketamine, esketamine, suvorexant, lemborexant, daridorexant, dronabinol, nabilone, trazodone, mirtazapine, doxepin, meprobamate, chloral hydrate, clomethiazole')] },
  barbiturate: { n: 'barbiturate', p: /\bbarbiturates?\b/, e: /barbiturate/i, a: ['N03AA', 'N05CA'] },
  gabapentinoid: { n: 'gabapentin or pregabalin', p: /\bgabapentinoids?\b/, i: list('gabapentin, gabapentin enacarbil, pregabalin, mirogabalin') },
  antipsychotic: { n: 'antipsychotic', p: /\bantipsychotics?\b|\bneuroleptics?\b/, e: ANTIPSYCHOTIC_EPC, a: ['N05A'] },
  muscle_relaxant: { n: 'muscle relaxant', p: /\bmuscle relaxants?\b/, e: /muscle relaxant/i, a: ['M03B'] },
  anticholinergic: { n: 'anticholinergic drug (dries mouth, can confuse)', p: /\banticholinergic (?:drugs?|agents?|medications?)|\banticholinergics\b|antimuscarinics?/, e: /cholinergic antagonist|cholinergic muscarinic antagonist/i, i: ANTICHOLINERGIC },
  ace_inhibitor: { n: 'ACE inhibitor (blood pressure)', p: /\bace inhibitors?\b|angiotensin[- ]converting enzyme (?:\(ace\) )?inhibitors?/, e: /angiotensin converting enzyme inhibitor/i, a: ['C09A', 'C09B'] },
  arb: { n: 'ARB (blood pressure)', p: /\barbs?\b|angiotensin (?:ii )?receptor (?:blockers?|antagonists?)/, e: /angiotensin 2 receptor blocker/i, a: ['C09C', 'C09D'] },
  raas: { n: 'drug that blocks the renin-angiotensin system', p: /\brenin-angiotensin(?:-aldosterone)? system|\braas? (?:inhibitors?|blockers?)|dual blockade of the ras/,
    e: /angiotensin converting enzyme inhibitor|angiotensin 2 receptor blocker|renin inhibitor|neprilysin/i, a: ['C09'] },
  k_sparing: { n: 'potassium-sparing diuretic', p: /\bpotassium[- ]sparing diuretics?|\baldosterone (?:receptor )?antagonists?|\bmineralocorticoid receptor antagonists?/,
    e: /aldosterone antagonist|potassium-sparing diuretic|mineralocorticoid receptor antagonist/i, a: ['C03DA', 'C03DB'], i: list('amiloride, triamterene, spironolactone, eplerenone, finerenone') },
  potassium: { n: 'potassium supplement', p: /\bpotassium (?:supplements?|salts?|chloride|-containing salt substitutes)|\bsalt substitutes?/, i: list('potassium, potassium chloride, potassium citrate, potassium bicarbonate, potassium gluconate'), a: ['A12BA'] },
  loop_diuretic: { n: 'loop diuretic (water pill)', p: /\bloop diuretics?\b/, e: /loop diuretic/i, a: ['C03C'] },
  thiazide: { n: 'thiazide diuretic (water pill)', p: /\bthiazides?\b|thiazide(?:-like)? diuretics?/, e: /thiazide/i, a: ['C03A', 'C03BA'] },
  diuretic: { n: 'diuretic (water pill)', p: /\bdiuretics?\b/, e: /diuretic/i, a: ['C03'] },
  insulin: { n: 'insulin', p: /\binsulins?\b/, e: /^insulin/i, a: ['A10A'] },
  sulfonylurea: { n: 'sulfonylurea diabetes drug', p: /\bsulfonylureas?\b|insulin secretagogues?/, e: /sulfonylurea|glinide/i, a: ['A10BB', 'A10BX'] },
  antidiabetic: { n: 'diabetes medicine', p: /\bantidiabetics?\b|\bhypoglycemic (?:agents?|drugs?)|antidiabetic (?:agents?|drugs?)|blood glucose[- ]lowering/, a: ['A10'] },
  antihypertensive: { n: 'blood pressure medicine', p: /\bantihypertensives?\b|antihypertensive (?:agents?|drugs?|medications?)|\bvasodilators?\b/, a: ['C02', 'C03', 'C07', 'C08', 'C09'] },
  beta_blocker: { n: 'beta-blocker', p: /\bbeta[- ]?(?:adrenergic )?blockers?\b|\bbeta[- ]?(?:adrenergic )?blocking agents?|\bβ-blockers?/, e: /beta adrenergic blocker|beta-adrenergic blocker/i, a: ['C07', 'S01ED'] },
  ccb: { n: 'calcium channel blocker', p: /\bcalcium channel (?:blockers?|antagonists?)|calcium[- ]blockers?/, e: /calcium channel blocker/i, a: ['C08'] },
  nondhp_ccb: { n: 'heart-slowing calcium channel blocker (verapamil, diltiazem)', p: /\bnon-?dihydropyridine/, i: list('verapamil, diltiazem') },
  digoxin: { n: 'digoxin', p: /\bdigitalis glycosides?|cardiac glycosides?/, i: list('digoxin, digitoxin') },
  antiarrhythmic: { n: 'heart rhythm drug', p: /\bantiarrhythmics?\b|antiarrhythmic (?:agents?|drugs?)/, e: /antiarrhythmic/i, a: ['C01B'] },
  nitrate: { n: 'nitrate (for chest pain)', p: /\bnitrates?\b|\bnitric oxide donors?|organic nitrates?/, e: /nitrate vasodilator/i, a: ['C01DA'], i: list('nitroglycerin, isosorbide mononitrate, isosorbide dinitrate, amyl nitrite') },
  pde5: { n: 'PDE5 inhibitor (like sildenafil)', p: /\bpde-?5 inhibitors?|phosphodiesterase(?: type)?[- ]5 (?:\(pde5\) )?inhibitors?/, e: /phosphodiesterase 5 inhibitor/i, i: list('sildenafil, tadalafil, vardenafil, avanafil') },
  alpha_blocker: { n: 'alpha-blocker', p: /\balpha[- ]?(?:adrenergic )?blockers?|\balpha[- ]?(?:1 )?(?:adrenergic )?(?:receptor )?antagonists?|alpha-blocking/, e: /alpha-1 adrenergic antagonist|alpha adrenergic blocker/i, a: ['C02CA', 'G04CA'] },
  statin: { n: 'statin (cholesterol)', p: /\bstatins?\b|hmg-?coa reductase inhibitors?/, e: /hmg-coa reductase inhibitor/i, a: ['C10AA'] },
  fibrate: { n: 'fibrate (cholesterol)', p: /\bfibrates?\b|fibric acid derivatives?/, e: /peroxisome proliferator receptor alpha agonist|fibrate/i, a: ['C10AB'] },
  bile_acid_sequestrant: { n: 'bile acid binder (cholestyramine type)', p: /\bbile acid sequestrants?|\bbile acid binding resins?/, e: /bile acid sequestrant/i, a: ['C10AC'] },
  cation: { n: 'antacid or mineral (aluminum, calcium, iron, magnesium, zinc)', p: /\bantacids?\b|polyvalent cations?|multivalent cations?|di- ?(?:and|or) trivalent cations?|\bcations\b/,
    e: /antacid|phosphate binder/i, a: ['A02A', 'A12A', 'A12C', 'B03A'], i: list('aluminum, calcium, iron, magnesium, zinc, sucralfate, bismuth, lanthanum, sevelamer, didanosine') },
  ppi: { n: 'stomach acid reducer (PPI)', p: /\bproton pump inhibitors?|\bppis?\b/, e: /proton pump inhibitor/i, a: ['A02BC'] },
  h2: { n: 'stomach acid reducer (H2 blocker)', p: /\bh2[- ](?:receptor )?(?:antagonists?|blockers?)/, e: /histamine-2 receptor antagonist/i, a: ['A02BA'] },
  acid_reducer: { n: 'stomach acid reducer', p: /\bacid[- ]reducing agents?|gastric acid[- ]reducing|drugs that (?:increase|raise) gastric ph/, e: /proton pump inhibitor|histamine-2 receptor antagonist|antacid/i, a: ['A02A', 'A02BA', 'A02BC'] },
  corticosteroid: { n: 'steroid (corticosteroid)', p: /\bcorticosteroids?\b|\bglucocorticoids?\b|\bsteroids?\b/, e: /corticosteroid/i, a: ['H02'] },
  immunosuppressant: { n: 'drug that weakens the immune system', p: /\bimmunosuppressants?\b|immunosuppressive (?:agents?|drugs?|therapy)/, e: /calcineurin inhibitor immunosuppressant|kinase inhibitor immunosuppressant|immunosuppressant/i, a: ['L04'] },
  live_vaccine: { n: 'live vaccine', p: /\blive (?:attenuated )?(?:virus )?vaccines?|\blive vaccines?/, r: /\blive\b|attenuated|^bcg|^rotavirus|yellow fever|^typhoid vaccine l|^vaccinia virus|^measles virus$|chikungunya|dengue/, i: list('measles, mumps and rubella vaccine, varicella vaccine, zoster vaccine live, yellow fever vaccine, rotavirus vaccine, typhoid vaccine live, bcg vaccine, influenza vaccine live, cholera vaccine live, dengue vaccine') },
  hormonal_contraceptive: { n: 'birth control pill or other hormonal contraceptive', p: /\b(?:hormonal|oral|combined hormonal) contraceptives?|\bbirth control pills?|estrogen-containing contraceptives?/, e: /estrogen|progestin/i, a: ['G03A'] },
  estrogen: { n: 'estrogen', p: /\bestrogens?\b/, e: /estrogen/i, a: ['G03C'] },
  thyroid: { n: 'thyroid hormone', p: /\bthyroid hormones?|\bthyroid replacement/, e: /l-thyroxine|thyroxine|thyroid/i, a: ['H03AA'] },
  fluoroquinolone: { n: 'quinolone antibiotic (like ciprofloxacin)', p: /\bfluoroquinolones?\b|\bquinolones?\b/, e: /quinolone antimicrobial/i, a: ['J01MA'] },
  tetracycline: { n: 'tetracycline antibiotic', p: /\btetracyclines\b|tetracycline-class/, e: /tetracycline-class/i, a: ['J01AA'] },
  macrolide: { n: 'macrolide antibiotic (like clarithromycin)', p: /\bmacrolides?\b/, e: /macrolide/i, a: ['J01FA'] },
  azole: { n: 'azole antifungal', p: /\bazole antifungals?|\bazoles\b|\btriazole antifungals?/, e: /azole antifungal/i, a: ['J02AB', 'J02AC'] },
  aminoglycoside: { n: 'aminoglycoside antibiotic', p: /\baminoglycosides?\b/, e: /aminoglycoside/i, a: ['J01G'] },
  protease_inhibitor: { n: 'HIV or hepatitis C protease inhibitor', p: /\b(?:hiv[- ]?(?:1 )?)?protease inhibitors?\b/, e: /protease inhibitor/i, a: ['J05AE', 'J05AP'] },
  antiepileptic: { n: 'seizure medicine', p: /\bantiepileptics?\b|\banticonvulsants?\b|antiepileptic drugs?|\baeds?\b/, e: /anti-epileptic|anticonvulsant/i, a: ['N03'] },
  stimulant: { n: 'stimulant', p: /\bcns stimulants?|\bstimulants?\b|\bamphetamines?\b|\bsympathomimetics\b|\bsympathomimetic (?:drugs?|agents?|medications?)/, e: /central nervous system stimulant|sympathomimetic/i, a: ['N06BA', 'R01BA'] },
  vasopressor: { n: 'vasopressor', p: /\bvasopressors?\b|\bpressor agents?/, a: ['C01CA'] },
  dopamine_antagonist: { n: 'dopamine blocker', p: /\bdopamine (?:d2 )?(?:receptor )?antagonists?|dopamine blocking/, e: /dopamine.*antagonist|antipsychotic/i, a: ['N05A'], i: list('metoclopramide, prochlorperazine, promethazine, droperidol, domperidone') },
  dopamine_agonist: { n: 'Parkinson medicine (dopamine)', p: /\bdopamine (?:receptor )?agonists?|dopaminergic (?:agents?|drugs?)|\blevodopa\b/, e: /dopamine agonist|aromatic amino acid/i, a: ['N04B'] },
  cholinesterase_inhibitor: { n: 'dementia drug (cholinesterase inhibitor)', p: /\bcholinesterase inhibitors?|acetylcholinesterase inhibitors?/, e: /cholinesterase inhibitor/i, a: ['N06DA'] },
  neuromuscular_blocker: { n: 'muscle paralyzing drug used in surgery', p: /\bneuromuscular block(?:ing agents?|ers?)/, e: /neuromuscular blocker/i, a: ['M03A'] },
  anesthetic: { n: 'general anesthetic', p: /\bgeneral anesthetics?|\banesthetic agents?/, e: /general anesthetic/i, a: ['N01A'] },
  antineoplastic: { n: 'cancer drug', p: /\bantineoplastics?\b|\bcytotoxic (?:agents?|drugs?)|\bchemotherap(?:y|eutic agents?)/, a: ['L01'] },
  nephrotoxic: { n: 'drug that can harm the kidneys', p: /\bnephrotoxic (?:agents?|drugs?|medications?)|potentially nephrotoxic/, a: ['J01G'], i: list('amphotericin b, cisplatin, cyclosporine, tacrolimus, vancomycin, foscarnet, cidofovir, tenofovir disoproxil, polymyxin b, colistin, bacitracin, pentamidine, zoledronic acid, methotrexate, lithium') },
  hepatotoxic: { n: 'drug that can harm the liver', p: /\bhepatotoxic (?:agents?|drugs?|medications?)|potentially hepatotoxic/ },
  qt: { n: 'drug that can upset heart rhythm (prolongs QT)', p: /\b(?:drugs?|agents?|medications?|medicinal products) (?:that|known to|which) (?:can |may )?(?:prolong|increase) (?:the )?qtc?(?: interval)?|qtc?[- ]prolonging (?:drugs?|agents?|medications?)|drugs? associated with qtc? prolongation/, i: QT_KNOWN },
  hypokalemic: { n: 'drug that lowers potassium', p: /\bdrugs? (?:that|which) (?:cause|lower|decrease|reduce) (?:serum )?potassium|potassium-(?:depleting|wasting)|hypokalemia-inducing/, a: ['C03A', 'C03C'], i: list('amphotericin b, furosemide, bumetanide, torsemide, hydrochlorothiazide, chlorthalidone, indapamide, metolazone') },
  hyperkalemic: { n: 'drug that raises potassium', p: /\bdrugs? (?:that|which|known to) (?:increase|raise|elevate) (?:serum )?potassium|potassium-(?:raising|increasing)/,
    e: /aldosterone antagonist|potassium-sparing|angiotensin converting enzyme inhibitor|angiotensin 2 receptor blocker/i, i: list('potassium, trimethoprim, heparin, cyclosporine, tacrolimus, drospirenone, amiloride, triamterene, spironolactone, eplerenone') },
  seizure_threshold: { n: 'drug that can lower the seizure threshold', p: /\b(?:lower|reduce|decrease)s? (?:the )?seizure threshold/, i: list('bupropion, tramadol, tapentadol, meperidine, clozapine, chlorpromazine, theophylline, imipenem, ciprofloxacin, levofloxacin, isoniazid, lithium') },
  myelosuppressive: { n: 'drug that lowers blood counts', p: /\bmyelosuppressive (?:agents?|drugs?)|\bbone marrow (?:depressants?|suppressants?)/ },
  ototoxic: { n: 'drug that can harm hearing', p: /\bototoxic (?:agents?|drugs?)/, a: ['J01G'], i: list('cisplatin, carboplatin, furosemide, bumetanide, ethacrynic acid, vancomycin') },
  lithium: { n: 'lithium', p: /\blithium\b/, i: list('lithium') },
  methotrexate: { n: 'methotrexate', p: /\bmethotrexate\b/, i: list('methotrexate') },
  contrast: { n: 'iodinated contrast dye (for scans)', p: /\biodinated contrast|\bcontrast (?:media|agents?|dyes?)\b|radiocontrast/, i: list('iohexol, iopamidol, iodixanol, ioversol, iopromide, ioxilan, diatrizoate, iomeprol, ioxaglate, iothalamate') },
};
