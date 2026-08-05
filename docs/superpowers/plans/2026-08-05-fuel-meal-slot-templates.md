# Fuel Meal-Slot Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User-defined meal-slot templates per day type (rest / training_am / training_pm) with mixed fixed/relative anchors, percent budgets and role presets, overlaid on the existing `buildDayPlan` engine, edited on a new `/fuel/slots` page with deterministic guardrails (PR 1) and an LLM "Mezo értékelése" verdict (PR 2).

**Spec:** `docs/superpowers/specs/2026-08-05-fuel-meal-slot-templates-design.md` (issue `mezo-7102`). Read it first.

**Architecture:** Template overlay — `placeWindows` untouched; `buildDayPlan` step 1 branches to a new pure `compileTemplate` when a template exists for the resolved day type; without a template behavior is byte-identical. Backend: one `meal_slot_template` row per user per day type with a typed-jsonb `slots` list, whole-document upsert. AI evaluation is a stateless gated endpoint behind a consumer-owned `SlotPlanLlm` port (ADR 0012).

**Tech Stack:** React 19 + Vite + TanStack Query (dual-mode hooks), Spring Boot 4 + JPA + Liquibase + MapStruct-free hand mapping, OpenAPI contract-first, Vitest + msw, `ApiIntegrationTest` + Testcontainers/compose PG.

## Global Constraints

- Conventions are MANDATORY reads before coding: `docs/references/frontend_conventions.md` (any FE file), `docs/references/api_contract_conventions.md`, `liquibase_conventions.md`, `spring_patterns.md`, `error_handling.md`, `testing_standards.md`, `integration_test_framework.md`, `configuration_conventions.md` (matching backend files).
- Base package `io.mrkuhne.mezo`; UUID PKs; `created_by` set server-side from `CurrentUserId`; soft delete `@SQLDelete`/`@SQLRestriction`; jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto a record.
- Contract-first: edit `api/feature/fuel/fuel.yml` BEFORE code; `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`; both outputs committed. Request-body string unions use `pattern:` (never `enum` — enum deser fails as 500); response enums are fine. Path params are plain `type: string`, validated server-side.
- FE: hooks only from `@/data/hooks` barrel; dual-mode reads via `useDualQuery` (real mode NEVER falls back to the mock seed); `isMockMode()` only inside hook bodies; deep absolute `@/` imports, no new barrels, colocated tests; never a `*Screen`/`*View`.
- FE gate per task that touches frontend: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (pnpm test is REAL mode by default).
- Backend: run ONLY focused tests locally (`./mvnw clean test -Dtest='<Pattern>*'`) — the full suite OOMs this machine; CI is the full-suite gate. ALWAYS `clean` (Lombok incremental compile is flaky). Compose PG must be up (`cd backend && docker compose up -d`).
- No `@Value`/`Environment` reads in business code; flags via `FeaturesConfiguration` constants + `@ConditionalOnProperty`; tunables via `@Validated` `*Properties` records.
- No `@MockBean` in ITs — LLM stubbing via the `companion-fake` profile (`FakeCompanionLlm`); flag-OFF states via `@TestPropertySource` (forks an unseeded context — fine for off-tests).
- Commits: conventional subjects carrying the bd id, e.g. `feat(fuel): compileTemplate anchor resolution (mezo-7102)`. Use explicit `git add <paths>` + `git commit --no-verify` (the bd hook force-adds a stray root `issues.jsonl` otherwise). Never `git add -A`.
- Hungarian UI copy; English code/comments/commits.

## File Map

**PR 1** — templates + engine + editor:
- Modify: `api/feature/fuel/fuel.yml` (+3 paths, +4 schemas) → regen `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608051000_mezo-7102_create_meal_slot_template.sql`; modify `1.0.0_master.yml`
- Create: `backend/.../feature/fuel/entity/MealSlotTemplateEntity.java`, `entity/MealSlotJson.java`, `repository/MealSlotTemplateRepository.java`, `service/SlotTemplateService.java`
- Modify: `backend/.../feature/fuel/controller/FuelController.java`, `backend/src/main/resources/messages.properties`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealSlotTemplatePopulator.java`; modify `support/ResetDatabase.java`, `support/AbstractIntegrationTest.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/SlotTemplateApiIT.java`
- Modify: `frontend/src/data/types.ts` (new types after `FuelSettings`)
- Create: `frontend/src/data/fuel/slotTemplateApi.ts`, `slotTemplateHooks.ts` (+ `slotTemplateHooks.test.tsx`)
- Modify: `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`
- Create: `frontend/src/features/fuel/logic/resolveDayType.ts`, `compileTemplate.ts`, `validateSlotPlan.ts` (+ colocated tests)
- Modify: `frontend/src/data/fuel/fuelConfig.ts` (role multipliers + guardrail constants), `frontend/src/features/fuel/logic/buildDayPlan.ts` (`splitBudgetPct`, template branch), `frontend/src/data/fuel/timelineHooks.ts`
- Create: `frontend/src/features/fuel/pages/FuelSlotsPage.tsx` (+ test)
- Modify: `frontend/src/app/router.tsx`, `frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx` (+ test), `docs/features/fuel.md`

**PR 2** — LLM evaluate:
- Modify: `api/feature/fuel/fuel.yml` (evaluate path, new tag `FuelSlotPlan`) → regen both
- Modify: `backend/.../techcore/configuration/FeaturesConfiguration.java`, `backend/src/main/resources/application.yml`, `messages.properties`
- Create: `backend/.../feature/fuel/service/SlotPlanLlm.java`, `service/SlotPlanEvaluationService.java`, `controller/SlotPlanEvaluateController.java`
- Create: `backend/.../feature/companion/llm/SlotPlanLlmAdapter.java`; modify `companion/llm/FakeCompanionLlm.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/SlotPlanEvaluateApiIT.java`, `SlotPlanEvaluateSwitchOffApiIT.java`, `SlotPlanEvaluateLlmUnavailableApiIT.java`
- Modify: `frontend/src/data/fuel/slotTemplateApi.ts`, `slotTemplateHooks.ts`, `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`, `frontend/src/features/fuel/pages/FuelSlotsPage.tsx` (+ tests), `docs/features/fuel.md`

---

## PR 1 — templates + engine + editor

### Task 1: API contract — slot-template CRUD

**Files:**
- Modify: `api/feature/fuel/fuel.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces wire schemas `SlotTemplateSlot`, `SlotTemplateRequest`, `SlotTemplateResponse`, `SlotTemplateListResponse` and paths `GET /api/fuel/slot-templates`, `PUT|DELETE /api/fuel/slot-templates/{dayType}` on tag `Fuel` (→ generated `FuelApi` methods `listSlotTemplates`, `putSlotTemplate`, `deleteSlotTemplate`).
- The anchor is FLATTENED on the wire (`anchorType` + optional `time` + optional `offsetMin`) — OpenAPI `oneOf` generates poorly; the FE re-shapes it into a discriminated union (Task 5).

- [ ] **Step 1: Add paths + schemas to `api/feature/fuel/fuel.yml`** (flow style, matching the existing protocol paths at lines 34-59; every non-2xx `$ref`s `SystemMessageList`):

