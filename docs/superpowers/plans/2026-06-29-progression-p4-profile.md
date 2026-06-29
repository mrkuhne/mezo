# Progression P4 — Profile Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the standalone progression read surface — `GET /api/progression/profile` — that aggregates `skill_progress` into the athletic+muscle profile: athlete-level, 6 radar axes, streak, and highlights, behind the progression feature switch.

**Architecture:** First `api/feature/progression/` contract fragment + first `@ConditionalOnProperty`-gated controller. `ProgressionService.getProfile(createdBy)` reads all `skill_progress` rows and derives the profile over the fixed taxonomy (12 athletic incl. robustness, 13 muscle); skills with no row count as level 1, and an empty profile yields `athleteLevel = null` (ghost). The Erő radar axis blends the muscle-level mean via a config weight. Backend-only — the FE profile cards + radar SVG + dual-mode mock are **P6**.

**Tech Stack:** Java 21, Spring Boot 4, Maven, Lombok; OpenAPI contract-first; integration-first tests (compose/Testcontainers Postgres, AssertJ).

**Driving bd:** `mezo-x71h` (child of epic `mezo-8e4`). Spec: `docs/superpowers/specs/2026-06-25-progression-levelup-design.md` §3 (getProfile), §6 (radar axes & athlete-level), §7 (profile card), §8 (P4).

## Global Constraints

Every task's requirements implicitly include this section.

- **Base package** `io.mrkuhne.mezo`; progression code in `feature/progression/{controller,service,config}`.
- **Contract-first** (`docs/references/api_contract_conventions.md`): create `api/feature/progression/progression.yml` FIRST, append it to `api/generate/merge.yml`, then `cd api/generate && npm run generate:api` (regen `api/openapi.yml`, commit) → `cd frontend && pnpm generate:api` (regen `src/lib/api.gen.ts`, commit) → backend Java types regenerate on `./mvnw clean test`. Never hand-edit generated artifacts. Schema name == generated class; **operationId `getProfile` == controller method**; **tag `Progression` == `ProgressionApi`**. Every non-2xx references `SystemMessageList`.
- **Spring** (`docs/references/spring_patterns.md`): constructor injection via `@RequiredArgsConstructor`; **read methods carry NO `@Transactional`**; controllers implement the generated `<Tag>Api`, no business logic; inject `CurrentUserId` (never a contract param).
- **Config** (`docs/references/configuration_conventions.md`): the radar blend weight lives under `mezo.progression.radar` in `application.yml`, bound via the existing `@Validated ProgressionProperties` record (new nested `Radar`); **never `@Value`**. The switch constant `FeaturesConfiguration.PROGRESSION_SWITCH` already exists; the controller consumes it via `@ConditionalOnProperty(..., havingValue = "true")` (no `matchIfMissing`); **both switch states tested**.
- **Tests** (`docs/references/testing_standards.md` + `integration_test_framework.md`): integration-first; service tests extend `AbstractIntegrationTest` (`@Transactional`), HTTP tests extend `ApiIntegrationTest` (no `@Transactional`); **AssertJ only**, no mocks; naming `test{Method}_should{Result}_when{Condition}`; data via `SkillProgressPopulator` (`createSkill(createdBy, skillKey, kind, cumulativeXp, level)`); HTTP via verb helpers + `ownerAuthHeaders()`; a `401`-without-token test on the endpoint; the **switch-off (404)** state via a dedicated `@TestPropertySource` context (no precedent yet — this establishes it).
- **No new tables / no migration** — P4 only reads `skill_progress` (already in `ResetDatabase`).
- **FE scope (locked):** regenerate `api.gen.ts` only; keep both modes green (`pnpm test`, `VITE_USE_MOCK=true pnpm test`, `pnpm build`). No FE consumer of the profile yet — `useProgressionProfile()` + the cards are **P6** (file as `mezo-8e4` child if not already `mezo-te8k`-adjacent).

## Taxonomy & math (locked — from spec §1/§3/§6)

