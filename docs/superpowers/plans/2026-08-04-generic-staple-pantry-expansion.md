# Generic Staple Pantry Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` for inline execution. Beads issue `mezo-23f8` is the source of task status.

**Goal:** Add exactly 99 reviewed, generic USDA staple-food records to the live pantry without modifying any existing row.

**Architecture:** Resolve a fixed FDC-ID roster from the official Foundation 2026-04-30 and SR Legacy 2018-04 JSON archives into a committed catalog artifact. Generate a guarded, fixed-UUID SQL insert from that artifact, back up production, execute once through Tailscale/kubectl, and verify the old-row hash plus the new rows through PostgreSQL and the authenticated pantry API.

**Tech Stack:** USDA FoodData Central JSON, jq, PostgreSQL 16, kubectl/Tailscale, Beads

## Global constraints

- Insert exactly 99 new rows; update or delete no existing row.
- Use only Foundation or SR Legacy records from the exact roster below; never use Branded, FNDDS, or Experimental data.
- Every row is `kind=food`, `source=web`, `serving_amount=100`, `serving_unit=g`, `nova=1`, and has non-null kcal/protein/carbohydrate/fat.
- Foundation energy uses nutrient 2048 (Atwater Specific) when present, otherwise 2047 (Atwater General). SR Legacy energy uses nutrient 1008.
- Protein uses nutrient 1003, fat 1004, carbohydrate-by-difference 1005, fiber 1079, sugars 2000 then 1063, and saturated fat 1258.
- Preserve source precision; do not calculate salt or synthesize missing nutrients.
- Store FDC ID, data type, exact source description, and release date in `notes`.
- Existing active, deleted, and historical pantry rows must remain byte-for-byte unchanged.

## Fixed roster

The roster has 24 vegetables, 20 fruits, 20 meats, 10 fish records, 3 egg records, 10 legumes, and 12 grains: 99 total.

