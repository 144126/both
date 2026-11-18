import { ANSM_URL_TEXT } from './curated.ts';

// Sources: r code -> [name, url, licence]
export const SOURCES: Record<string, [string, string, string]> = {
  us: ['US FDA drug labels (DailyMed / openFDA)', 'https://open.fda.gov/data/downloads/', 'public domain'],
  no: ['Norwegian Medical Products Agency, FEST interaction database', 'https://www.dmp.no/en/about-us/distribution-of-data-on-medicinal-products/electronic-prescription-support-system-fest', 'NLOD 2.0'],
  dk: ['Danish Medicines Agency, interaction database', 'https://laegemiddelstyrelsen.dk/en/sideeffects/danish-drug-interaction-databases/', 'public, attribution'],
  fr: ['ANSM (France) thesaurus of drug interactions, September 2023', ANSM_URL_TEXT, 'public information, attribution'],
  va: ['US Veterans Affairs NDF-RT drug interactions (2014)', 'https://evs.nci.nih.gov/ftp1/NDF-RT/', 'public domain'],
  onc: ['ONC high-priority and non-interruptive interaction lists (Phansalkar 2012, 2013)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3422823/', 'public'],
  beers: ['2023 AGS Beers Criteria, Table 5 (drug-drug interactions to avoid in older adults)', 'https://doi.org/10.1111/jgs.18372', 'cited facts'],
  mech: ['Inferred from mechanism by this project: both drugs share a risk named in their FDA labels or classes', 'https://github.com/144126/both#how-it-works', 'CC0'],
  wd: ['Wikidata "significant drug interaction" (P769)', 'https://www.wikidata.org/wiki/Property:P769', 'CC0'],
};
