# Fuel Slice C · Pantry (Kamra) — backend + CRUD wiring

- **Date:** 2026-06-22
- **Driving bd:** `mezo-9xu` (brainstorm & design parent; implementation issues created by writing-plans)
- **Status:** design approved → ready for implementation plan
- **Phase:** 2 (core data backend) · first Fuel sub-slice
- **Mockups:** `docs/design/kamra-mockup-v3-A.html` (chosen layout — design-system primitives), `kamra-mockup-v1.html` (entity-model comparison), `kamra-mockup-v2-layouts.html` (layout comparison)

---

## 1. Context & goal

The Fuel pillar is the third Phase-2 backend slice (after Biometrics and Train). We start with the **Pantry (Hungarian "Kamra")** sub-feature: the user's food + supplement inventory.

Today the entire Fuel/Pantry surface is **100% mock**: `usePantry()`, `useStack()`, `useRecipes()` etc. return module-level arrays synchronously, and every action button (`Polcra`, `Logolás`, `Frissítés`, `Szerkesztés`, import) is **inert** (just closes its sheet). There is no persistence anywhere.

**Goal of this slice:** make the Kamra *live* — persist the inventory in Postgres and wire real **CRUD** (create / read / update / delete) end-to-end, **without changing the frontend hook signatures or view components**. This is the smallest slice that turns the Kamra from a static catalogue into a usable inventory.

> **PRD note:** "Pantry/Kamra" is **not** named in the PRD — it is a frontend-prototype-derived feature. The PRD's nearest concepts are the supplement **"Stash"** (`SupplementStashItem`: stock/brand/form/protocol/low-stock) and the Nutrition `FoodItem` domain. The **frontend is the hard design contract** (the PRD defers to it), so we model to the existing `usePantry()` shape, informed by the architecture's `FoodItem`/`SupplementStashItem` schemas as the long-term target.

---

## 2. Decisions (locked in brainstorming)

### D1 — Scope: inventory + real CRUD
**In:** persist food ingredients + supplement/stim stash; manual add / edit / update-stock / delete; wire the inert sheet buttons.
**Out (deferred to later Fuel slices):** scrape/import (OpenFoodFacts, URL, barcode, label-photo), recipes, meal logging & per-meal scoring, NOVA auto-classification, micronutrient computation, `imports` activity feed, `suggestions` feed, low-stock push notifications.

### D2 — Entity model: **Model B** (single table, `kind` discriminator)
One `pantry_item` table, `kind ∈ {food, supplement, stim, med}`; kind-specific columns are nullable. Rationale: the UI splits by `kind` anyway, one CRUD path is simpler than two, and it is a step toward the architecture's unified `FoodItem` catalogue. (Mockup `kamra-mockup-v1.html` compared Model A two-flat-tables / Model B unified / Model C catalogue+inventory.)

The mock `stashRefId` dual-representation (e.g. whey appears both as an `Ingredient` *and* a `SupplementStashItem`) **collapses to a single row** in Model B — a row may carry both macros and a supplement protocol. `buildKamraItems`' merge/de-dupe becomes trivial.

### D3 — UI layout: **Direction A** (`kamra-mockup-v3-A.html`)
Type segmented switcher (Mind / Étel / Supp / Stim) as the primary axis · colored `.divider` type sections · lightened cards built from the **real design-system `.meal-card`** primitive (44px stock slot · Antonio name · `src/meta` · macro line · right kcal/dose) · **notched-chamfer corners** (not `border-radius`) per the Deep Current signature · supplement/stim cards get a left inset tint · a thin `.meal-window-push` "needs attention" strip (expiring soon). This is presentation only — independent of D2.

---

## 3. Data model — `pantry_item`