| Category | FDC ID | Hungarian name |
|---|---:|---|
| vegetables | 2710823 | Spárga, nyers |
| vegetables | 169145 | Cékla, nyers |
| vegetables | 170383 | Kelbimbó, nyers |
| vegetables | 2346407 | Fejes káposzta, nyers |
| vegetables | 2346408 | Lilakáposzta, nyers |
| vegetables | 2685573 | Karfiol, nyers |
| vegetables | 2685577 | Padlizsán, nyers |
| vegetables | 168421 | Fodros kel, nyers |
| vegetables | 169246 | Póréhagyma, nyers |
| vegetables | 2346388 | Jégsaláta, nyers |
| vegetables | 2346389 | Római saláta, nyers |
| vegetables | 2346391 | Zöld leveles saláta, nyers |
| vegetables | 2685568 | Cukkini, nyers |
| vegetables | 2685570 | Sonkatök, nyers |
| vegetables | 168448 | Sütőtök, nyers |
| vegetables | 170427 | Zöld kaliforniai paprika, nyers |
| vegetables | 170108 | Piros kaliforniai paprika, nyers |
| vegetables | 169383 | Sárga kaliforniai paprika, nyers |
| vegetables | 169276 | Retek, nyers |
| vegetables | 170417 | Paszternák, nyers |
| vegetables | 170457 | Paradicsom, nyers |
| vegetables | 2747655 | Édeskömény, nyers |
| vegetables | 168424 | Karalábé, nyers |
| vegetables | 170400 | Zellergumó, nyers |
| fruits | 169118 | Körte, nyers |
| fruits | 174683 | Szőlő, nyers |
| fruits | 173033 | Grapefruit, nyers |
| fruits | 167746 | Citrom, nyers |
| fruits | 168155 | Zöldcitrom, nyers |
| fruits | 167765 | Görögdinnye, nyers |
| fruits | 169092 | Sárgadinnye, nyers |
| fruits | 169949 | Szilva, nyers |
| fruits | 2710815 | Sárgabarack, nyers |
| fruits | 169134 | Gránátalma, nyers |
| fruits | 171722 | Tőzegáfonya, nyers |
| fruits | 173946 | Szeder, nyers |
| fruits | 173963 | Fekete ribizli, nyers |
| fruits | 171719 | Cseresznye, nyers |
| fruits | 167762 | Eper, nyers |
| fruits | 171711 | Áfonya, nyers |
| fruits | 173021 | Füge, nyers |
| fruits | 169914 | Nektarin, nyers |
| fruits | 169941 | Datolyaszilva, nyers |
| fruits | 2710832 | Mandarin, nyers |
| meat | 2646171 | Csirkecombfilé, nyers |
| meat | 172388 | Csirkecombfilé, sült |
| meat | 172373 | Csirke alsócomb bőrrel, nyers |
| meat | 173612 | Csirke alsócomb bőrrel, sült |
| meat | 171093 | Pulykamell bőrrel, nyers |
| meat | 171492 | Pulykamell bőrrel, sült |
| meat | 171531 | Pulykacomb bőr nélkül, nyers |
| meat | 171532 | Pulykacomb bőr nélkül, sült |
| meat | 172410 | Kacsahús bőr nélkül, nyers |
| meat | 172411 | Kacsahús bőr nélkül, sült |
| meat | 171765 | Marhabélszín, nyers |
| meat | 174004 | Marhabélszín, sült |
| meat | 171760 | Marhafelsál, nyers |
| meat | 174007 | Marhafelsál, sült |
| meat | 168230 | Sertéskaraj sovány, nyers |
| meat | 168233 | Sertéskaraj sovány, sült |
| meat | 168249 | Sertésszűz, nyers |
| meat | 168250 | Sertésszűz, sült |
| meat | 174313 | Báránycomb sovány, nyers |
| meat | 174314 | Báránycomb sovány, sült |
| fish | 171955 | Atlanti tőkehal, nyers |
| fish | 171956 | Atlanti tőkehal, sült |
| fish | 175167 | Atlanti lazac, tenyésztett, nyers |
| fish | 175168 | Atlanti lazac, tenyésztett, sült |
| fish | 175176 | Tilápia, nyers |
| fish | 175177 | Tilápia, sült |
| fish | 173717 | Szivárványos pisztráng, tenyésztett, nyers |
| fish | 173718 | Szivárványos pisztráng, tenyésztett, sült |
| fish | 175119 | Atlanti makréla, nyers |
| fish | 175120 | Atlanti makréla, sült |
| eggs | 173424 | Tojás, keményre főtt |
| eggs | 172183 | Tojásfehérje, nyers |
| eggs | 172184 | Tojássárgája, nyers |
| legumes | 173756 | Csicseriborsó, száraz |
| legumes | 173757 | Csicseriborsó, főtt |
| legumes | 174252 | Limabab, száraz |
| legumes | 174253 | Limabab, főtt |
| legumes | 174256 | Mungóbab, száraz |
| legumes | 174257 | Mungóbab, főtt |
| legumes | 175199 | Pintóbab, száraz |
| legumes | 175200 | Pintóbab, főtt |
| legumes | 173758 | Feketeszemű bab, száraz |
| legumes | 173759 | Feketeszemű bab, főtt |
| grains | 169703 | Barna rizs, száraz |
| grains | 169704 | Barna rizs, főtt |
| grains | 168874 | Quinoa, száraz |
| grains | 168917 | Quinoa, főtt |
| grains | 170685 | Hajdina, száraz |
| grains | 170686 | Hajdina, főtt |
| grains | 170284 | Árpagyöngy, száraz |
| grains | 170285 | Árpagyöngy, főtt |
| grains | 169702 | Köles, száraz |
| grains | 168871 | Köles, főtt |
| grains | 169699 | Kuszkusz, száraz |
| grains | 169700 | Kuszkusz, főtt |

## Task 1: Materialize and verify the USDA catalog artifact

**Files:**

- Create: `docs/superpowers/plans/assets/2026-08-04-usda-generic-staples.json`
- Create: `docs/superpowers/plans/assets/2026-08-04-usda-generic-staples-source-report.md`

Use these exact official archives:

```text
Foundation: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip
SHA-256: 186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a

SR Legacy: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip
SHA-256: 0fe8ae486a2c8eb42cb96413f058deb51863a46c8fb8eeb4b1fb45006dd338ef
```

The JSON artifact is an array of exactly 99 objects with this interface:

```json
{
  "id": "fixed UUID generated once for this catalog row",
  "fdcId": 2710823,
  "name": "Spárga, nyers",
  "category": "vegetables",
  "dataType": "Foundation",
  "sourceDescription": "Asparagus, green, raw",
  "releaseDate": "2026-04-30",
  "per": 100,
  "unit": "g",
  "kcal": 23.5,
  "proteinG": 1.44,
  "carbsG": 5.1,
  "fatG": 0.216,
  "fiberG": 1.88,
  "sugarG": null,
  "saturatedFatG": null
}
```

Generate fixed UUIDs once and persist them in the artifact. Do not regenerate them after review.

Validate with `jq`:

```bash
jq -e '
  length == 99 and
  ([.[].id] | length == (unique | length)) and
  ([.[].fdcId] | length == (unique | length)) and
  ([.[].name] | length == (unique | length)) and
  all(.[];
    (.dataType == "Foundation" or .dataType == "SR Legacy") and
    (.per == 100 and .unit == "g") and
    (.kcal != null and .proteinG != null and .carbsG != null and .fatG != null)
  )
' docs/superpowers/plans/assets/2026-08-04-usda-generic-staples.json
```

Expected: exit 0 and `true`. The source report records both archive URLs/checksums, the nutrient-ID mapping, Foundation energy priority `2048 → 2047`, SR energy `1008`, candidate rejections, and category counts `24/20/20/10/3/10/12`.

Commit the catalog and source report before touching production.

## Task 2: Build and dry-run the guarded SQL

**Files:**

- Create: `docs/superpowers/plans/assets/2026-08-04-insert-usda-generic-staples.sql`

Generate explicit `INSERT` values from the committed catalog, including its fixed UUIDs. The script must:

1. `BEGIN` and lock `pantry_item` in `SHARE ROW EXCLUSIVE` mode.
2. Resolve exactly one owner UUID from the existing 158 active rows and abort otherwise.
3. Load all 99 catalog rows into a temporary table.
4. Assert 99 unique UUIDs, FDC IDs, and names; all required macros; allowed categories; and `100 g` basis.
5. Assert none of the UUIDs or names already exists in any active or deleted `pantry_item` row.
6. Insert only the columns authorized by the spec: fixed ID, owner, `kind=food`, `is_deleted=false`, current `created_at`, Hungarian name, `brand=null`, `source=web`, category, provenance notes, 100 g basis, nutrient values, `nova=1`, and default `taken=false`.
7. Assert the insert affected exactly 99 rows and every inserted row matches the temporary catalog.
8. Print inserted counts grouped by category and `COMMIT`.

Dry-run by replacing only the final `COMMIT` with `ROLLBACK` in the input stream. Expected output: insert count 99, category counts `24/20/20/10/3/10/12`, then `ROLLBACK`. Confirm a sentinel FDC ID is still absent after the dry run.

Commit the verified SQL before the live execution.

## Task 3: Back up and execute on production

Create a full CSV export of `pantry_item` inside `postgres-0`, copy it to:

```text
/Users/mrkuhne/MrKuhne/mezo-live-backups/20260804-mezo-23f8-pantry-item-before.csv
```

Require 163 lines including the header. Record its SHA-256 checksum. Before insertion record:

- total/active/deleted counts (`162/158/4` expected before this task);
- a deterministic hash of every complete pre-existing row ordered by UUID;
- per-category active counts;
- the set of the 99 fixed target UUIDs and names as absent.

Run the guarded SQL exactly once. Any assertion failure must leave production rolled back and stop execution for investigation.

## Task 4: Verify the database and application

Fresh post-write checks must prove:

- totals are `261/257/4`;
- exactly 99 catalog UUIDs exist and all are active;
- new category counts are vegetables +24, fruits +20, meat +20, fish +10, eggs +3, legumes +10, and grains +12;
- every inserted row has required macros, `100 g`, `source=web`, `nova=1`, and USDA provenance;
- no duplicate active names exist;
- the deterministic hash of the original 162 UUIDs is identical to the pre-write hash;
- all four deleted rows are unchanged.

Authenticate to the production API and confirm it returns 257 pantry items. Spot-check at least one row from every category plus the following state pairs:

```text
Csirkecombfilé, nyers / Csirkecombfilé, sült
Csicseriborsó, száraz / Csicseriborsó, főtt
Barna rizs, száraz / Barna rizs, főtt
Atlanti lazac, tenyésztett, nyers / Atlanti lazac, tenyésztett, sült
```

Close and sync `mezo-23f8` only after every DB and API assertion passes.