```yaml
  /api/fuel/slot-templates:
    get:
      tags: [Fuel]
      operationId: listSlotTemplates
      summary: All meal-slot templates of the owner (0-3 rows, one per day type)
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/SlotTemplateListResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/fuel/slot-templates/{dayType}:
    put:
      tags: [Fuel]
      operationId: putSlotTemplate
      summary: Whole-document upsert of one day type's template
      parameters:
        - { name: dayType, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/SlotTemplateRequest' } } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/SlotTemplateResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    delete:
      tags: [Fuel]
      operationId: deleteSlotTemplate
      summary: Delete one day type's template (revert to the automatic recommendation)
      parameters:
        - { name: dayType, in: path, required: true, schema: { type: string } }
      responses:
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

Schemas (under `components.schemas:`):

```yaml
    SlotTemplateSlot:
      type: object
      required: [label, slotKind, role, anchorType, budgetPct]
      properties:
        label: { type: string, maxLength: 40 }
        slotKind: { type: string, pattern: '^(breakfast|lunch|dinner|snack)$' }
        role: { type: string, pattern: '^(standard|pre_workout|post_workout)$' }
        anchorType: { type: string, pattern: '^(fixed|wake|training_start|training_end|bed)$' }
        time: { type: string, pattern: '^([01]\d|2[0-3]):[0-5]\d$', description: 'Required when anchorType=fixed' }
        offsetMin: { type: integer, minimum: -720, maximum: 720, description: 'Required for relative anchors, signed' }
        budgetPct: { type: integer, minimum: 1, maximum: 100 }
    SlotTemplateRequest:
      type: object
      required: [slots]
      properties:
        slots: { type: array, items: { $ref: '#/components/schemas/SlotTemplateSlot' }, minItems: 2, maxItems: 8 }
    SlotTemplateResponse:
      type: object
      required: [dayType, slots]
      properties:
        dayType: { type: string, enum: [rest, training_am, training_pm] }
        slots: { type: array, items: { $ref: '#/components/schemas/SlotTemplateSlot' } }
    SlotTemplateListResponse:
      type: object
      required: [templates]
      properties:
        templates: { type: array, items: { $ref: '#/components/schemas/SlotTemplateResponse' } }
```

- [ ] **Step 2: Regenerate both artifacts**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` diffs contain the four new schemas.

- [ ] **Step 3: Commit**

```bash
git add api/feature/fuel/fuel.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit --no-verify -m "feat(api): fuel slot-template CRUD contract (mezo-7102)"
```

### Task 2: Backend — migration, entity, repository, service, controller, ITs

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608051000_mezo-7102_create_meal_slot_template.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/entity/MealSlotJson.java`, `entity/MealSlotTemplateEntity.java`, `repository/MealSlotTemplateRepository.java`, `service/SlotTemplateService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/controller/FuelController.java`, `backend/src/main/resources/messages.properties`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealSlotTemplatePopulator.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/SlotTemplateApiIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list), `support/AbstractIntegrationTest.java` (`@Import` list)

**Interfaces:**
- Consumes: generated `FuelApi` methods + `api.dto` models from Task 1; `CurrentUserId.get()`; `OwnedEntity`.
- Produces: `SlotTemplateService.list(UUID userId)`, `put(UUID userId, String dayType, SlotTemplateRequest req)`, `delete(UUID userId, String dayType)`; error codes `FUEL_SLOT_TEMPLATE_BUDGET_SUM`, `FUEL_SLOT_TEMPLATE_ANCHOR_INVALID`; populator `mealSlotTemplate(UUID owner, String dayType)`.

- [ ] **Step 1: Migration SQL** (`202608051000_mezo-7102_create_meal_slot_template.sql`) — mirror `202607231933_mezo-53su_create_fuel_settings.sql`:

```sql
-- Meal-slot templates (bd mezo-7102, spec docs/superpowers/specs/2026-08-05-fuel-meal-slot-templates-design.md).
-- One row per owner per day type; `slots` is a typed jsonb list (label/slotKind/role/anchor/budgetPct)
-- always read/written whole. No template row => the automatic placeWindows recommendation stays live.

create table meal_slot_template (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz,
    day_type   varchar(11) not null,
    slots      jsonb       not null,
    constraint pk_meal_slot_template_id primary key (id),
    constraint fk_meal_slot_template_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_meal_slot_template_day_type check (day_type in ('rest', 'training_am', 'training_pm'))
);
create unique index uq_meal_slot_template_user_day_type on meal_slot_template (created_by, day_type) where is_deleted = false;
```

Append to `1.0.0_master.yml` (same shape as the tail entry):

```yaml
  - changeSet:
      id: "1.0.0:202608051000_mezo-7102_create_meal_slot_template"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608051000_mezo-7102_create_meal_slot_template.sql
```

Run: `node scripts/lint-liquibase.mjs` → Expected: PASS.

- [ ] **Step 2: Entity + jsonb record + repository.**

`entity/MealSlotJson.java`:

```java
package io.mrkuhne.mezo.feature.fuel.entity;

/** One template slot, stored inside the {@code slots} jsonb array. Anchor is flattened:
 *  {@code anchorType=fixed} uses {@code time}, relative anchors use signed {@code offsetMin}. */
public record MealSlotJson(String label, String slotKind, String role,
                           String anchorType, String time, Integer offsetMin, Integer budgetPct) {}