UUID PK, `created_by` ownership, soft-delete, single table (Model B). Inherits `OwnedEntity` (`techcore/persistence/OwnedEntity.java`): `created_by uuid NOT NULL`, `is_deleted boolean`, `@CreationTimestamp created_at`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()`, `pk_pantry_item_id` |
| `created_by` | uuid NOT NULL | FK `app_user(id)` ON DELETE CASCADE, server-set |
| `is_deleted` | boolean NOT NULL default false | soft delete |
| `created_at` | timestamptz NOT NULL | `@CreationTimestamp` |
| `updated_at` | timestamptz | `@UpdateTimestamp` |
| `kind` | text NOT NULL | `ck_pantry_item_kind` ∈ (`food`,`supplement`,`stim`,`med`) |
| `name` | text NOT NULL | |
| `brand` | text | |
| `source` | text | `ck_pantry_item_source` ∈ (`kifli.hu`,`myprotein.hu`,`tesco.hu`,`auchan.hu`,`manual`), default `manual` (server-set on manual add) |
| `category` | text | free text (FE `categoryMeta` maps → label/color) |
| `notes` | text | |
| **Food / nutrition (nullable)** | | |
| `serving_amount` | numeric | the `per` (e.g. 100) |
| `serving_unit` | text | the `unit` (e.g. `g`, `ml`, `db`) |
| `kcal` | numeric | per `serving_amount` |
| `protein_g` | numeric | |
| `carbs_g` | numeric | |
| `fat_g` | numeric | |
| `price_huf` | integer | |
| `price_unit` | text | e.g. `Ft/kg` |
| `package_label` | text | the `pkg` (e.g. `500g tálca`) |
| `micros` | jsonb | `[{name,pct}]`, `@JdbcTypeCode(SqlTypes.JSON)` onto a typed record |
| `nova` | smallint | `ck_pantry_item_nova` between 1 and 4; user-set (no auto-classify) |
| **Stock (shared; expiry food-only)** | | |
| `stock_qty` | numeric | food: grams/ml/db; supplement: doses/db |
| `stock_unit` | text | `g`/`ml`/`db`/`adag` |
| `stock_expires` | date | food only |
| **Supplement / stim (nullable)** | | |
| `dose` | text | e.g. `5g`, `300mg` |
| `form` | text | e.g. `por · 1 mérőkanál` |
| `protocol` | text | |
| `timing` | text | `morning`/`midday`/`evening`/`dinner`/`flexible`/`pre-workout` |
| `taken` | boolean default false | daily "taken" flag (simplification — a future logging slice may move this to an intake log) |
| `caffeine` | boolean | |

**Indexes:** `idx_pantry_item_created_by` (ownership), `idx_pantry_item_created_by_kind` (kind filter).
**Soft delete:** `@SQLDelete(... set is_deleted = true ...)` + `@SQLRestriction("is_deleted = false")`.
**Derived / out-of-scope fields** not stored this slice: `lastUsed`, `usedInRecipes` (need logging/recipes → mapper defaults `'—'`/`0`), `scrapedAt` (scrape deferred), `stashRefId` (collapses — unused), `warning` (FE derives from `kind`/`caffeine`).

### Liquibase
- Script: `db/changelog/1.0.0/script/{YYYYMMDDHHMM}_mezo-<impl-id>_create_pantry_item.sql` (e.g. `202606221200_mezo-<id>_create_pantry_item.sql`) — DDL + CHECK/index, explicit constraint names (`pk_/fk_/ck_/idx_`).
- Register the changeset in `db/changelog/1.0.0/1.0.0_master.yml` (append `id: "1.0.0:<filename-stem>"`, `author: daniel.kuhne`, `sqlFile relativeToChangelogFile: true`).
- No SQL seed — any demo rows go in a `@Profile("demodata")` Java runner (optional, opt-in).

---

## 4. API contract (`api/feature/pantry/pantry.yml`)

Contract-first. Append `- inputFile: ../feature/pantry/pantry.yml` to `api/generate/merge.yml`, then `npm run generate:api`.

**Endpoints** (tag `Pantry`, all owned by the current user):

| Verb | Path | Body | Response |
|---|---|---|---|
| GET | `/api/pantry` | — | `PantryResponse` `{ ingredients: IngredientResponse[], stash: SupplementStashResponse[] }` |
| POST | `/api/pantry` | `PantryItemRequest` | 201 `PantryItemResponse` |
| PUT | `/api/pantry/{id}` | `PantryItemRequest` | 200 `PantryItemResponse` |
| DELETE | `/api/pantry/{id}` | — | 204 (soft delete) |

**Why the GET split into two typed lists:** preserves the existing `usePantry()` return shape (`{ ingredients, stash, ... }`) with zero FE data-layer gymnastics. The single table is a storage detail; the contract projects by `kind` (`food` → `ingredients`; `supplement`/`stim`/`med` → `stash`).

**Schemas** (mirror the FE types in `frontend/src/data/types.ts` so `api.gen.ts` lines up):
- `IngredientResponse`: `id, name, brand, source, category, per, unit, macros{kcal,p,c,f}, price, priceUnit, pkg, micros[{name,pct}], nova, stock{qty,unit,expires}|null, lastUsed, usedInRecipes`
- `SupplementStashResponse`: `id, name, brand, type(supplement|stimulant|medication), category, dose, form, stock|null, stockUnit|null, protocol, timing, taken, caffeine`
  - `type` derives from `kind` (`supplement`↔supplement, `stim`↔stimulant, `med`↔medication).
- `PantryItemRequest`: `kind` (required) + the union of nullable fields; **server validates required-per-kind** (e.g. `food` ⇒ `serving_unit`+`kcal`; `supplement`/`stim` ⇒ `dose`). `created_by`/`source`-default set server-side, never from client.
- `PantryItemResponse`: superset (kind-tagged), returned by POST/PUT.
- Error responses `$ref` the shared `SystemMessageList` (house error contract; `SystemRuntimeErrorException` + `SystemMessage` codes, no hardcoded user text).

---

## 5. Backend implementation (`feature/pantry/`)

Package `io.mrkuhne.mezo.feature.pantry`, mirroring `feature/biometrics/weight/`:

- `entity/PantryItemEntity.java` — `extends OwnedEntity`, `@Entity @Table(name="pantry_item")`, `@SQLDelete`/`@SQLRestriction`, `micros` as `@JdbcTypeCode(SqlTypes.JSON)` typed record (`PantryMicros`/`List<MicroFact>`).
- `repository/PantryItemRepository.java` — `extends OwnedRepository<PantryItemEntity>` (inherits owned reads); add a derived `findAllByCreatedByAndKind...` only if needed (projection can filter in service).
- `service/PantryService.java` — `@Service @RequiredArgsConstructor`; `@Transactional` on writes only; sets `createdBy` from `currentUserId.get()`; validates required-per-kind; maps to the split GET response.
- `controller/PantryController.java` — `@RestController @RequiredArgsConstructor implements PantryApi` (generated interface); delegates to service.
- `mapper/PantryMapper.java` — `@Mapper(componentModel="spring")`, entity ↔ `api.dto` (split projection + request→entity), defaults `lastUsed`/`usedInRecipes`.

Config/validation per house standards (`@Validated`, `SystemMessage` codes in `message.properties`; no `@Value`, no hardcoded tunables).

---

## 6. Frontend wiring

**No view/component signature changes.** New file `frontend/src/lib/pantryApi.ts` (fetch client: `list`/`create`/`update`/`remove`) + new `frontend/src/data/pantryHooks.ts`, re-exported from `data/hooks.ts` (the established split-file pattern, cf. `weightHooks.ts`).

- **`usePantry()`** — moves to `pantryHooks.ts`, keeps its exact return shape. Becomes `useQuery(['pantry'])` with mock-mode `initialData` (synchronous first render for parity/tests), real-mode `queryFn: pantryApi.list`. Returns `{ ingredients, stash }` from the query + static `{ sources: pantrySources, categoryMeta: pantryCategoryMeta }` + **`{ imports: [], suggestions: [] }`** (deferred). Mapper fills `lastUsed`/`usedInRecipes` defaults.
- **`usePantryActions()`** (new) — `useMutation` per the `useWeight` dual-mode pattern: `{ addItem, updateItem, deleteItem }`. Mock mode mutates the cache via `setQueryData(['pantry'])`; real mode `invalidateQueries(['pantry'])`. Optimistic update on the `['pantry']` key.

**Sheets / buttons to wire:**
- New **`AddPantryItemSheet`** (manual entry) on the header `＋` — kind toggle + name/brand/source/category + kind-specific fields → `addItem`. (The existing `ImportItemSheet` scrape wizard stays mock/deferred.)
- **`IngredientDetailSheet`**: `Szerkesztés` → edit mode (reuse `AddPantryItemSheet`) → `updateItem`; `Frissítés` → quick `stock_qty` update; add a **delete** action → `deleteItem`. `Logolás` stays deferred (no logging slice yet).
- `SuggestionCard` `Polcra` and `ImportItemSheet` `Polcra` remain inert/deferred.

**Regen:** `cd frontend && pnpm generate:api` after the contract merges.

---

## 7. Testing (house integration-first)

- `support/populator/PantryPopulator.java` (`@TestComponent`, `saveAndFlush`, sets `createdBy`); register in `AbstractIntegrationTest` `@Import({...})`.
- Add `pantry_item` to `ResetDatabase.resetExceptMasterData()` TRUNCATE list (mandatory growth rule — same change that creates the table).
- `PantryServiceIT` (service-level, `AbstractIntegrationTest`): CRUD happy paths; per-kind validation failures (`SystemMessage` asserts); the split projection (food→ingredients, supplement/stim→stash); soft-delete hides rows.
- `PantryApiIT` (`ApiIntegrationTest`): GET/POST/PUT/DELETE via verb helpers + `ownerAuthHeaders()`; field-error asserts on bad requests.
- **One ownership-isolation test** (user B sees 0 of user A's pantry rows).
- Frontend: `usePantry`/`usePantryActions` tests in **both** modes (mock + real); the Kamra view + sheets keep passing; `pnpm build` green.

---

## 8. Build sequence (high level — detailed steps from writing-plans)

1. `api/feature/pantry/pantry.yml` + merge + generate (contract-first).
2. Liquibase `create_pantry_item` + master registration.
3. Backend: entity → repository → service (+ per-kind validation, split projection) → mapper → controller implementing `PantryApi`.
4. Tests: populator + ResetDatabase + `PantryServiceIT` + `PantryApiIT` + ownership isolation.
5. FE: `pantryApi.ts` + `pantryHooks.ts` (`usePantry` real, `usePantryActions`) + wire `AddPantryItemSheet`/detail-sheet edit/update/delete; regen `api.gen.ts`; both-mode tests + build.
6. Parity screenshot vs the chosen mockup; update `docs/features/fuel.md` (Pantry now backend-backed); close the bd issues.

---

## 9. Risks / open notes

- **`taken`/`lastUsed`/`usedInRecipes`** are logging/recipe-derived; stored/served as simplifications now (`taken` column default false; `lastUsed`/`usedInRecipes` defaulted in mapper). Revisit when the logging + recipes slices land.
- **Per-kind required-field validation** lives in the service (not DB CHECKs) to keep the single table flexible; keep the rules in one place and covered by ITs.
- **`PantryItem.stock` FE union** (`{qty,unit}` vs full `IngredientStock`) — the API firms this to `{qty,unit,expires}` for food; supplement uses `{stock, stockUnit}` flat fields. The defensive `in`-narrowing in `KamraCard`/`IngredientDetailSheet` stays valid.
- **`source` as enum** — if a future import adds vendors, extend the CHECK + the FE `PantrySourceKey` union together.
