# USDA generic staple production import audit

Date: 2026-08-04  
Beads issue: `mezo-23f8`

## Scope

- Insert-only import of 99 generic, non-branded foods.
- Categories: vegetables 24, fruits 20, meat 20, fish 10, eggs 3, legumes 10, grains 12.
- Nutrition basis: 100 g; USDA FoodData Central Foundation Foods (2026-04-30) and SR Legacy (2018-04).
- Existing rows were not updated or deleted.

## Backup and baseline

- Backup: `/Users/mrkuhne/MrKuhne/mezo-live-backups/20260804-mezo-23f8-pantry-item-before.csv`
- Backup rows including header: 163.
- SHA-256: `007dfdd75a01fbd78d4a4b2e90393d59efeacd38643f335c0a78abf546eb01ed`
- Pre-import counts: 162 total, 158 active, 4 deleted.
- Pre-import hash of all rows: `100c206ed6a743073fbac72c5bb86b27`.

## Execution

- The guarded SQL was first executed with its final `COMMIT` replaced by `ROLLBACK`.
- The dry run inserted 99 rows inside the transaction, returned the expected category counts, and rolled back.
- After rollback the sentinel UUID count was 0 and pantry counts remained 162/158/4.
- The unchanged guarded SQL then inserted 99 rows and committed.

## Post-import verification

- Counts: 261 total, 257 active, 4 deleted.
- Catalog UUID matches: 99; fully valid required-field/provenance matches: 99.
- Active duplicate normalized names: 0.
- Hash of the 162 non-catalog rows after import: `100c206ed6a743073fbac72c5bb86b27`, equal to the pre-import hash.
- API counts: 249 ingredients, 8 stash, 257 total active items.
- API comparison against the committed catalog: 99 expected, 0 field mismatches.

## Repository verification

- Frontend: 366 test files passed; 2426 tests passed.
- Backend: 1714 tests passed; 0 failures, 0 errors, 0 skipped; Maven `BUILD SUCCESS`.

## Artifacts

- Catalog: `2026-08-04-usda-generic-staples.json`
- Source report: `2026-08-04-usda-generic-staples-source-report.md`
- Guarded import: `2026-08-04-insert-usda-generic-staples.sql`