```

`entity/MealSlotTemplateEntity.java` (mirror `FuelSettingsEntity` + `PantryItemEntity.micros`):

```java
@Getter
@Setter
@Entity
@Table(name = "meal_slot_template")
@SQLDelete(sql = "update meal_slot_template set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MealSlotTemplateEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "day_type", nullable = false, length = 11)
    private String dayType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<MealSlotJson> slots;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
```

`repository/MealSlotTemplateRepository.java` (extend `JpaRepository` directly — no `date` field, the `FuelSettingsRepository` note applies):

```java
public interface MealSlotTemplateRepository extends JpaRepository<MealSlotTemplateEntity, UUID> {
    List<MealSlotTemplateEntity> findAllByCreatedByAndDeletedFalse(UUID createdBy);
    Optional<MealSlotTemplateEntity> findByCreatedByAndDayTypeAndDeletedFalse(UUID createdBy, String dayType);
}
```

- [ ] **Step 3: Service with server-side validation.** `service/SlotTemplateService.java` — read has no `@Transactional`, writes do (the `FuelSettingsService` split). Validation mirrors the FE deterministic ERRORS (spec §4): day type ∈ the 3 keys (`SystemMessage.field("VALIDATION_INVALID_VALUE", "dayType")`, 400); 2–8 slots (bean validation covers via contract, keep a guard); Σ budgetPct within 100±1 → else `SystemMessage.error("FUEL_SLOT_TEMPLATE_BUDGET_SUM")`, 400; per-slot anchor coherence (`fixed` requires `time`, relative requires `offsetMin` → `SystemMessage.field("VALIDATION_INVALID_VALUE", "slots")`); training anchors (`training_start`/`training_end`) forbidden when `dayType == "rest"` → `SystemMessage.error("FUEL_SLOT_TEMPLATE_ANCHOR_INVALID")`, 400. Collect-then-throw is fine (`error_handling.md:109-121`). Skeleton:

```java
@Service
@RequiredArgsConstructor
public class SlotTemplateService {

    private static final Set<String> DAY_TYPES = Set.of("rest", "training_am", "training_pm");

    private final MealSlotTemplateRepository repository;

    public SlotTemplateListResponse list(UUID userId) {
        return SlotTemplateListResponse.builder()
            .templates(repository.findAllByCreatedByAndDeletedFalse(userId).stream().map(this::toResponse).toList())
            .build();
    }

    @Transactional
    public SlotTemplateResponse put(UUID userId, String dayType, SlotTemplateRequest req) {
        requireDayType(dayType);
        validateSlots(dayType, req.getSlots());
        MealSlotTemplateEntity row = repository.findByCreatedByAndDayTypeAndDeletedFalse(userId, dayType)
            .orElseGet(() -> {
                MealSlotTemplateEntity e = new MealSlotTemplateEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                e.setDayType(dayType);
                return e;
            });
        row.setSlots(req.getSlots().stream().map(this::toJson).toList());
        repository.save(row);
        return toResponse(row);
    }

    @Transactional
    public void delete(UUID userId, String dayType) {
        requireDayType(dayType);
        MealSlotTemplateEntity row = repository.findByCreatedByAndDayTypeAndDeletedFalse(userId, dayType)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        repository.delete(row); // soft via @SQLDelete
    }
}
```

`toJson`/`toResponse` map `api.dto.SlotTemplateSlot` ↔ `MealSlotJson` field-by-field (hand mapping — `feature/fuel` has no MapStruct mapper; keep it that way). `messages.properties` additions:

```properties
FUEL_SLOT_TEMPLATE_BUDGET_SUM=A slot-budgetek összege 100% kell legyen (±1).
FUEL_SLOT_TEMPLATE_ANCHOR_INVALID=Pihenőnapi sablonban nem lehet edzés-horgonyú slot.
```

- [ ] **Step 4: Controller.** Add the three `@Override` methods to `FuelController` (it implements the regenerated `FuelApi`; inject `SlotTemplateService`, pass `currentUserId.get()` first — exact shape of the existing protocol methods).

- [ ] **Step 5: Test infra.** `MealSlotTemplatePopulator` (mirror `FuelSettingsPopulator`: `@TestComponent`, `saveAndFlush`, layered overloads — default = a valid 3-slot rest template summing 100). Add `meal_slot_template` to the `ResetDatabase` TRUNCATE string; add `MealSlotTemplatePopulator.class` to `AbstractIntegrationTest`'s `@Import` list.

- [ ] **Step 6: Write `SlotTemplateApiIT` (failing first), run, implement fixes, re-run.** Extends `ApiIntegrationTest`; tests (naming `test{Method}_should{Result}_when{Condition}`, AssertJ only):
  - `testListSlotTemplates_shouldReturnEmpty_whenNoneSaved` — GET → 200, `templates` empty.
  - `testPutSlotTemplate_shouldCreateThenUpdate_whenCalledTwice` — PUT training_am with 3 slots (e.g. `pre_workout snack training_start -45 8%` + `post_workout breakfast training_end +30 32%` + `dinner fixed 19:00 60%`) → 200; second PUT with changed pct → 200 and GET shows ONE row with the new values.
  - `testPutSlotTemplate_shouldReject_whenBudgetSumOff` — pcts summing 90 → 400 + `assertHasRequestError(body, "FUEL_SLOT_TEMPLATE_BUDGET_SUM")`.
  - `testPutSlotTemplate_shouldReject_whenTrainingAnchorOnRestDay` — rest + `training_start` anchor → 400 + `FUEL_SLOT_TEMPLATE_ANCHOR_INVALID`.
  - `testPutSlotTemplate_shouldReject_whenDayTypeUnknown` — PUT `/slot-templates/weekend` → 400 + field error `dayType`.
  - `testDeleteSlotTemplate_shouldSoftDelete_whenExists` — populator row → DELETE → 204 → GET empty; DELETE again → 404.
  - Ownership: `testListSlotTemplates_shouldNotLeakOtherUsers_whenForeignRowExists` — populate a row for `databasePopulator.populateUser("other@x.hu")`, owner GET → empty.

Run: `cd backend && ./mvnw clean test -Dtest='SlotTemplateApiIT'` → Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main api/… backend/src/test
git commit --no-verify -m "feat(fuel): meal_slot_template table + CRUD endpoints (mezo-7102)"
```

### Task 3: FE domain types + dual-mode data layer

**Files:**
- Modify: `frontend/src/data/types.ts` (insert right after `FuelSettings`, ~line 48)
- Create: `frontend/src/data/fuel/slotTemplateApi.ts`, `frontend/src/data/fuel/slotTemplateHooks.ts`, `frontend/src/data/fuel/slotTemplateHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts` (after line 37), `frontend/src/test/msw/handlers.ts` (next to the fuel-settings handlers ~line 869)

**Interfaces:**
- Produces domain types (exact — every later task uses these):

```ts
export type SlotTemplateDayType = 'rest' | 'training_am' | 'training_pm'
export type SlotAnchor =
  | { type: 'fixed'; time: string }
  | { type: 'wake' | 'training_start' | 'training_end' | 'bed'; offsetMin: number }
export interface SlotTemplateRow {
  label: string
  slotKind: MealSlot        // 'breakfast' | 'lunch' | 'dinner' | 'snack' (types.ts:68)
  role: RecipeRole          // 'standard' | 'pre_workout' | 'post_workout' (types.ts:281)
  anchor: SlotAnchor
  budgetPct: number
}
export interface SlotTemplate {
  dayType: SlotTemplateDayType
  slots: SlotTemplateRow[]
}
```

- Produces hooks: `useSlotTemplates(): { templates: SlotTemplate[]; isPending: boolean }` and `useSlotTemplateActions(): { putTemplate(t: SlotTemplate): Promise<void>; deleteTemplate(dayType: SlotTemplateDayType): Promise<void>; pending: boolean }`.

- [ ] **Step 1: Failing hook test** (`slotTemplateHooks.test.tsx`, mirror `fuelSettingsHooks.test.tsx`): mock mode — `useSlotTemplates()` returns `[]`; `putTemplate` then re-render shows the template; `deleteTemplate` empties it. Real mode (`vi.stubEnv('VITE_USE_MOCK','false')`) — msw `server.use(http.put(...))` captures the wire body and asserts the FLATTENED anchor (`{ anchorType: 'training_start', offsetMin: -45 }`), the PUT invalidates `['fuelSlotTemplates']`.

Run: `cd frontend && pnpm test slotTemplateHooks` → Expected: FAIL (module not found).

- [ ] **Step 2: Implement.** `slotTemplateApi.ts` — wire↔domain mapping module-scope (`fromWire`/`toWireSlot`), `satisfies` on request bodies:

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { SlotAnchor, SlotTemplate, SlotTemplateDayType, SlotTemplateRow } from '@/data/types'

type SlotWire = components['schemas']['SlotTemplateSlot']
type ListWire = components['schemas']['SlotTemplateListResponse']
type PutWire = components['schemas']['SlotTemplateRequest']

const fromAnchor = (w: SlotWire): SlotAnchor =>
  w.anchorType === 'fixed'
    ? { type: 'fixed', time: w.time ?? '12:00' }
    : { type: w.anchorType as Exclude<SlotAnchor['type'], 'fixed'>, offsetMin: w.offsetMin ?? 0 }

const toWireSlot = (r: SlotTemplateRow): SlotWire => ({
  label: r.label, slotKind: r.slotKind, role: r.role, budgetPct: r.budgetPct,
  anchorType: r.anchor.type,
  time: r.anchor.type === 'fixed' ? r.anchor.time : undefined,
  offsetMin: r.anchor.type === 'fixed' ? undefined : r.anchor.offsetMin,
})

export const slotTemplateApi = {
  list: (): Promise<SlotTemplate[]> =>
    apiFetch<ListWire>('/api/fuel/slot-templates').then(r => r.templates.map(t => ({
      dayType: t.dayType as SlotTemplateDayType,
      slots: t.slots.map(s => ({ label: s.label, slotKind: s.slotKind as SlotTemplateRow['slotKind'], role: s.role as SlotTemplateRow['role'], anchor: fromAnchor(s), budgetPct: s.budgetPct })),
    }))),
  put: (t: SlotTemplate): Promise<void> =>
    apiFetch(`/api/fuel/slot-templates/${t.dayType}`, {
      method: 'PUT',
      body: JSON.stringify({ slots: t.slots.map(toWireSlot) } satisfies PutWire),
    }).then(() => undefined),
  remove: (dayType: SlotTemplateDayType): Promise<void> =>
    apiFetch(`/api/fuel/slot-templates/${dayType}`, { method: 'DELETE' }).then(() => undefined),
}
```

`slotTemplateHooks.ts` — `useDualQuery` read (`mockData: []`, `realEmpty: []`), module-local key `const SLOT_TEMPLATES_KEY = ['fuelSlotTemplates'] as const`, actions with mock cache mutators (the `pantryHooks` (b) form — upsert by `dayType`, delete filters), `onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: SLOT_TEMPLATES_KEY })`. Export `SLOT_TEMPLATES_KEY` for timelineHooks-adjacent invalidation if needed.

msw defaults in `handlers.ts`:

```ts
http.get(`${API_BASE}/api/fuel/slot-templates`, () => HttpResponse.json({ templates: [] })),
http.put(`${API_BASE}/api/fuel/slot-templates/:dayType`, async ({ params, request }) =>
  HttpResponse.json({ dayType: params.dayType, ...(await request.json() as object) })),