- **Athletic (11 non-robustness):** `explosiveness, vertical_jump, sprint_speed, aerobic_capacity, anaerobic_capacity, strength_endurance, core_stability, max_strength, coordination, mobility, agility`. Plus `robustness` (12th, ATHLETIC) — included in `athletic[]` but **excluded** from athlete-level and the radar (shown as its own element).
- **Muscle (13, exact Train tokens):** `back-mid, lats, chest, shoulder, rear-delt, biceps, triceps, quad, ham, glute, calf, core, traps`.
- **`levelOf(key)`** = the row's `currentLevel`, or **1** when the user has no row for that key (every skill starts at level 1).
- **athleteLevel** = `null` when the user has **zero** `skill_progress` rows (ghost); otherwise `round1(mean(levelOf(k) for k in the 11 non-robustness athletic))`.
- **streakWeeks** = `RobustnessCalculator.streakWeeks(createdBy)`.
- **Radar axes (6, fixed grouping; value = `round1(mean of member levelOf)`):** Robbanékonyság=`explosiveness,vertical_jump`; Sebesség=`sprint_speed`; Állóképesség=`aerobic_capacity,strength_endurance,anaerobic_capacity`; Mozgékonyság=`mobility,core_stability`; Koordináció=`agility,coordination`; **Erő** = `round1(levelOf(max_strength)*(1-w) + muscleMean*w)` where `muscleMean = mean(levelOf(m) for m in the 13 muscle)` and `w = mezo.progression.radar.strength-muscle-blend` (default 0.5).
- **highlights** = `{ bestAthletic, bestMuscle }`, each the **existing** row (not a level-1 phantom) of that kind with the max `(level, cumulativeXp)`; `bestAthletic` excludes robustness; each null when no such row.
- **round1(x)** = `Math.round(x*10)/10.0`.

---

## Task 1: Contract — progression fragment + regen + FE green

**Files:**
- Create: `api/feature/progression/progression.yml`
- Modify: `api/generate/merge.yml`
- Regenerate/commit: `api/openapi.yml`, `frontend/src/lib/api.gen.ts`

**Interfaces:**
- Produces: `ProgressionApi.getProfile()` (Spring interface) + DTOs `ProgressionProfileResponse {athleteLevel?, streakWeeks, athletic[], muscle[], radarAxes[], highlights}`, `SkillLevel {skillKey, kind, level, cumulativeXp, progressPct}`, `RadarAxis {axis, value}`, `ProfileHighlights {bestAthletic?, bestMuscle?}`, `SkillRef {skillKey, level}`. FE types under `components['schemas']`.

- [ ] **Step 1: Write `api/feature/progression/progression.yml`** (complete mini-document):

```yaml
openapi: 3.0.3
info:
  title: Progression API
  version: 1.0.0
tags:
  - name: Progression
paths:
  /api/progression/profile:
    get:
      operationId: getProfile
      tags: [Progression]
      summary: Athletic + muscle progression profile (radar, athlete-level, streak, highlights).
      responses:
        '200':
          description: The progression profile.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ProgressionProfileResponse' }
        '401':
          description: Unauthenticated.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    ProgressionProfileResponse:
      type: object
      required: [streakWeeks, athletic, muscle, radarAxes, highlights]
      properties:
        athleteLevel:
          type: number
          nullable: true
          description: Mean of the 11 non-robustness athletic levels (1-decimal); null = ghost (no XP yet).
        streakWeeks:
          type: integer
        athletic:
          type: array
          items: { $ref: '#/components/schemas/SkillLevel' }
        muscle:
          type: array
          items: { $ref: '#/components/schemas/SkillLevel' }
        radarAxes:
          type: array
          items: { $ref: '#/components/schemas/RadarAxis' }
        highlights:
          $ref: '#/components/schemas/ProfileHighlights'
    SkillLevel:
      type: object
      required: [skillKey, kind, level, cumulativeXp, progressPct]
      properties:
        skillKey: { type: string }
        kind: { type: string, description: 'ATHLETIC|MUSCLE' }
        level: { type: integer }
        cumulativeXp: { type: integer, format: int64 }
        progressPct: { type: number, description: 'within-level fill 0..100' }
    RadarAxis:
      type: object
      required: [axis, value]
      properties:
        axis: { type: string, description: 'HU axis label (Erő, Robbanékonyság, …)' }
        value: { type: number, description: 'aggregated level, 1-decimal' }
    ProfileHighlights:
      type: object
      properties:
        bestAthletic: { $ref: '#/components/schemas/SkillRef' }
        bestMuscle: { $ref: '#/components/schemas/SkillRef' }
    SkillRef:
      type: object
      required: [skillKey, level]
      properties:
        skillKey: { type: string }
        level: { type: integer }
```

