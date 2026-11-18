# both

A free, open drug interaction checker and dataset. Check whether medicines are safe to take together at **https://both.apexlinks.org**, call the free API, or download everything.

Interaction databases that clinics and pharmacies rely on cost tens of thousands of dollars a year. both is built only from public sources, so anyone can use it, ship it in a product, or check how it reached each answer.

> both helps people ask the right questions. It is not medical advice and does not replace a doctor or pharmacist. Never start, stop or change a medicine without asking them.

## What's in it

About 614,000 interacting ingredient pairs over 6,750 ingredients (3,400 with known interactions), each with a severity, what happens, and the evidence behind it.

| Source | What it adds | Licence |
| --- | --- | --- |
| US FDA drug labels (openFDA, DailyMed) | every Rx and OTC label's interaction, contraindication and warning sentences | public domain |
| Norwegian Medical Products Agency, FEST | 11,000 graded interactions with consequence, mechanism, handling, evidence level | NLOD 2.0 |
| Danish Medicines Agency interaction database | 7,600 interactions, professional and patient texts | public sector information |
| ANSM (France) thesaurus, Sept 2023 | 3,100 entries, four levels, drug classes | public information |
| US VA NDF-RT (2014) | 10,000 critical and significant interactions | public domain |
| ONC high-priority and non-interruptive lists | expert consensus lists | published research |
| 2023 AGS Beers Criteria, table 5 | interactions to avoid in older adults | cited facts |
| FDA CYP and transporter table | which drugs block, speed up or depend on liver enzymes | public domain |
| Wikidata P769 | community-listed interactions, unrated | CC0 |

Norwegian, Danish and French texts are machine-translated offline (Argos/OPUS-MT), with drug names protected from the translator; originals are kept.

## Severity

`x` do not take together (contraindicated) · `a` avoid · `c` take care (dose change, spacing, monitoring) · `m` minor · `n` studied, no meaningful interaction.
Each source's own words are kept next to ours. The most cautious documented rating wins. Source `mech` marks pairs inferred from mechanism (both drugs share a risk named in their FDA labels, or one strongly blocks an enzyme the other depends on); these never outrank a documented source and are shown as "possible".

## Accuracy

Measured against DDInter 2.0 (used only as a yardstick, none of its data is included): both flags 75% of DDInter’s major pairs and 49% of its moderate pairs, and lists many pairs DDInter lacks. Known limits: no independent pharmacist review yet; label sentences are read by rules that can misread; machine translation; no dose, route or age logic yet.

## API

The checker itself is fully offline: the first visit stores the app and a ~13 MB data bundle (including blink-8M int8 meaning search) (`site/static/app/<version>/`) on the device, and every check after that runs locally with no network.

The whole dataset is also one SQLite/Turso database, `/download/both.db.gz` (open it with Turso, sqlite3 or any SQLite library).

The public API is static JSON, no key, no limits:

- `GET /api/v1/index.json`: ingredients, search names (brands, other languages), classes, sources.
- `GET /api/v1/drug/<slug>.json`: one ingredient's interactions with evidence references.
- `GET /api/v1/text/<n>.json`: evidence texts, 200 per file.

Full docs: https://both.apexlinks.org/developers. Downloads (CSV and JSON lines): https://both.apexlinks.org/data.

## Build it yourself

Node 24, pnpm, uv (for translation) and ~250 MB of models in `~/models/argos`:

```sh
node pipeline/labels.ts      # stream all FDA labels (1.8 GB, nothing raw kept)
node pipeline/fda_pk.ts      # FDA enzyme table
node pipeline/fest.ts && node pipeline/dk.ts && node pipeline/ansm.ts && node pipeline/ndfrt.ts
# translate (see pipeline/translate.py), then:
node pipeline/repair.ts    # put back drug names the translator garbled
node pipeline/vocab.ts && node pipeline/extract.ts && node pipeline/mechanism.ts && node pipeline/build.ts
node pipeline/evaluate.ts    # recall against DDInter
node pipeline/site.ts && node pipeline/db.ts && node pipeline/bundle.ts && node pipeline/meaning.ts && cd site && pnpm build
```

## Licence

Data: CC BY 4.0, crediting both and the sources above. Code: MIT.
