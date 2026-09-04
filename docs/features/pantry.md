---
title: Pantry (Kamra)
type: feature-domain
status: done
updated: 2026-09-02
tags: [fuel, pantry, frontend, data-layer, backend, multi-user]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/pantry
  - api/feature/pantry/pantry.yml
  - frontend/src/data/fuel/pantryHooks.ts
  - frontend/src/data/fuel/pantryApi.ts
  - frontend/src/features/fuel/pages/FuelKamraPage.tsx
  - frontend/src/features/fuel/pages/KamraItemDetailPage.tsx
  - frontend/src/features/fuel/sheets/CatalogSearchSheet.tsx
  - backend/src/main/resources/db/changelog/1.0.0/script/202609021410_mezo-qw37.4_pantry_catalog_split.sql
related: [fuel, recipe, _platform-data-layer, _platform-auth-security]
---

# Pantry (Kamra) — Feature Documentation

> One-line: the shelf at route `/fuel/kamra` (tab "Fuel" → tile "Kamra"): a SHARED definition catalog (`pantry_catalog`) + PER-USER state rows (`pantry_item`). **Status: ✅ backend + FE dual-mode done; split into catalog/state by S4 (`mezo-qw37.4`).**

## 1. Summary

The pantry is mezo's food/supplement/stim/med inventory, reached from the Fuel hub's "Kamra" tile. Since the S4 slice (`mezo-qw37.4`, decision K1 of [ADR 0035](../decisions/0035-multi-user-account-model.md)) it is split into two tables that mirror the `exercise_catalog` hybrid shape already established for Train:

- **`pantry_catalog`** — the shared *definition*: what a food/supplement/stim/med item **is** (name, brand, kind, source, category, macros/micros, NOVA, form, caffeine). `created_by IS NULL` marks a loader-seeded master row (`seed/pantry-catalog.json`, 147 items, `PantryCatalogLoader`); `created_by` set marks a user-authored definition. Every row, master or user-authored, is readable by everyone.
- **`pantry_item`** — the caller's *shelf state*: what **I** have of it (`catalog_id NOT NULL`, stock qty/unit/expiry, price, notes, dose/form/protocol/timing/taken for the stash side).

`pantry_item.id` values were preserved through the migration untouched, so the four existing `ON DELETE RESTRICT` FKs into it (`meal_item`, `recipe_ingredient`, `protocol_item`, `supplement_intake`) and `pantry_import`'s `SET NULL` FK needed no data migration of their own — only the columns the migration drops (§4) moved off the entity.

Driving spec: [`2026-09-02-multi-user-accounts-design.md`](../superpowers/specs/2026-09-02-multi-user-accounts-design.md) §8 (K1). The pantry's pre-split history (single-table `pantry_item`, imports, scrape/photo AI extraction, the 147-item seed) is carried in [`fuel.md`](fuel.md) — this doc covers the S4 shape going forward.

## 2. User-facing behavior

`FuelKamraPage` (`/fuel/kamra`) header carries three actions:

- **„Közös"** — opens `CatalogSearchSheet`: search the shared catalog by name/brand, filter by kind chips (`Mind`/`Étel`/`Supp`/`Stim`/`Gyógyszer`), each hit shows a **„Hozzáadás a közösből"** action that idempotently puts the definition on the caller's shelf (already-on-shelf rows show **„a polcon"** instead).
- **„Import"** — the pre-existing OFF/Link/Fotó import flows, unchanged by S4 (see [`fuel.md`](fuel.md) §1 for their history); a confirmed import now resolves through `PantryCatalogService.findOrCreate` instead of writing a standalone `pantry_item`.
- **„Új tétel"** — manual add, same as before.

Shared-provenance UI:

