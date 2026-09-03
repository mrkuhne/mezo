# Diet Plan Slice 1 — Diet Split Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user-customizable macro split (presets + custom P/C/F %, protein tier) stored in a new `diet_settings` singleton, with the goal engine prescribing per-segment `carbsG`/`fatG` (clamped by the protein g/kg floor and a fat g/kg minimum) so the BE fuel-day targets and the FE daily budget stop using hardcoded carb/fat constants.

**Architecture:** New `diet_settings` per-user singleton in `feature/nutrition` following the `fuel_settings` idiom exactly (gated HTTP surface + an ungated resolver with a config ghost). The goal engine (`GoalEvaluationService.assemble`) consumes the resolved preferences and emits `carbsG`/`fatG` on every prescription segment (jsonb-additive — no data migration). `FuelDayService.targetSet` and FE `deriveDailyBudget` both switch from static constants to the segment values, with the old constants surviving as fallbacks.

**Tech Stack:** Spring Boot 3 + Liquibase + generated OpenAPI server stubs (backend), React 19 + TanStack Query + openapi-typescript (frontend), Vitest + JUnit/AssertJ ITs.

**Spec:** `docs/superpowers/specs/2026-09-02-diet-plan-design.md` (§6.1 without slice-3/4/5 fields, §6.2, §6.7 first bullet, §6.9)

## Global Constraints

- **Contract-first:** edit `api/feature/<name>/<name>.yml` BEFORE code; regenerate in the SAME commit: `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`. Backend Java DTOs regenerate automatically in `./mvnw generate-sources`/`test`. CI's contract-drift job fails otherwise.
- **CODEMAP freshness:** any new file/class requires `node scripts/gen-codemap.mjs` before commit (CI runs `--check`).
- **Frozen ArchUnit store:** before EVERY commit run `git status` and verify `backend/src/test/resources/archunit-store/**` is NOT modified/emptied by the test run; if it is, `git checkout -- backend/src/test/resources/archunit-store`.
- **Backend tests: FOCUSED ONLY, never the full suite locally** (16 GB OOM). Use the exact `-Dtest=` commands given per task, always from `backend/`: `./mvnw test -Dtest=<Class>`. CI runs the full suite on the PR.
- **Frontend tests run in BOTH modes:** `pnpm test` AND `VITE_USE_MOCK=true pnpm test` (from `frontend/`); for speed, per-file: `pnpm vitest run <path>` in both modes.
- **Config-first:** every engine number goes into `@Validated @ConfigurationProperties` records bound from `application.yml` — no `@Value`, no hardcoded constants in services.
- **Naming:** target-split code is `dietSplit`/`DietSplit`/`DIET_SPLIT_*` — NEVER `macroSplit` (collides with the in-flight mezo-tjua logged-meal work).
- **Commits:** conventional subjects carrying the driving bd id, e.g. `feat(nutrition): diet_settings singleton (mezo-XXXX)` — replace `mezo-XXXX` with the actual slice-1 bd id at execution time.
- **Language:** code/comments/commit messages English; UI copy Hungarian, matching the existing terse tone (`Fuel beállítások`, sublabels in sentence case).
- **Zero-jump deploy invariant:** the `balanced` preset (fat share 0.275) + `moderate` protein tier + ghost water 4000 / fiber 30 MUST reproduce today's numbers exactly, so an unset diet_settings row changes nothing on deploy.

---

### Task 1: API contract — diet-settings fragment + prescription segment carbsG/fatG

