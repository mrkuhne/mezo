# Fuel P6 — implementation plan (mezo-bka)

Design: [`../specs/2026-07-05-fuel-p6-pantry-import-design.md`](../specs/2026-07-05-fuel-p6-pantry-import-design.md).
Branch `feat/fuel-p6-pantry-import`; one `--no-ff` merge; gates = BE `./mvnw clean test`,
FE `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`; feature-doc + lint-docs before merge.

1. **Contract** — extend `api/feature/pantry/pantry.yml`: `PantryImport` tag,
   `GET /api/pantry/lookup`, `POST /api/pantry/import`, `PantryLookupResponse/Result`,
   `PantryImportRequest`, `PantryImportEntryResponse`, `PantrySuggestionResponse`,
   `PantryResponse.imports/suggestions` (required), `openfoodfacts` in every source enum.
   Merge (`api/generate npm run generate:api`) + FE regen (`pnpm generate:api`).
2. **Migration** `202607051415_mezo-bka_pantry_import.sql` + master entry: `pantry_import`
   table (explicit `pk_/fk_/ck_/idx_` names) + widen `ck_pantry_item_source`.
3. **Backend skeleton** — `PantryImportEntity` (mirrors constraints), `PantryImportRepository`,
   `PantryImportProperties` + `PantrySuggestionProperties` + `PANTRY_IMPORT_SWITCH` +
   `application.yml` zone, `messages.properties` `PANTRY_IMPORT_LOOKUP_FAILED`.
4. **Tests first (red):** WireMock test dep + `support/` wiring (`@DynamicPropertySource`
   base-url override in the IT); `PantryImportApiIT`, `PantrySuggestionServiceIT`,
   `PantryImportPopulator`, `ResetDatabase` + `DatabasePopulator` growth, `PantryApiIT`
   imports/suggestions assertions, w3o fallback unit test.
5. **Backend impl (green):** `OffClient` (RestClient, UA, timeout, barcode vs text),
   `PantryImportService` (lookup mapping; import tx → item + feed row),
   `PantrySuggestionService` (cheaper-alt + low-NOVA, cap), `PantryImportController`
   (`@ConditionalOnProperty`), `PantryService.getPantry` composes imports+suggestions,
   `PantryMapper` new mappings + defensive `toSourceEnum` (mezo-w3o). `./mvnw clean test` green.
6. **FE data layer:** `pantrySources` + type union `openfoodfacts`; `pantryApi.lookup/importItem`
   + list mapping (`when` humanized); `usePantry` real imports/suggestions off the same
   `['pantry']` query; `usePantryActions.importItem` (mock cache-append / real POST+invalidate);
   MSW handlers; hook tests both modes.
7. **FE surface:** `ImportItemSheet` rework (real 3-phase, mock demo path), `FuelKamraPage`
   Import chip + suggestions + imports-feed sections (hidden when empty), `SuggestionCard`
   CTA behind optional `onAdd`. Page/sheet tests both modes; `pnpm build`.
8. **Docs & close:** `docs/features/fuel.md` (§2 Kamra, §4 contract, §5, §9, §10),
   `docs/milestones/roadmap.md` P6 row, `node scripts/lint-docs.mjs`; merge `--no-ff`,
   `bd dolt push && git push`, close `mezo-bka` + `mezo-w3o` with notes.