http.delete(`${API_BASE}/api/fuel/slot-templates/:dayType`, () => new HttpResponse(null, { status: 204 })),
```

Barrel (`data/hooks.ts` after line 37): `export { useSlotTemplates, useSlotTemplateActions } from '@/data/fuel/slotTemplateHooks'`.

- [ ] **Step 3: Run both modes** — `pnpm test slotTemplateHooks && VITE_USE_MOCK=true pnpm test slotTemplateHooks` → PASS.

- [ ] **Step 4: Commit** — `git add frontend/src/data frontend/src/test && git commit --no-verify -m "feat(fuel): dual-mode slot-template hooks (mezo-7102)"`

### Task 4: Engine logic — `resolveDayType` + `compileTemplate`

**Files:**
- Create: `frontend/src/features/fuel/logic/resolveDayType.ts` (+ `.test.ts`), `frontend/src/features/fuel/logic/compileTemplate.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `PlannerBlock` (`buildDayPlan.ts:43-48`), `SlotTemplate`/`SlotTemplateRow` (Task 3), `toMin`/`toHHmm`/`EATING_START_OFFSET_MIN`/`KITCHEN_CLOSE_OFFSET_MIN`/`MIN_SLOT_GAP_MIN`/`DEFAULT_BLOCK_MIN`/`DEFAULT_RUN_MIN` (`fuelConfig.ts`).
- Produces:
  - `resolveDayType(blocks: PlannerBlock[]): SlotTemplateDayType` — no blocks → `'rest'`; earliest `toMin(block.time)` < 720 → `'training_am'`; else `'training_pm'`.
  - `compileTemplate(template: SlotTemplate, ctx: { wake: string; bed: string; blocks: PlannerBlock[] }): PlannedWindow[]` — `PlannedWindow` gains optional `budgetPct?: number` and `role?: RecipeRole` (Task 5 extends the interface; write against it here).

- [ ] **Step 1: Failing tests.** `resolveDayType.test.ts`: `[]` → rest; gym 07:00 → training_am; sport 18:00 → training_pm; gym 18:00 + run 09:00 → training_am (earliest wins); boundary 12:00 → training_pm. `compileTemplate.test.ts` (wake 05:30, bed 22:00, gym block 07:00/60min unless noted):
  - fixed anchor `12:00` resolves to 720 min; `wake +45` → 375; `bed −120` → 1200; `training_start −45` → 375; `training_end +30` → 510.
  - `training_end` with `durationMin: null` uses `DEFAULT_BLOCK_MIN` (gym/sport) / `DEFAULT_RUN_MIN` (run).
  - two blocks → `training_start` uses the EARLIEST start, `training_end` the LATEST end (blocks arrive unsorted — sort internally; `deriveBlocks` does not sort).
  - clamping: a `wake +0` slot clamps to eatingStart (wake+45); a `bed −30` slot clamps to kitchenClose (bed−90).
  - gap-push: two slots resolving 30min apart → second pushed to +90 (`MIN_SLOT_GAP_MIN`), capped at kitchenClose.
  - training-anchored slot on a day with NO blocks (defensive) → dropped from the output.
  - output carries `slotKey = row.slotKind`, `kind = slotKind === 'snack' ? 'snack' : 'meal'`, `label = row.label`, `budgetPct`, `role`; sorted by time.

Run: `pnpm test resolveDayType compileTemplate` → FAIL.

- [ ] **Step 2: Implement.** `compileTemplate` core:

```ts
export function compileTemplate(template: SlotTemplate, ctx: { wake: string; bed: string; blocks: PlannerBlock[] }): PlannedWindow[] {
  const eatingStart = toMin(ctx.wake) + EATING_START_OFFSET_MIN
  const kitchenClose = toMin(ctx.bed) - KITCHEN_CLOSE_OFFSET_MIN
  const clamp = (t: number) => Math.min(kitchenClose, Math.max(eatingStart, t))
  const starts = ctx.blocks.map(b => toMin(b.time))
  const ends = ctx.blocks.map(b => toMin(b.time) + (b.durationMin ?? (b.kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_BLOCK_MIN)))

  const windows: PlannedWindow[] = []
  for (const row of template.slots) {
    let t: number | null = null
    const a = row.anchor
    if (a.type === 'fixed') t = toMin(a.time)
    else if (a.type === 'wake') t = toMin(ctx.wake) + a.offsetMin
    else if (a.type === 'bed') t = toMin(ctx.bed) + a.offsetMin
    else if (a.type === 'training_start') t = starts.length ? Math.min(...starts) + a.offsetMin : null
    else if (a.type === 'training_end') t = ends.length ? Math.max(...ends) + a.offsetMin : null
    if (t == null) continue // training anchor on a blockless day — defensive drop
    windows.push({ slotKey: row.slotKind, kind: row.slotKind === 'snack' ? 'snack' : 'meal', label: row.label, time: clamp(t), weight: row.budgetPct, budgetPct: row.budgetPct, role: row.role })
  }
  windows.sort((a, z) => a.time - z.time)
  for (let i = 1; i < windows.length; i++) {
    if (windows[i].time < windows[i - 1].time + MIN_SLOT_GAP_MIN) {
      windows[i].time = Math.min(kitchenClose, windows[i - 1].time + MIN_SLOT_GAP_MIN)
    }
  }
  return windows
}
```

(Note: relative anchors are SIGNED `offsetMin` — the editor stores `training_start` with `offsetMin: -45` for "edzés−45p". `weight` mirrors `budgetPct` so any weight-based consumer stays sane, but the template path splits by pct — Task 5.)

- [ ] **Step 3: Run tests** → PASS. **Step 4: Commit** — `git commit --no-verify -m "feat(fuel): resolveDayType + compileTemplate (mezo-7102)"`

### Task 5: Engine — `splitBudgetPct` + `buildDayPlan` template branch

**Files:**
- Modify: `frontend/src/data/fuel/fuelConfig.ts` (constants), `frontend/src/features/fuel/logic/buildDayPlan.ts` (+ its `.test.ts`)

**Interfaces:**
- Consumes: `compileTemplate` (Task 4), `SlotTemplate` (Task 3).
- Produces: `PlannedWindow` gains `budgetPct?: number; role?: RecipeRole`; `DayPlanInput` gains `template?: SlotTemplate | null`; `splitBudgetPct(budget: Macro4, windows: PlannedWindow[]): Macro4[]` exported from `buildDayPlan.ts`.

- [ ] **Step 1: Constants in `fuelConfig.ts`:**

```ts
// Meal-slot templates (mezo-7102). Role multipliers skew a slot's P/C/F share before per-macro
// normalization (splitBudgetPct) — pre-workout is carb-forward, post-workout protein-forward.
export const ROLE_MACRO_MULTIPLIERS: Record<'standard' | 'pre_workout' | 'post_workout', { p: number; c: number; f: number }> = {
  standard: { p: 1, c: 1, f: 1 },
  pre_workout: { p: 0.5, c: 1.6, f: 0.4 },
  post_workout: { p: 1.7, c: 1.1, f: 0.7 },
}
export const MAX_TEMPLATE_SLOTS = 8
export const PRE_WORKOUT_SLOT_WARN_PCT = 15
export const PRE_WORKOUT_SLOT_WARN_KCAL = 300
export const EVENING_SHARE_WARN = 0.4
```

- [ ] **Step 2: Failing tests** (extend `buildDayPlan.test.ts`):
  - `splitBudgetPct`: Σ kcal/p/c/f across slots === daily budget EXACTLY per macro (rounding drift absorbed by the largest-pct slot); a `pre_workout` slot gets more c and less p/f than the same pct `standard` slot; all-standard 25/25/25/25 equals proportional split.
  - `buildDayPlan` with `template` set: windows carry the template labels/times (e.g. "Ebéd 1" fixed 12:00, "Ebéd 2" fixed 15:00 — BOTH `slotKey: 'lunch'`); two logged lunch meals fill the two windows in loggedAt order (existing cursor logic — pin it); `template: null`/absent → output DEEP-EQUALS the pre-change output for the reference day (zero-regression pin: compute once with the old path expectations already in the file — do not weaken existing assertions).

Run: `pnpm test buildDayPlan` → FAIL.

- [ ] **Step 3: Implement.** `splitBudgetPct`:

```ts
export function splitBudgetPct(budget: Macro4, windows: PlannedWindow[]): Macro4[] {
  const totalPct = windows.reduce((s, w) => s + (w.budgetPct ?? 0), 0) || 1
  const share = (w: PlannedWindow) => (w.budgetPct ?? 0) / totalPct
  // kcal: straight pct
  const out = windows.map(w => ({ kcal: Math.round(budget.kcal * share(w)), p: 0, c: 0, f: 0 }) as Macro4)
  // p/c/f: pct share × role multiplier, then normalize the column so Σ === budget[k]
  for (const k of ['p', 'c', 'f'] as const) {
    const raw = windows.map(w => share(w) * (ROLE_MACRO_MULTIPLIERS[w.role ?? 'standard'][k]))
    const rawSum = raw.reduce((s, x) => s + x, 0) || 1
    windows.forEach((_, i) => { out[i][k] = Math.round((budget[k] * raw[i]) / rawSum) })
  }
  // absorb drift per macro into the largest-pct slot (the dinner-absorbs principle)
  const bigIdx = windows.reduce((bi, w, i) => ((w.budgetPct ?? 0) > (windows[bi].budgetPct ?? 0) ? i : bi), 0)
  for (const k of ['kcal', 'p', 'c', 'f'] as const) {
    const sum = out.reduce((s, b) => s + b[k], 0)
    out[bigIdx][k] += budget[k] - sum
  }
  return out
}
```

`buildDayPlan` step 1 becomes:

```ts
  const windows = input.template
    ? compileTemplate(input.template, { wake, bed, blocks })
    : placeWindows(wake, bed, mealsPerDay, blocks, input.weightKg ?? 0)
  const budgets = input.template ? splitBudgetPct(budget, windows) : splitBudget(budget, windows)
```

- [ ] **Step 4: Run** `pnpm test buildDayPlan compileTemplate` → PASS (both modes). **Step 5: Commit** — `git commit --no-verify -m "feat(fuel): template branch + pct budget split in buildDayPlan (mezo-7102)"`

### Task 6: `validateSlotPlan` guardrails

