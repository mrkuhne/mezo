# Live pantry name translation design

**Issue:** `mezo-8t51`
**Date:** 2026-08-04
**Scope:** production data maintenance

## Goal

Translate every English `name` value on active (`is_deleted = false`) `pantry_item` rows into natural Hungarian. The result should read like names a Hungarian user would normally use in the Kamra UI, for example `Eggs` → `Tojás` and `Chicken Breast Cooked` → `Főtt csirkemell`.

## Translation rules

- Update only `pantry_item.name`.
- Update only active rows.
- Use natural Hungarian wording and word order rather than mirroring English syntax.
- Preserve brand names, shop names, product-line names, flavours, and meaningful qualifiers where they identify the product.
- Translate generic food descriptors, preparation states, and ordinary flavour descriptions when they are English.
- Keep names that are already Hungarian unchanged.
- Correct an obvious English spelling mistake as part of its Hungarian translation when the intended item is unambiguous.
- Do not translate technical enum values such as `kind`, `category`, `source`, units, or any other column.
- Do not modify IDs, ownership, nutrition, price, stock, relationships, timestamps, or deleted rows.

## Execution

1. Read the active `id` and `name` pairs and prepare an explicit old-name → new-name mapping.
2. Review the mapping for duplicate targets, missing English names, accidental brand translation, and ambiguous products.
3. Save a rollback artifact containing the original `id` and `name` values before the update.
4. Apply the mapping in one PostgreSQL transaction, matching rows by UUID and requiring `is_deleted = false`.
5. Roll back the transaction if the affected-row count differs from the approved mapping size.

## Verification

- Confirm that the number of active and deleted rows is unchanged.
- Confirm that every changed row matches its approved old-name → new-name pair.
- Confirm that no column other than `name` changed.
- Re-scan active names for remaining clearly English generic descriptions.
- Confirm that all four deleted rows retain their original names.
- Spot-check the pantry API or UI after the database checks.

## Recovery

The pre-change `id` → original `name` artifact is the rollback source. If verification fails, restore those values in a single transaction using the immutable UUIDs. The existing nightly database backups remain a second recovery layer.