- A **„közös"** badge appears on `KamraCard` for any item whose catalog row the caller did not author (`sharedFrom != null`).
- `KamraItemDetailPage` shows a **„közös · {szerző}"** line naming the author (or, for a master row, no author — `authorName: null`).
- The edit sheet locks the definition fields (name, brand, macros, …) on a non-editable catalog entry, with the note **„Közös katalógus-tétel: az adatait csak a szerző vagy a tulajdonos szerkesztheti…"**. State fields (stock, price, notes, dose/protocol/timing/taken) stay editable regardless of who authored the definition.
- Deleting a shelf item removes only the caller's `pantry_item` row — the shared definition and every other user's shelf row survive.

## 3. Architecture & data flow

**Read:** `usePantry()` (`useDualQuery`, key `['pantry']`, `realEmpty` empty arrays, mock seed unchanged plus the new `catalogId`/`sharedFrom`/`catalogEditable` fields) → `pantryApi.list` → `GET /api/pantry` → `PantryService.getPantry(AppUserEntity)` → `PantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc` (join-fetches `catalog`) → `PantryMapper.toIngredientResponse(entity, sharedFromName, editable)` — `sharedFromName` and `editable` come from `PantryCatalogService.sharedFromName`/`editable`, both computed against the caller.

**Write paths** (`PantryService`):

- `createItem` — binds to an existing catalog entry (`req.catalogId` set) or resolves/creates one via `PantryCatalogService.findOrCreate` from the request's definition fields, natural-key bound.
- `addFromCatalog` → `PantryCatalogService.ensureItem(userId, catalogId)` — the idempotent "put on my shelf": returns the caller's existing live row for that catalog id if there is one, else creates one.
- `updateItem` — calls `PantryMapper.definitionDiffers(catalog, req)` first; if any *definition* field in the request differs from the catalog row, per-kind validation (`validateEffectivePerKind`) and `PantryCatalogService.requireEditable(user, catalog)` run BEFORE any mutation (so a refused edit never gets flushed); *state* fields (stock/price/notes/dose/timing/taken) apply unconditionally. A **state-only PATCH is never validated against the per-kind rules** and never has to carry the definition back: validation applies to the MERGED definition (request field, else the stored one), so a food edit no longer has to resend `unit`/`kcal`. The edit sheet correspondingly sends a definition field only when that save CHANGES it — echoing the response back used to turn a price edit into a definition edit, because (pre-`mezo-6omv`) `PantryMapper` zero-filled NULL macros on the way out (a 403 for a non-author, a silent zero-overwrite of the shared row for an OWNER); since `mezo-6omv` the macros round-trip as honest nulls (see §4), so that particular echo hazard is gone, though sending only the changed fields remains the rule. When the definition edit lands on a **draft** row and the caller is its author, `updateItem` also promotes `status` to `verified` — see §9.
- `deleteItem` — soft-deletes only the caller's `pantry_item`; the catalog row is untouched.

**`PantryCatalogService.findOrCreate`** (the shared natural-key resolver every writer funnels through — `PantryService`, `PantryImportService`, `ProtocolSeedData`, the AI meal draft, the Receptműhely): a hit is revived if soft-deleted and fill-only merged (never overwrites a curated value) *only when the caller is the row's author* — a bystander OWNER's ordinary add/import never silently backfills someone else's or a master row's NULL fields. A miss inserts in its **own `REQUIRES_NEW` transaction**; on a unique-index race (two users typing the same food at once) the loser catches `DataIntegrityViolationException` and re-resolves via `findByNaturalKey`, binding to whichever row won — the same fill-only-if-author merge then applies.

`findOrCreate` has a second overload, `findOrCreate(authorId, candidate, allowMerge)`, and the plain two-arg form is just `allowMerge = true`. **`PantryImportService` deliberately calls the three-arg form as `findOrCreate(userId, candidate, !manualReview)`** (`PantryImportService.java`): a low-confidence scrape/photo draft that still needs human review must not touch the shared definition's NULL fields before the user confirms it, even when the caller IS that row's author — `allowMerge = false` skips `mergeIfAuthor` entirely on a hit and returns the existing row untouched. See §9.

