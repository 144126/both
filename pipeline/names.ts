// Name normalization shared by every source: salts, hydrates, accents and the US/international spelling differences.

// salt, ester and hydrate words dropped from the end of an ingredient name ("warfarin sodium" -> "warfarin")
const SALT = new Set(('sodium potassium calcium magnesium hydrochloride hcl hydrobromide bromide chloride sulfate sulphate bisulfate maleate mesylate '
  + 'mesilate besylate besilate tartrate bitartrate succinate citrate phosphate diphosphate acetate fumarate hemifumarate lactate gluconate '
  + 'dihydrate monohydrate trihydrate hemihydrate sesquihydrate hydrate anhydrous disodium dipotassium tromethamine meglumine '
  + 'oxalate nitrate tosylate hyclate hemisuccinate valerate propionate dipropionate butyrate furoate pivalate stearate palmitate '
  + 'carbonate bicarbonate hydroxide oxide napsylate pamoate embonate edisylate estolate ethylsuccinate lactobionate '
  + 'xinafoate decanoate enanthate cypionate undecanoate benzoate aspartate saccharate dimesylate erbumine olamine axetil '
  + 'medoxomil proxetil cilexetil arginine lysine sulfosalicylate glucoside camsylate besilat hydrochlorid').split(' '));
// ions that are the active part when they come first: "potassium chloride" -> "potassium", "lithium carbonate" -> "lithium"
const ION = new Set('potassium calcium magnesium lithium iron zinc aluminum aluminium sodium ferrous ferric bismuth'.split(' '));

export const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").trim();

/** Ingredient key: plain lowercase, salts and hydrates removed, "ferrous sulfate" -> "iron". */
export function base(name: string): string {
  let words = plain(name).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9' -]+/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > 1 && ION.has(words[0]) && words.slice(1).every(w => SALT.has(w))) words = [words[0]];
  while (words.length > 1 && SALT.has(words[words.length - 1])) words.pop();
  const key = words.join(' ');
  return key === 'ferrous' || key === 'ferric' ? 'iron' : key === 'aluminium' ? 'aluminum' : key;
}