- [ ] **Step 2: Append the fragment to `api/generate/merge.yml`** (after the medication input):

```yaml
  - inputFile: ../feature/medication/medication.yml
  - inputFile: ../feature/progression/progression.yml
```

- [ ] **Step 3: Regenerate the merged contract + FE types.**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` gains the `/api/progression/profile` path + the 5 schemas; `src/lib/api.gen.ts` gains them under `components['schemas']`. `SystemMessageList` resolves post-merge (shared schema).

- [ ] **Step 4: Verify FE + backend stay green (new types unused).**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: all PASS (no FE consumer yet).
Run: `cd backend && ./mvnw clean test`
Expected: PASS (the generated `ProgressionApi` interface compiles; no controller implements it yet, which is allowed — `interfaceOnly` generation).

- [ ] **Step 5: Commit.**

```bash
git add api/feature/progression/progression.yml api/generate/merge.yml api/openapi.yml frontend/src/lib/api.gen.ts
git commit -m "feat(api): progression profile contract — GET /api/progression/profile (mezo-x71h)"
```

---

## Task 2: Config — radar blend weight

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPropertiesIT.java`

**Interfaces:**
- Produces: `ProgressionProperties.radar(): Radar` with `double strengthMuscleBlend`.

- [ ] **Step 1: Add the failing binding assertion to `ProgressionPropertiesIT`:**

```java
    @Test
    void testRadarConfig_shouldBindFromYaml_whenContextStarts() {
        assertThat(properties.radar().strengthMuscleBlend()).isEqualTo(0.5);
    }
```

- [ ] **Step 2: Run to confirm it fails to compile (red).**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPropertiesIT`
Expected: FAIL — `properties.radar()` does not resolve.

- [ ] **Step 3: Add the `Radar` node to `ProgressionProperties`** (4th-after-sport component; insert `radar` into the top record and add the nested record):

```java
public record ProgressionProperties(
    @NotNull @Valid Curve curve,
    @NotNull @Valid Gym gym,
    @NotNull @Valid Run run,
    @NotNull @Valid Sport sport,
    @NotNull @Valid Robustness robustness,
    @NotNull @Valid Radar radar
) {
```
and the nested record (next to `Sport`):

```java
    /** Radar axis aggregation (v1: fixed grouping; only the Erő muscle-blend weight is config). */
    public record Radar(
        /** Erő axis blend: value = max_strength*(1-w) + muscleMean*w, 0..1. */
        @DecimalMin("0.0") @DecimalMax("1.0") double strengthMuscleBlend  // 0.5
    ) {}
```
Add imports `jakarta.validation.constraints.DecimalMin`, `jakarta.validation.constraints.DecimalMax`.

- [ ] **Step 4: Add the YAML block in `application.yml`** (after the `sport:` block under `mezo.progression`):

```yaml
    # Radar aggregation (fixed axis grouping in v1; only the Erő muscle blend is tunable).
    radar:
      strength-muscle-blend: 0.5   # Erő = max_strength*(1-w) + muscle-level-mean*w
```

- [ ] **Step 5: Run the properties IT (also update the ProgressionCurveTest record arity).**

`ProgressionCurveTest` builds `new ProgressionProperties(...)` directly — add the new `Radar` arg:
```java
            new ProgressionProperties.Robustness(25),
            new ProgressionProperties.Radar(0.5)));