Mock-mode mutators (`mockAddFromCatalog` in `pantryHooks.ts`) mirror the real endpoint's idempotency against the client-owned TanStack cache.

**Megőrzési terv (`mezo-ho5w`).** Az archive tábla egyirányú biztonsági háló: a split előtti
20 definíció-oszlop minden sorra, a soft-deleted-eket is beleértve. Nincs FK-ja, nincs
JPA-mappingje, és nem is lesz.

A takarító changeset feltétele — MINDHÁROM teljesüljön, produkciós adaton:

1. a split legalább egy teljes release-cikluson át fut éles adaton, definíció-visszaállítási
   igény nélkül;
2. minden archive sor lefedett a mai adattal, azaz nincs olyan archivált definíció, aminek nincs
   élő megfelelője a `pantry_catalog`-ban;
3. a `pantry_item` minden sora egy létező `pantry_catalog` sorra mutat.

Ellenőrző lekérdezés a 2. és 3. ponthoz:

```sql
-- 2) archivált definíciók, amiknek nincs katalógus-megfelelője (elvárt: 0 sor)
select a.id, a.name, a.brand
from pantry_item_definition_archive a
where not exists (
    select 1 from pantry_catalog c
    where lower(trim(c.name)) = lower(trim(a.name))
      and lower(trim(coalesce(c.brand, ''))) = lower(trim(coalesce(a.brand, '')))
);

-- 3) árva polc-sorok (elvárt: 0 sor)
select i.id from pantry_item i
left join pantry_catalog c on c.id = i.catalog_id
where c.id is null;
```

Amíg mindhárom feltétel nincs igazolva produkción, a tábla marad. A takarítás külön
changeset lesz — a split SQL-je immutábilis, sosem szerkeszthető.

## 4. Data model & API

**`pantry_catalog`** (definition; migration §1, `202609021410_mezo-qw37.4_pantry_catalog_split.sql`):

