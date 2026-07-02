# Fuel P2 — Stack/Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Stack tab real — persist a versioned protocol (selection + version only, per the approved spec), log supplement intakes, and turn "Bekapcsolás · ma" into a real write; the Mai protocol-meta row goes live.

**Architecture:** New first Fuel-owned backend package (`feature/fuel`) + `api/feature/fuel/fuel.yml` contract fragment. Three tables: `protocol` (version metadata), `protocol_item` (normalized selection join → `pantry_item`), `supplement_intake` (append-only ledger, `medication_dose` precedent). Slots stay FE-computed (`buildProtocol` deterministic); the FE `useStack` composes the pantry stash with a day-intake query, `useProtocol` reads the persisted active version.

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase; React 19 + TanStack Query + MSW; OpenAPI contract-first.

**Driving bd:** `mezo-09g` (folds in `mezo-4nu` #1). Spec: `docs/superpowers/specs/2026-07-02-fuel-stack-protocol-water-design.md` §3. ADRs: `0005` (supplement_intake FK → pantry_item).
**Branch:** `feat/fuel-p2-stack-protocol` (from `main`, after P1 merged). Claim first: `bd update mezo-09g --claim`.

## Global Constraints

- Backend base package `io.mrkuhne.mezo`; new package `feature/fuel/{controller,service,repository,entity}`.
- UUID PKs; owned tables: `created_by` FK → `app_user`, `is_deleted`, `created_at`; soft-delete `@SQLDelete`+`@SQLRestriction`; constraint names `pk_/fk_/uq_/ck_/idx_`; plain-UUID FK columns (no JPA associations) — `MedicationDoseEntity` precedent.
- Contract-first: create `api/feature/fuel/fuel.yml`, register it in `api/generate/merge.yml` `inputs:` list, merge (`cd api/generate && npm run generate:api`), FE types (`cd frontend && pnpm generate:api`). Generated: `FuelApi` interface + DTOs in `io.mrkuhne.mezo.api.{controller,dto}`.
- Config: `@Validated` `@ConfigurationProperties` records auto-registered via `@ConfigurationPropertiesScan` — never `@Value`. (Note: the roadmap's "kcal floor 2500 → config" is ALREADY satisfied by `mezo.nutrition.*` / `NutritionTargetsProperties` — nothing to do.)
- Backend gate: `cd backend && ./mvnw clean test` (compose up). FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- FE: hooks from `@/data/hooks` only; view/component signatures must NOT change (additive props/fields OK); no static-seed fallback in real mode (honest-empty); Hungarian UI copy, English code/commits. Commits carry `(mezo-09g)`.

---

### Task 1: API contract — `fuel.yml`

**Files:**
- Create: `api/feature/fuel/fuel.yml`
- Modify: `api/generate/merge.yml` (append input BEFORE the `output:` line)
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces (produces):** operationIds `getProtocol`, `activateProtocol`, `listIntakes`, `logIntake`, `deleteIntake` on tag `Fuel` → generated `FuelApi`. Schemas: `ProtocolResponse`, `ProtocolHistoryEntry`, `ProtocolViewResponse`, `ProtocolActivateRequest`, `IntakeRequest`, `IntakeResponse`, `IntakeListResponse`.

- [ ] **Step 1: Write `api/feature/fuel/fuel.yml`** (mirror `meal.yml`'s flow style; `info: { title: '', version: '' }`):

```yaml
openapi: 3.0.3
info: { title: '', version: '' }
tags:
  - name: Fuel
    description: >
      Fuel-owned protocol + supplement-intake endpoints. The protocol persists ONLY the selected
      pantry-item ids + version metadata (ADR/spec 2026-07-02) — timing slots are recomputed by the
      FE buildProtocol. supplement_intake is an append-only taken-ledger FK-ing pantry_item (ADR 0005).
paths:
  /api/fuel/protocol:
    get:
      tags: [Fuel]
      operationId: getProtocol
      summary: The active protocol + version history (active absent when none exists — honest-empty)
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/ProtocolViewResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    post:
      tags: [Fuel]
      operationId: activateProtocol
      summary: Activate a new protocol version from the current selection (previous active superseded)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/ProtocolActivateRequest' } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/ProtocolViewResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/fuel/intake/{date}:
    get:
      tags: [Fuel]
      operationId: listIntakes
      summary: The day's supplement intakes (feeds taken-state; the P5 timeline reuses this read)
      parameters:
        - { name: date, in: path, required: true, schema: { type: string, format: date } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/IntakeListResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/fuel/intake:
    post:
      tags: [Fuel]
      operationId: logIntake
      summary: Log one supplement/stim intake (dose snapshotted from the pantry item when omitted)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/IntakeRequest' } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/IntakeResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Pantry item not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/fuel/intake/entry/{id}:
    delete:
      tags: [Fuel]
      operationId: deleteIntake
      summary: Soft-delete an intake entry (undo a mis-tap)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
components:
  schemas:
    ProtocolHistoryEntry:
      type: object
      required: [version, builtAt]
      properties:
        version: { type: integer }
        builtAt: { type: string, format: date-time }
        reason: { type: string }
    ProtocolResponse:
      type: object
      required: [id, version, builtAt, status, selectedPantryItemIds]
      properties:
        id: { type: string, format: uuid }
        version: { type: integer }
        builtAt: { type: string, format: date-time }
        status: { type: string, enum: [active, superseded] }
        confidence: { type: number }
        lastReplanReason: { type: string }
        selectedPantryItemIds: { type: array, items: { type: string, format: uuid } }
    ProtocolViewResponse:
      type: object
      required: [history]
      properties:
        active: { $ref: '#/components/schemas/ProtocolResponse' }
        history: { type: array, items: { $ref: '#/components/schemas/ProtocolHistoryEntry' } }
    ProtocolActivateRequest:
      type: object
      required: [selectedPantryItemIds]
      properties:
        selectedPantryItemIds: { type: array, minItems: 1, items: { type: string, format: uuid } }
        reason: { type: string }
    IntakeRequest:
      type: object
      required: [pantryItemId]
      properties:
        pantryItemId: { type: string, format: uuid }
        takenAt: { type: string, format: date-time, description: 'Offset-bearing; defaults to now server-side' }
        slotKey: { type: string }
        dose: { type: string, description: 'Snapshot; defaults to the pantry item''s dose' }
        note: { type: string }
    IntakeResponse:
      type: object
      required: [id, pantryItemId, takenAt, takenDate]
      properties:
        id: { type: string, format: uuid }
        pantryItemId: { type: string, format: uuid }
        takenAt: { type: string, format: date-time }
        takenDate: { type: string, format: date }
        slotKey: { type: string }
        dose: { type: string }
        note: { type: string }
    IntakeListResponse:
      type: object
      required: [intakes]
      properties:
        intakes: { type: array, items: { $ref: '#/components/schemas/IntakeResponse' } }
```

> `DELETE` lives under `/api/fuel/intake/entry/{id}` (not `/api/fuel/intake/{id}`) because `/api/fuel/intake/{date}` already binds `{date}` at that position — two path params with different types at one position would collide.

- [ ] **Step 2:** Append to `api/generate/merge.yml` inputs (before `output:`): `  - inputFile: ../feature/fuel/fuel.yml`

- [ ] **Step 3: Merge + FE regen**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` + `api.gen.ts` gain the Fuel paths/schemas. (Backend still compiles — `FuelApi` is a new interface nothing implements yet.)

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): fuel.yml — protocol + supplement-intake contract (mezo-09g)"
```

---

### Task 2: Liquibase migration — three tables

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607021300_mezo-09g_create_protocol_supplement_intake.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`

- [ ] **Step 1: Migration SQL**

```sql
-- Fuel Stack/Protocol (mezo-09g). protocol persists ONLY selection + version metadata (spec
-- 2026-07-02): timing slots are recomputed by the FE buildProtocol, so no slot snapshot here.
-- protocol_item is the normalized selection (FK -> pantry_item, RESTRICT). supplement_intake is
-- an append-only taken-ledger mirroring medication_dose (ADR 0005: supplements live in pantry_item).
create table protocol (
    id                 uuid        not null default gen_random_uuid(),
    created_by         uuid        not null,
    is_deleted         boolean     not null default false,
    created_at         timestamptz not null default now(),
    version            integer     not null,
    built_at           timestamptz not null,
    status             text        not null,
    confidence         numeric,
    last_replan_reason text,
    constraint pk_protocol_id primary key (id),
    constraint fk_protocol_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_protocol_status check (status in ('active','superseded')),
    constraint uq_protocol_created_by_version unique (created_by, version)
);

create unique index uq_protocol_active_per_user on protocol (created_by) where status = 'active' and is_deleted = false;
create index idx_protocol_created_by on protocol (created_by);

create table protocol_item (
    id             uuid        not null default gen_random_uuid(),
    created_by     uuid        not null,
    is_deleted     boolean     not null default false,
    created_at     timestamptz not null default now(),
    protocol_id    uuid        not null,
    pantry_item_id uuid        not null,
    item_order     integer     not null,
    constraint pk_protocol_item_id primary key (id),
    constraint fk_protocol_item_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_protocol_item_protocol_id_protocol_id foreign key (protocol_id) references protocol (id) on delete cascade,
    constraint fk_protocol_item_pantry_item_id_pantry_item_id foreign key (pantry_item_id) references pantry_item (id) on delete restrict
);

create index idx_protocol_item_protocol_id on protocol_item (protocol_id);
create index idx_protocol_item_pantry_item_id on protocol_item (pantry_item_id);

create table supplement_intake (
    id             uuid        not null default gen_random_uuid(),
    created_by     uuid        not null,
    is_deleted     boolean     not null default false,
    created_at     timestamptz not null default now(),
    pantry_item_id uuid        not null,
    taken_at       timestamptz not null,
    taken_date     date        not null,
    slot_key       text,
    dose           text,
    note           text,
    constraint pk_supplement_intake_id primary key (id),
    constraint fk_supplement_intake_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_supplement_intake_pantry_item_id_pantry_item_id foreign key (pantry_item_id) references pantry_item (id) on delete restrict
);

create index idx_supplement_intake_created_by_taken_date on supplement_intake (created_by, taken_date);
```

- [ ] **Step 2:** Register in `1.0.0_master.yml` (append; id `"1.0.0:202607021300_mezo-09g_create_protocol_supplement_intake"`, `author: daniel.kuhne`, same `sqlFile` shape as the others).

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/changelog/
git commit -m "feat(db): protocol + protocol_item + supplement_intake tables (mezo-09g)"
```

---

### Task 3: Entities + repositories + test plumbing

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/entity/ProtocolEntity.java`, `ProtocolItemEntity.java`, `SupplementIntakeEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/repository/ProtocolRepository.java`, `ProtocolItemRepository.java`, `SupplementIntakeRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/ProtocolPopulator.java`, `SupplementIntakePopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`, `AbstractIntegrationTest.java`

**Interfaces (produces):** entity fields below; repo methods:
`ProtocolRepository.findByCreatedByAndStatusAndDeletedFalse(UUID, String): Optional<ProtocolEntity>`, `findByCreatedByAndDeletedFalseOrderByVersionDesc(UUID): List<ProtocolEntity>`, `@Query max-version`;
`ProtocolItemRepository.findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(UUID): List<ProtocolItemEntity>`;
`SupplementIntakeRepository.findByCreatedByAndTakenDateAndDeletedFalseOrderByTakenAtAsc(UUID, LocalDate): List<SupplementIntakeEntity>`, `findByIdAndCreatedByAndDeletedFalse(UUID, UUID): Optional<...>`;
populators `ProtocolPopulator.createProtocol(UUID owner, int version, String status, List<UUID> pantryItemIds): ProtocolEntity`, `SupplementIntakePopulator.createIntake(UUID owner, UUID pantryItemId, Instant takenAt): SupplementIntakeEntity`.

- [ ] **Step 1: Entities** — all extend `OwnedEntity`, `@Getter @Setter @Entity @SQLDelete(...is_deleted...) @SQLRestriction("is_deleted = false")`, `@Id @GeneratedValue @Column(columnDefinition = "uuid")` id (copy `WaterLogEntity`/`MedicationDoseEntity` shape). Fields:
  - `ProtocolEntity` (`@Table(name = "protocol")`): `Integer version` (`@NotNull`), `Instant builtAt` (`built_at`), `String status`, `BigDecimal confidence`, `String lastReplanReason` (`last_replan_reason`).
  - `ProtocolItemEntity` (`protocol_item`): `UUID protocolId`, `UUID pantryItemId`, `Integer itemOrder` — all `@NotNull`, plain UUID columns.
  - `SupplementIntakeEntity` (`supplement_intake`): `UUID pantryItemId` (`@NotNull`), `Instant takenAt` (`@NotNull`), `LocalDate takenDate` (`@NotNull`), `String slotKey`, `String dose`, `String note`.

- [ ] **Step 2: Repositories** — `extends JpaRepository<X, UUID>` with the finders above; the max-version query on `ProtocolRepository`:

```java
    @Query("select coalesce(max(p.version), 0) from ProtocolEntity p where p.createdBy = :userId and p.deleted = false")
    int maxVersion(UUID userId);
```

- [ ] **Step 3: Populators** (`@TestComponent @RequiredArgsConstructor`, `saveAndFlush`; `ProtocolPopulator` also writes the items with `itemOrder` = list index). Register BOTH in `AbstractIntegrationTest` `@Import`; add `supplement_intake, protocol_item, protocol` to the front of the `ResetDatabase` TRUNCATE list.

- [ ] **Step 4: Compile-check + commit**

Run: `cd backend && ./mvnw clean compile` — Expected: BUILD SUCCESS.

```bash
git add backend/src
git commit -m "feat(be): fuel entities + repositories + test plumbing (mezo-09g)"
```

---

### Task 4: ProtocolService + IntakeService (TDD, service-level ITs)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/ProtocolServiceIT.java`, `IntakeServiceIT.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/ProtocolService.java`, `IntakeService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/config/FuelProtocolProperties.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.fuel.protocol` block)

**Interfaces:**
- Consumes: repos (Task 3), `PantryItemRepository.findByIdAndCreatedByAndDeletedFalse(UUID, UUID)` (existing pantry repo — check the exact finder name in `feature/pantry/repository` and reuse), generated DTOs (Task 1).
- Produces: `ProtocolService.getView(UUID userId): ProtocolViewResponse`, `activate(UUID userId, ProtocolActivateRequest req): ProtocolViewResponse`; `IntakeService.listForDay(UUID userId, LocalDate date): IntakeListResponse`, `logIntake(UUID userId, IntakeRequest req): IntakeResponse`, `deleteIntake(UUID userId, UUID id): void`.

- [ ] **Step 1: Failing ITs** — `extends AbstractIntegrationTest`, `@Autowired` the service + populators + `PantryItemPopulator` (existing; check its creator methods for a supplement-kind and a food-kind item). Test methods:

```java
// ProtocolServiceIT
testGetView_shouldReturnEmptyActive_whenNoProtocol()            // active null, history empty
testActivate_shouldCreateV1Active_whenFirstActivation()          // version 1, status active, items round-trip in order
testActivate_shouldSupersedePreviousAndIncrementVersion_whenActivatedAgain()  // v2 active, v1 superseded, history [v2, v1]
testActivate_shouldReject_whenSelectionEmpty()                   // 400 VALIDATION_REQUIRED_FIELD on selectedPantryItemIds
testActivate_shouldReject_whenItemIsFoodKind()                   // 400 VALIDATION_INVALID_VALUE on selectedPantryItemIds
testActivate_shouldReject_whenItemForeignOrMissing()             // 404 RESOURCE_NOT_FOUND
// IntakeServiceIT
testLogIntake_shouldSnapshotPantryDose_whenDoseOmitted()         // dose == pantry item's dose; takenDate == takenAt local date
testLogIntake_shouldDefaultTakenAtToNow_whenOmitted()
testLogIntake_shouldReject_whenPantryItemIsFood()                // 400
testListForDay_shouldReturnOnlyThatDaysRows_orderedByTakenAt()
testDeleteIntake_shouldSoftDeleteOwnRow_and404OnForeign()
```

Use AssertJ; assert thrown `SystemRuntimeErrorException` status + message code with `assertThatThrownBy(...).isInstanceOf(SystemRuntimeErrorException.class)` + extracting the status/messages.

Run: `cd backend && ./mvnw clean test -Dtest='ProtocolServiceIT,IntakeServiceIT'` — Expected: compile FAIL (services missing).

- [ ] **Step 2: `FuelProtocolProperties`**

```java
package io.mrkuhne.mezo.feature.fuel.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "mezo.fuel.protocol")
public record FuelProtocolProperties(
    @NotNull @DecimalMin("0") @DecimalMax("1") BigDecimal defaultConfidence
) {
}
```

`application.yml` (inside the `mezo:` block, alphabetically after `feature:`):

```yaml
  fuel:
    protocol:
      # Deterministic-era protocol confidence (the Stack page 'conf' badge). P8 replaces this
      # with a computed value; until then it is config, never hardcoded in code.
      default-confidence: 0.86
```

- [ ] **Step 3: `ProtocolService`**

```java
@Service
@RequiredArgsConstructor
public class ProtocolService {

    private final ProtocolRepository protocolRepository;
    private final ProtocolItemRepository itemRepository;
    private final PantryItemRepository pantryItemRepository;
    private final FuelProtocolProperties properties;

    @Transactional(readOnly = true)
    public ProtocolViewResponse getView(UUID userId) {
        ProtocolEntity active = protocolRepository
            .findByCreatedByAndStatusAndDeletedFalse(userId, "active").orElse(null);
        return ProtocolViewResponse.builder()
            .active(active == null ? null : toResponse(active))
            .history(protocolRepository.findByCreatedByAndDeletedFalseOrderByVersionDesc(userId).stream()
                .map(p -> ProtocolHistoryEntry.builder()
                    .version(p.getVersion()).builtAt(p.getBuiltAt().atOffset(ZoneOffset.UTC))
                    .reason(p.getLastReplanReason()).build())
                .toList())
            .build();
    }

    @Transactional
    public ProtocolViewResponse activate(UUID userId, ProtocolActivateRequest request) {
        List<UUID> ids = request.getSelectedPantryItemIds();
        if (ids == null || ids.isEmpty()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_REQUIRED_FIELD", "selectedPantryItemIds").build(), HttpStatus.BAD_REQUEST);
        }
        for (UUID id : ids) {
            PantryItemEntity item = pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
            if ("food".equals(item.getKind())) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "selectedPantryItemIds").build(), HttpStatus.BAD_REQUEST);
            }
        }
        protocolRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
            .ifPresent(prev -> prev.setStatus("superseded"));

        ProtocolEntity next = new ProtocolEntity();
        next.setCreatedBy(userId); // server-side ownership — never from the client
        next.setVersion(protocolRepository.maxVersion(userId) + 1);
        next.setBuiltAt(Instant.now());
        next.setStatus("active");
        next.setConfidence(properties.defaultConfidence());
        next.setLastReplanReason(request.getReason());
        ProtocolEntity saved = protocolRepository.save(next);

        for (int i = 0; i < ids.size(); i++) {
            ProtocolItemEntity pi = new ProtocolItemEntity();
            pi.setCreatedBy(userId);
            pi.setProtocolId(saved.getId());
            pi.setPantryItemId(ids.get(i));
            pi.setItemOrder(i);
            itemRepository.save(pi);
        }
        return getView(userId);
    }

    private ProtocolResponse toResponse(ProtocolEntity p) {
        return ProtocolResponse.builder()
            .id(p.getId()).version(p.getVersion()).builtAt(p.getBuiltAt().atOffset(ZoneOffset.UTC))
            .status(ProtocolResponse.StatusEnum.fromValue(p.getStatus()))
            .confidence(p.getConfidence()).lastReplanReason(p.getLastReplanReason())
            .selectedPantryItemIds(itemRepository.findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(p.getId())
                .stream().map(ProtocolItemEntity::getPantryItemId).toList())
            .build();
    }
}
```

(Adjust `StatusEnum`/builder names to whatever the generator emits — check the generated `ProtocolResponse` after Task 1; `builtAt` generated type is `OffsetDateTime` with `dateLibrary java8`. If the pantry finder has a different name, reuse the existing one — do NOT add a duplicate.)

- [ ] **Step 4: `IntakeService`**

```java
@Service
@RequiredArgsConstructor
public class IntakeService {

    private final SupplementIntakeRepository repository;
    private final PantryItemRepository pantryItemRepository;

    @Transactional
    public IntakeResponse logIntake(UUID userId, IntakeRequest request) {
        PantryItemEntity item = pantryItemRepository
            .findByIdAndCreatedByAndDeletedFalse(request.getPantryItemId(), userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if ("food".equals(item.getKind())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "pantryItemId").build(), HttpStatus.BAD_REQUEST);
        }
        OffsetDateTime takenAt = request.getTakenAt() != null ? request.getTakenAt() : OffsetDateTime.now();
        SupplementIntakeEntity e = new SupplementIntakeEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setPantryItemId(item.getId());
        e.setTakenAt(takenAt.toInstant());
        e.setTakenDate(takenAt.toLocalDate()); // offset-bearing wall-clock date, the medication_dose precedent
        e.setSlotKey(request.getSlotKey());
        e.setDose(request.getDose() != null && !request.getDose().isBlank() ? request.getDose() : item.getDose());
        e.setNote(request.getNote());
        return toResponse(repository.save(e));
    }

    @Transactional(readOnly = true)
    public IntakeListResponse listForDay(UUID userId, LocalDate date) {
        return IntakeListResponse.builder()
            .intakes(repository.findByCreatedByAndTakenDateAndDeletedFalseOrderByTakenAtAsc(userId, date)
                .stream().map(this::toResponse).toList())
            .build();
    }

    @Transactional
    public void deleteIntake(UUID userId, UUID id) {
        SupplementIntakeEntity e = repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        repository.delete(e);
    }

    private IntakeResponse toResponse(SupplementIntakeEntity e) {
        return IntakeResponse.builder()
            .id(e.getId()).pantryItemId(e.getPantryItemId())
            .takenAt(e.getTakenAt().atOffset(ZoneOffset.UTC)).takenDate(e.getTakenDate())
            .slotKey(e.getSlotKey()).dose(e.getDose()).note(e.getNote())
            .build();
    }
}
```

(Verify the pantry entity's dose getter name — `getDose()` per `PantryService.validatePerKind` usage.)

- [ ] **Step 5: Run the ITs — green**, then commit

Run: `cd backend && ./mvnw clean test -Dtest='ProtocolServiceIT,IntakeServiceIT'` — Expected: PASS.

```bash
git add backend/src
git commit -m "feat(be): ProtocolService + IntakeService with config-backed confidence (mezo-09g)"
```

---

### Task 5: FuelController + API-level ITs

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/FuelApiIT.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/controller/FuelController.java`

**Interfaces:**
- Consumes: `ProtocolService`, `IntakeService` (Task 4), `CurrentUserId`.
- Produces: HTTP surface of Task 1's contract.

- [ ] **Step 1: Failing `FuelApiIT`** (`extends ApiIntegrationTest`): happy-path protocol round-trip (`POST /api/fuel/protocol` with a populated supplement pantry-item id → 201 + `active.version == 1`; `GET` → same; second POST → `version 2`), intake round-trip (`POST /api/fuel/intake` → 201; `GET /api/fuel/intake/{today}` → 1 row; `DELETE /api/fuel/intake/entry/{id}` → 204 → list empty), unauthenticated `GET /api/fuel/protocol` without headers → 401, empty-selection POST → 400.

Run: `./mvnw clean test -Dtest=FuelApiIT` — Expected: 404s / compile fail (no controller).

- [ ] **Step 2: Controller**

```java
package io.mrkuhne.mezo.feature.fuel.controller;

import io.mrkuhne.mezo.api.controller.FuelApi;
import io.mrkuhne.mezo.api.dto.IntakeListResponse;
import io.mrkuhne.mezo.api.dto.IntakeRequest;
import io.mrkuhne.mezo.api.dto.IntakeResponse;
import io.mrkuhne.mezo.api.dto.ProtocolActivateRequest;
import io.mrkuhne.mezo.api.dto.ProtocolViewResponse;
import io.mrkuhne.mezo.feature.fuel.service.IntakeService;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class FuelController implements FuelApi {

    private final ProtocolService protocolService;
    private final IntakeService intakeService;
    private final CurrentUserId currentUserId;

    @Override
    public ProtocolViewResponse getProtocol() {
        return protocolService.getView(currentUserId.get());
    }

    @Override
    public ProtocolViewResponse activateProtocol(ProtocolActivateRequest protocolActivateRequest) {
        return protocolService.activate(currentUserId.get(), protocolActivateRequest);
    }

    @Override
    public IntakeListResponse listIntakes(LocalDate date) {
        return intakeService.listForDay(currentUserId.get(), date);
    }

    @Override
    public IntakeResponse logIntake(IntakeRequest intakeRequest) {
        return intakeService.logIntake(currentUserId.get(), intakeRequest);
    }

    @Override
    public void deleteIntake(UUID id) {
        intakeService.deleteIntake(currentUserId.get(), id);
    }
}
```

- [ ] **Step 3: Green + full backend gate + commit**

Run: `cd backend && ./mvnw clean test` — Expected: ALL green.

```bash
git add backend/src
git commit -m "feat(be): FuelController — protocol + intake endpoints live (mezo-09g)"
```

---

### Task 6: FE — `fuelApi.ts` (mappers + unit test)

**Files:**
- Create: `frontend/src/data/fuel/fuelApi.ts`
- Test: `frontend/src/data/fuel/fuelApi.test.ts` (mirror `recipeApi.test.ts` style — pure mapper tests, no HTTP)

**Interfaces:**
- Produces:
  - `interface Intake { id: string; pantryItemId: string; takenAt: string; dose: string | null; slotKey: string | null }`
  - `interface ProtocolView { protocol: Protocol | null; selectedIds: string[] | null }`
  - `fuelApi.getProtocol(): Promise<ProtocolView>`, `activateProtocol(selectedIds: string[], reason?: string): Promise<ProtocolView>`, `listIntakes(date: string): Promise<Intake[]>`, `logIntake(input: { pantryItemId: string; dose?: string; slotKey?: string }): Promise<Intake>`, `deleteIntake(id: string): Promise<void>`
  - exported `fromProtocolView(r: ProtocolViewResponse): ProtocolView` for tests.

- [ ] **Step 1: Failing mapper test** — `fromProtocolView` maps a full response to the FE `Protocol` shape (`itemCount` = selection length, `source: 'Stack builder'`, formatted `builtAt`, history `{v, when, reason}`), and `{ active: undefined }` → `{ protocol: null, selectedIds: null }`.

- [ ] **Step 2: Implement**

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { Protocol } from '@/data/types'

type ProtocolViewResponse = components['schemas']['ProtocolViewResponse']
type IntakeResponse = components['schemas']['IntakeResponse']

export interface Intake {
  id: string
  pantryItemId: string
  takenAt: string
  dose: string | null
  slotKey: string | null
}

export interface ProtocolView {
  protocol: Protocol | null
  selectedIds: string[] | null
}

const formatBuiltAt = (iso: string) =>
  new Date(iso).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function fromProtocolView(r: ProtocolViewResponse): ProtocolView {
  const a = r.active
  if (!a) return { protocol: null, selectedIds: null }
  return {
    protocol: {
      version: a.version,
      builtAt: formatBuiltAt(a.builtAt),
      source: 'Stack builder',
      status: a.status,
      itemCount: a.selectedPantryItemIds.length,
      confidence: a.confidence ?? 0,
      lastReplanReason: a.lastReplanReason ?? null,
      history: (r.history ?? []).map(h => ({ v: h.version, when: formatBuiltAt(h.builtAt), reason: h.reason ?? '' })),
    },
    selectedIds: a.selectedPantryItemIds,
  }
}

function fromIntake(r: IntakeResponse): Intake {
  return { id: r.id, pantryItemId: r.pantryItemId, takenAt: r.takenAt, dose: r.dose ?? null, slotKey: r.slotKey ?? null }
}

export const fuelApi = {
  getProtocol: (): Promise<ProtocolView> =>
    apiFetch<ProtocolViewResponse>('/api/fuel/protocol').then(fromProtocolView),
  activateProtocol: (selectedIds: string[], reason?: string): Promise<ProtocolView> =>
    apiFetch<ProtocolViewResponse>('/api/fuel/protocol', {
      method: 'POST',
      body: JSON.stringify({ selectedPantryItemIds: selectedIds, reason }),
    }).then(fromProtocolView),
  listIntakes: (date: string): Promise<Intake[]> =>
    apiFetch<{ intakes: IntakeResponse[] }>(`/api/fuel/intake/${date}`).then(r => r.intakes.map(fromIntake)),
  logIntake: (input: { pantryItemId: string; dose?: string; slotKey?: string }): Promise<Intake> =>
    apiFetch<IntakeResponse>('/api/fuel/intake', { method: 'POST', body: JSON.stringify(input) }).then(fromIntake),
  deleteIntake: (id: string): Promise<void> =>
    apiFetch(`/api/fuel/intake/entry/${id}`, { method: 'DELETE' }).then(() => undefined),
}
```

- [ ] **Step 3: Green + commit** (`pnpm vitest run src/data/fuel/fuelApi.test.ts`)

```bash
git add frontend/src/data/fuel/fuelApi.ts frontend/src/data/fuel/fuelApi.test.ts
git commit -m "feat(fe): fuelApi client + protocol mappers (mezo-09g)"
```

---

### Task 7: FE — `stackHooks.ts` (dual-mode hooks) + barrel rewire

**Files:**
- Create: `frontend/src/data/fuel/stackHooks.ts`
- Test: `frontend/src/data/fuel/stackHooks.test.tsx`
- Modify: `frontend/src/data/fuel/fuelReadHooks.ts` (remove `useStack`/`useProtocol`; make `useStackRecommendations` mode-aware)
- Modify: `frontend/src/data/hooks.ts` (barrel line 9 + new exports)
- Modify: `frontend/src/test/msw/handlers.ts` (default Fuel handlers)

**Interfaces:**
- Consumes: `fuelApi`/`Intake`/`ProtocolView` (Task 6), `usePantry` (existing), `useDualQuery`, `protocol` + `supplementsStash` seeds from `@/data/fuel/fuel`.
- Produces (all exported from `@/data/hooks`):
  - `useStack(): { stash: SupplementStashItem[] }` — same shape as today; `taken` now derives from the day's intakes.
  - `useProtocol(): { protocol: Protocol; selectedIds: string[] | null }` — `protocol` keeps its shape; `version === 0` ghost means "no protocol yet" (honest-empty); `selectedIds` is additive.
  - `useStackActions(date?): { logIntake(pantryItemId: string): void; undoIntake(pantryItemId: string): void }`
  - `useProtocolActions(): { applyProtocol(selectedIds: string[], reason?: string): Promise<ProtocolView> }`

- [ ] **Step 1: Failing hook tests** (`sharedWrapper` + `vi.stubEnv` pattern, MSW for real mode):
  - mock: `useStack` marks exactly the seed's `taken:true` items; `logIntake('magnez')` flips it to taken, `undoIntake` flips back; `useProtocol().protocol.version === 3` (seed); `applyProtocol([...])` resolves with `version 4` and the cache reflects it.
  - real: `useProtocol` returns the v0 ghost while pending (never the seed); `applyProtocol` POSTs `selectedPantryItemIds` and updates the `['protocol']` cache from the response; `useStack` merges `GET /api/fuel/intake/{date}` rows into `taken`; `logIntake` POSTs and invalidates `['fuelIntake', date]`; `undoIntake` DELETEs the matching row's id.

- [ ] **Step 2: Implement `stackHooks.ts`**

```ts
import { useCallback } from 'react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { fuelApi, type Intake, type ProtocolView } from '@/data/fuel/fuelApi'
import { usePantry } from '@/data/fuel/pantryHooks'
import { protocol as protocolSeed, supplementsStash } from '@/data/fuel/fuel'
import type { Protocol, SupplementStashItem } from '@/data/types'

const PROTOCOL_KEY = ['protocol'] as const
const intakeKey = (date: string) => ['fuelIntake', date] as const

const GHOST_PROTOCOL: Protocol = {
  version: 0, builtAt: '', source: '', status: 'none',
  itemCount: 0, confidence: 0, lastReplanReason: null, history: [],
}
const EMPTY_VIEW: ProtocolView = { protocol: null, selectedIds: null }
// mock: the seed protocol is active but carries no selection — the page's default applies
const mockView: ProtocolView = { protocol: protocolSeed, selectedIds: null }
// mock intake seed derives from the stash's taken flags so mock/real read the same shape
const mockIntakeSeed: Intake[] = supplementsStash
  .filter(s => s.taken)
  .map(s => ({ id: `intake-${s.id}`, pantryItemId: s.id, takenAt: '', dose: s.dose, slotKey: null }))

export function useProtocol(): { protocol: Protocol; selectedIds: string[] | null } {
  const { data } = useDualQuery<ProtocolView>({
    queryKey: PROTOCOL_KEY,
    mockData: mockView,
    realFetch: fuelApi.getProtocol,
    realEmpty: EMPTY_VIEW,
    realStaleTime: 0,
  })
  return { protocol: data.protocol ?? GHOST_PROTOCOL, selectedIds: data.selectedIds }
}

function useIntakes(date: string): Intake[] {
  const { data } = useDualQuery<Intake[]>({
    queryKey: intakeKey(date),
    mockData: mockIntakeSeed,
    realFetch: () => fuelApi.listIntakes(date),
    realEmpty: [],
    realStaleTime: 0,
  })
  return data
}

export function useStack(): { stash: SupplementStashItem[] } {
  const { stash } = usePantry()
  const intakes = useIntakes(localDateString())
  const takenIds = new Set(intakes.map(i => i.pantryItemId))
  return { stash: stash.map(s => ({ ...s, taken: takenIds.has(s.id) })) }
}

export function useStackActions(date: string = localDateString()) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const invalidate = () => qc.invalidateQueries({ queryKey: intakeKey(date) })

  const logM = useMutation({
    mutationFn: mock
      ? async (pantryItemId: string) => mockAddIntake(qc, date, pantryItemId)
      : async (pantryItemId: string) => { await fuelApi.logIntake({ pantryItemId }) },
    onSuccess: mock ? undefined : invalidate,
  })
  const undoM = useMutation({
    mutationFn: mock
      ? async (pantryItemId: string) => mockRemoveIntake(qc, date, pantryItemId)
      : async (pantryItemId: string) => {
          const row = (qc.getQueryData<Intake[]>(intakeKey(date)) ?? []).find(i => i.pantryItemId === pantryItemId)
          if (row) await fuelApi.deleteIntake(row.id)
        },
    onSuccess: mock ? undefined : invalidate,
  })

  const logIntake = useCallback((pantryItemId: string) => logM.mutate(pantryItemId), [logM])
  const undoIntake = useCallback((pantryItemId: string) => undoM.mutate(pantryItemId), [undoM])
  return { logIntake, undoIntake }
}

export function useProtocolActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const applyM = useMutation({
    mutationFn: mock
      ? async (v: { selectedIds: string[]; reason?: string }) => mockActivate(qc, v.selectedIds)
      : async (v: { selectedIds: string[]; reason?: string }) => {
          const view = await fuelApi.activateProtocol(v.selectedIds, v.reason)
          qc.setQueryData(PROTOCOL_KEY, view)
          return view
        },
  })

  const applyProtocol = useCallback(
    (selectedIds: string[], reason?: string) => applyM.mutateAsync({ selectedIds, reason }),
    [applyM],
  )
  return { applyProtocol }
}

function mockAddIntake(qc: QueryClient, date: string, pantryItemId: string) {
  qc.setQueryData<Intake[]>(intakeKey(date), (rows = []) =>
    rows.some(r => r.pantryItemId === pantryItemId)
      ? rows
      : [...rows, { id: `intake-${pantryItemId}`, pantryItemId, takenAt: '', dose: null, slotKey: null }])
}

function mockRemoveIntake(qc: QueryClient, date: string, pantryItemId: string) {
  qc.setQueryData<Intake[]>(intakeKey(date), (rows = []) => rows.filter(r => r.pantryItemId !== pantryItemId))
}

function mockActivate(qc: QueryClient, selectedIds: string[]): ProtocolView {
  const prev = qc.getQueryData<ProtocolView>(PROTOCOL_KEY) ?? mockView
  const base = prev.protocol ?? GHOST_PROTOCOL
  const next: ProtocolView = {
    protocol: {
      ...base,
      version: base.version + 1,
      builtAt: 'most',
      source: 'Stack builder',
      status: 'active',
      itemCount: selectedIds.length,
      history: [{ v: base.version + 1, when: 'most', reason: 'Stack bekapcsolás' }, ...base.history],
    },
    selectedIds,
  }
  qc.setQueryData(PROTOCOL_KEY, next)
  return next
}
```

- [ ] **Step 3: Rewire** — `fuelReadHooks.ts`: delete `useStack`/`useProtocol` (and their now-unused imports); change `useStackRecommendations` to `return { recommendations: isMockMode() ? stackRecommendations : [] }` (import `isMockMode`). `hooks.ts` line 9 becomes:

```ts
export { useFuelTimeline, useFuelWeek, useReplanScenarios, useStackRecommendations } from '@/data/fuel/fuelReadHooks'
export { useStack, useProtocol, useStackActions, useProtocolActions } from '@/data/fuel/stackHooks'
```

Add default MSW handlers (`test/msw/handlers.ts`): `GET /api/fuel/protocol` → `{ history: [] }`, `GET /api/fuel/intake/:date` → `{ intakes: [] }`, `POST /api/fuel/protocol` → a v1 `ProtocolViewResponse`, `POST /api/fuel/intake` → a row, `DELETE /api/fuel/intake/entry/:id` → 204.

- [ ] **Step 4: Green + commit** (`pnpm vitest run src/data/fuel` then the two-mode full test run)

```bash
git add frontend/src
git commit -m "feat(fe): dual-mode useStack/useProtocol + stack/protocol actions (mezo-09g)"
```

---

### Task 8: FE — `buildProtocol` real-stash matching + `refId`

**Files:**
- Modify: `frontend/src/features/fuel/logic/buildProtocol.ts`
- Modify: `frontend/src/data/types.ts` (`ProtocolSlotItem`)
- Test: `frontend/src/features/fuel/logic/buildProtocol.test.ts`

**Why:** `buildProtocol` keys items with `byId('kreatin')` etc. — mock slug ids. In real mode the stash ids are backend UUIDs (147-item catalog), so every id-rule silently misses. Match on **name OR id substring** instead, and stamp each emitted item with its stash `refId` so the page can log intakes from slot rows.

- [ ] **Step 1: Failing tests** — (a) existing tests stay green (mock slugs still match); (b) new test: a stash whose items have UUID ids but real names (`'Kreatin monohidrát'`, `'Koffein 200'`, `'D3 + K2 vitamin'`, `'Magnézium-biszglicinát'`, `'Omega-3'`) produces the same slot kinds as the slug stash; (c) every emitted `ProtocolSlotItem` carries the source item's `refId`.

- [ ] **Step 2: Implement** — in `types.ts` extend:

```ts
export interface ProtocolSlotItem { refId: string; name: string; dose: string; color: string }
```

In `buildProtocol.ts` replace the `byId` helper with a needle matcher and use it everywhere:

```ts
const norm = (s: string) => s.toLowerCase()
const find = (...needles: string[]) =>
  items.find(i => needles.some(n => norm(i.name).includes(n) || norm(i.id).includes(n)))

const kre = find('kreatin')
const koffein = find('koffein', 'caffeine', 'kávé', 'kohi')
const d3 = find('d3')
const magnez = find('magn')
const omega = find('omega')
const aakg = find('aakg')
const beta = find('beta-alanin', 'betaalanin', 'béta-alanin')
const whey = find('whey', 'protein')
```

and add `refId: <item>.id` to every `ProtocolSlotItem` literal pushed (each push site already has the matched item in scope).

- [ ] **Step 3: Green + commit**

```bash
git add frontend/src
git commit -m "feat(fe): buildProtocol matches real stash names + emits refId (mezo-09g)"
```

---

### Task 9: FE — FuelStackPage + ProtocolSlot + Mai meta row wiring

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelStackPage.tsx`
- Modify: `frontend/src/features/fuel/components/ProtocolSlot.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Tests: `FuelStackPage.test.tsx`, `FuelMaiPage.test.tsx`

**Interfaces:**
- Consumes: `useStack`/`useProtocol`/`useStackActions`/`useProtocolActions` (Task 7), `refId` on slot items (Task 8).
- Produces: `ProtocolSlot` gains optional `takenIds?: Set<string>` and `onToggleItem?: (refId: string, taken: boolean) => void` props (presentational default unchanged).

- [ ] **Step 1: Failing/updated tests**
  - Stack: initial selection prefers the active protocol's `selectedIds` (mock `selectedIds` is null → default all-non-medication stays, existing picker test green); clicking `Bekapcsolás · ma` shows a toast with the version returned by `applyProtocol` (mock: seed v3 → `Protokoll · v4 aktív`); the `Mentés protokollként` button is disabled and reads `· hamarosan`; the recommendations section is absent when `recommendations` is empty (real mode); tapping a slot item row calls `logIntake` with its `refId` (and `undoIntake` when already taken).
  - Mai: the protocol-meta row is hidden when `protocol.version === 0` (real-mode ghost) and shown with `Stack · v3` in mock.

- [ ] **Step 2: FuelStackPage** — key edits:

```tsx
const { protocol, selectedIds: activeSelection } = useProtocol()
const { logIntake, undoIntake } = useStackActions()
const { applyProtocol } = useProtocolActions()

const defaultIds = stash.filter(s => s.type !== 'medication').map(s => s.id)
const [userSel, setUserSel] = useState<string[] | null>(null)
const selectedIds = userSel ?? activeSelection ?? defaultIds
const toggle = (id: string) =>
  setUserSel(prev => {
    const base = prev ?? selectedIds
    return base.includes(id) ? base.filter(i => i !== id) : [...base, id]
  })

const [appliedVersion, setAppliedVersion] = useState<number | null>(null)
const apply = () => {
  void applyProtocol(selectedIds).then(view => setAppliedVersion(view.protocol?.version ?? null))
}
```

- Replace the `useState<string[]>(() => stash.filter(...))` initializer + old `toggle` with the block above; the auto-hide effect keys on `appliedVersion` (reset to `null`); the toast renders `Protokoll · v{appliedVersion} aktív` only when `appliedVersion != null`.
- `Bekapcsolás · ma` → `onClick={apply}`.
- `Mentés protokollként` → `disabled` + label `Mentés protokollként · hamarosan` + `style={{ opacity: 0.5 }}` (the RecipeDetail deferred-CTA precedent).
- Recommendations section: wrap in `{recommendations.length > 0 && (...)}`.
- Slots: compute `const takenIds = new Set(stash.filter(s => s.taken).map(s => s.id))` and render `<ProtocolSlot slot={slot} takenIds={takenIds} onToggleItem={(refId, taken) => (taken ? undoIntake(refId) : logIntake(refId))} />`.
- **mezo-4nu #1 decouple:** drop the `useProfile()`/`useGoal()` calls. First grep where their mock consts live (`grep -rn "weekInMeso" frontend/src/data`), then add to `stackHooks.ts` a static context hook that imports those seed consts directly (no query, no fetch):

```ts
export function useStackContext(): { weekInMeso: number; mesoTitle: string } {
  // static context labels — same values the mock useProfile()/useGoal() produced for this card;
  // avoids the real /api/goals + profile fetches from the Stack view (mezo-4nu). P4/P8 feed these live.
  return { weekInMeso: userSeed.weekInMeso, mesoTitle: activeMesoShortTitle }
}
```

(resolve `userSeed`/`activeMesoShortTitle` from the actual seed modules found by the grep; the rendered strings must not change — the existing test snapshot/queries guard this). Export `useStackContext` from the `@/data/hooks` barrel next to the other stackHooks exports. A real-mode MSW test asserts the Stack render fires NO `/api/goals` request.

- [ ] **Step 3: ProtocolSlot** — props become `{ slot, takenIds, onToggleItem }: { slot: ProtocolSlotData; takenIds?: Set<string>; onToggleItem?: (refId: string, taken: boolean) => void }`; each item row becomes a `<button type="button">` (keep the row layout) with `aria-label={`${it.name} bevétel`}`, `onClick={() => onToggleItem?.(it.refId, taken)}` where `const taken = takenIds?.has(it.refId) ?? false`, and a trailing `<Icon name="check" size={10} color="var(--brand-glow)" />` when taken. Without the new props it renders exactly as before.

- [ ] **Step 4: FuelMaiPage** — wrap the protocol-meta row in `{protocol.version > 0 && ( ... )}`.

- [ ] **Step 5: Green + full FE gate + commit**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — Expected: green in both modes.

```bash
git add frontend/src
git commit -m "feat(fe): Stack page live — real apply, intake tap-to-log, Mai meta row (mezo-09g)"
```

---

### Task 10: Docs + close + merge + push

**Files:**
- Modify: `docs/features/fuel.md` (§1 status, §2 Stack/Mai, §3 architecture exceptions, §4 data model & API, §5 integrations)
- Modify: `docs/superpowers/plans/2026-06-26-fuel-completion-roadmap.md` (P2 ✅ SHIPPED note, incl. the two divergences: DELETE path shape, `useStackContext` decouple)
- Modify: `docs/milestones/roadmap.md`

- [ ] **Step 1:** Update the docs (Stack is now real: `fuel.yml`, `feature/fuel` package, three tables, dual-mode hooks, the deferred `Mentés · hamarosan` CTA; `useStackRecommendations` real-mode `[]`).
- [ ] **Step 2:** `node scripts/lint-docs.mjs` — Expected: PASS.
- [ ] **Step 3:** Close + note the fold-in:

```bash
git add docs/ && git commit -m "docs(fuel): stack/protocol shipped — fuel.md + roadmaps (mezo-09g)"
bd close mezo-09g
bd update mezo-4nu --notes "Item 1 (FuelStackView /api/goals decouple) shipped in mezo-09g via useStackContext; items 2-4 still open."
git add .beads/issues.jsonl && git commit -m "chore(bd): sync issues.jsonl — close mezo-09g"
```

- [ ] **Step 4:** Merge + push (pull-rebase BEFORE the merge):

```bash
git checkout main && git pull --rebase
git merge --no-ff feat/fuel-p2-stack-protocol -m "Merge feat/fuel-p2-stack-protocol: Stack/Protocol real — supplement_intake + versioned protocol (mezo-09g)"
git branch -d feat/fuel-p2-stack-protocol
bd dolt push && git push && git status
```

Expected: `up to date with 'origin/main'`.