```

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPropertiesIT,ProgressionCurveTest`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java \
        backend/src/main/resources/application.yml \
        backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPropertiesIT.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionCurveTest.java
git commit -m "feat(progression): radar blend-weight config (mezo-x71h)"
```

---

## Task 3: Taxonomy + `getProfile` aggregation

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/ProgressionTaxonomy.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/service/ProgressionProfileServiceIT.java`

**Interfaces:**
- Produces: `ProgressionService.getProfile(UUID createdBy): ProgressionProfileResponse` (the generated `api.dto` type).
- Consumes: `SkillProgressRepository.findByCreatedByOrderBySkillKeyAsc`, `ProgressionCurve.progressPct`, `RobustnessCalculator.streakWeeks`, `properties.radar()`.

- [ ] **Step 1: Create `ProgressionTaxonomy`:**

```java
package io.mrkuhne.mezo.feature.progression;

import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** Fixed skill taxonomy for the profile aggregation (spec §1). */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class ProgressionTaxonomy {

    public static final String ROBUSTNESS = "robustness";

    /** 11 non-robustness athletic skills — drive athlete-level + the radar. */
    public static final List<String> ATHLETIC = List.of(
        "explosiveness", "vertical_jump", "sprint_speed", "aerobic_capacity", "anaerobic_capacity",
        "strength_endurance", "core_stability", "max_strength", "coordination", "mobility", "agility");

    /** 13 muscle tokens — exact Train tokens (ExerciseCatalogLoader.MUSCLES). */
    public static final List<String> MUSCLE = List.of(
        "back-mid", "lats", "chest", "shoulder", "rear-delt", "biceps", "triceps",
        "quad", "ham", "glute", "calf", "core", "traps");
}
```

- [ ] **Step 2: Write the failing `ProgressionProfileServiceIT`** (service-level, `@Transactional`; seeds rows via `SkillProgressPopulator`):

