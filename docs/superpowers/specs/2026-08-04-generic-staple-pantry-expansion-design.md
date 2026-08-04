# Generic staple pantry expansion design

**Issue:** `mezo-23f8`
**Date:** 2026-08-04
**Scope:** curated production data expansion

## Goal

Add 80–100 missing, generic staple foods to the live pantry with Hungarian names and authoritative per-100 g energy and macronutrient values. The expansion covers vegetables, fruits, meats, fish, eggs, legumes, and grains. It must not add branded or manufacturer-dependent products and must not modify any existing pantry row.

## Authoritative source

Use USDA FoodData Central (FDC), whose data are public domain under CC0:

- Prefer the April 2026 Foundation Foods release for minimally processed commodities with analytically derived values.
- Fall back to the April 2018 SR Legacy final release when a suitable Foundation record does not exist.
- Exclude Branded Foods, FNDDS composite dishes, Experimental Foods, and records with added sauces, breading, oil, or brand-specific formulation.
- Use the official downloadable JSON datasets rather than API search calls for the full catalog. The download is reproducible and avoids the DEMO_KEY limit of 30 requests/hour and 50 requests/day.

References:

- <https://fdc.nal.usda.gov/download-datasets/>
- <https://fdc.nal.usda.gov/data-documentation/>
- <https://fdc.nal.usda.gov/api-guide/>

## Catalog composition

The final catalog contains 80–100 new rows, approximately distributed as follows:

| Category | Target | State policy |
|---|---:|---|
| vegetables | 20–25 | Raw edible portion; no separate cooked variants in this pass |
| fruits | 15–20 | Raw edible portion |
| meat | 20–25 | Separate raw, cooked, roasted, or grilled rows only when FDC has distinct generic records without added fat or sauce |
| fish | 6–10 | Raw and plain cooked variants where distinct generic records exist |
| eggs | 2–4 | Generic whole-egg states; avoid recipe-style preparations |
| legumes | 8–12 | Separate dry and cooked states where both are useful and sourced |
| grains | 8–12 | Separate dry and cooked states where both are useful and sourced |

The exact category counts may move within these ranges to avoid duplicates and low-value variants, but the total must remain within 80–100.

## Selection and naming rules

- Select foods commonly available in Hungary and broadly useful for meal logging.
- Exclude regional cultivars, obscure cuts, baby-food products, restaurant preparations, supplements, fortified formulations, and manufacturer-specific items.
- Do not add a food that is already represented by an active row with the same ingredient and preparation state, even if the wording differs.
- Give every row a concise, natural Hungarian name.
- Encode preparation state in the name when it materially changes the nutrient basis, for example `Lencse, száraz`, `Lencse, főtt`, `Csirkemell, nyers`, or `Csirkemell, sült`.
- Do not silently merge raw and cooked nutrient records under one name.

## Nutrient mapping

Every inserted row uses `serving_amount = 100` and `serving_unit = g`.

Required FDC nutrient mappings:

- energy in kcal → `kcal`;
- protein → `protein_g`;
- carbohydrate by difference → `carbs_g`;
- total lipid (fat) → `fat_g`.

Optional direct mappings, when present in the selected FDC record:

- total dietary fiber → `fiber_g`;
- total sugars → `sugar_g`;
- saturated fatty acids → `saturated_fat_g`.

Do not derive salt from sodium and do not fabricate missing values. Required macro values must all be present; a candidate missing any required value is rejected or replaced with a suitable SR Legacy record. Preserve source precision without adding false decimal places, and verify that kcal is plausible relative to the macros while accepting normal differences caused by fiber, organic acids, and FDC calculation methods.

## Stored provenance

Each new row uses:

- `kind = food`;
- the matching existing pantry category enum;
- `source = web`, because the current API enum has no USDA-specific value;
- `notes` containing the FDC ID, data type (`Foundation` or `SR Legacy`), exact English FDC description, and dataset release date;
- `brand = null`, price/stock/package fields null, and `nova = 1` for plain unprocessed foods.

No application contract or source enum change is part of this task.

## Data flow

1. Download the official Foundation Foods April 2026 and SR Legacy April 2018 JSON archives.
2. Select exact FDC records and materialize a reviewed catalog artifact containing Hungarian name, category, state, FDC provenance, and nutrient values.
3. Compare the artifact against active live names and semantic equivalents; remove conflicts rather than updating existing rows.
4. Save a full pre-change `pantry_item` rollback export and deterministic hash of all existing rows.
5. Insert the reviewed rows in one guarded PostgreSQL transaction using the live owner UUID.
6. Abort if the planned count, uniqueness checks, owner resolution, or required-macro checks fail.

## Verification and recovery

- Confirm the inserted row count is within 80–100 and equals the catalog artifact count.
- Confirm every inserted row has `100 g`, all four required macros, an allowed category, `source = web`, and complete USDA provenance.
- Confirm no duplicate active names and no semantic duplicates identified during review.
- Confirm the complete pre-existing-row hash is unchanged.
- Confirm total and per-category counts increased by exactly the planned amounts.
- Retrieve the pantry through the authenticated production API and spot-check every category and multiple preparation-state pairs.
- Keep the catalog artifact, guarded SQL, and source-selection report in the repository for auditability.
- If verification fails, delete only the inserted UUIDs or restore from the full rollback export in one transaction.

## Non-goals

- Changing existing names or nutrient values.
- Adding branded foods or prices.
- Building a permanent USDA integration or scheduled synchronization.
- Expanding dairy, cheese, nuts, oils, bakery, condiments, snacks, beverages, or supplements.
- Translating or normalizing the existing seed catalog.