**Files:**
- Create: `api/feature/diet-settings/diet-settings.yml`
- Modify: `api/generate/merge.yml` (append input)
- Modify: `api/feature/goal/goal.yml` (GoalPrescriptionSegment: optional `carbsG`, `fatG`)
- Generated (same commit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: DTOs `DietSettingsResponse` / `SetDietSettingsRequest` (fields: `splitPreset` enum `[balanced, low_fat, low_carb, high_carb, custom]`, `proteinPctX10`/`carbsPctX10`/`fatPctX10` optional integers 0..1000, `proteinTier` enum `[moderate, high]`, `waterMl` int, `fiberG` int); endpoints `GET|PUT /api/diet/settings` (operationIds `getDietSettings`/`setDietSettings`, tag `DietSettings` → generated `DietSettingsApi`); `GoalPrescriptionSegment.carbsG`/`fatG` optional integers.

- [ ] **Step 1: Write the fragment**

Create `api/feature/diet-settings/diet-settings.yml`:

```yaml
openapi: 3.0.3
info: { title: mezo diet-settings fragment, version: 1.0.0 }
tags:
  - name: DietSettings
    description: Nutrition-owned per-user diet preferences (macro split, protein tier, water/fiber targets)
paths:
  /api/diet/settings:
    get:
      tags: [DietSettings]
      operationId: getDietSettings
      summary: The diet settings; config-default ghost when unset — never 404 (DietSettings)
      responses:
        '200':
          description: The settings (ghost balanced / moderate / 4000 / 30 before the first save)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/DietSettingsResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    put:
      tags: [DietSettings]
      operationId: setDietSettings
      summary: Upsert the diet settings (per-user singleton) (DietSettings)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SetDietSettingsRequest' }
      responses:
        '200':
          description: Saved settings
          content:
            application/json:
              schema: { $ref: '#/components/schemas/DietSettingsResponse' }
        '400':
          description: Validation failure (incl. custom split not summing to 100.0%)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    DietSettingsResponse:
      type: object
      required: [splitPreset, proteinTier, waterMl, fiberG]
      properties:
        splitPreset:
          type: string
          enum: [balanced, low_fat, low_carb, high_carb, custom]
          description: Named fat/carb balance; custom uses the three pct fields
        proteinPctX10:
          type: integer
          minimum: 0
          maximum: 1000
          description: Custom protein energy share, tenths of a percent (advisory — the g/kg floor wins)
        carbsPctX10: { type: integer, minimum: 0, maximum: 1000 }
        fatPctX10: { type: integer, minimum: 0, maximum: 1000 }
        proteinTier:
          type: string
          enum: [moderate, high]
          description: g/kg band endpoint — moderate=2.0 g/kg BW, high=2.2 g/kg BW (engine config)
        waterMl: { type: integer, minimum: 500, maximum: 8000 }
        fiberG: { type: integer, minimum: 10, maximum: 80 }
    SetDietSettingsRequest:
      type: object
      required: [splitPreset, proteinTier, waterMl, fiberG]
      properties:
        splitPreset: { type: string, enum: [balanced, low_fat, low_carb, high_carb, custom] }
        proteinPctX10: { type: integer, minimum: 0, maximum: 1000 }
        carbsPctX10: { type: integer, minimum: 0, maximum: 1000 }
        fatPctX10: { type: integer, minimum: 0, maximum: 1000 }
        proteinTier: { type: string, enum: [moderate, high] }
        waterMl: { type: integer, minimum: 500, maximum: 8000 }
        fiberG: { type: integer, minimum: 10, maximum: 80 }
```

- [ ] **Step 2: Register the fragment**

In `api/generate/merge.yml`, after the `fuel-settings.yml` line (line 28):

```yaml
  - inputFile: ../feature/diet-settings/diet-settings.yml
```

- [ ] **Step 3: Extend the goal segment schema**

In `api/feature/goal/goal.yml`, `GoalPrescriptionSegment.properties` (after `proteinG`, ~line 187) — NOT added to `required` (old persisted prescriptions lack them):

```yaml
        carbsG: { type: integer, description: 'Prescribed carbohydrate grams — the split remainder after protein + fat (absent on pre-slice-1 prescriptions)' }
        fatG: { type: integer, description: 'Prescribed fat grams — split fat-share of segment kcal, floored at fat-floor g/kg (absent on pre-slice-1 prescriptions)' }
```

- [ ] **Step 4: Regenerate both clients**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` gains the DietSettings paths + schemas; `frontend/src/data/_client/api.gen.ts` gains `DietSettingsResponse`/`SetDietSettingsRequest` types and `GoalPrescriptionSegment` gains `carbsG?`/`fatG?`.

- [ ] **Step 5: Verify backend stubs generate**

```bash
cd backend && ./mvnw generate-sources -q
ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/ | grep DietSettings
```

Expected: `DietSettingsApi.java` listed.

- [ ] **Step 6: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): diet-settings contract + prescription segment carbsG/fatG (mezo-XXXX)"
```

---

### Task 2: `diet_settings` table + entity + repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021000_mezo-XXXX_create_diet_settings.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity/DietSettingsEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/repository/DietSettingsRepository.java`

**Interfaces:**
- Produces: `DietSettingsEntity` (getters/setters for `splitPreset:String`, `proteinPctX10:Integer` nullable, `carbsPctX10:Integer` nullable, `fatPctX10:Integer` nullable, `proteinTier:String`, `waterMl:Integer`, `fiberG:Integer`), `DietSettingsRepository.findByCreatedByAndDeletedFalse(UUID): Optional<DietSettingsEntity>`.

- [ ] **Step 1: Write the migration**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202609021000_mezo-XXXX_create_diet_settings.sql` (mirror the `fuel_settings` DDL shape):

```sql
-- mezo-XXXX (Diet Plan slice 1, spec docs/superpowers/specs/2026-09-02-diet-plan-design.md).
-- Per-user diet-preference singleton (fuel_settings shape): macro split preset / custom P/C/F
-- tenths-of-percent / protein g-per-kg tier / water + fiber targets. No backfill: the absent row
-- resolves to the config ghost (balanced / moderate / 4000 / 30), which reproduces the previous
-- hardcoded behavior exactly.

create table diet_settings (
    id              uuid        not null default gen_random_uuid(),
    created_by      uuid        not null,
    is_deleted      boolean     not null default false,
    created_at      timestamptz not null default now(),
    split_preset    varchar(16) not null,
    protein_pct_x10 integer,
    carbs_pct_x10   integer,
    fat_pct_x10     integer,
    protein_tier    varchar(16) not null,
    water_ml        integer     not null,
    fiber_g         integer     not null,
    constraint pk_diet_settings_id primary key (id),
    constraint fk_diet_settings_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_diet_settings_split_preset check (split_preset in ('balanced', 'low_fat', 'low_carb', 'high_carb', 'custom')),
    constraint ck_diet_settings_protein_tier check (protein_tier in ('moderate', 'high')),
    constraint ck_diet_settings_water_ml check (water_ml between 500 and 8000),
    constraint ck_diet_settings_fiber_g check (fiber_g between 10 and 80)
);
create unique index uq_diet_settings_user on diet_settings (created_by) where is_deleted = false;
```

- [ ] **Step 2: Register the changeSet**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (after the last entry, `...create_character_tables`):

```yaml
  - changeSet:
      id: "1.0.0:202609021000_mezo-XXXX_create_diet_settings"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021000_mezo-XXXX_create_diet_settings.sql
```

- [ ] **Step 3: Write the entity + repository**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity/DietSettingsEntity.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** Diet preferences — one live row per owner (fuel_settings shape, partial-unique on created_by). */
@Getter
@Setter
@Entity
@Table(name = "diet_settings")
@SQLDelete(sql = "update diet_settings set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DietSettingsEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "split_preset", nullable = false, length = 16)
    private String splitPreset;

    /** Custom split fields, tenths of a percent — null unless splitPreset = custom. */
    @Min(0)
    @Max(1000)
    @Column(name = "protein_pct_x10")
    private Integer proteinPctX10;

    @Min(0)
    @Max(1000)
    @Column(name = "carbs_pct_x10")
    private Integer carbsPctX10;

    @Min(0)
    @Max(1000)
    @Column(name = "fat_pct_x10")
    private Integer fatPctX10;

    @NotNull
    @Column(name = "protein_tier", nullable = false, length = 16)
    private String proteinTier;

    @NotNull
    @Min(500)
    @Max(8000)
    @Column(name = "water_ml", nullable = false)
    private Integer waterMl;

    @NotNull
    @Min(10)
    @Max(80)
    @Column(name = "fiber_g", nullable = false)
    private Integer fiberG;
}
```

Create `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/repository/DietSettingsRepository.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.repository;

import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton config row (no 'date' base field) => extend JpaRepository directly, not OwnedRepository.
public interface DietSettingsRepository extends JpaRepository<DietSettingsEntity, UUID> {

    Optional<DietSettingsEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
```

- [ ] **Step 4: Verify the migration applies + entity maps**

```bash
cd backend && ./mvnw test -Dtest=FuelSettingsApiIT
```

Expected: PASS (any IT boots Liquibase against the test DB — a broken changeSet or entity/DDL mismatch fails at context startup).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/repository
git commit -m "feat(nutrition): diet_settings table + entity + repository (mezo-XXXX)"
```

---

### Task 3: Config — ghost properties, feature switch, engine split tunables

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/config/DietSettingsProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (~line 152, after `FUEL_SETTINGS_SWITCH`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java` (new nested `Diet` record)
- Modify: `backend/src/main/resources/application.yml` (three blocks)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/GoalEnginePropertiesIT.java` (extend)

**Interfaces:**
- Produces: `DietSettingsProperties(String defaultSplitPreset, String defaultProteinTier, int defaultWaterMl, int defaultFiberG)` bound from `mezo.diet-settings`; `GoalEngineProperties.diet()` → `Diet(Double fatShareBalanced, Double fatShareLowFat, Double fatShareLowCarb, Double fatShareHighCarb, Double fatFloorGPerKg)` with helper `fatShareFor(String preset, Integer fatPctX10)`; `FeaturesConfiguration.DIET_SETTINGS_SWITCH = "mezo.feature.diet-settings.enabled"`.

- [ ] **Step 1: Write the failing properties-binding assertion**

In `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/GoalEnginePropertiesIT.java`, add (match the file's existing assertion style — read it first; it asserts bound values from `application.yml`):

```java
    @Test
    void testDietSplitTunables_shouldBindFromYml() {
        assertThat(props.diet().fatShareBalanced()).isEqualTo(0.275);
        assertThat(props.diet().fatShareLowFat()).isEqualTo(0.20);
        assertThat(props.diet().fatShareLowCarb()).isEqualTo(0.40);
        assertThat(props.diet().fatShareHighCarb()).isEqualTo(0.22);
        assertThat(props.diet().fatFloorGPerKg()).isEqualTo(0.5);
        // preset resolution helper: custom uses the tenths-of-percent field, presets use config
        assertThat(props.diet().fatShareFor("balanced", null)).isEqualTo(0.275);
        assertThat(props.diet().fatShareFor("custom", 300)).isEqualTo(0.30);
        assertThat(props.diet().fatShareFor("unknown", null)).isEqualTo(0.275); // safe default
    }
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=GoalEnginePropertiesIT
```

Expected: COMPILE FAILURE — `diet()` not defined.

- [ ] **Step 3: Implement the config**

In `GoalEngineProperties.java`, add to the record header (after `ewma`, before `thermogenesisHaircutKcalPerDay`):

```java
    /** Diet-split tunables (slice 1): preset fat energy-shares + the fat g/kg floor. */
    @NotNull @Valid Diet diet,
```

and the nested record at the bottom (after `Ewma`):

```java
    /** Diet-split tunables. Fat share = fraction of segment kcal; floor per ISSN (~0.5 g/kg). */
    public record Diet(
        @NotNull @Positive Double fatShareBalanced, // 0.275 — reproduces the pre-slice-1 FE constant
        @NotNull @Positive Double fatShareLowFat,   // 0.20
        @NotNull @Positive Double fatShareLowCarb,  // 0.40
        @NotNull @Positive Double fatShareHighCarb, // 0.22
        @NotNull @Positive Double fatFloorGPerKg    // 0.5 — hormonal-health fat minimum
    ) {
        /** Fat energy-share for a preset; custom reads the request's tenths-of-percent; unknown → balanced. */
        public double fatShareFor(String preset, Integer fatPctX10) {
            if (preset == null) {
                return fatShareBalanced;
            }
            return switch (preset) {
                case "low_fat" -> fatShareLowFat;
                case "low_carb" -> fatShareLowCarb;
                case "high_carb" -> fatShareHighCarb;
                case "custom" -> fatPctX10 == null ? fatShareBalanced : fatPctX10 / 1000.0;
                default -> fatShareBalanced;
            };
        }
    }
```

Create `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/config/DietSettingsProperties.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Diet-settings ghost defaults (mezo.diet-settings) — served before the user saves (never 404). */
@Validated
@ConfigurationProperties(prefix = "mezo.diet-settings")
public record DietSettingsProperties(

    /** Split preset ghost — balanced reproduces the pre-slice-1 hardcoded 27.5% fat share. */
    @NotBlank
    String defaultSplitPreset,

    /** Protein tier ghost — moderate = the engine's existing 2.0 g/kg default path. */
    @NotBlank
    String defaultProteinTier,

    /** Water target ghost (ml) — equals the old mezo.nutrition.water so behavior is unchanged. */
    @Min(500) @Max(8000)
    int defaultWaterMl,

    /** Fiber target ghost (g) — equals the old FE FIBER_TARGET_G so behavior is unchanged. */
    @Min(10) @Max(80)
    int defaultFiberG
) {}
```

In `FeaturesConfiguration.java`, after `FUEL_SETTINGS_SWITCH` (line 152):

```java
    /** Diet preferences (Diet Plan slice 1) — macro split + protein tier + water/fiber singleton.
     *  Gates /api/diet/settings (the DietPreferencesResolver stays on — the engine always resolves). */
    public static final String DIET_SETTINGS_SWITCH = "mezo.feature.diet-settings.enabled";
```

In `application.yml`: under `mezo.feature` (after the `fuel-settings.enabled` block, ~line 246):

```yaml
    # Diet preferences (Diet Plan slice 1): macro split + protein tier + water/fiber singleton.
    diet-settings:
      enabled: true
```

after the `mezo.fuel-settings` ghost block (~line 1376):

```yaml
  # Diet-settings ghost defaults (Diet Plan slice 1). Binds onto DietSettingsProperties.
  diet-settings:
    default-split-preset: balanced
    default-protein-tier: moderate
    default-water-ml: 4000
    default-fiber-g: 30
```

and under `mezo.goal` (after the `ewma` block, ~line 92 — keep key order matching the record):

```yaml
    diet:
      # Preset fat energy-shares (fraction of segment kcal). balanced = the pre-slice-1 FE
      # FAT_KCAL_SHARE (0.275) so an unset diet_settings row changes nothing on deploy.
      fat-share-balanced: 0.275
      fat-share-low-fat: 0.20
      fat-share-low-carb: 0.40
      fat-share-high-carb: 0.22
      # ISSN fat minimum (g per kg body weight) — the engine floors prescribed fat here.
      fat-floor-g-per-kg: 0.5
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && ./mvnw test -Dtest=GoalEnginePropertiesIT
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java backend/src/main/resources/application.yml backend/src/test
git commit -m "feat(goal): diet split tunables + diet-settings ghost config (mezo-XXXX)"
```

---

### Task 4: `DietPreferencesResolver` (ungated) — the engine's preference source

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DietPreferences.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DietPreferencesResolver.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/DietPreferencesResolverIT.java`

**Interfaces:**
- Produces: `record DietPreferences(String splitPreset, Integer proteinPctX10, Integer carbsPctX10, Integer fatPctX10, String proteinTier, int waterMl, int fiberG)`; `DietPreferencesResolver.resolve(UUID userId): DietPreferences` (row → its values; no row → ghost). Ungated (no `@ConditionalOnProperty`) — the engine and FuelDayService must always resolve, exactly like the fuel caffeine resolver stays on.
- Consumes: Task 2 `DietSettingsRepository`, Task 3 `DietSettingsProperties`.

- [ ] **Step 1: Write the failing IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/DietPreferencesResolverIT.java` (mirror `AbstractIntegrationTest` usage from `GoalEvaluationServiceIT`; check `backend/src/test/java/io/mrkuhne/mezo/support/` for the owner-id helper — `DatabasePopulator`/populators expose the seeded owner; read `FuelSettingsPopulator.java` and copy its row-creation idiom for a `DietSettingsPopulator` if one is needed, or create the entity inline via the repository as below):

```java
package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import io.mrkuhne.mezo.feature.nutrition.service.DietPreferences;
import io.mrkuhne.mezo.feature.nutrition.service.DietPreferencesResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** The ungated preference source: saved row wins, config ghost otherwise (never null). */
@Transactional
class DietPreferencesResolverIT extends AbstractIntegrationTest {

    @Autowired private DietPreferencesResolver resolver;
    @Autowired private DietSettingsRepository repository;

    @Test
    void testResolve_shouldReturnConfigGhost_whenNoRow() {
        DietPreferences p = resolver.resolve(UUID.randomUUID());

        assertThat(p.splitPreset()).isEqualTo("balanced");
        assertThat(p.proteinTier()).isEqualTo("moderate");
        assertThat(p.waterMl()).isEqualTo(4000);
        assertThat(p.fiberG()).isEqualTo(30);
        assertThat(p.fatPctX10()).isNull();
    }

    @Test
    void testResolve_shouldReturnSavedRow_whenPresent() {
        UUID owner = ownerId(); // the seeded owner — see AbstractIntegrationTest/populator helpers
        DietSettingsEntity row = new DietSettingsEntity();
        row.setCreatedBy(owner);
        row.setSplitPreset("custom");
        row.setProteinPctX10(300);
        row.setCarbsPctX10(400);
        row.setFatPctX10(300);
        row.setProteinTier("high");
        row.setWaterMl(3500);
        row.setFiberG(35);
        repository.save(row);

        DietPreferences p = resolver.resolve(owner);

        assertThat(p.splitPreset()).isEqualTo("custom");
        assertThat(p.fatPctX10()).isEqualTo(300);
        assertThat(p.proteinTier()).isEqualTo("high");
        assertThat(p.waterMl()).isEqualTo(3500);
    }
}
```

(If `ownerId()` does not exist on `AbstractIntegrationTest`, look at how `FuelSettingsApiIT`'s sibling service ITs obtain the seeded owner UUID and use that idiom — do NOT invent a helper.)

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=DietPreferencesResolverIT
```

Expected: COMPILE FAILURE — resolver class missing.

- [ ] **Step 3: Implement**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DietPreferences.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.service;

/** Resolved diet preferences — a saved row's values or the config ghost; never null fields except the custom pcts. */
public record DietPreferences(
    String splitPreset,
    Integer proteinPctX10,
    Integer carbsPctX10,
    Integer fatPctX10,
    String proteinTier,
    int waterMl,
    int fiberG
) {}
```

Create `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DietPreferencesResolver.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.nutrition.config.DietSettingsProperties;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The single diet-preference derivation — deliberately UN-gated (the fuel-settings caffeine-resolver
 * idiom): the goal engine and the fuel-day targets must always resolve preferences, feature switch
 * or not. No row → the config ghost, which reproduces pre-slice-1 behavior exactly.
 */
@Service
@RequiredArgsConstructor
public class DietPreferencesResolver {

    private final DietSettingsRepository repository;
    private final DietSettingsProperties properties;

    public DietPreferences resolve(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(e -> new DietPreferences(e.getSplitPreset(), e.getProteinPctX10(), e.getCarbsPctX10(),
                e.getFatPctX10(), e.getProteinTier(), e.getWaterMl(), e.getFiberG()))
            .orElseGet(() -> new DietPreferences(properties.defaultSplitPreset(), null, null, null,
                properties.defaultProteinTier(), properties.defaultWaterMl(), properties.defaultFiberG()));
    }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && ./mvnw test -Dtest=DietPreferencesResolverIT
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/nutrition backend/src/test/java/io/mrkuhne/mezo/feature/nutrition
git commit -m "feat(nutrition): DietPreferencesResolver — ungated row-or-ghost source (mezo-XXXX)"
```

---

### Task 5: Engine — per-segment carbsG/fatG assembly + protein tier

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalPrescriptionJson.java` (Segment record + two fields)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationService.java` (assemble + proteinTargetGrams)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java` (resolve + pass prefs)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/mapper/GoalMapper.java` (`toSegments` projects the two fields)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java` (extend)

**Interfaces:**
- Consumes: Task 4 `DietPreferencesResolver.resolve(UUID): DietPreferences`; Task 3 `props.diet().fatShareFor(String, Integer)` + `props.diet().fatFloorGPerKg()`.
- Produces: `GoalPrescriptionJson.Segment` gains `Integer carbsG, Integer fatG` (positionally AFTER `proteinG`, BEFORE `sleepTargetH` — update ALL constructor call sites); `GoalEvaluationService.assemble(GoalEntity, BigDecimal weightKg, BigDecimal bodyFatPct, List<ProjectionSegment>, GuardStatus, DietPreferences prefs)` (new last param); `proteinTargetGrams(BigDecimal weightKg, BigDecimal bodyFatPct, String proteinTier)` — `high` uses `props.protein().gPerKgBwCeil()` (2.2) as the BW base instead of `gPerKgBwDefault()` (2.0), LBM path + cap unchanged; package-private `int fatTargetGrams(int segmentKcal, BigDecimal weightKg, DietPreferences prefs)` and `int carbsTargetGrams(int segmentKcal, int proteinG, int fatG)`.

- [ ] **Step 1: Write the failing IT assertions**

Add to `GoalEvaluationServiceIT.java` (read its existing tests first for the populator seeding idiom — the goal window, profile, weigh-in are seeded by the populators listed in its `@Autowired` fields; append tests reusing the same seeding as its existing prescription test):

```java
    @Test
    void testAssemble_shouldPrescribeCarbsAndFat_fromBalancedGhost() {
        // Seed exactly like the existing prescription test (goal + profile + weigh-in), then:
        GoalPrescriptionJson rx = engine.evaluate(ownerId, goalId);

        GoalPrescriptionJson.Segment seg = rx.segments().get(0);
        // balanced ghost: fat = max(0.275×kcal/9, 0.5 g/kg×weight); carbs = (kcal−4p−9f)/4, ≥0
        int expectedFat = (int) Math.round(Math.max(seg.kcal() * 0.275 / 9.0, 0.5 * 84)); // 84 = seeded weight class
        assertThat(seg.fatG()).isEqualTo(expectedFat);
        assertThat(seg.carbsG())
            .isEqualTo(Math.max(0, Math.round((seg.kcal() - 4 * seg.proteinG() - 9 * seg.fatG()) / 4.0f)));
    }
```

(Adapt `ownerId`/`goalId`/the seeded 84 kg to the file's actual local variable names + populator values — copy the arrange block of the existing feasible-prescription test verbatim.)

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=GoalEvaluationServiceIT
```

Expected: COMPILE FAILURE — `seg.fatG()` not defined.

- [ ] **Step 3: Implement**

`GoalPrescriptionJson.Segment` — insert after `proteinG`:

```java
    public record Segment(
        Integer fromWeek,
        Integer toWeek,
        String label,
        Integer kcal,
        Integer proteinG,
        Integer carbsG,   // prescribed carbs (g) — split remainder; null on pre-slice-1 prescriptions
        Integer fatG,     // prescribed fat (g) — split share floored at fat-floor g/kg; null on pre-slice-1 prescriptions
        BigDecimal sleepTargetH,
        List<Integer> restDays,
        BigDecimal projectedRateKgPerWk,
        Integer dailyEnergyBalanceKcal,
        String rationale
    ) {
    }
```

`GoalEvaluationService` — new imports `io.mrkuhne.mezo.feature.nutrition.service.DietPreferences`; change `assemble` signature and the loop:

```java
    public GoalPrescriptionJson assemble(
        GoalEntity goal,
        BigDecimal weightKg,
        BigDecimal bodyFatPct,
        List<ProjectionSegment> segments,
        GuardStatus guards,
        DietPreferences prefs) {

        Feasibility feasibility = grade(goal, segments, guards);
        int proteinG = proteinTargetGrams(weightKg, bodyFatPct, prefs.proteinTier());

        List<Segment> rxSegments = new ArrayList<>(segments.size());
        for (ProjectionSegment seg : segments) {
            int kcal = seg.targetKcal().setScale(0, RoundingMode.HALF_UP).intValueExact();
            int fatG = fatTargetGrams(kcal, weightKg, prefs);
            int carbsG = carbsTargetGrams(kcal, proteinG, fatG);
            rxSegments.add(new Segment(
                seg.fromWeek(),
                seg.toWeek(),
                seg.label(),
                kcal,
                proteinG,
                carbsG,
                fatG,
                DEFAULT_SLEEP_TARGET_H,
                List.of(), // rest-day placement is a future Train bridge (no deload weeks derivable here).
                seg.projectedRateKgPerWk(),
                seg.dailyEnergyBalanceKcal(),
                seg.rationale()));
        }

        return new GoalPrescriptionJson(
            OffsetDateTime.now(), BASIS_FORMULA, rxSegments, guards, feasibility);
    }

    /**
     * Prescribed fat (g): the split's fat energy-share of the segment kcal, floored at the ISSN
     * fat minimum (fat-floor g/kg × body weight). A custom split's fat% obeys the same floor.
     */
    int fatTargetGrams(int segmentKcal, BigDecimal weightKg, DietPreferences prefs) {
        double share = props.diet().fatShareFor(prefs.splitPreset(), prefs.fatPctX10());
        double shareGrams = segmentKcal * share / 9.0;
        double floorGrams = props.diet().fatFloorGPerKg() * weightKg.doubleValue();
        return (int) Math.round(Math.max(shareGrams, floorGrams));
    }

    /** Prescribed carbs (g): the energy remainder after protein + fat — never negative. The custom
     *  split's protein/carb %s are advisory: the g/kg protein target wins, carbs absorb the delta. */
    int carbsTargetGrams(int segmentKcal, int proteinG, int fatG) {
        return Math.max(0, Math.round((segmentKcal - 4f * proteinG - 9f * fatG) / 4f));
    }
```

`proteinTargetGrams` — tier-aware BW base (LBM path + cap unchanged):

```java
    int proteinTargetGrams(BigDecimal weightKg, BigDecimal bodyFatPct, String proteinTier) {
        double gPerKgBw = "high".equals(proteinTier)
            ? props.protein().gPerKgBwCeil() : props.protein().gPerKgBwDefault();
        BigDecimal bwTarget = BigDecimal.valueOf(gPerKgBw).multiply(weightKg);
        BigDecimal target = bwTarget;
        if (bodyFatPct != null) {
            BigDecimal lbm = weightKg.multiply(
                BigDecimal.ONE.subtract(bodyFatPct.divide(ONE_HUNDRED, 6, RoundingMode.HALF_UP)));
            BigDecimal lbmTarget = BigDecimal.valueOf(props.protein().gPerKgLbmHigh()).multiply(lbm);
            target = target.max(lbmTarget);
        }
        BigDecimal cap = BigDecimal.valueOf(props.protein().gPerKgBwCap()).multiply(weightKg);
        return target.min(cap).setScale(0, RoundingMode.HALF_UP).intValueExact();
    }
```

`GoalEngineService` — inject + pass (import `io.mrkuhne.mezo.feature.nutrition.service.DietPreferencesResolver`; this cross-feature direct injection mirrors the existing `WeeklyScheduledActivityService` consumption):

```java
    private final DietPreferencesResolver dietPreferences;
```

and in `evaluate`, replace the assemble call:

```java
        GoalPrescriptionJson rx = evaluationService.assemble(
            goal, currentWeightKg, profile.getBodyFatPct(), segments, guards,
            dietPreferences.resolve(userId));
```

`GoalMapper.toSegments` — add after `.proteinG(s.proteinG())`:

```java
            .carbsG(s.carbsG())
            .fatG(s.fatG())
```

Also fix any other `new Segment(` call sites (search: `grep -rn "new Segment(" backend/src` and `grep -rn "new GoalPrescriptionJson.Segment(" backend/src` — test fixtures included) to pass the two new arguments in position.

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && ./mvnw test -Dtest=GoalEvaluationServiceIT
./mvnw test -Dtest=GoalEngineRecomputeIT
```

Expected: BOTH PASS (recompute IT proves old call paths survive the signature change).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(goal): engine prescribes per-segment carbsG/fatG + protein tier (mezo-XXXX)"
```

---

### Task 6: Gated HTTP surface — `DietSettingsService` + controller + recompute trigger

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DietSettingsService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/controller/DietSettingsController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/DietSettingsApiIT.java`

**Interfaces:**
- Consumes: Task 1 generated `DietSettingsApi`, `DietSettingsResponse`, `SetDietSettingsRequest`; Task 2 repository/entity; Task 4 resolver (for GET); `GoalEngineService.evaluate(UUID, UUID)` + `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(UUID, String)` (the `WeightLogService.recomputeActiveGoal` idiom).
- Produces: `DietSettingsService.getSettings(UUID): DietSettingsResponse`, `setSettings(UUID, SetDietSettingsRequest): DietSettingsResponse` — save re-evaluates the active goal in the same transaction (the 7th recompute trigger).

- [ ] **Step 1: Write the failing API IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/DietSettingsApiIT.java` (mirror `FuelSettingsApiIT`):

```java
package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the generated {@code DietSettingsApi} contract. */
class DietSettingsApiIT extends ApiIntegrationTest {

    @Test
    void testGetDietSettings_shouldReturnConfigDefaultGhost_whenNoneSet() {
        DietSettingsResponse s =
            getForBody("/api/diet/settings", ownerAuthHeaders(), HttpStatus.OK, DietSettingsResponse.class);

        assertThat(s.getSplitPreset()).isEqualTo(DietSettingsResponse.SplitPresetEnum.BALANCED);
        assertThat(s.getProteinTier()).isEqualTo(DietSettingsResponse.ProteinTierEnum.MODERATE);
        assertThat(s.getWaterMl()).isEqualTo(4000);
        assertThat(s.getFiberG()).isEqualTo(30);
    }

    @Test
    void testSetDietSettings_shouldUpsertSingleRow_whenSavedTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/diet/settings",
            SetDietSettingsRequest.builder()
                .splitPreset(SetDietSettingsRequest.SplitPresetEnum.LOW_CARB)
                .proteinTier(SetDietSettingsRequest.ProteinTierEnum.HIGH)
                .waterMl(3500).fiberG(35).build(),
            auth, HttpStatus.OK, DietSettingsResponse.class);
        DietSettingsResponse second = putForBody("/api/diet/settings",
            SetDietSettingsRequest.builder()
                .splitPreset(SetDietSettingsRequest.SplitPresetEnum.CUSTOM)
                .proteinPctX10(300).carbsPctX10(400).fatPctX10(300)
                .proteinTier(SetDietSettingsRequest.ProteinTierEnum.MODERATE)
                .waterMl(4000).fiberG(30).build(),
            auth, HttpStatus.OK, DietSettingsResponse.class);

        assertThat(second.getSplitPreset()).isEqualTo(DietSettingsResponse.SplitPresetEnum.CUSTOM);
        assertThat(second.getFatPctX10()).isEqualTo(300);

        DietSettingsResponse read =
            getForBody("/api/diet/settings", auth, HttpStatus.OK, DietSettingsResponse.class);
        assertThat(read.getSplitPreset()).isEqualTo(DietSettingsResponse.SplitPresetEnum.CUSTOM);
    }

    @Test
    void testSetDietSettings_shouldReturn400_whenCustomSplitDoesNotSumTo1000() {
        SetDietSettingsRequest bad = SetDietSettingsRequest.builder()
            .splitPreset(SetDietSettingsRequest.SplitPresetEnum.CUSTOM)
            .proteinPctX10(300).carbsPctX10(300).fatPctX10(300) // 900 ≠ 1000
            .proteinTier(SetDietSettingsRequest.ProteinTierEnum.MODERATE)
            .waterMl(4000).fiberG(30).build();

        putForBody("/api/diet/settings", bad, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testDietSettingsEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/diet/settings", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
```

(Builder/enum names come from the generated DTOs — if the generator emitted different enum constant casing, `./mvnw generate-sources` then check `backend/target/generated-sources/openapi/.../dto/DietSettingsResponse.java` and adjust.)

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=DietSettingsApiIT
```

Expected: FAIL — 404 (no controller bean yet).

- [ ] **Step 3: Implement service + controller**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DietSettingsService.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.DIET_SETTINGS_SWITCH, havingValue = "true")
public class DietSettingsService {

    private static final String STATUS_ACTIVE = "active";
    private static final String PRESET_CUSTOM = "custom";
    private static final int PCT_X10_TOTAL = 1000;

    private final DietSettingsRepository repository;
    private final DietPreferencesResolver resolver;
    private final GoalRepository goalRepository;
    private final GoalEngineService goalEngineService;

    /** Config-default ghost when unset — never 404: the split always resolves. */
    public DietSettingsResponse getSettings(UUID userId) {
        return compose(resolver.resolve(userId));
    }

    @Transactional
    public DietSettingsResponse setSettings(UUID userId, SetDietSettingsRequest req) {
        validateCustomSplit(req);
        DietSettingsEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                DietSettingsEntity e = new DietSettingsEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        boolean custom = PRESET_CUSTOM.equals(req.getSplitPreset().getValue());
        row.setSplitPreset(req.getSplitPreset().getValue());
        row.setProteinPctX10(custom ? req.getProteinPctX10() : null);
        row.setCarbsPctX10(custom ? req.getCarbsPctX10() : null);
        row.setFatPctX10(custom ? req.getFatPctX10() : null);
        row.setProteinTier(req.getProteinTier().getValue());
        row.setWaterMl(req.getWaterMl());
        row.setFiberG(req.getFiberG());
        repository.save(row);
        // The split moved (Diet Plan slice 1 — the 7th recompute trigger): re-prescribe the owner's
        // ACTIVE goal so segments carry the new carbsG/fatG. No active goal → skip gracefully.
        recomputeActiveGoal(userId);
        return compose(resolver.resolve(userId));
    }

    /** Custom split must sum to exactly 100.0% (all three fields present). */
    private static void validateCustomSplit(SetDietSettingsRequest req) {
        if (!PRESET_CUSTOM.equals(req.getSplitPreset().getValue())) {
            return;
        }
        Integer p = req.getProteinPctX10();
        Integer c = req.getCarbsPctX10();
        Integer f = req.getFatPctX10();
        if (p == null || c == null || f == null || p + c + f != PCT_X10_TOTAL) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("DIET_SPLIT_SUM_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
    }

    /** Recompute the owner's single active goal (if any) — the WeightLogService idiom. */
    private void recomputeActiveGoal(UUID userId) {
        List<GoalEntity> active =
            goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE);
        if (active.isEmpty()) {
            return;
        }
        goalEngineService.evaluate(userId, active.get(0).getId());
    }

    private static DietSettingsResponse compose(DietPreferences p) {
        return DietSettingsResponse.builder()
            .splitPreset(DietSettingsResponse.SplitPresetEnum.fromValue(p.splitPreset()))
            .proteinPctX10(p.proteinPctX10())
            .carbsPctX10(p.carbsPctX10())
            .fatPctX10(p.fatPctX10())
            .proteinTier(DietSettingsResponse.ProteinTierEnum.fromValue(p.proteinTier()))
            .waterMl(p.waterMl())
            .fiberG(p.fiberG())
            .build();
    }
}
```

(`SystemMessage.error(...)` key: check `techcore/exception/SystemMessage.java` usage in `GoalEngineService` — same builder chain. If message keys must be registered in a catalog/enum, register `DIET_SPLIT_SUM_INVALID` the same way existing `TRAIN_MUSCLE_PRIORITY_TIER_INVALID` is.)

Create `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/controller/DietSettingsController.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.controller;

import io.mrkuhne.mezo.api.controller.DietSettingsApi;
import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.nutrition.service.DietSettingsService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/diet/settings surface (Diet Plan slice 1) — mappings come from the generated {@link DietSettingsApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.DIET_SETTINGS_SWITCH, havingValue = "true")
public class DietSettingsController implements DietSettingsApi {

    private final DietSettingsService service;
    private final CurrentUserId currentUserId;

    @Override
    public DietSettingsResponse getDietSettings() {
        return service.getSettings(currentUserId.get());
    }

    @Override
    public DietSettingsResponse setDietSettings(SetDietSettingsRequest setDietSettingsRequest) {
        return service.setSettings(currentUserId.get(), setDietSettingsRequest);
    }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && ./mvnw test -Dtest=DietSettingsApiIT
```

Expected: PASS (4 tests).

- [ ] **Step 5: Write + run the recompute-trigger IT**

Add to `DietSettingsApiIT` (or extend `GoalEngineRecomputeIT` if its seeding fits better — read it first; it already proves weigh-in triggers re-evaluate, copy that arrangement):

```java
    @Test
    void testSetDietSettings_shouldReprescribeActiveGoal_withNewSplit() {
        HttpHeaders auth = ownerAuthHeaders();
        // Arrange an ACTIVE evaluated goal exactly the way GoalEngineRecomputeIT does (populators).
        // Act: switch to low_carb (fat share 0.40).
        putForBody("/api/diet/settings",
            SetDietSettingsRequest.builder()
                .splitPreset(SetDietSettingsRequest.SplitPresetEnum.LOW_CARB)
                .proteinTier(SetDietSettingsRequest.ProteinTierEnum.MODERATE)
                .waterMl(4000).fiberG(30).build(),
            auth, HttpStatus.OK, DietSettingsResponse.class);
        // Assert: the active goal's prescription segments now carry fatG ≈ 0.40×kcal/9 (≥ floor).
        GoalEntity goal = goalRepository
            .findByCreatedByAndStatusAndDeletedFalse(ownerId, "active").get(0);
        GoalPrescriptionJson.Segment seg = goal.getPrescription().segments().get(0);
        assertThat(seg.fatG())
            .isEqualTo((int) Math.round(Math.max(seg.kcal() * 0.40 / 9.0, 0.5 * seededWeightKg)));
    }
```

```bash
cd backend && ./mvnw test -Dtest=DietSettingsApiIT
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(nutrition): /api/diet/settings surface + save re-prescribes the active goal (mezo-XXXX)"
```

---

### Task 7: `FuelDayService.targetSet` serves prescribed carbs/fat + preference water

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java:97-110`
- Test: existing fuel-day IT (find it: `grep -rln "fuel-day\|FuelDay" backend/src/test --include="*.java"`) — extend

**Interfaces:**
- Consumes: Task 5 `Segment.carbsG()/fatG()`; Task 4 `DietPreferencesResolver.resolve(UUID).waterMl()`.
- Produces: `targetSet(GoalEntity goal, LocalDate date, UUID userId)` — c/f prefer the covering segment, water prefers the resolved preference; `NutritionTargetsProperties` stays the per-field fallback.

- [ ] **Step 1: Write the failing IT**

In the fuel-day IT class (e.g. the one covering `GET /api/meal/fuel-day` — locate via the grep above), add a test that seeds an active evaluated goal (same populator arrangement as `GoalEvaluationServiceIT`) and asserts the day response's `targets.c`/`targets.f` equal the covering segment's `carbsG`/`fatG` (not 380/95), and that with NO goal the values remain 380/95/4000.

```java
    @Test
    void testFuelDayTargets_shouldServePrescribedCarbsFat_whenSegmentCovers() {
        // arrange: active evaluated goal covering today (GoalEvaluationServiceIT seeding idiom)
        FuelDayResponse day = getForBody("/api/meal/fuel-day?date=" + coveredDate,
            ownerAuthHeaders(), HttpStatus.OK, FuelDayResponse.class);

        GoalPrescriptionJson.Segment seg = seededGoal.getPrescription().segments().get(0);
        assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(seg.carbsG()));
        assertThat(day.getTargets().getF()).isEqualByComparingTo(BigDecimal.valueOf(seg.fatG()));
    }
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=<TheFuelDayITClass>
```

Expected: FAIL — c is 380 (config), not the segment value.

- [ ] **Step 3: Implement**

In `FuelDayService`, inject the resolver and thread `userId` into `targetSet` (both call sites — `getDay` line 53 passes `userId`, `getWeek` line 71 likewise):

```java
    private final DietPreferencesResolver dietPreferences;
```

```java
    private MacroSet targetSet(GoalEntity goal, LocalDate date, UUID userId) {
        GoalPrescriptionJson.Segment seg = null;
        if (goal != null && goal.getStartDate() != null) {
            long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
            seg = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        }
        int waterMl = dietPreferences.resolve(userId).waterMl();
        return MacroSet.builder()
            .kcal(BigDecimal.valueOf(seg != null && seg.kcal() != null ? seg.kcal() : targets.kcal()))
            .p(BigDecimal.valueOf(seg != null && seg.proteinG() != null ? seg.proteinG() : targets.p()))
            .c(BigDecimal.valueOf(seg != null && seg.carbsG() != null ? seg.carbsG() : targets.c()))
            .f(BigDecimal.valueOf(seg != null && seg.fatG() != null ? seg.fatG() : targets.f()))
            .water(BigDecimal.valueOf(waterMl))
            .build();
    }
```

For `getWeek`, resolve preferences ONCE before the 7-day loop (avoid 7 identical queries): fetch `int waterMl = dietPreferences.resolve(userId).waterMl();` outside and pass it in — refactor `targetSet(GoalEntity, LocalDate, int waterMl)` instead if cleaner; keep ONE shape for both call sites. Update the class javadoc line "Carbs/fat/water are not prescribed" to reflect the new source order.

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && ./mvnw test -Dtest=<TheFuelDayITClass>
```

Expected: PASS (new + existing tests — existing no-goal fallback tests must still see 380/95/4000).

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(meal): fuel-day targets serve prescribed carbs/fat + preference water (mezo-XXXX)"
```

---

### Task 8: FE data layer — types, api, hooks, mock fixtures, drift guard

**Files:**
- Modify: `frontend/src/data/types.ts` (after `FuelSettings`, ~line 58)
- Create: `frontend/src/data/fuel/dietSettingsApi.ts`
- Create: `frontend/src/data/fuel/dietSettingsHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel export, near line 44)
- Modify: `frontend/src/data/fuel/fuelConfig.ts` (add `DIET_SPLIT_PRESETS`)
- Modify: `frontend/src/data/me/goals.ts` (mock segments gain `carbsG`/`fatG`)
- Test: `frontend/src/data/fuel/dietSplitDriftGuard.test.ts`

**Interfaces:**
- Consumes: Task 1 generated types `components['schemas']['DietSettingsResponse'|'SetDietSettingsRequest']`.
- Produces: `interface DietSettings { splitPreset: 'balanced'|'low_fat'|'low_carb'|'high_carb'|'custom'; proteinPctX10: number|null; carbsPctX10: number|null; fatPctX10: number|null; proteinTier: 'moderate'|'high'; waterMl: number; fiberG: number }`; `DIET_SETTINGS_GHOST: DietSettings`; `useDietSettings(): { settings: DietSettings; isPending: boolean }`; `useDietSettingsActions(): { setSettings(s: DietSettings): Promise<void>; pending: boolean }`; `DIET_SPLIT_PRESETS: Record<'balanced'|'low_fat'|'low_carb'|'high_carb', number>` (fat kcal shares).

- [ ] **Step 1: Write the failing drift-guard test**

Create `frontend/src/data/fuel/dietSplitDriftGuard.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'
import { DIET_SPLIT_PRESETS } from '@/data/fuel/fuelConfig'
import { DIET_SETTINGS_GHOST } from '@/data/fuel/dietSettingsHooks'

// DRIFT-GUARD (Diet Plan slice 1): these MUST match backend `mezo.goal.diet` + `mezo.diet-settings`
// in application.yml. If you change one side, change the other — this test is the tripwire.
const BACKEND_FAT_SHARES = { balanced: 0.275, low_fat: 0.2, low_carb: 0.4, high_carb: 0.22 }
const BACKEND_GHOST = {
  splitPreset: 'balanced', proteinPctX10: null, carbsPctX10: null, fatPctX10: null,
  proteinTier: 'moderate', waterMl: 4000, fiberG: 30,
}

describe('diet split FE↔backend drift-guard', () => {
  test('fuelConfig.DIET_SPLIT_PRESETS mirrors mezo.goal.diet fat shares', () => {
    expect(DIET_SPLIT_PRESETS).toEqual(BACKEND_FAT_SHARES)
  })
  test('DIET_SETTINGS_GHOST mirrors the mezo.diet-settings config ghost', () => {
    expect(DIET_SETTINGS_GHOST).toEqual(BACKEND_GHOST)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && pnpm vitest run src/data/fuel/dietSplitDriftGuard.test.ts
```

Expected: FAIL — imports unresolved.

- [ ] **Step 3: Implement the data layer**

`frontend/src/data/types.ts`, after the `FuelSettings` interface:

```typescript
/** Diet preferences (Diet Plan slice 1) — macro split + protein tier + water/fiber, per-user singleton. */
export interface DietSettings {
  splitPreset: 'balanced' | 'low_fat' | 'low_carb' | 'high_carb' | 'custom'
  proteinPctX10: number | null
  carbsPctX10: number | null
  fatPctX10: number | null
  proteinTier: 'moderate' | 'high'
  waterMl: number
  fiberG: number
}
```

`frontend/src/data/fuel/fuelConfig.ts`, after `FAT_KCAL_SHARE`:

```typescript
// Diet split presets (Diet Plan slice 1) — fat energy-shares mirroring backend `mezo.goal.diet`
// (dietSplitDriftGuard.test.ts is the tripwire). FAT_KCAL_SHARE above stays as the no-segment fallback.
export const DIET_SPLIT_PRESETS: Record<'balanced' | 'low_fat' | 'low_carb' | 'high_carb', number> = {
  balanced: 0.275, low_fat: 0.2, low_carb: 0.4, high_carb: 0.22,
}
```

Create `frontend/src/data/fuel/dietSettingsApi.ts`:

```typescript
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { DietSettings } from '@/data/types'

type DietSettingsResponse = components['schemas']['DietSettingsResponse']
type SetDietSettingsRequest = components['schemas']['SetDietSettingsRequest']

const fromWire = (r: DietSettingsResponse): DietSettings => ({
  splitPreset: r.splitPreset,
  proteinPctX10: r.proteinPctX10 ?? null,
  carbsPctX10: r.carbsPctX10 ?? null,
  fatPctX10: r.fatPctX10 ?? null,
  proteinTier: r.proteinTier,
  waterMl: r.waterMl,
  fiberG: r.fiberG,
})

export const dietSettingsApi = {
  get: (): Promise<DietSettings> =>
    apiFetch<DietSettingsResponse>('/api/diet/settings').then(fromWire),
  set: (settings: DietSettings): Promise<DietSettings> =>
    apiFetch<DietSettingsResponse>('/api/diet/settings', {
      method: 'PUT',
      body: JSON.stringify({
        splitPreset: settings.splitPreset,
        proteinPctX10: settings.proteinPctX10 ?? undefined,
        carbsPctX10: settings.carbsPctX10 ?? undefined,
        fatPctX10: settings.fatPctX10 ?? undefined,
        proteinTier: settings.proteinTier,
        waterMl: settings.waterMl,
        fiberG: settings.fiberG,
      } satisfies SetDietSettingsRequest),
    }).then(fromWire),
}
```

Create `frontend/src/data/fuel/dietSettingsHooks.ts` (mirror `fuelSettingsHooks.ts` exactly, including the mock-mode cache-patch write and the invalidations — the day plan must re-derive):

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { dietSettingsApi } from '@/data/fuel/dietSettingsApi'
import type { DietSettings } from '@/data/types'

/** The backend's config-default ghost — the honest value in BOTH modes before a save. */
export const DIET_SETTINGS_GHOST: DietSettings = {
  splitPreset: 'balanced', proteinPctX10: null, carbsPctX10: null, fatPctX10: null,
  proteinTier: 'moderate', waterMl: 4000, fiberG: 30,
}

export function useDietSettings() {
  const { data, isPending } = useDualQuery<DietSettings>({
    queryKey: ['dietSettings'],
    mockData: DIET_SETTINGS_GHOST,
    realFetch: dietSettingsApi.get,
    realEmpty: DIET_SETTINGS_GHOST,
  })
  return { settings: data, isPending }
}

export function useDietSettingsActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (settings: DietSettings) => {
      if (mock) {
        qc.setQueryData<DietSettings>(['dietSettings'], settings)
        return
      }
      await dietSettingsApi.set(settings)
    },
    onSuccess: mock ? undefined : () => {
      qc.invalidateQueries({ queryKey: ['dietSettings'] })
      qc.invalidateQueries({ queryKey: ['goals'] })    // save re-prescribed the active goal (carbsG/fatG)
      qc.invalidateQueries({ queryKey: ['fuelDay'] })  // day targets changed with the split
    },
  })
  return {
    setSettings: (s: DietSettings) => mutation.mutateAsync(s).then(() => undefined),
    pending: mutation.isPending,
  }
}
```

(Verify the actual query keys for goals/fuel-day: `grep -rn "queryKey" frontend/src/data/me/goalHooks.ts frontend/src/data/fuel/ | grep -i "goal\|fuelDay"` — use the keys those hooks actually register, not guesses.)

`frontend/src/data/hooks.ts`, after the fuelSettings line:

```typescript
export { useDietSettings, useDietSettingsActions, DIET_SETTINGS_GHOST } from '@/data/fuel/dietSettingsHooks'
```

`frontend/src/data/me/goals.ts` — the two mock segments gain the derived values (balanced 0.275; f = round(kcal×0.275/9), c = round((kcal−4p−9f)/4)):

```typescript
      // segment 1 (kcal 2150, proteinG 163): add
        carbsG: 226,
        fatG: 66,
      // segment 2 (kcal 2380, proteinG 155): add
        carbsG: 276,
        fatG: 73,
```

(Insert each pair right after that segment's `proteinG:` line, matching the wire field order.)

- [ ] **Step 4: Run to verify it passes (both modes)**

```bash
cd frontend && pnpm vitest run src/data/fuel/dietSplitDriftGuard.test.ts
VITE_USE_MOCK=true pnpm vitest run src/data/fuel/dietSplitDriftGuard.test.ts
```

Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(fuel): dietSettings data layer + mock segment carbsG/fatG + drift guard (mezo-XXXX)"
```

---

### Task 9: FE budget — `deriveDailyBudget` uses segment fatG/carbsG; fiber target from settings

**Files:**
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts:133-162`
- Modify: `frontend/src/features/fuel/logic/keretHero.ts` (fiber ring target parameterized)
- Modify: `frontend/src/data/fuel/timelineHooks.ts` (wire segment c/f + dietSettings fiber through)
- Test: `frontend/src/features/fuel/logic/buildDayPlan.test.ts` (extend — find the exact test file: `ls frontend/src/features/fuel/logic/*.test.ts`)

**Interfaces:**
- Consumes: Task 8 `useDietSettings`; segment wire fields `carbsG?`/`fatG?` (Task 1 types).
- Produces: `deriveDailyBudget(segment: { kcal: number; proteinG: number; carbsG?: number | null; fatG?: number | null; dailyEnergyBalanceKcal?: number } | null, fallback: MacroSet, energy?: EnergyInputs): DayBudget` — fat prefers `segment.fatG`, falls back to `FAT_KCAL_SHARE`; carbs stay the remainder-absorber formula in the dynamic path and prefer `segment.carbsG` in the static path. `buildKeretHero` input gains `fiberTargetG: number`.

- [ ] **Step 1: Write the failing tests**

In the buildDayPlan test file, add:

```typescript
test('deriveDailyBudget prefers the segment fatG over FAT_KCAL_SHARE', () => {
  const segment = { kcal: 2150, proteinG: 163, carbsG: 226, fatG: 90, dailyEnergyBalanceKcal: -516 }
  const fallback = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  // static path (no energy inputs): f from segment, c from segment
  const staticBudget = deriveDailyBudget(segment, fallback)
  expect(staticBudget.f).toBe(90)
  expect(staticBudget.c).toBe(226)
  // dynamic path: fat stays the segment's, carbs absorb the activity bonus
  const dyn = deriveDailyBudget(segment, fallback, { bmr: 1720, neat: 1.2, weightKg: 84, blocks: [] })
  expect(dyn.f).toBe(90)
  expect(dyn.c).toBe(Math.max(0, Math.round((dyn.kcal - 163 * 4 - 90 * 9) / 4)))
})

test('deriveDailyBudget keeps the FAT_KCAL_SHARE fallback for pre-slice-1 segments', () => {
  const segment = { kcal: 2150, proteinG: 163, dailyEnergyBalanceKcal: -516 } // no carbsG/fatG
  const fallback = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  const budget = deriveDailyBudget(segment, fallback)
  expect(budget.f).toBe(Math.round((2150 * 0.275) / 9)) // 66 — unchanged legacy behavior
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd frontend && pnpm vitest run src/features/fuel/logic/buildDayPlan.test.ts
```

Expected: FAIL — first test's `f` is 66 (share formula), not 90.

- [ ] **Step 3: Implement**

In `buildDayPlan.ts`, `deriveDailyBudget` (types + two lines):

```typescript
export function deriveDailyBudget(
  segment: { kcal: number; proteinG: number; carbsG?: number | null; fatG?: number | null; dailyEnergyBalanceKcal?: number } | null,
  fallback: MacroSet,
  energy?: EnergyInputs,
): DayBudget {
  const baseKcal = segment?.kcal ?? fallback.kcal
  const proteinG = segment?.proteinG ?? fallback.p
  // Prescribed fat wins (Diet Plan slice 1); FAT_KCAL_SHARE remains the pre-slice-1 fallback.
  const fat = segment?.fatG ?? Math.round((baseKcal * FAT_KCAL_SHARE) / 9)
  const carbs = (kcal: number) => Math.max(0, Math.round((kcal - proteinG * 4 - fat * 9) / 4))

  if (!energy || energy.bmr == null || energy.neat == null) {
    if (!segment) {
      return { kcal: fallback.kcal, p: fallback.p, c: fallback.c, f: fallback.f, energy: { base: fallback.kcal, activity: 0, balance: 0, target: fallback.kcal } }
    }
    return { kcal: baseKcal, p: proteinG, c: segment.carbsG ?? carbs(baseKcal), f: fat, energy: { base: baseKcal, activity: 0, balance: 0, target: baseKcal } }
  }
  const balance = segment?.dailyEnergyBalanceKcal ?? 0
  const maintenance = energy.bmr * energy.neat
  const eat = activityKcal(energy.blocks, energy.weightKg)
  const target = Math.max(energy.bmr, maintenance + eat + balance) // KCAL_FLOOR = BMR
  return {
    kcal: Math.round(target),
    p: proteinG,
    c: carbs(target), // carbs stay the absorber of the day's activity bonus, off the prescribed fat
    f: fat,
    energy: { base: Math.round(maintenance), activity: Math.round(eat), balance: Math.round(balance), target: Math.round(target) },
  }
}
```

In `keretHero.ts`: add `fiberTargetG: number` to the input interface (next to `water`), replace `FIBER_TARGET_G` at the ring call (line 89) with `input.fiberTargetG` (adjust to the local destructuring style — `const { …, fiberTargetG } = input`), keep the `FIBER_TARGET_G` import only if still used as a default elsewhere; update the line-82 comment (the target now comes from diet settings).

In `timelineHooks.ts`: `const { settings: dietSettings } = useDietSettings()` (import from `@/data/hooks`); pass `fiberTargetG: dietSettings.fiberG` where the keret-hero input is built (find it: `grep -n "buildKeretHero\|keretHero" frontend/src/data/fuel/timelineHooks.ts` — it may be built in a page/component instead; wire it wherever the input object is assembled, threading through props if needed). The `segment` passed to `deriveDailyBudget` (line 103) already carries `carbsG`/`fatG` from the wire once Task 1's types regenerated — no change needed there.

- [ ] **Step 4: Run the full fuel logic suite in both modes**

```bash
cd frontend && pnpm vitest run src/features/fuel src/data/fuel
VITE_USE_MOCK=true pnpm vitest run src/features/fuel src/data/fuel
```

Expected: PASS. Fix keretHero test fixtures that now need `fiberTargetG` (give them `fiberTargetG: 30` — behavior identical).

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(fuel): daily budget consumes prescribed fatG/carbsG; fiber target from diet settings (mezo-XXXX)"
```

---

### Task 10: FE — Diéta section in FuelSettingsSheet

**Files:**
- Modify: `frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/FuelSettingsSheet.test.tsx` (create if absent — check `ls frontend/src/features/fuel/sheets/*.test.tsx`)

**Interfaces:**
- Consumes: Task 8 `useDietSettings`/`useDietSettingsActions`/`DIET_SETTINGS_GHOST`, type `DietSettings`.

- [ ] **Step 1: Write the failing component test**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// wrap with the repo's standard test providers — copy the setup from a sibling sheet test
// (e.g. grep -l "FuelSettingsSheet\|Sheet(" frontend/src/features/fuel/**/*.test.tsx)

test('custom split blocks save until the three percents sum to 100.0', async () => {
  const user = userEvent.setup()
  renderSheet() // helper per sibling-test idiom
  await user.click(screen.getByRole('button', { name: /Egyéni/ }))
  const protein = screen.getByLabelText('Fehérje %')
  await user.clear(protein); await user.type(protein, '30')
  const carbs = screen.getByLabelText('Szénhidrát %')
  await user.clear(carbs); await user.type(carbs, '30')
  const fat = screen.getByLabelText('Zsír %')
  await user.clear(fat); await user.type(fat, '30')
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled() // 90 ≠ 100
  await user.clear(carbs); await user.type(carbs, '40')
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
})

test('preset selection hides the custom percent inputs', async () => {
  const user = userEvent.setup()
  renderSheet()
  await user.click(screen.getByRole('button', { name: /Kiegyensúlyozott/ }))
  expect(screen.queryByLabelText('Fehérje %')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/fuel/sheets/FuelSettingsSheet.test.tsx
```

Expected: FAIL — no Diéta controls rendered.

- [ ] **Step 3: Implement the section**

Extend `FuelSettingsSheet.tsx` — new state from `useDietSettings()` (same touched/prefill-race guard as the existing fields), a "Diéta" block between the caffeine row and the slots link, and the save handler persisting BOTH settings objects:

```tsx
// additions inside the component (state + derived):
const { settings: diet, isPending: dietPending } = useDietSettings()
const { setSettings: setDiet, pending: dietSaving } = useDietSettingsActions()
const [splitPreset, setSplitPreset] = useState<DietSettings['splitPreset']>(diet.splitPreset)
const [pPct, setPPct] = useState(diet.proteinPctX10 != null ? diet.proteinPctX10 / 10 : 30)
const [cPct, setCPct] = useState(diet.carbsPctX10 != null ? diet.carbsPctX10 / 10 : 40)
const [fPct, setFPct] = useState(diet.fatPctX10 != null ? diet.fatPctX10 / 10 : 30)
const [proteinTier, setProteinTier] = useState<DietSettings['proteinTier']>(diet.proteinTier)
const [waterMl, setWaterMl] = useState(diet.waterMl)
const [fiberG, setFiberG] = useState(diet.fiberG)
// extend the existing prefill-race useEffect with the diet fields (same touched guard)
const customSumOk = splitPreset !== 'custom' || Math.round((pPct + cPct + fPct) * 10) === 1000
const busy = pending || isPending || dietSaving || dietPending || !customSumOk

const PRESET_LABELS: Record<DietSettings['splitPreset'], string> = {
  balanced: 'Kiegyensúlyozott', low_fat: 'Alacsony zsír', low_carb: 'Alacsony szénhidrát',
  high_carb: 'Magas szénhidrát', custom: 'Egyéni',
}

const save = (close: () => void) =>
  Promise.all([
    setSettings({ mealsPerDay, caffeineCutoff }),
    setDiet({
      splitPreset,
      proteinPctX10: splitPreset === 'custom' ? Math.round(pPct * 10) : null,
      carbsPctX10: splitPreset === 'custom' ? Math.round(cPct * 10) : null,
      fatPctX10: splitPreset === 'custom' ? Math.round(fPct * 10) : null,
      proteinTier, waterMl, fiberG,
    }),
  ]).then(close)
```

```tsx
{/* Diéta section (Diet Plan slice 1) */}
<span style={{ ...LABEL, marginTop: 6 }}>Diéta · makró-arány</span>
<div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
  {(Object.keys(PRESET_LABELS) as DietSettings['splitPreset'][]).map(k => (
    <button key={k} type="button" className="chip" aria-pressed={splitPreset === k}
      style={{ fontWeight: splitPreset === k ? 800 : 500 }}
      onClick={() => { setTouched(true); setSplitPreset(k) }}>
      {PRESET_LABELS[k]}
    </button>
  ))}
</div>
{splitPreset === 'custom' && (
  <div className="row gap-sm" style={ROW}>
    {([['Fehérje %', pPct, setPPct], ['Szénhidrát %', cPct, setCPct], ['Zsír %', fPct, setFPct]] as const)
      .map(([label, value, set]) => (
        <label key={label} className="col" style={{ fontSize: 9, color: 'var(--faint)' }}>
          {label}
          <input type="number" min={0} max={100} step={0.5} aria-label={label} value={value}
            onChange={(e) => { setTouched(true); set(Number(e.target.value)) }}
            style={{ width: 56, background: 'transparent', border: '1px solid var(--surface-3)', color: 'var(--text-primary)' }} />
        </label>
      ))}
  </div>
)}
{splitPreset === 'custom' && !customSumOk && (
  <span style={{ fontSize: 9, color: 'var(--warn, #e6a23c)' }}>Az arányoknak 100%-ra kell összegződniük.</span>
)}
{splitPreset === 'custom' && (
  <span style={{ fontSize: 9, color: 'var(--faint)' }}>A fehérje-cél g/kg alapon védett — az egyéni fehérje-arány csak iránymutatás, az eltérést a szénhidrát nyeli el.</span>
)}
<div className="row" style={ROW}>
  <span style={LABEL}>Fehérje-szint</span>
  <div className="row gap-sm">
    <button type="button" className="chip" aria-pressed={proteinTier === 'moderate'}
      onClick={() => { setTouched(true); setProteinTier('moderate') }}>Mérsékelt</button>
    <button type="button" className="chip" aria-pressed={proteinTier === 'high'}
      onClick={() => { setTouched(true); setProteinTier('high') }}>Magas</button>
  </div>
</div>
<div className="row" style={ROW}>
  <span style={LABEL}>Víz-cél (ml)</span>
  <input type="number" min={500} max={8000} step={100} aria-label="Víz-cél" value={waterMl}
    onChange={(e) => { setTouched(true); setWaterMl(Number(e.target.value)) }}
    style={{ width: 72, background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'right' }} />
</div>
<div className="row" style={ROW}>
  <span style={LABEL}>Rost-cél (g)</span>
  <input type="number" min={10} max={80} aria-label="Rost-cél" value={fiberG}
    onChange={(e) => { setTouched(true); setFiberG(Number(e.target.value)) }}
    style={{ width: 72, background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'right' }} />
</div>
```

(Adopt the file's exact styling idiom — the `ROW`/`LABEL` consts already exist; adjust to match sibling markup on lint complaints.)

- [ ] **Step 4: Run to verify it passes (both modes)**

```bash
cd frontend && pnpm vitest run src/features/fuel/sheets/FuelSettingsSheet.test.tsx
VITE_USE_MOCK=true pnpm vitest run src/features/fuel/sheets/FuelSettingsSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(fuel): Diéta section — split preset, custom %, protein tier, water/fiber (mezo-XXXX)"
```

---

### Task 11: Docs, CODEMAP, final gates

**Files:**
- Modify: `docs/features/goal-engine.md` (§4 config table gains `mezo.goal.diet`; §5 the Fuel bridge now carries c/f; recompute-trigger table gains the diet-settings save)
- Modify: `docs/features/fuel.md` (§4/§5/§9: the "fixed FAT_KCAL_SHARE split" statements now describe the fallback; the macro-split-asymmetry decision gains the prescribed-fat override; §10 constants)
- Modify: `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Update the two feature docs**

In `goal-engine.md`: add `diet.*` rows to the §4 config table (five values + what they do), add "diet-settings saved → `DietSettingsService.setSettings`" to the §3 recompute-trigger table, and update §5's "Still emitted-but-unconsumed" line (carbs/fat now prescribed and consumed by Fuel). In `fuel.md`: §4 line ~211 and §9's "Dynamic budget: macro-split asymmetry" decision — prescribed `fatG` wins, `FAT_KCAL_SHARE` is the legacy fallback; §10 add `DIET_SPLIT_PRESETS`. Keep edits surgical — these docs are lintable knowledge-base artifacts; follow the existing section voice.

- [ ] **Step 2: Regenerate CODEMAP**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 3: Run the focused verification battery**

```bash
cd backend && ./mvnw test -Dtest='DietSettingsApiIT,DietPreferencesResolverIT,GoalEvaluationServiceIT,GoalEngineRecomputeIT,GoalEnginePropertiesIT,FuelSettingsApiIT'
cd ../frontend && pnpm test
VITE_USE_MOCK=true pnpm test
pnpm build
```

Expected: all green (FE full suite is fine locally; only the BACKEND full suite is forbidden). Baseline note: `chatApi.test.ts` (transcribe) and `MesocyclePlannerPage.test.tsx` (day tabs) were already failing on main before this slice — those two are pre-existing and NOT this slice's regressions; everything else must pass.

- [ ] **Step 4: ArchUnit store + status check**

```bash
git status
```

Verify: no `archunit-store` modifications, no stray files. If the store emptied, restore it: `git checkout -- backend/src/test/resources/archunit-store`.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs(fuel,goal): diet split foundations — config, triggers, budget source (mezo-XXXX)"
```

---

## Self-review notes (already applied)

- **Spec coverage:** §6.1 settings fields (minus slice-3 `dayTypeShiftKcal`) → Tasks 1–2; §6.2 engine formulas + clamps + 7th trigger → Tasks 3–6; `targetSet` c/f → Task 7; §6.7 sheet UI → Task 10; §6.9 drift guard + dual modes + focused ITs → Tasks 8/11. Deferred by design: protein-floor UI badge ("a fehérje-padló felülírta") — the clamp itself is engine-side (Task 5); the badge needs the GoalRecept surface and lands with slice 4's recept work.
- **Type consistency:** `DietPreferences` (record, BE) / `DietSettings` (interface, FE) are deliberately distinct names for distinct layers; `Segment.carbsG/fatG` ordering (after `proteinG`) is used consistently in Task 5 (record), Task 1 (yaml), Task 8 (mock).
- **Placeholder scan:** the two "read the sibling test first" instructions (Tasks 4/6 owner-id helper, Task 10 render helper) are deliberate — the exact helper names must come from the current test support code, not be invented here; everything else is concrete.