**Files:**
- Create: `frontend/src/features/fuel/logic/validateSlotPlan.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `SlotTemplateRow`, compiled `PlannedWindow[]` (Task 4), guardrail constants (Task 5), `daySpan`/`toMin` (`fuelConfig.ts`).
- Produces:

```ts
export interface SlotPlanIssue { code: string; text: string }
export function validateSlotPlan(
  rows: SlotTemplateRow[],
  compiled: PlannedWindow[],
  ctx: { wake: string; bed: string; dayType: SlotTemplateDayType; budgetKcal: number },
): { errors: SlotPlanIssue[]; warnings: SlotPlanIssue[] }
```

- [ ] **Step 1: Failing tests** — one per rule. ERRORS: `sum_pct` (Σ ≠ 100±1 → „A budgetek összege {n}% — 100% kell legyen"); `too_few` (<2 slot); `too_many` (>8); `out_of_span` (a compiled window at/outside wake→bed); `rest_training_anchor` (training anchor while `dayType === 'rest'`). WARNINGS: `gap` (compiled neighbors < 90 min — report the pair labels); `pre_workout_big` (pre_workout role slot with `budgetPct > 15` OR `budgetPct/100*budgetKcal > 300`); `evening_heavy` (windows in the last third of the wake→bed span summing > 40%); `past_kitchen_close` (compiled time > bed−90 — note compile clamps, so validate from the RAW anchor resolution: recompute unclamped like compileTemplate but without clamp, or accept the clamped-equal case as the signal). Hungarian `text`, stable `code` for tests.

- [ ] **Step 2: Implement + run** → PASS. **Step 3: Commit** — `git commit --no-verify -m "feat(fuel): validateSlotPlan deterministic guardrails (mezo-7102)"`

### Task 7: Thread templates through `useFuelTimeline`

**Files:**
- Modify: `frontend/src/data/fuel/timelineHooks.ts` (+ `timelineHooks.test.tsx`)

**Interfaces:**
- Consumes: `useSlotTemplates` (Task 3), `resolveDayType` (Task 4), `deriveBlocks` (already in the file).
- Produces: `useFuelTimeline` return gains `dayType: SlotTemplateDayType` and `template: SlotTemplate | null`; `buildDayPlan` receives `template`.

- [ ] **Step 1: Failing test** (extend `timelineHooks.test.tsx`, sharedWrapper idiom): seed the cache `qc.setQueryData(['fuelSlotTemplates'], [template])` with a rest-day template (blocks empty in the fixture) → `plan.slots` contains the template's labels at the template times; with NO cached template → the pre-change assertions still hold (zero-regression).
- [ ] **Step 2: Implement.** Call `useSlotTemplates()` UNCONDITIONALLY with the other hooks (file-header rule); after `deriveBlocks`: `const dayType = resolveDayType(blocks); const template = templates.find(t => t.dayType === dayType) ?? null`; pass `template` into `buildDayPlan`; add `dayType, template` to the return object (line 135).
- [ ] **Step 3: Run** `pnpm test timelineHooks && VITE_USE_MOCK=true pnpm test timelineHooks` → PASS. **Step 4: Commit** — `git commit --no-verify -m "feat(fuel): timeline resolves day-type template (mezo-7102)"`

### Task 8: `/fuel/slots` editor page

**Files:**
- Create: `frontend/src/features/fuel/pages/FuelSlotsPage.tsx` (+ `FuelSlotsPage.test.tsx`)
- Modify: `frontend/src/app/router.tsx` (import next to line 29, route after line 98, BEFORE the `*` catch-all)

**Interfaces:**
- Consumes: `useSlotTemplates`/`useSlotTemplateActions`/`useFuelTimeline`/`useSleepGoal` from `@/data/hooks`; `resolveDayType`, `compileTemplate`, `validateSlotPlan`, `placeWindows`, `splitBudget` (recommended preview + fork seed); `ROLE_OPTIONS`/`roleLabel` from `@/features/fuel/logic/recipeRole`; `useStickyTab` from `@/shared/hooks/useStickyTab`; `toHHmm`/`toMin`.
- Produces: the routed page `FuelSlotsPage`; route `{ path: 'fuel/slots', element: <FuelSlotsPage /> }` (full-page sibling — NO `FUEL_TABS` entry, `tabs.ts` untouched).

**Page composition (top→bottom):**
1. Back row (`aria-label="Vissza"`, `navigate(-1)`) + `.pghead-np sage` header — `over` `"Fuel · Beállítások"`, `h1` `"Étkezési ablakok"` (the `RecipeEditorPage.tsx:195-210` shape, 110px bottom padding for the save bar).
2. Day-type switcher — `SegButton`-style `role="tablist"` (`aria-label="Naptípusok"`), sage accent (`--sage-deep` / `--wash-sage`), options `Pihenőnap / Reggeli edzés / Esti edzés`; state via `useStickyTab('fuel.slots.dayType', 'rest')`.
3. **Reference day derivation:** `const { blocks, budget, wake, bed, dayType: todayType } = useFuelTimeline()`. If `todayType === selectedDayType` use today's real `blocks`; else synthesize: `rest → []`, `training_am → [{ kind: 'gym', time: '07:00', durationMin: 60, label: 'Gym' }]`, `training_pm → [{ kind: 'gym', time: '18:00', durationMin: 60, label: 'Gym' }]` (spec §1 reference-day rule). `wake`/`bed` always from the live sleep goal.
4. **Two states per day type:**
   - No template → read-only recommended preview: `placeWindows(wake, bed, mealsPerDay, refBlocks, weightKg)` + `splitBudget(budget, windows)` rendered as `.zcard` rows (`{toHHmm(w.time)} · {w.label} · {kcal} kcal`), plus a `cta-primary` **`Testreszabás`** button that forks: rows built from the recommended windows (`label`, `slotKind: w.slotKey`, `role: 'standard'`, `anchor: { type: 'fixed', time: toHHmm(w.time) }`, `budgetPct` from the slot kcal share normalized to Σ=100 with the largest slot absorbing drift).
   - Template exists (or a fork is being edited) → editable rows in local `useState<SlotTemplateRow[]>`.
5. **Slot row editor** (one `.zcard`-styled block per row): name `<input>` (`aria-label="Slot neve"`); slotKind chips (the `RecipeEditorPage.tsx:232-238` chip idiom, options Reggeli/Ebéd/Vacsora/Snack); role chips from `ROLE_OPTIONS`; anchor editor — a `<select aria-label="Horgony">` with the 5 anchor types (labels: `Fix időpont / Ébredés után / Edzés előtt‑után (kezdet) / Edzés vége után / Lefekvés előtt`), then `type="time"` input (`aria-label="Fix időpont"`, the `FuelSettingsSheet.tsx:58-60` styling + empty-guard) for `fixed`, or a signed-minutes numeric input (`aria-label="Eltolás perc"`, AmountField-style local component with ±15 steppers) for relatives; budget% numeric (`aria-label="Budget %"`); row delete button (`aria-label="{label} törlése"`); `+ Új slot` appends a default row (`{ label: 'Snack', slotKind: 'snack', role: 'standard', anchor: { type: 'fixed', time: '16:00' }, budgetPct: 10 }`).
6. **Σ meter + live preview:** Σ% pill (`.pc`-style, red tint when ≠100); preview list = `compileTemplate({ dayType, slots: rows }, { wake, bed, blocks: refBlocks })` + `splitBudgetPct(budget, compiled)` → `{time} · {label} · {kcal} kcal · P{p}`.
7. **Validation:** `validateSlotPlan(rows, compiled, { wake, bed, dayType, budgetKcal: budget.kcal })` — errors as red `<p role="alert">` (`color: 'var(--coral-deep)'`), warnings as amber `<p>` (`color: 'var(--warning)'`, the `AiLogSheet.tsx:314-318` shape).
8. **Save bar** (portaled `.recipe-save-bar`, the `RecipeEditorPage.tsx:354-365` `createPortal` into `.phone-screen`): `Mégse` → `navigate(-1)`; `Mentés` (`cta-primary`, `disabled={errors.length > 0 || pending}`) → `putTemplate({ dayType, slots: rows }).then(() => navigate(-1))`. Editing an EXISTING template also shows **`Ajánlott visszaállítása`** (`aria-label="Ajánlott visszaállítása"`) → `deleteTemplate(dayType)` and drop back to the recommended state.

- [ ] **Step 1: Failing page tests** (`FuelSlotsPage.test.tsx`; the `RecipeEditorPage.test.tsx` scaffold: `vi.stubEnv`, `newQc`, `MemoryRouter initialEntries={['/fuel', '/fuel/slots']} initialIndex={1}`, `LocationProbe` on `/fuel`):
  - renders the recommended preview + `Testreszabás` when no template cached.
  - fork → rows editable; setting a pct so Σ≠100 → the `sum_pct` error text visible and `Mentés` disabled.
  - valid rows + `Mentés` → cache (`renderHook(() => useSlotTemplates())` against the same qc) contains the template; navigates back.
  - existing template in cache → editable state directly + `Ajánlott visszaállítása` present; clicking it empties the cache.
  - real mode: msw PUT override captures the wire body (flattened anchor).
- [ ] **Step 2: Implement page + route.** Run `pnpm test FuelSlotsPage` → PASS.
- [ ] **Step 3: Full FE gate** — `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → all green.
- [ ] **Step 4: Commit** — `git commit --no-verify -m "feat(fuel): /fuel/slots meal-slot template editor (mezo-7102)"`