// International (INN, used by Europe and most of the world) -> US (USAN) names, the canonical English form here
export const US_NAME: Record<string, string> = {
  paracetamol: 'acetaminophen', 'acetylsalicylic acid': 'aspirin', 'acetylsalicylsyre': 'aspirin', adrenaline: 'epinephrine',
  noradrenaline: 'norepinephrine', salbutamol: 'albuterol', levosalbutamol: 'levalbuterol', glibenclamide: 'glyburide',
  rifampicin: 'rifampin', ciclosporin: 'cyclosporine', ciclosporine: 'cyclosporine', pethidine: 'meperidine', frusemide: 'furosemide',
  colestyramine: 'cholestyramine', dosulepin: 'dothiepin', isoprenaline: 'isoproterenol', phenobarbitone: 'phenobarbital',
  'methylthioninium chloride': 'methylene blue', methylthioninium: 'methylene blue', lignocaine: 'lidocaine', amfetamine: 'amphetamine',
  dexamfetamine: 'dextroamphetamine', lisdexamfetamine: 'lisdexamfetamine', metamfetamine: 'methamphetamine', benzylpenicillin: 'penicillin g',
  phenoxymethylpenicillin: 'penicillin v', cefalexin: 'cephalexin', cefazolin: 'cefazolin', cefalotin: 'cephalothin', ciclopirox: 'ciclopirox',
  sulfamethoxazole: 'sulfamethoxazole', trimethoprim: 'trimethoprim', 'valproic acid': 'valproate', 'sodium valproate': 'valproate',
  valproinsyre: 'valproate', 'acide valproique': 'valproate', divalproex: 'valproate', 'valproate semisodium': 'valproate',
  bendroflumethiazide: 'bendroflumethiazide', bendrofluazide: 'bendroflumethiazide', chlorphenamine: 'chlorpheniramine',
  dexchlorpheniramine: 'dexchlorpheniramine', hyoscine: 'scopolamine', 'hyoscine butylbromide': 'butylscopolamine', butylscopolamine: 'butylscopolamine',
  orciprenaline: 'metaproterenol', mesalazine: 'mesalamine', aciclovir: 'acyclovir', valaciclovir: 'valacyclovir', ganciclovir: 'ganciclovir',
  thiamazole: 'methimazole', levothyroxine: 'levothyroxine', 'levothyroxine sodium': 'levothyroxine', liothyronine: 'liothyronine',
  oestradiol: 'estradiol', ethinylestradiol: 'ethinyl estradiol', 'ethinyl oestradiol': 'ethinyl estradiol', etinylestradiol: 'ethinyl estradiol',
  'ethinylestradiol ': 'ethinyl estradiol', norethisterone: 'norethindrone', medroxyprogesterone: 'medroxyprogesterone',
  dimeticone: 'simethicone', simeticone: 'simethicone', 'glyceryl trinitrate': 'nitroglycerin', nitroglycerol: 'nitroglycerin',
  'isosorbide mononitrate': 'isosorbide mononitrate', tetracosactide: 'cosyntropin', 'insulin human': 'insulin', 'human insulin': 'insulin',
  'thyroid': 'thyroid', 'sulphasalazine': 'sulfasalazine', sulfasalazine: 'sulfasalazine', sulfadiazine: 'sulfadiazine', 'co-trimoxazole': 'sulfamethoxazole/trimethoprim',
  trimipramine: 'trimipramine', clomethiazole: 'clomethiazole', methotrimeprazine: 'levomepromazine', levomepromazine: 'levomepromazine',
  zuclopenthixol: 'zuclopenthixol', flupentixol: 'flupentixol', mitoxantrone: 'mitoxantrone', procaine: 'procaine', tamsulosin: 'tamsulosin',
  ketoconazole: 'ketoconazole', alfacalcidol: 'alfacalcidol', colecalciferol: 'cholecalciferol', ergocalciferol: 'ergocalciferol',
  phytomenadione: 'phytonadione', 'vitamin k1': 'phytonadione', retinol: 'vitamin a', 'ascorbic acid': 'ascorbic acid', 'folic acid': 'folic acid',
  cyanocobalamin: 'cyanocobalamin', 'st johns wort': "st. john's wort", 'hypericum perforatum': "st. john's wort", 'johannesurt': "st. john's wort",
  'millepertuis': "st. john's wort", 'perikon': "st. john's wort", 'grapefruit': 'grapefruit juice', grapefruktjuice: 'grapefruit juice',
  'jus de pamplemousse': 'grapefruit juice', grapefrugtjuice: 'grapefruit juice', grapefrugt: 'grapefruit juice', 'pamplemousse': 'grapefruit juice', ethanol: 'alcohol', 'alcool': 'alcohol', alkohol: 'alcohol',
  'beclometasone': 'beclomethasone', betametasone: 'betamethasone', dexametasone: 'dexamethasone', 'flumetasone': 'flumethasone',
  'fluorometholone': 'fluorometholone', 'mometasone': 'mometasone', 'triamcinolone': 'triamcinolone', 'mitomycin': 'mitomycin',
  'amoxicillin': 'amoxicillin', amoxycillin: 'amoxicillin', 'flucloxacillin': 'flucloxacillin', 'clavulanic acid': 'clavulanate',
  'tranexamic acid': 'tranexamic acid', 'aminocaproic acid': 'aminocaproic acid', 'tiotropium bromide': 'tiotropium',
  'ipratropium bromide': 'ipratropium', 'glycopyrronium': 'glycopyrrolate', 'glycopyrronium bromide': 'glycopyrrolate', 'pizotifen': 'pizotifen',
  'cinnarizine': 'cinnarizine', 'promethazine': 'promethazine', 'lysine acetylsalicylate': 'aspirin', 'acetylsalicylate': 'aspirin',
  'esomeprazole': 'esomeprazole', 'clorazepic acid': 'clorazepate', 'dipotassium clorazepate': 'clorazepate', 'eszopiclone': 'eszopiclone',
  'chlormethine': 'mechlorethamine', 'busulfan': 'busulfan', 'busulphan': 'busulfan', 'cyclophosphamide': 'cyclophosphamide',
  'tretinoin': 'tretinoin', 'isotretinoin': 'isotretinoin', 'tolbutamide': 'tolbutamide', 'gliclazide': 'gliclazide',
  'potassium clavulanate': 'clavulanate', torasemide: 'torsemide', 'etacrynic acid': 'ethacrynic acid', ethacrynate: 'ethacrynic acid',
  chlortalidone: 'chlorthalidone', 'tienilic acid': 'ticrynafen', 'potassium canrenoate': 'canrenoate', 'clavulansyre': 'clavulanate', 'apomorphine': 'apomorphine', 'levodopa': 'levodopa', 'carbidopa': 'carbidopa', 'benserazide': 'benserazide',
};

/** Spelling skeleton that makes INN, USAN and most European spellings of one drug collide: amikacine ~ amikacin, ciclosporine ~ cyclosporine. */
export function skeleton(name: string): string {
  return plain(name).replace(/[^a-z]/g, '').replace(/ph/g, 'f').replace(/th/g, 't').replace(/y/g, 'i').replace(/k/g, 'c').replace(/z/g, 's')
    .replace(/qu/g, 'c').replace(/x/g, 'cs').replace(/([bcdfghjlmnprstvw])h/g, '$1').replace(/(.)\1+/g, '$1').replace(/e$/, '');
}