| Column | Notes |
|---|---|
| `id` | UUID PK |
| `created_by` | nullable FK → `app_user`, `ON DELETE SET NULL` — NULL = loader master |
| `is_deleted` | soft-delete; no `@SQLRestriction` on the entity — a deleted catalog row stays loadable through a `pantry_item.catalog_id` FK and is revivable by `PantryCatalogService.findOrCreate`/the loader |
| `status` | `draft` \| `verified` (`ck_pantry_catalog_status`), default `verified`; added by `202609041000_mezo-qooi_pantry_catalog_status.sql` (`mezo-qooi`). `draft` = an unreviewed import candidate, visible only on its own author's shelf — see §9 |
| `kind`, `name`, `brand`, `source`, `category`, `serving_amount`, `serving_unit`, `kcal`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sugar_g`, `salt_g`, `saturated_fat_g`, `package_label`, `micros` (jsonb), `nova`, `form`, `caffeine` | the definition columns, moved verbatim off `pantry_item` |

Constraints/indexes: `pk_pantry_catalog_id`, `fk_pantry_catalog_created_by_app_user_id` (`SET NULL`), `ck_pantry_catalog_kind`/`_source`/`_category`/`_nova`, **`uq_pantry_catalog_natural`** — a unique expression index on `(lower(trim(name)), lower(trim(coalesce(brand, ''))))` — this trim-normalized, case-insensitive natural key is used by EVERY producer/consumer: the migration's dedupe (§ below), `PantryCatalogRepository.findByNaturalKey`, and the operational diagnostic in §9 — plus `idx_pantry_catalog_created_by`, `idx_pantry_catalog_kind`.

**The `lower(trim(...))` folding is Postgres-side only** — no Java-side normalization mirrors it (`mezo-imet`). `PantryCatalogRepository.findByNaturalKey` and the `searchAll`/`searchByKind` queries all express the fold directly in JPQL/SQL against the same expression the unique index uses, and `PantryCatalogLoader` (§5, §9) resolves every seed row's natural key the same way, through `findByNaturalKey` — it does not build its own in-memory Java map of existing rows to dedupe against. One expression, one place, no drift.

**`pantry_item`** (state, same table, definition columns dropped):

| Column | Notes |
|---|---|
| `id` | UUID PK — **preserved** through the split |
| `created_by` | NOT NULL, fully owned |
| `catalog_id` | NOT NULL FK → `pantry_catalog`, `ON DELETE RESTRICT` |
| stock/price/notes/dose/form/protocol/timing/taken (unchanged) | per-user state |

Constraints/indexes: `fk_pantry_item_catalog_id_pantry_catalog_id` (`RESTRICT` — a definition with live shelf rows cannot be hard-deleted), `idx_pantry_item_catalog_id`, **`uq_pantry_item_created_by_catalog_id`** partial unique on `(created_by, catalog_id) WHERE is_deleted = false` — one live shelf row per (user, definition).

**The migration's steps** (see the full script for exact SQL):
1. Create `pantry_catalog` + its natural-key index.
2. A throwaway pre-flight guard: a partial unique index on live `pantry_item` rows by `(created_by, name, brand)` that immediately fails (and rolls back the whole changeset) if any user already holds two live duplicate-key rows — resolve by hand first; see §9 for the diagnostic query.
3. Backfill `pantry_catalog` from LIVE `pantry_item` rows, one row per natural key, earliest `created_at`/`id` wins and becomes the author.
4. Backfill `pantry_catalog` from soft-deleted `pantry_item` rows whose key has no live match yet.
5. Add `pantry_item.catalog_id`, backfill by natural-key join, set `NOT NULL`, add the FK + indexes (nullable → backfill → `NOT NULL` → constrain — the standard Citus-safe recipe, spec §13).
6. Snapshot the pre-drop definition columns into a **one-way safety-net table**, `pantry_item_definition_archive` (no FK, may be dropped by a later cleanup changeset once the split is proven in production).
7. Drop the definition columns (and their CHECKs/index) off `pantry_item`.

**Entity mapping:** `PantryItemEntity.catalog` is `@ManyToOne(FetchType.LAZY)`; every finder that returns items to a caller uses a join-fetch (`findByCreatedByAndDeletedFalseOrderByNameAsc`) to avoid N+1. No `@SQLRestriction` on `PantryCatalogEntity` — see the soft-delete note above.

**Contract** (`api/feature/pantry/pantry.yml`):

| Method | Path | Notes |
|---|---|---|
| GET | `/api/pantry` | `PantryResponse` — `ingredients`/`stash` now carry `catalogId`, `sharedFrom` (nullable `{authorName}`), `catalogEditable` |
| POST | `/api/pantry` | `PantryItemRequest` gains optional `catalogId` (bind to an existing definition on create; ignored on update) |
| PUT | `/api/pantry/{id}` | as before, plus **403 `PANTRY_CATALOG_NOT_EDITABLE`** (definition field changed, caller is not author/OWNER) and **409 `PANTRY_CATALOG_NAME_TAKEN`** (rename collides with another definition's natural key) |
| DELETE | `/api/pantry/{id}` | unchanged — deletes only the caller's shelf row |
| GET | `/api/pantry/catalog?q=&kind=` | **new (S4)** — global search, master + every user's live definitions, max 50, `PantryCatalogEntry[]` |
| POST | `/api/pantry/items/from-catalog` | **new (S4)** — `PantryFromCatalogRequest{catalogId}` → the caller's `PantryItemResponse`, idempotent |

**`kind` and macros contract (`mezo-4orh`, `mezo-6omv`).** `IngredientResponse` itself now carries `kind` (server-computed off `pantry_catalog.kind`), so FE consumers read it straight off the response instead of re-deriving it client-side — the two derivations this replaced, `kamraItems.ts`'s own kind lookup and `pantryPickables.foodKind`, are gone. `PantryMacros`' wire fields — `kcal`, `p`, `c`, `f` (short names on the contract; `PantryCatalogEntity`'s Java getters `getProteinG()`/`getCarbsG()`/`getFatG()` map onto `p`/`c`/`f` in `PantryMapper`) — are all nullable in the contract and on the wire: `PantryMapper` no longer zero-fills a missing macro with `nz()` before serializing, so "no data recorded" (`null`) and "recorded as zero" (`0`) are two distinct, round-tripping states — a FE macro consumer that used to treat every value as a definite number must null-check before formatting/summing (see the split calculator consumers — `recipeMacros.ts`, `RecipeIngredientRow.tsx`, `RecipeEditorPage.tsx`, `fuelHooks.ts`, `MealComposer.tsx` — versus the display consumers — `MacroCells.tsx`, `KamraCard.tsx`, `KamraPickSheet.tsx`, `KamraItemDetailPage.tsx`).

## 5. Integrations

- **Meal** — `MealService` snapshots macro/nutrient facts from `item.getCatalog()` at log time (frozen snapshot, ADR 0026); `MealAiDraftService` + `PantryNameIndex` match free-text/photo food mentions against the GLOBAL catalog (not just the caller's shelf) and auto-`ensureItem` the caller onto the shelf at match time.
- **Recipe** — `RecipeService` snapshots/`NOVA`/category are live reads off `item.getCatalog()`; `RecipeWorkshopService`/`RecipeWorkshopValidator` do the same name-match + auto-add over the global catalog via `PantryNameIndex`.
- **Fuel stack** — `ProtocolService`/`PlacementEngine`/`IntakeService` read `kind`/`name` off the catalog; `ProtocolSeedData` seeds both a definition and a state row.
- **Habit** — `HabitEvaluator`'s stim-kind check reads the catalog `kind`.
- **Character** — `CharacterSignalReads` names pantry items off the catalog.
- **Import** — `PantryImportService` writes a catalog definition (via `findOrCreate`) + the caller's item + the `pantry_import` feed row.
- **Auth** — `CurrentUser`/`AppUserEntity.isOwner()` back the author-or-OWNER edit gate.
- **Loader** — `PantryCatalogLoader` (`@Order(50)`, every profile — not gated behind `demodata`) seeds 147 master rows idempotently, never creates a `pantry_item`, and CLAIMS a colliding user-authored row as master if the seed's natural key already exists (see §9).

## 6. How to use it (consume)

FE: `usePantry()` returns the same shape as before plus `catalogId`/`sharedFrom`/`catalogEditable` on each ingredient/stash entry; `usePantryActions()` gained `searchCatalog`/`addFromCatalog` alongside the existing create/update/delete mutations — import from `@/data/hooks`, never reach into `pantryHooks.ts`/`pantryApi.ts` directly.

Backend: to turn a shared definition into a shelf row, call `PantryCatalogService.ensureItem(userId, catalogId)` — **never** `new PantryItemEntity()` outside `PantryCatalogPopulator`/the loader. To resolve or create a definition from raw facts (import, AI extraction), call `PantryCatalogService.findOrCreate(authorId, candidate)`.

## 7. How to extend it

- **New definition field** (something the item universally IS): add the catalog column + `PantryCatalogEntity` + `PantryMapper` (`applyDefinition`, `applyDefinitionPartial`, `definitionDiffers`, the response mappers, `toCatalogEntry`) + the contract (`PantryCatalogEntry`, `PantryItemRequest`).
- **New state field** (something the CALLER holds of it): add the `pantry_item` column + `PantryMapper`'s `applyUserFields*` + the contract's response/request schemas.
- **The natural key is name+brand only, folded Postgres-side (`mezo-imet`).** Changing it means a new unique index on `pantry_catalog` AND updating `PantryCatalogRepository.findByNaturalKey`'s query together — never add a second, Java-side `lower(trim(...))` (e.g. an in-memory map) that could drift from the SQL expression index; `PantryCatalogLoader` itself resolves seed rows through `findByNaturalKey`, not its own key computation, precisely to avoid that drift.

## 8. Testing

Backend: `PantryCatalogMigrationIT` (standalone Liquibase run against a throwaway schema), `PantryCatalogApiIT` (search, from-catalog idempotency, 403/409 edit gates, delete keeps the definition), `PantryCatalogServiceIT` (revive, `ensureItem`, the concurrent-insert race), `PantryCatalogLoaderIT`, `PantryItemRepositoryIT`, `PantryNameIndexTest`, plus the cross-feature auto-add cases in `MealAiDraftServiceIT`/`RecipeWorkshopApiIT`. FE: `CatalogSearchSheet.test.tsx`, `KamraCard.test.tsx`, `pantryHooks.test.tsx` (both `pnpm test` and `VITE_USE_MOCK=false pnpm test`).

Commands: backend focused `./mvnw clean test -Dtest='Pantry*,...' -Dmezo.test.use-testcontainers=true`; frontend `pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`.

## 9. Decisions, gotchas & deferred

- **Auto-add happens at MATCH time, not save time.** `MealAiDraftService`/`RecipeWorkshopValidator` call `ensureItem` as soon as the LLM's mention resolves against the catalog, before the user confirms the draft — a discarded draft can still leave a new shelf row behind. Accepted trade-off (mirrors the equivalent Recipe-side note).
- **The natural key ignores `kind`.** A food "Kreatin" and a supplement "Kreatin" collide on the same catalog row — accepted; disambiguate with a brand if this ever bites.
- **Migration dedupe is lossy by design.** Step 3/4 pick the earliest `created_at`/`id` as the surviving definition; every OTHER live row's differing macros/micros/source values for the same natural key are DROPPED from `pantry_catalog` (their shelf STATE survives via `catalog_id`). This is a known, accepted data-loss edge on the definition side only — the pre-drop values are preserved in `pantry_item_definition_archive` (§4) as a one-way safety net, not a live read path.
- **Operational diagnostic — duplicate live rows before the split.** If the pre-flight guard (migration §2) fails, find the offending rows with the exact key expression the guard and the natural-key index both use:

  ```sql
  select created_by, lower(trim(name)), lower(trim(coalesce(brand,''))), count(*), array_agg(id)
  from pantry_item
  where is_deleted = false
  group by 1,2,3
  having count(*) > 1;
  ```

  Resolve by hand (merge or rename one of the duplicates) before re-running the migration — it must never be left to auto-pick a winner.
- **A manual-review import draft never merges into the shared definition on a natural-key HIT, and lands as `status = draft` on a MISS (`mezo-qooi`).** `PantryImportService` calls `findOrCreate(userId, candidate, !manualReview)` — the third parameter is `trusted`, and it now gates BOTH branches of `findOrCreate`, not just the merge:
  - **HIT** (existing definition): `trusted = false` skips `mergeIfAuthor` entirely and returns the existing row untouched — a low-confidence scrape/photo draft must not backfill the shared row's NULL fields, even when the caller already authored that row, because a bad AI-extracted value would otherwise permanently block the correct curated value from ever filling that column later (fill-only merge never overwrites a non-null value).
  - **MISS** (new definition): `trusted = false` inserts the new row as `status = 'draft'` instead of `'verified'`. A draft is excluded from THREE read paths — `PantryCatalogRepository.searchAll`/`searchByKind` (so it never appears in `CatalogSearchSheet` for anyone but its author browsing their own shelf) and `PantryNameIndex` (so `MealAiDraftService`/`RecipeWorkshopValidator` never auto-match free text against it) — and from a FOURTH: `PantryCatalogService.ensureItem` (the `from-catalog` idempotent add) refuses to bind ANY caller to a draft row except the row's own author, returning the same `RESOURCE_NOT_FOUND` a bystander gets for an unknown id, so a guessed or leaked draft `catalogId` cannot be probed into existence by a non-author. The author's own subsequent definition edit (`PantryService#updateItem`, when it touches a definition field and the caller is the row's author) promotes the row to `verified` — that edit IS the human confirmation the manual-review badge asks for; a natural-key HIT is never promoted this way, since a HIT never touches an unreviewed row's `status` in the first place.
  This closes a gap the original manual-review gate left open: the S4 gate only covered the HIT branch, so a MISS from low-confidence data still published unreviewed content straight into the shared catalog every user searches. A new `findOrCreate` caller for unreviewed/low-confidence data should default to `trusted = false` too, not copy the plain two-arg (`trusted = true`) call.