### Task 9: `FuelSettingsSheet` entry row

**Files:**
- Modify: `frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx` (+ `FuelSettingsSheet.test.tsx`)

- [ ] **Step 1: Failing test:** render inside `MemoryRouter` + `LocationProbe` route for `/fuel/slots`; click `Étkezési ablakok szerkesztése` → sheet closes AND location becomes `/fuel/slots`. (Existing sheet tests render without a router — wrap the new test's render in `MemoryRouter`; the sheet must now always be rendered under a router, check both existing tests still pass after adding `useNavigate`.)
- [ ] **Step 2: Implement:** `const navigate = useNavigate()`; a new ROW-styled button under the caffeine row: label span `Étkezési ablakok` + `szerkesztése ›` (chevron `aria-hidden="true"`), `aria-label="Étkezési ablakok szerkesztése"`, `onClick={() => { close(); navigate('/fuel/slots') }}` (close FIRST — the `QuickInputSheet.tsx:29` idiom). Update `FuelMaiPage.test.tsx` if its settings-sheet assertions enumerate rows.
- [ ] **Step 3: Run** `pnpm test FuelSettingsSheet FuelMaiPage` both modes → PASS. **Step 4: Commit** — `git commit --no-verify -m "feat(fuel): settings-sheet entry to the slot editor (mezo-7102)"`

### Task 10: PR 1 docs + ship

**Files:**
- Modify: `docs/features/fuel.md` (§1 status line, §2 routes table + a `/fuel/slots` paragraph, §4 endpoints, the engine/§5 planner section: template overlay + `resolveDayType`/`compileTemplate`/`splitBudgetPct`/`validateSlotPlan`), `.beads/issues.jsonl` (bd auto)

- [ ] **Step 1: Update `docs/features/fuel.md`** (overwrite in place, no changelog; `file:line` pointers not code paste). Run `node scripts/lint-docs.mjs` → PASS.
- [ ] **Step 2: Full gates.** FE: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`. BE focused: `./mvnw clean test -Dtest='SlotTemplateApiIT'`. All green.
- [ ] **Step 3: Ship PR 1** (CLAUDE.md flow + memory gotchas):

```bash
git push -u origin feat/meal-slot-templates
gh pr create --title "feat(fuel): user-defined meal-slot templates (mezo-7102)" \
  --body "PR 1 of mezo-7102: day-type templates + engine overlay + /fuel/slots editor. Spec: docs/superpowers/specs/2026-08-05-fuel-meal-slot-templates-design.md. PR 2 (LLM evaluate) follows."
# wait for CI; NEVER trust `gh pr checks --watch` exit code — re-run `gh pr checks <n>` and read the table
```
  - If `test-visual` reds: regen linux goldens via `gh workflow run update-visual-baselines.yml -r feat/meal-slot-templates`, approve the bot run (`gh api --method POST repos/mrkuhne/mezo/actions/runs/<id>/approve`), `git pull` before merge.
  - CONFLICTING PR gets NO CI — merge origin/main INTO the branch (never rebase; `.beads/issues.jsonl` unions via `bd import` both + `bd export`).
  - Merge (worktree-safe — main is checked out in the primary checkout): `git fetch origin && git checkout -b tmp origin/main && git merge --no-ff --no-verify feat/meal-slot-templates && git push origin tmp:main && git checkout feat/meal-slot-templates && git branch -D tmp`. Verify your bd ids survive on origin/main (`git show origin/main:.beads/issues.jsonl | grep mezo-7102`) AND run the memory-row check (`grep '"_type":"memory"' | wc -l`).

---

## PR 2 — LLM evaluate

### Task 11: Contract + backend evaluate slice

**Files:**
- Modify: `api/feature/fuel/fuel.yml` (new tag `FuelSlotPlan`, evaluate path + 3 schemas) → regen `api/openapi.yml` + `api.gen.ts`
- Modify: `backend/.../techcore/configuration/FeaturesConfiguration.java`, `backend/src/main/resources/application.yml`, `messages.properties`
- Create: `backend/.../feature/fuel/service/SlotPlanLlm.java`, `service/SlotPlanEvaluationService.java`, `controller/SlotPlanEvaluateController.java`
- Create: `backend/.../feature/companion/llm/SlotPlanLlmAdapter.java`; modify `companion/llm/FakeCompanionLlm.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/SlotPlanEvaluateApiIT.java`, `SlotPlanEvaluateSwitchOffApiIT.java`, `SlotPlanEvaluateLlmUnavailableApiIT.java`

**Interfaces:**
- Produces: `POST /api/fuel/slot-templates/evaluate` on NEW tag `FuelSlotPlan` (→ own generated `FuelSlotPlanApi`, so the gated controller can be a separate bean — `FuelController` stays unconditional). Wire: `SlotPlanEvaluateRequest { dayType: string(pattern), slots: [SlotTemplateSlot], resolvedTimes: [{label,time}], budget: {kcal,p,c,f: integer}, balanceKcal: integer, blocks: [{kind,time,durationMin?}] }` → `SlotPlanEvaluateResponse { verdict: enum [ok, adjust], summary: string, suggestions: [{slotLabel?: string, text: string}] }`.
- Flag `SLOT_TEMPLATE_AI_SWITCH = "mezo.feature.slot-template-ai.enabled"` (+ `application.yml` `slot-template-ai: enabled: true` with comment); port `SlotPlanLlm { String complete(String systemPrompt, String userMessage); }` (byte-copy of `StackPlacementLlm` shape); adapter = the `StackPlacementLlmAdapter` two-switch array form gated on `{SLOT_TEMPLATE_AI_SWITCH, COMPANION_SWITCH}`; message `FUEL_SLOT_TEMPLATE_LLM_UNAVAILABLE=Az AI-értékelés most nem elérhető.`.

- [ ] **Step 1: Contract + regen + commit** (same motions as Task 1).
- [ ] **Step 2: Backend.** `SlotPlanEvaluationService`: `ObjectProvider<SlotPlanLlm> llm` + `requireAvailable()` throwing 503 `FUEL_SLOT_TEMPLATE_LLM_UNAVAILABLE` (the `ScrapeExtractionService.java:70-77` honest-503 form); `public static final String SYSTEM_PROMPT_MARKER = "SLOT-TERV-ERTEKELES";` — SYSTEM_PROMPT starts with the marker, instructs strict-JSON Hungarian output `{"verdict":"ok|adjust","summary":"…","suggestions":[{"slotLabel":"…","text":"…"}]}` judging the split against the goal balance + training placement; user message = the request serialized compactly (day type, per-slot label/role/pct/resolved time, budget, balance, blocks). Call through `llmCallContextHolder.runWith(new LlmCallContext("slot_template", "evaluate", null, null), () -> port.complete(SYSTEM_PROMPT, userMessage))`; parse with the `raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1)` guard; on parse/LLM exception log-warn and throw the same 503 (stateless endpoint — the FE degrades honestly). `SlotPlanEvaluateController` implements `FuelSlotPlanApi`, `@ConditionalOnProperty(name = FeaturesConfiguration.SLOT_TEMPLATE_AI_SWITCH, havingValue = "true")`, passes `currentUserId.get()` (auth only — nothing persisted).
- [ ] **Step 3: `FakeCompanionLlm` branch:** `SLOT_PLAN_MARKER_MIRROR = "SLOT-TERV-ERTEKELES"` (LITERAL mirror, never an import) + sentinel `\[fake-slot-plan:(\{.*}|[^\]]*)]` + default `{"verdict":"ok","summary":"Teszt értékelés.","suggestions":[]}` — the exact `STACK_PLACEMENT` branch shape at `FakeCompanionLlm.java:176-184,255-260`.
- [ ] **Step 4: ITs (failing first):**
  - `SlotPlanEvaluateApiIT` — `@ActiveProfiles("companion-fake")`, POST a valid request → 200, `verdict` in `{ok,adjust}`, summary non-blank.
  - `SlotPlanEvaluateLlmUnavailableApiIT` — `@TestPropertySource(properties = "mezo.feature.companion.enabled=false")` → 503 + `assertHasRequestError(body, "FUEL_SLOT_TEMPLATE_LLM_UNAVAILABLE")`.
  - `SlotPlanEvaluateSwitchOffApiIT` — `@TestPropertySource(properties = "mezo.feature.slot-template-ai.enabled=false")` → **405** NOT 404 (the fixed `/evaluate` segment falls through to the `PUT|DELETE /{dayType}` mapping — `GlobalExceptionHandler.handleMethodNotAllowed`; assert `METHOD_NOT_ALLOWED`).

Run: `./mvnw clean test -Dtest='SlotPlanEvaluate*'` → green.
- [ ] **Step 5: Commit** — `git commit --no-verify -m "feat(fuel): gated slot-plan LLM evaluate endpoint (mezo-7102)"`

### Task 12: FE evaluate hook + editor card

**Files:**
- Modify: `frontend/src/data/fuel/slotTemplateApi.ts`, `slotTemplateHooks.ts` (+ test), `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`, `frontend/src/features/fuel/pages/FuelSlotsPage.tsx` (+ test)

**Interfaces:**
- Produces: `SlotPlanVerdict { verdict: 'ok' | 'adjust'; summary: string; suggestions: { slotLabel?: string; text: string }[] }` (declare in `slotTemplateApi.ts` — the `coachApi.ts` precedent); `useSlotTemplateEvaluation(): { evaluate(input: { dayType, rows: SlotTemplateRow[], resolvedTimes: {label,time}[], budget: {kcal,p,c,f}, balanceKcal: number, blocks: PlannerBlock[] }): Promise<SlotPlanVerdict>; pending: boolean }` — barrel-exported.

- [ ] **Step 1: Failing hook test:** mock mode → canned verdict after the demo delay (`await new Promise(r => setTimeout(r, 400))`, `{ verdict: 'ok', summary: 'A felosztás illik a célodhoz…', suggestions: [] }`); real mode → msw POST override echoes a verdict, wire body carries flattened slots.
- [ ] **Step 2: Implement** api (`satisfies` request) + `useMutation`-based hook (no cache write — stateless).
- [ ] **Step 3: Editor card:** a **`Mezo értékelése`** button (`aria-label="Mezo értékelése"`, disabled while `errors.length > 0 || evalPending`) next to the save bar's Mégse; on result an **olvasat card** above the save bar: verdict chip (`ok` → sage `„rendben"` / `adjust` → amber `„érdemes igazítani"`), `summary` paragraph, per-suggestion rows (`{slotLabel && <b>{slotLabel}: </b>}{text}`); while pending a `✨ Mezo értékeli a felosztást…` twinkle line (the RecipeDetail „Mezo értékeli…" copy family); on `ApiError` (405/503/anything) an honest note: `„Az AI-értékelés most nem elérhető — a determinisztikus ellenőrzés él."` — NEVER blocks saving.
- [ ] **Step 4: Page tests:** evaluate flow in mock mode (canned verdict renders); error path via msw 503 → the honest note. Full FE gate both modes + build.
- [ ] **Step 5: Commit** — `git commit --no-verify -m "feat(fuel): Mezo evaluates the custom slot split (mezo-7102)"`