```java
package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.api.dto.RadarAxis;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionProfileServiceIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressPopulator skillPop;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testGetProfile_shouldReturnGhost_whenNoSkillRows() {
        UUID user = databasePopulator.populateUser("ghost@test.local");

        ProgressionProfileResponse p = progressionService.getProfile(user);

        assertThat(p.getAthleteLevel()).isNull();              // ghost
        assertThat(p.getStreakWeeks()).isZero();
        assertThat(p.getAthletic()).hasSize(12);               // 11 + robustness, all level 1
        assertThat(p.getMuscle()).hasSize(13);
        assertThat(p.getAthletic()).allSatisfy(s -> assertThat(s.getLevel()).isEqualTo(1));
        assertThat(p.getRadarAxes()).extracting(RadarAxis::getAxis)
            .containsExactly("Erő", "Robbanékonyság", "Sebesség", "Állóképesség", "Mozgékonyság", "Koordináció");
        assertThat(p.getHighlights().getBestAthletic()).isNull();
    }

    @Test
    void testGetProfile_shouldDeriveAthleteLevelOverElevenAthletic_whenRowsExist() {
        UUID user = databasePopulator.populateUser("athlete@test.local");
        // two athletic skills at level 3, the other nine count as level 1:
        skillPop.createSkill(user, "max_strength", "ATHLETIC", 303L, 3);
        skillPop.createSkill(user, "sprint_speed", "ATHLETIC", 303L, 3);

        ProgressionProfileResponse p = progressionService.getProfile(user);

        // (3 + 3 + 1*9) / 11 = 15/11 = 1.36 -> 1.4
        assertThat(p.getAthleteLevel()).isEqualTo(1.4);
        // Sebesség = sprint_speed level = 3.0
        assertThat(axis(p, "Sebesség")).isEqualTo(3.0);
        assertThat(p.getHighlights().getBestAthletic().getSkillKey()).isIn("max_strength", "sprint_speed");
        assertThat(p.getHighlights().getBestAthletic().getLevel()).isEqualTo(3);
    }

    @Test
    void testGetProfile_shouldBlendMuscleMeanIntoEroAxis_whenMaxStrengthAndMusclesLogged() {
        UUID user = databasePopulator.populateUser("ero@test.local");
        skillPop.createSkill(user, "max_strength", "ATHLETIC", 919L, 5); // level 5
        skillPop.createSkill(user, "chest", "MUSCLE", 303L, 3);          // one muscle at level 3

        ProgressionProfileResponse p = progressionService.getProfile(user);

        // muscleMean = (3 + 1*12) / 13 = 15/13 = 1.1538; Erő = 5*0.5 + 1.1538*0.5 = 3.0769 -> 3.1
        assertThat(axis(p, "Erő")).isEqualTo(3.1);
        assertThat(p.getHighlights().getBestMuscle().getSkillKey()).isEqualTo("chest");
    }

    @Test
    void testGetProfile_shouldExcludeRobustnessFromAthleteLevelAndRadar_whenRobustnessHigh() {
        UUID user = databasePopulator.populateUser("rob@test.local");
        skillPop.createSkill(user, "robustness", "ATHLETIC", 5000L, 10);

        ProgressionProfileResponse p = progressionService.getProfile(user);

        // all 11 non-robustness athletic are level 1 -> athleteLevel 1.0 (robustness ignored)
        assertThat(p.getAthleteLevel()).isEqualTo(1.0);
        // robustness still appears in athletic[]
        assertThat(p.getAthletic()).anySatisfy(s ->
            assertThat(s.getSkillKey()).isEqualTo("robustness"));
        // robustness is NOT a radar axis
        assertThat(p.getRadarAxes()).extracting(RadarAxis::getAxis).doesNotContain("Robusztusság", "robustness");
    }

    private double axis(ProgressionProfileResponse p, String name) {
        return p.getRadarAxes().stream().filter(a -> a.getAxis().equals(name))
            .findFirst().orElseThrow().getValue().doubleValue();
    }
}
```