- **A seed collision no longer claims a user-authored row silently.** When `PantryCatalogLoader` finds an existing `pantry_catalog` row whose natural key matches a seed entry and that row is user-authored (`created_by` set), it clears `created_by` to convert it into shared master content — this is intentional (see the loader's javadoc) but it does destroy that user's sole authorship claim on the row. The loader now emits one `WARN` line PER claimed **user-authored** row (not just an end-of-run summary) naming the row's id, name (and brand, when set), and the `created_by` UUID being cleared, so an operator scanning startup logs can reconstruct exactly which rows lost authorship and why. A plain revive of an already-master (soft-deleted) row, or an ordinary insert of a brand-new seed row, does not log this WARN — only an actual authorship claim does. Note the `claimed` count in the run's end-of-run `INFO` summary line is broader than the WARN count: it also tallies those silent already-master revives, so "N claimed" in the summary can exceed the number of WARN lines for the same run.
- **A deleted author's definitions become master-like.** The catalog FK is `ON DELETE SET NULL`, so once an author's account is gone the row reads as loader-master (`isMaster() == true`) and is thereafter OWNER-editable only.
- **`ResetDatabase` ordering** — `pantry_catalog` rows must TRUNCATE before `app_user` (the FK is `SET NULL`, not `CASCADE`, so order still matters for a clean re-seed).
- **The 147-item seed's `stockQty`/`priceHuf` fields are ignored by `PantryCatalogLoader`** — the loader only ever writes definition columns; no `pantry_item` is created by the loader for anyone but populators/tests that explicitly ask for one.
- **Deferred:** catalog moderation/merge UI (duplicate near-miss detection beyond the exact natural key), per-user definition overrides (K2 — explicitly REJECTED in the spec, not merely deferred), `usedInRecipes`/`lastUsed` on `IngredientResponse` are still hardcoded constants (pre-dates S4).

## 10. Key files

- **Backend:** `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/{entity/PantryCatalogEntity,entity/PantryItemEntity,repository/PantryCatalogRepository,repository/PantryItemRepository,service/PantryCatalogService,service/PantryService,service/PantryNameIndex,mapper/PantryMapper,controller/PantryController,PantryCatalogLoader}.java`
- **Migration:** `backend/src/main/resources/db/changelog/1.0.0/script/202609021410_mezo-qw37.4_pantry_catalog_split.sql`
- **Contract:** `api/feature/pantry/pantry.yml`
- **FE data:** `frontend/src/data/fuel/{pantryApi,pantryHooks,pantry,pantryImpact,pantryPickables}.ts`
- **FE views/sheets:** `frontend/src/features/fuel/pages/{FuelKamraPage,KamraItemDetailPage}.tsx`, `frontend/src/features/fuel/sheets/CatalogSearchSheet.tsx`
- **Tests:** `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/{PantryCatalogMigrationIT,PantryCatalogApiIT,PantryCatalogServiceIT,PantryCatalogLoaderIT,PantryItemRepositoryIT,service/PantryNameIndexTest}.java`, `backend/src/test/java/io/mrkuhne/mezo/support/populator/PantryCatalogPopulator.java`, `frontend/src/data/fuel/pantryHooks.test.tsx`
- **Docs:** [`fuel.md`](fuel.md) (pre-split pantry history), [`recipe.md`](recipe.md), [`_platform-auth-security.md`](_platform-auth-security.md) §4, [`liquibase_conventions.md`](../references/liquibase_conventions.md), [ADR 0035](../decisions/0035-multi-user-account-model.md)
