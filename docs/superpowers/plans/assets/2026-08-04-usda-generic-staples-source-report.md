# USDA generic staples source report

**Issue:** `mezo-23f8`
**Generated:** 2026-08-04
**Catalog:** `2026-08-04-usda-generic-staples.json`

## Source archives

| Data type | Release | Official URL | SHA-256 |
|---|---|---|---|
| Foundation Foods | 2026-04-30 | `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip` | `186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a` |
| SR Legacy | 2018-04 | `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip` | `0fe8ae486a2c8eb42cb96413f058deb51863a46c8fb8eeb4b1fb45006dd338ef` |

USDA FoodData Central data are public domain under CC0. Foundation Foods supplies analytically derived commodity data; SR Legacy is the final USDA Standard Reference release. Branded, FNDDS, and Experimental records were not loaded or considered.

Official documentation:

- <https://fdc.nal.usda.gov/download-datasets/>
- <https://fdc.nal.usda.gov/data-documentation/>
- <https://fdc.nal.usda.gov/Foundation_Foods_Documentation/>

## Nutrient mapping

| Pantry field | FDC nutrient ID | Rule |
|---|---:|---|
| `kcal` | 2048 / 2047 / 1008 | Foundation: prefer Atwater Specific 2048, otherwise General 2047; SR Legacy: Energy 1008 |
| `proteinG` | 1003 | Protein, g/100 g |
| `fatG` | 1004 | Total lipid (fat), g/100 g |
| `carbsG` | 1005 | Carbohydrate by difference, g/100 g |
| `fiberG` | 1079 | Total dietary fiber when present |
| `sugarG` | 2000 / 1063 | Total sugars, preferring 2000 when present |
| `saturatedFatG` | 1258 | Total saturated fatty acids when present |

No salt value is derived from sodium. Source numeric values are preserved as published.

## Selection result

The catalog contains 99 unique FDC IDs, 99 fixed UUIDs, and 99 unique Hungarian names:

| Category | Rows |
|---|---:|
| vegetables | 24 |
| fruits | 20 |
| meat | 20 |
| fish | 10 |
| eggs | 3 |
| legumes | 10 |
| grains | 12 |

Data-type split: 15 Foundation rows and 84 SR Legacy rows. All 99 rows have non-null kcal, protein, carbohydrate, and fat values.

The roster was compared against all active and deleted production `pantry_item.name` values on 2026-08-04; no exact target-name collision existed. Semantic review excluded already represented states such as raw chicken breast, cooked chicken breast, generic egg, frozen berries, basmati rice, bulgur, oats, canned chickpeas, and existing bean varieties.

## Rejected Foundation candidates

Four preferred Foundation records failed required-macro validation and were replaced with complete SR Legacy equivalents:

| Rejected FDC ID | Description | Reason | Selected replacement |
|---:|---|---|---:|
| 323505 | `Kale, raw` | Missing published kcal | 168421 |
| 2727578 | `Squash, pie pumpkin, peeled, seeded, raw` | Missing carbohydrate and fat, no usable energy | 168448 |
| 2747675 | `Watermelon, seedless, flesh only, raw` | Missing carbohydrate and fat, no usable energy | 167765 |
| 2727566 | `Chicken, drumstick, meat and skin, raw` | Negative carbohydrate-by-difference (`-0.475 g/100 g`) | 172373 |

No value was imputed to retain these records.