### Task 13: PR 2 docs + ship

- [ ] **Step 1:** `docs/features/fuel.md` — evaluate endpoint (§4), the two-tier evaluation paragraph (§2 `/fuel/slots`), the 4th-LLM-endpoint note (§1 status). `node scripts/lint-docs.mjs` → PASS.
- [ ] **Step 2:** Full gates (FE both modes + build; BE `./mvnw clean test -Dtest='SlotPlanEvaluate*,SlotTemplateApiIT'`).
- [ ] **Step 3:** Ship exactly as Task 10 Step 3 (push branch → PR → CI table green → worktree-safe `--no-ff` merge → push main → bd union verify). Close `mezo-7102` (`bd close mezo-7102`) only after the PR-2 merge is on origin/main and docs landed.

---

## Self-review notes (already applied)

- Spec §3 "fuel_slot notifications ride buildDayPlan output — verify during implementation": Task 7's timeline threading is the single composition point; the notification writer consumes the same `plan.slots`, so no extra task — the Task 7 subagent must grep `fuel_slot` writers (`frontend/src/data` + notifications platform doc) and confirm, reporting back if a separate write path exists.
- `PlannedWindow.weight` mirrors `budgetPct` on the template path so `splitBudget` misuse can't produce NaN; `splitBudgetPct` is the only splitter used when `template` is set.
- The `{dayType}` path param is a plain string end-to-end; day-type validation is server-side (400) + FE type-level.
- Recipe suggestions (`pickRecipe`) keep working unchanged on template windows because `slotKey` is one of the 4 legacy kinds.