- [ ] **Step 3: Run to confirm failure (no getProfile).**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionProfileServiceIT`
Expected: FAIL — `getProfile` does not resolve.

- [ ] **Step 4: Implement `getProfile` in `ProgressionService`** (read method, no `@Transactional`). Add imports for the `api.dto` types (`ProgressionProfileResponse`, `SkillLevel`, `RadarAxis`, `ProfileHighlights`, `SkillRef`), `ProgressionTaxonomy`, `java.util.*`, `java.math.BigDecimal`:

```java
    public ProgressionProfileResponse getProfile(UUID createdBy) {
        List<SkillProgressEntity> rows = skillProgressRepository.findByCreatedByOrderBySkillKeyAsc(createdBy);
        Map<String, SkillProgressEntity> byKey = new HashMap<>();
        rows.forEach(r -> byKey.put(r.getSkillKey(), r));

        List<SkillLevel> athletic = new ArrayList<>();
        ProgressionTaxonomy.ATHLETIC.forEach(k -> athletic.add(skillLevel(byKey, k, "ATHLETIC")));
        athletic.add(skillLevel(byKey, ProgressionTaxonomy.ROBUSTNESS, "ATHLETIC"));
        List<SkillLevel> muscle = ProgressionTaxonomy.MUSCLE.stream()
            .map(k -> skillLevel(byKey, k, "MUSCLE")).toList();

        Double athleteLevel = rows.isEmpty() ? null
            : round1(ProgressionTaxonomy.ATHLETIC.stream().mapToInt(k -> levelOf(byKey, k)).average().orElse(1));

        double muscleMean = ProgressionTaxonomy.MUSCLE.stream().mapToInt(k -> levelOf(byKey, k)).average().orElse(1);
        double blend = properties.radar().strengthMuscleBlend();
        double ero = levelOf(byKey, "max_strength") * (1 - blend) + muscleMean * blend;
        List<RadarAxis> axes = List.of(
            axis("Erő", round1(ero)),
            axis("Robbanékonyság", meanLevel(byKey, "explosiveness", "vertical_jump")),
            axis("Sebesség", meanLevel(byKey, "sprint_speed")),
            axis("Állóképesség", meanLevel(byKey, "aerobic_capacity", "strength_endurance", "anaerobic_capacity")),
            axis("Mozgékonyság", meanLevel(byKey, "mobility", "core_stability")),
            axis("Koordináció", meanLevel(byKey, "agility", "coordination")));

        ProfileHighlights highlights = ProfileHighlights.builder()
            .bestAthletic(bestRow(rows, "ATHLETIC", true))
            .bestMuscle(bestRow(rows, "MUSCLE", false))
            .build();

        return ProgressionProfileResponse.builder()
            .athleteLevel(athleteLevel == null ? null : BigDecimal.valueOf(athleteLevel))
            .streakWeeks(robustnessCalculator.streakWeeks(createdBy))
            .athletic(athletic).muscle(muscle).radarAxes(axes).highlights(highlights)
            .build();
    }

    private SkillLevel skillLevel(Map<String, SkillProgressEntity> byKey, String key, String kind) {
        SkillProgressEntity r = byKey.get(key);
        long cum = r != null ? r.getCumulativeXp() : 0L;
        int level = r != null ? r.getCurrentLevel() : 1;
        return SkillLevel.builder().skillKey(key).kind(kind).level(level)
            .cumulativeXp(cum).progressPct(BigDecimal.valueOf(curve.progressPct(cum, level))).build();
    }

    private int levelOf(Map<String, SkillProgressEntity> byKey, String key) {
        SkillProgressEntity r = byKey.get(key);
        return r != null ? r.getCurrentLevel() : 1;
    }

    private BigDecimal meanLevel(Map<String, SkillProgressEntity> byKey, String... keys) {
        double mean = Arrays.stream(keys).mapToInt(k -> levelOf(byKey, k)).average().orElse(1);
        return round1(mean);
    }

    private RadarAxis axis(String name, BigDecimal value) {
        return RadarAxis.builder().axis(name).value(value).build();
    }

    /** Best EXISTING row of a kind by (level, cumulativeXp); athletic optionally excludes robustness. */
    private SkillRef bestRow(List<SkillProgressEntity> rows, String kind, boolean excludeRobustness) {
        return rows.stream()
            .filter(r -> kind.equals(r.getSkillKind()))
            .filter(r -> !excludeRobustness || !ProgressionTaxonomy.ROBUSTNESS.equals(r.getSkillKey()))
            .max(Comparator.comparingInt(SkillProgressEntity::getCurrentLevel)
                .thenComparingLong(SkillProgressEntity::getCumulativeXp))
            .map(r -> SkillRef.builder().skillKey(r.getSkillKey()).level(r.getCurrentLevel()).build())
            .orElse(null);
    }

    private static BigDecimal round1(double v) {
        return BigDecimal.valueOf(Math.round(v * 10) / 10.0);
    }
```
(Note: the generated `RadarAxis.value` / `SkillLevel.progressPct` / `athleteLevel` are `BigDecimal` from OpenAPI `type: number` — wrap doubles with `BigDecimal.valueOf`. Adjust to the actual generated types if they are `Double` instead.)

- [ ] **Step 5: Run to confirm green.**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionProfileServiceIT`
Expected: PASS (all four tests). If a `BigDecimal`-equality assertion is brittle, compare via `.doubleValue()` (the helper already does for axes).

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/ProgressionTaxonomy.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/progression/service/ProgressionProfileServiceIT.java
git commit -m "feat(progression): getProfile aggregation — athlete-level, radar, highlights (mezo-x71h)"
```

---

## Task 4: Controller + HTTP contract IT (switch ON)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/controller/ProgressionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/controller/ProgressionProfileApiIT.java`

**Interfaces:**
- Consumes: generated `ProgressionApi`, `ProgressionService.getProfile`, `CurrentUserId`.

- [ ] **Step 1: Write the failing `ProgressionProfileApiIT`** (HTTP-level, extends `ApiIntegrationTest`, no `@Transactional`):

```java
package io.mrkuhne.mezo.feature.progression.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ProgressionProfileApiIT extends ApiIntegrationTest {

    @Test
    void testGetProfile_shouldReturnGhostProfile_whenOwnerHasNoXp() {
        ProgressionProfileResponse p = getForBody("/api/progression/profile",
            ownerAuthHeaders(), HttpStatus.OK, ProgressionProfileResponse.class);

        assertThat(p.getAthleteLevel()).isNull();
        assertThat(p.getStreakWeeks()).isZero();
        assertThat(p.getAthletic()).hasSize(12);
        assertThat(p.getMuscle()).hasSize(13);
        assertThat(p.getRadarAxes()).hasSize(6);
    }

    @Test
    void testGetProfile_shouldReturn401_whenNoToken() {
        getForBody("/api/progression/profile", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
```
(`getForBody` is the existing verb helper; confirm its signature in `ApiIntegrationTest`. The owner is the demodata seed with no progression rows → ghost.)

- [ ] **Step 2: Run to confirm failure (no controller → 404/no handler).**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionProfileApiIT`
Expected: FAIL — `testGetProfile_shouldReturnGhostProfile…` gets 404 (no `ProgressionController` yet).

- [ ] **Step 3: Create `ProgressionController`:**

```java
package io.mrkuhne.mezo.feature.progression.controller;

import io.mrkuhne.mezo.api.controller.ProgressionApi;
import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** Read surface for the gamified-progression profile; present only when the engine is switched on. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PROGRESSION_SWITCH, havingValue = "true")
public class ProgressionController implements ProgressionApi {

    private final ProgressionService progressionService;
    private final CurrentUserId currentUserId;

    @Override
    public ProgressionProfileResponse getProfile() {
        return progressionService.getProfile(currentUserId.get());
    }
}
```
(Confirm the `CurrentUserId` package + accessor from an existing controller, e.g. `WeightLogController`/`TrainController`; match it exactly.)

- [ ] **Step 4: Run to confirm green.**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionProfileApiIT`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/controller/ProgressionController.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/progression/controller/ProgressionProfileApiIT.java
git commit -m "feat(progression): ProgressionController GET /profile (switch-gated) (mezo-x71h)"
```

---

## Task 5: Switch-OFF state test (404)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/controller/ProgressionProfileSwitchOffApiIT.java`

**Interfaces:**
- Consumes: `ApiIntegrationTest` + a property override turning the progression switch off.

- [ ] **Step 1: Write the switch-off test** (a dedicated `@TestPropertySource` context — establishes the both-states pattern):

```java
package io.mrkuhne.mezo.feature.progression.controller;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the progression switch OFF, the @ConditionalOnProperty controller bean is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.progression.enabled=false")
class ProgressionProfileSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testGetProfile_shouldReturn404_whenProgressionSwitchOff() {
        getForBody("/api/progression/profile", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
```

- [ ] **Step 2: Run to confirm green** (a second Spring context boots with progression off).

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionProfileSwitchOffApiIT`
Expected: PASS. If the app fails to boot with the switch off, fix the offending bean to also be gated/optional (the gym/run/sport triggers already use `ObjectProvider<ProgressionGate>`, so the app must already boot switch-off — confirm).

- [ ] **Step 3: Commit.**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/progression/controller/ProgressionProfileSwitchOffApiIT.java
git commit -m "test(progression): profile endpoint 404 when switch off (mezo-x71h)"
```

---

## Task 6: Docs + roadmap + full gates + bd close

**Files:**
- Modify: `docs/features/_platform-api-backend.md` (progression §4 table row + §4e + key files), `docs/milestones/roadmap.md`

- [ ] **Step 1: Update `_platform-api-backend.md`.** In the §4 summary table Progression row, change the status to include **P4 (profile endpoint)** and note the new `api/feature/progression/progression.yml` fragment + `GET /api/progression/profile` (no longer "no standalone REST surface"). In §4e: add a **profile read surface (P4)** paragraph — `ProgressionController` (`@ConditionalOnProperty(PROGRESSION_SWITCH)`, the first gated controller) → `ProgressionService.getProfile` aggregating `skill_progress` over `ProgressionTaxonomy` (athlete-level = mean of 11 non-robustness athletic, missing→1, null=ghost; 6 fixed radar axes with the Erő muscle-blend `mezo.progression.radar.strength-muscle-blend`; streak; highlights), ITs `ProgressionProfileServiceIT` + `ProgressionProfileApiIT` + `ProgressionProfileSwitchOffApiIT`. Update the key-files + ITs lists (`controller/ProgressionController.java`, `ProgressionTaxonomy.java`, `mezo.progression.{…,radar}`). Note `GET /progression/profile` now contributes a real `api/feature/progression/` fragment to the merged contract (FE consumption still P6).

- [ ] **Step 2: Update `docs/milestones/roadmap.md`** — add a 2026-06-29 milestone row: Progression **P4 — profile endpoint** (`mezo-x71h`) shipped: `GET /api/progression/profile` (first progression fragment + first switch-gated controller), `ProgressionService.getProfile` (athlete-level / 6 radar axes / streak / highlights over the fixed taxonomy, ghost when no XP). FE cards + dual-mode mock → P6.

- [ ] **Step 3: Clear staleness + lint.**

Run: `node scripts/lint-docs.mjs`
Expected: `_platform-api-backend.md` no longer stale (pre-existing stale docs from mezo-4wd may remain).

- [ ] **Step 4: Full backend gate.**

Run: `cd backend && ./mvnw clean test`
Expected: PASS.

- [ ] **Step 5: Full frontend gate.**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: all PASS.

- [ ] **Step 6: Commit + close bd.**

```bash
git add docs/
git commit -m "docs(progression): P4 profile endpoint — backend doc + roadmap (mezo-x71h)"
bd close mezo-x71h
```

---

## Self-Review (against spec §3/§6/§7)

**Coverage:** §3 getProfile (all skill_progress + athlete-level + streak + radar + highlights) → Task 3; the feature-switch on the controller + both states → Tasks 4–5. §6 athlete-level (11 non-robustness, 1-decimal, null ghost) + 6 axes (Erő muscle-blend) → Task 3 math (locked) + Task 2 config. §7 profile-card data (radar hero + athlete-level/streak/best + muscle top-list) → `athletic[]`/`muscle[]`/`radarAxes[]`/`highlights` (the FE cards render in P6). §8 P4 (profile endpoint) → this plan; FE cards/radar/mock are P6 (deferred).

**Type consistency:** `getProfile(UUID): ProgressionProfileResponse` produced in Task 3, consumed in Task 4. `properties.radar().strengthMuscleBlend()` produced in Task 2, consumed in Task 3. `ProgressionTaxonomy.{ATHLETIC,MUSCLE,ROBUSTNESS}` produced in Task 3 Step 1, consumed in Step 4. Generated `ProgressionApi`/DTOs produced in Task 1, consumed in Tasks 3–5.

**Open risk:** the generated numeric types (`athleteLevel`/`value`/`progressPct`) may be `BigDecimal` (OpenAPI `number`) — Task 3 wraps with `BigDecimal.valueOf` and asserts via `.doubleValue()`; if the generator emits `Double`/`Float` instead, drop the wrapping. Resolve at Task 3 Step 4 by reading the generated `RadarAxis`/`ProgressionProfileResponse`.
