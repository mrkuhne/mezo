# Sleep Depth Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four sleep phases (deep / light / REM / awake) — already extracted and persisted but never read back — the sleep page's second dimension, and add a quantised 15-minute hypnogram rendered as a hanging depth silhouette.

**Architecture:** Contract-first. `api/` YAML changes land before any Java or TS. The backend gains one nullable `jsonb` column and three validator checks; everything else is read-side frontend work built on a new pure logic module (`sleepPhases.ts`) plus five presentational components. The hypnogram is display-only provenance and never feeds a ratio statistic — every percentage comes from the exact per-phase minute totals.

**Tech Stack:** Spring Boot 4.x / Java 21 / Maven / PostgreSQL + Liquibase · React 19 + Vite + Tailwind v4 + TanStack Query · OpenAPI contract-first codegen · Vitest + Testing Library · JUnit + AssertJ + Testcontainers

**Spec:** [`docs/superpowers/specs/2026-07-30-sleep-depth-stats-design.md`](../specs/2026-07-30-sleep-depth-stats-design.md)
**Driver:** `mezo-fk9a`

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Language:** all code, comments and commit messages in **English**. All **UI copy in Hungarian**.
- **Commit subjects** carry the bd id: `feat(sleep): ... (mezo-fk9a)`.
- **Committing:** always explicit `git add <paths>` + `git commit --no-verify`. **Never `git add -A`** — the beads pre-commit hook force-stages a stray gitignored root `issues.jsonl`. Do not commit any root `issues.jsonl`.
- **The central rule (spec §2):** the hypnogram NEVER feeds a ratio statistic. Every phase percentage, average and trend value comes from the exact per-phase minute totals. The hypnogram earns exactly two jobs: the drawing, and the first-half/second-half split.
- **`asleep` is always `deep + light + rem`**, computed — never read from `SleepEntry.duration` (which is rounded hours and would disagree).
- **Phase percentages denominate on `asleep`**, never on `inBed`. The rail's segment *widths* denominate on `inBed` (so the four segments fill the rail). These two denominators differ on purpose.
- **Tone (spec §9):** reference bands render in sage; out-of-band verdicts are locational (`a sáv felett` / `a sáv alatt`), never red, never an alert colour, never a grade. Deep and REM get bands; **light does not**.
- **Frontend conventions are mandatory:** read [`docs/references/frontend_conventions.md`](../../references/frontend_conventions.md) before writing any `frontend/src` code. Deep absolute `@/*` imports, no relative `../`, no barrels except `data/hooks.ts`, tests colocated, `shared/ui` stays domain-free.
- **Backend conventions are mandatory:** [`java_package_structure.md`](../../references/java_package_structure.md), [`spring_patterns.md`](../../references/spring_patterns.md), [`liquibase_conventions.md`](../../references/liquibase_conventions.md), [`api_contract_conventions.md`](../../references/api_contract_conventions.md), [`testing_standards.md`](../../references/testing_standards.md).
- **Test commands — use these exactly, never the full backend suite:**
  - Frontend: `cd frontend && pnpm test <pattern>` then `VITE_USE_MOCK=true pnpm test <pattern>`. **Both modes must be green.** Pass an explicit Bash `timeout` of `600000` and run each command as its own foreground call, never chained with `&&` across long runs.
  - Backend: `cd backend && ./mvnw clean test -Dtest='<TheClasses>,ArchitectureTest'`. Always `clean` (Lombok+MapStruct incremental compile is flaky). **Do NOT run the full backend suite — this machine OOMs on it; CI is the authoritative gate.**
  - Never run `pnpm test:visual` or regenerate Playwright goldens. Baselines are per-platform and handled at ship time by the coordinator.
- **Mock mode is the default:** `isMockMode()` is `VITE_USE_MOCK !== 'false'`, so an unset env means **mock**. A gitignored `frontend/.env` on this machine sets `VITE_USE_MOCK=false`. Always set the variable explicitly when comparing.

---

## File Structure

**New — backend**
| File | Responsibility |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/entity/SleepHypnogram.java` | Typed jsonb value record. Named `SleepHypnogram`, not `Hypnogram`, so it never collides with the generated API model of the same schema name. |
| `backend/src/main/resources/db/changelog/1.0.0/script/202607301200_mezo-fk9a_add_sleep_log_hypnogram.sql` | The one column. |

**New — frontend**
| File | Responsibility |
|---|---|
| `frontend/src/features/me/logic/sleepPhases.ts` | All phase maths. Pure, no React. Separate from `sleepStats.ts` (timing) because this answers composition. |
| `frontend/src/features/me/components/PhaseRail.tsx` | Proportional stacked rail + legend. Three consumers. |
| `frontend/src/features/me/components/PhaseReferenceRow.tsx` | One reference row: label, value, verdict, band+pin bar. |
| `frontend/src/features/me/components/NightArcCard.tsx` | The hanging silhouette + hour axis + half-night rails + front-load sentence. |
| `frontend/src/features/me/components/PhaseAverageCard.tsx` | Average composition + both reference rows. |
| `frontend/src/features/me/components/RemDurationCard.tsx` | Duration↔REM scatter + derived sentence. |

**Modified** — backend: `SleepShotService.java`, `SleepShotDraftValidator.java`, `SleepLogEntity.java`, `SleepLogService.java`, `SleepLogMapper.java`, `1.0.0_master.yml` · contract: `api/common/common-schemas.yml`, `api/feature/sleep/sleep.yml`, `api/feature/sleep-shot/sleep-shot.yml` · frontend: `types.ts`, `biometricsApi.ts`, `sleep.ts`, `sleepShot.ts`, `msw/handlers.ts`, `SleepChart.tsx`, `SleepPage.tsx`, `SleepLogSheet.tsx`, `prototype.css` · docs: `docs/features/me.md`, `docs/features/_platform-design-system.md`, `docs/decisions/0015-hypnogram-display-only.md`.

---

## Task 1: Contract, migration, entity, persistence round-trip

**Files:**
- Modify: `api/common/common-schemas.yml`
- Modify: `api/feature/sleep/sleep.yml` (both `LogSleepRequest` and `SleepLogResponse`)
- Modify: `api/feature/sleep-shot/sleep-shot.yml` (`SleepShotDraftResponse`)
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607301200_mezo-fk9a_add_sleep_log_hypnogram.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append at end)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/entity/SleepHypnogram.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/entity/SleepLogEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepLogService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/mapper/SleepLogMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/SleepLogHypnogramIT.java`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: generated API model `io.mrkuhne.mezo.api.dto.Hypnogram` with `getBucketMin()`, `getStages()` and `Hypnogram.builder()`. Entity record `SleepHypnogram(Integer bucketMin, String stages)`. `LogSleepRequest.getHypnogram()`, `SleepLogResponse.getHypnogram()`, `SleepShotDraftResponse.builder().hypnogram(...)`. Frontend generated type `components['schemas']['Hypnogram']`.

- [ ] **Step 1: Add the shared `Hypnogram` schema**

In `api/common/common-schemas.yml`, append under `components.schemas` (after `SystemMessageList`):

```yaml
    Hypnogram:
      type: object
      description: >
        Quantised sleep-stage sequence read off the tracker's stage graph (mezo-fk9a).
        One letter per bucket, chronological, starting at the row's bedtime:
        D=deep, L=light, R=REM, A=awake. DISPLAY-ONLY — never the source of a ratio
        statistic; every phase percentage comes from the exact per-phase minute totals.
      required: [bucketMin, stages]
      properties:
        bucketMin:
          type: integer
          minimum: 1
          description: Minutes per letter (15 today; stored so a finer resolution needs no migration)
        stages:
          type: string
          pattern: '^[DLRA]+$'
          maxLength: 200
          description: One letter per bucket, chronological from bedtime
```

- [ ] **Step 2: Reference it from the three payloads**

In `api/feature/sleep/sleep.yml`, add to **both** `LogSleepRequest.properties` and `SleepLogResponse.properties` (after the `source` property in each):

```yaml
        hypnogram:
          $ref: '#/components/schemas/Hypnogram'
```

In `api/feature/sleep-shot/sleep-shot.yml`, add to `SleepShotDraftResponse.properties` (after `sourceQualityPct`, before `confidence`):

```yaml
        hypnogram:
          $ref: '#/components/schemas/Hypnogram'
```

- [ ] **Step 3: Regenerate the merged spec and the frontend types**

Run each as its own foreground call:

```bash
cd api/generate && npm run generate:api
```
```bash
cd frontend && pnpm generate:api
```

Expected: `api/openapi.yml` gains a `Hypnogram` schema; `frontend/src/data/_client/api.gen.ts` gains `Hypnogram` and the three payloads gain the field.

Verify: `grep -c "Hypnogram" api/openapi.yml frontend/src/data/_client/api.gen.ts` — both non-zero.

- [ ] **Step 4: Write the migration**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202607301200_mezo-fk9a_add_sleep_log_hypnogram.sql`:

```sql
-- Quantised sleep-stage sequence from the tracker screenshot (mezo-fk9a).
-- Display-only provenance: never queried on its own, never aggregated in SQL, always
-- read with its parent row — which is why this is a jsonb column and not a child table.
alter table sleep_log add column hypnogram jsonb;
```

Append to the END of `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202607301200_mezo-fk9a_add_sleep_log_hypnogram"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607301200_mezo-fk9a_add_sleep_log_hypnogram.sql
```

- [ ] **Step 5: Write the failing integration test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/SleepLogHypnogramIT.java`. Read [`integration_test_framework.md`](../../references/integration_test_framework.md) first; extend `AbstractIntegrationTest` and create the user via `UserPopulator` (never the seeded owner — a `@TestPropertySource` context gets its own unseeded DB in CI).

```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.Hypnogram;
import io.mrkuhne.mezo.api.dto.LogSleepRequest;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogService;
import io.mrkuhne.mezo.test.AbstractIntegrationTest;
import io.mrkuhne.mezo.test.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class SleepLogHypnogramIT extends AbstractIntegrationTest {

    @Autowired
    private SleepLogService sleepLogService;

    @Autowired
    private UserPopulator userPopulator;

    @Test
    void testLog_shouldRoundTripHypnogramAsTypedJsonb_whenProvided() {
        UUID userId = userPopulator.createUser().getId();
        LogSleepRequest req = new LogSleepRequest();
        req.setDate(LocalDate.of(2026, 7, 30));
        req.setHypnogram(Hypnogram.builder().bucketMin(15).stages("ALDDLRR").build());

        sleepLogService.log(userId, req);

        List<SleepLogResponse> rows = sleepLogService.list(userId);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getHypnogram()).isNotNull();
        assertThat(rows.getFirst().getHypnogram().getBucketMin()).isEqualTo(15);
        assertThat(rows.getFirst().getHypnogram().getStages()).isEqualTo("ALDDLRR");
    }

    @Test
    void testLog_shouldLeaveHypnogramNull_whenOmitted() {
        UUID userId = userPopulator.createUser().getId();
        LogSleepRequest req = new LogSleepRequest();
        req.setDate(LocalDate.of(2026, 7, 30));

        sleepLogService.log(userId, req);

        assertThat(sleepLogService.list(userId).getFirst().getHypnogram()).isNull();
    }
}
```

> **Two shapes to confirm against the real code before assuming this compiles.** (a) `UserPopulator`'s factory method name/signature — match the existing populator usage in a neighbouring sleep IT rather than inventing one; the rule that matters is *create the user, don't reach for the seeded owner*. (b) Whether the generated `LogSleepRequest` exposes setters or only a builder — check `frontend`-side siblings or an existing sleep IT and use `LogSleepRequest.builder()...build()` if setters are absent.

- [ ] **Step 6: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='SleepLogHypnogramIT'
```
Expected: FAIL — `LogSleepRequest.setHypnogram` does not exist yet, or the column is missing.

- [ ] **Step 7: Add the entity value record**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/entity/SleepHypnogram.java`:

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.entity;

/**
 * Typed jsonb envelope for a quantised sleep-stage sequence (mezo-fk9a): one letter per
 * {@code bucketMin} minutes from the row's bedtime — D=deep, L=light, R=REM, A=awake.
 * DISPLAY-ONLY provenance (ADR 0015): never the source of a phase ratio. Named
 * SleepHypnogram so it never collides with the generated API model {@code api.dto.Hypnogram}.
 */
public record SleepHypnogram(Integer bucketMin, String stages) {
}
```

- [ ] **Step 8: Map it on the entity**

In `SleepLogEntity.java`, add the two imports (`org.hibernate.annotations.JdbcTypeCode`, `org.hibernate.type.SqlTypes`) and append the field after `source`:

```java
    /** Quantised stage sequence from the screenshot (mezo-fk9a) — display-only provenance;
     *  null on manual rows and whenever the extraction failed cross-validation. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private SleepHypnogram hypnogram;
```

- [ ] **Step 9: Persist and map it**

In `SleepLogService.log(...)`, after the `setSourceQualityPct` line:

```java
        e.setHypnogram(req.getHypnogram() == null ? null
            : new SleepHypnogram(req.getHypnogram().getBucketMin(), req.getHypnogram().getStages()));
```

In `SleepLogMapper.java`, add the explicit value mapping (imports: the generated `Hypnogram` and the entity `SleepHypnogram`):

```java
    /** Entity record -> generated API model. Explicit so the jsonb field can never be
     *  silently dropped if the generator's model shape changes. */
    default Hypnogram map(SleepHypnogram h) {
        return h == null ? null
            : Hypnogram.builder().bucketMin(h.bucketMin()).stages(h.stages()).build();
    }
```

- [ ] **Step 10: Run the test to verify it passes**

```bash
cd backend && ./mvnw clean test -Dtest='SleepLogHypnogramIT,ArchitectureTest'
```
Expected: PASS, 2 tests.

- [ ] **Step 11: Commit**

```bash
git add api/ backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/ backend/src/main/resources/db/changelog/ backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/SleepLogHypnogramIT.java frontend/src/data/_client/api.gen.ts
git commit --no-verify -m "feat(sleep): hypnogram jsonb column + contract (mezo-fk9a)"
```

---

## Task 2: Prompt + the three validator checks

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepShotDraftValidator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepShotService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/SleepShotDraftValidatorHypnogramTest.java`

**Interfaces:**
- Consumes: `api.dto.Hypnogram` + `SleepShotDraftResponse.builder().hypnogram(...)` from Task 1.
- Produces: `Extracted` gains a trailing `String hypnogram` component — **the record's component order is `(bedtime, wakeup, asleepMin, inBedMin, awakeMin, lightMin, remMin, deepMin, qualityPct, hypnogram)`**. New public method `String acceptedHypnogram(Extracted e)` returning the validated string or `null`.

- [ ] **Step 1: Write the failing validator tests**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/SleepShotDraftValidatorHypnogramTest.java`:

```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Extracted;
import org.junit.jupiter.api.Test;

/** V1-V3 of the hypnogram gate (mezo-fk9a, spec section 4). Plain unit test: the validator
 *  is deterministic and has no collaborators. */
class SleepShotDraftValidatorHypnogramTest {

    private final SleepShotDraftValidator validator = new SleepShotDraftValidator();

    /** The canonical screenshot: 0:42 -> 9:03 (501 min span), 34 buckets, phases within tolerance. */
    private static final String GOOD = "ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR";

    private static Extracted with(String hypnogram) {
        return new Extracted("00:42", "09:03", 449, 501, 52, 206, 144, 100, 95, hypnogram);
    }

    @Test
    void testAcceptedHypnogram_shouldReturnTheSequence_whenAllChecksPass() {
        assertThat(validator.acceptedHypnogram(with(GOOD))).isEqualTo(GOOD);
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenAlphabetIsViolated() {
        assertThat(validator.acceptedHypnogram(with("ALDDXRRL"))).isNull();
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenLengthIsMoreThanTwoBucketsOff() {
        assertThat(validator.acceptedHypnogram(with("ALDDLRRL"))).isNull();
    }

    @Test
    void testAcceptedHypnogram_shouldTolerateTwoBucketsOfLengthDrift() {
        assertThat(validator.acceptedHypnogram(with(GOOD.substring(0, 32)))).isNotNull();
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenCompositionContradictsTheMinuteTotals() {
        // Right length (34), but almost all deep — the minute totals say deep is only 100 min.
        String allDeep = "D".repeat(32) + "LR";
        assertThat(validator.acceptedHypnogram(with(allDeep))).isNull();
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenPhaseMinutesAreMissing() {
        Extracted noPhases = new Extracted("00:42", "09:03", 449, 501, 52, null, 144, 100, 95, GOOD);
        assertThat(validator.acceptedHypnogram(noPhases)).isNull();
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenAbsent() {
        assertThat(validator.acceptedHypnogram(with(null))).isNull();
    }

    /** The whole point of keeping the two verdicts separate (spec section 4). */
    @Test
    void testScore_shouldBeUnaffected_whenTheHypnogramIsRejected() {
        var good = validator.score(with(GOOD), 0.6);
        var bad = validator.score(with("ALDDXRRL"), 0.6);
        assertThat(bad.confidence()).isEqualByComparingTo(good.confidence());
        assertThat(bad.needsReview()).isEqualTo(good.needsReview());
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='SleepShotDraftValidatorHypnogramTest'
```
Expected: FAIL — `Extracted` has 9 components, not 10; `acceptedHypnogram` does not exist.

- [ ] **Step 3: Extend the record and add the gate**

In `SleepShotDraftValidator.java`, add the constants beside the existing ones:

```java
    private static final int BUCKET_MIN = 15;
    private static final int LENGTH_TOLERANCE_BUCKETS = 2;
    private static final int HYPNOGRAM_TOLERANCE_MIN = 30;
    private static final double HYPNOGRAM_TOLERANCE_PCT = 0.35;
```

Extend the record (append the component; do not reorder):

```java
    public record Extracted(String bedtime, String wakeup, Integer asleepMin, Integer inBedMin,
                            Integer awakeMin, Integer lightMin, Integer remMin, Integer deepMin,
                            Integer qualityPct, String hypnogram) {}
```

Add the gate. Note it is deliberately NOT part of `score(...)`: a rejected drawing says nothing about the numbers the user is about to save.

```java
    /**
     * The hypnogram gate (mezo-fk9a, spec section 4) — V1 alphabet, V2 length against the
     * clock span, V3 composition against the exact per-phase minute totals. All-or-nothing:
     * a sequence with one stage misread is a wrong picture, and there is no honest partial
     * rendering. Deliberately independent of {@link #score}: confidence describes the numbers
     * the user is about to save, and a bad drawing must not scare them off good data.
     *
     * @return the sequence when every check passes, otherwise null
     */
    public String acceptedHypnogram(Extracted e) {
        String h = e.hypnogram() == null ? null : e.hypnogram().strip().toUpperCase();
        if (h == null || h.isEmpty()) {
            return null;
        }
        if (!h.matches("[DLRA]+")) { // V1
            return null;
        }
        if (!parses(e.bedtime()) || !parses(e.wakeup())) {
            return null;
        }
        int span = Math.floorMod(toMin(e.wakeup()) - toMin(e.bedtime()), 24 * 60);
        int expected = Math.round((float) span / BUCKET_MIN);
        if (Math.abs(h.length() - expected) > LENGTH_TOLERANCE_BUCKETS) { // V2
            return null;
        }
        // V3 precondition: without the three sleep-stage totals the composition is uncheckable,
        // and an uncheckable hypnogram is not worth drawing.
        if (e.deepMin() == null || e.lightMin() == null || e.remMin() == null) {
            return null;
        }
        return composesWith(h, 'D', e.deepMin()) && composesWith(h, 'L', e.lightMin())
            && composesWith(h, 'R', e.remMin())
            && (e.awakeMin() == null || composesWith(h, 'A', e.awakeMin()))
            ? h : null;
    }

    /** V3 for one stage. Loose on purpose: at 15-minute resolution a 100-minute total
     *  legitimately lands in 6-8 buckets. This catches a hallucinated sequence, not rounding. */
    private static boolean composesWith(String hypnogram, char stage, int actualMin) {
        int fromBuckets = (int) hypnogram.chars().filter(c -> c == stage).count() * BUCKET_MIN;
        double tolerance = Math.max(HYPNOGRAM_TOLERANCE_MIN, HYPNOGRAM_TOLERANCE_PCT * actualMin);
        return Math.abs(fromBuckets - actualMin) <= tolerance;
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dtest='SleepShotDraftValidatorHypnogramTest'
```
Expected: PASS, 8 tests.

- [ ] **Step 5: Extend the prompt and wire the draft response**

In `SleepShotService.java`, replace the `SYSTEM_PROMPT` text block with:

```java
    private static final String SYSTEM_PROMPT = """
        You read a screenshot of the Sleep Cycle app. Return ONLY a JSON object, no prose:
        {"bedtime":"H:mm or HH:mm 24h from 'Went to bed'","wakeup":"from 'Woke up'",
        "asleepMin":total asleep minutes from 'Asleep' (e.g. 7h 29m -> 449),
        "inBedMin":total minutes from 'In bed',"awakeMin":minutes from the 'Awake' stage,
        "lightMin":minutes from 'Light',"remMin":minutes from 'Dream' (Dream IS REM),
        "deepMin":minutes from 'Deep',"qualityPct":the 0-100 'Sleep quality' number,
        "hypnogram":a string with ONE letter per 15 minutes of the 'Sleep stages' graph,
        left to right, from 'Went to bed' to 'Woke up'. Letters: D=Deep, L=Light, R=Dream,
        A=Awake. Decide each 15-minute slot by the COLOUR of the curve there (white=Awake,
        magenta=Dream, light cyan=Light, dark teal=Deep), NOT by its height}
        Use null for anything not visible on the screenshot. Numbers as integers.
        """;
```

Update `normalize` to carry the new component through:

```java
    private static Extracted normalize(Extracted e) {
        return new Extracted(pad(e.bedtime()), pad(e.wakeup()), e.asleepMin(), e.inBedMin(),
            e.awakeMin(), e.lightMin(), e.remMin(), e.deepMin(), e.qualityPct(), e.hypnogram());
    }
```

In `extract(...)`, after the `Score score = ...` line:

```java
        String hypnogram = validator.acceptedHypnogram(e);
```

and add to the builder, after `.sourceQualityPct(e.qualityPct())`:

```java
            .hypnogram(hypnogram == null ? null
                : Hypnogram.builder().bucketMin(15).stages(hypnogram).build())
```

Extend the existing log line so a rejected drawing is visible in ops:

```java
        log.info("Sleep screenshot draft for {}: confidence={} needsReview={} hypnogram={}",
            userId, score.confidence(), score.needsReview(), hypnogram == null ? "rejected" : "ok");
```

Add the import `io.mrkuhne.mezo.api.dto.Hypnogram`.

- [ ] **Step 6: Verify compilation and the existing sleep-shot tests still pass**

```bash
cd backend && ./mvnw clean test -Dtest='SleepShot*,SleepLogHypnogramIT,ArchitectureTest'
```
Expected: PASS. Any pre-existing test constructing `Extracted` with 9 args must gain a trailing `null`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/ backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/
git commit --no-verify -m "feat(sleep): extract and cross-validate the 15-min hypnogram (mezo-fk9a)"
```

---

## Task 3: Frontend data layer — types, client, mock seed, MSW

**Files:**
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/me/biometricsApi.ts`
- Modify: `frontend/src/data/me/sleepShot.ts`
- Modify: `frontend/src/data/me/sleep.ts`
- Modify: `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Consumes: the generated types from Task 1.
- Produces: `Hypnogram { bucketMin: number; stages: string }` exported from `@/data/types`; `SleepEntry.hypnogram?: Hypnogram | null`; `SleepLogInput.hypnogram?: Hypnogram`; `SleepShotDraft.hypnogram: Hypnogram | null`. Mock seed `sleepLog` where **8 of 14** nights carry phase minutes and **5 of those** carry a hypnogram.

- [ ] **Step 1: Add the type**

In `frontend/src/data/types.ts`, above `export interface SleepEntry`:

```ts
/** Quantised stage sequence from a tracker screenshot (mezo-fk9a) — one letter per
 *  `bucketMin` minutes from `bedtime`: D=mély, L=könnyű, R=REM, A=éber. DISPLAY-ONLY:
 *  never the source of a phase ratio (ADR 0015). */
export interface Hypnogram {
  bucketMin: number
  stages: string
}
```

Add to `SleepEntry` (after `source`): `hypnogram?: Hypnogram | null`.
Add to `SleepLogInput` (after `deepMin`): `hypnogram?: Hypnogram`.
Add to `SleepShotDraft` (after `sourceQualityPct`): `hypnogram: Hypnogram | null`.

- [ ] **Step 2: Pass it through the client**

In `biometricsApi.ts`, in `sleepApi.log`'s body object after `remMin: input.remMin, deepMin: input.deepMin,`:

```ts
        hypnogram: input.hypnogram,
```

In `sleepShotApi.extract`'s `.then(r => ({ ... }))`, after `sourceQualityPct`:

```ts
        hypnogram: r.hypnogram ?? null,
```

- [ ] **Step 3: Give the mock draft a hypnogram**

In `frontend/src/data/me/sleepShot.ts`, add to `MOCK_SLEEP_SHOT_DRAFT` after `sourceQualityPct: 95,`:

```ts
  // 34 buckets x 15 min = 510 min, within tolerance of the 501-minute 00:42 -> 09:03 span.
  hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' },
```

- [ ] **Step 4: Seed the mock log**

In `frontend/src/data/me/sleep.ts`, add phase fields to **8** of the 14 nights, leaving 6 untouched so the sparse-series handling is exercised. For each enriched night the three sleep phases must sum to `duration * 60` (±2 min) so `phaseBreakdown` agrees with the displayed hours. Add a hypnogram to **5** of them whose bucket count is within 2 of `round(spanMin / 15)`.

Use exactly these replacements (the other six lines stay as they are):

```ts
  { date: '2026-05-10', bedtime: '23:40', wakeup: '07:00', duration: 7.3, quality: 7, awakenings: 1, mealToSleep: 95, notes: 'Vacsora csúszott', inBedMin: 460, awakeMin: 22, lightMin: 200, remMin: 140, deepMin: 98, sourceQualityPct: 82, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ALDDLLRRLDDLLRRLDDLLRRLALDDLRRR' } },
  { date: '2026-05-11', bedtime: '23:55', wakeup: '07:20', duration: 7.4, quality: 6, awakenings: 2, mealToSleep: 80, notes: 'Volleyball szombat · late dinner', inBedMin: 475, awakeMin: 31, lightMin: 210, remMin: 132, deepMin: 102, sourceQualityPct: 78, source: 'screenshot' },
  { date: '2026-05-13', bedtime: '23:10', wakeup: '06:50', duration: 7.7, quality: 8, awakenings: 1, mealToSleep: 140, notes: null, inBedMin: 480, awakeMin: 18, lightMin: 208, remMin: 148, deepMin: 106, sourceQualityPct: 88, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ADDLLRRLDDLLRRRLDDLLRRLLDDLRRRRR' } },
  { date: '2026-05-15', bedtime: '00:15', wakeup: '07:00', duration: 6.8, quality: 5, awakenings: 3, mealToSleep: 65, notes: 'Magnézium kihagyva · késő szénhidrát', inBedMin: 445, awakeMin: 37, lightMin: 196, remMin: 112, deepMin: 100, sourceQualityPct: 64, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ALDDLLRLDDLLARLDDLLRRLALDDLR' } },
  { date: '2026-05-16', bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 150, notes: null, inBedMin: 468, awakeMin: 20, lightMin: 204, remMin: 142, deepMin: 104, sourceQualityPct: 86, source: 'screenshot' },
  { date: '2026-05-18', bedtime: '23:50', wakeup: '07:10', duration: 7.3, quality: 7, awakenings: 2, mealToSleep: 95, notes: 'Volleyball + késő vacsora', inBedMin: 462, awakeMin: 24, lightMin: 202, remMin: 138, deepMin: 98, sourceQualityPct: 80, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ALDDLLRRLDDLLRRLDDLLRRLALDDLRRR' } },
  { date: '2026-05-19', bedtime: '22:45', wakeup: '06:30', duration: 7.8, quality: 9, awakenings: 0, mealToSleep: 160, notes: 'Reta D1 · pihenve, magnézium ment', inBedMin: 478, awakeMin: 13, lightMin: 210, remMin: 152, deepMin: 106, sourceQualityPct: 92, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ADDLLRRLDDLLRRRLDDLLRRLLDDLRRRR' } },
```

For the **eighth** enriched night, apply the same treatment to the last entry in the array (the most recent night — it drives the hero, `NightArcCard` and the front-load sentence, so it must carry both phases and a hypnogram). Read the file, take its existing `date`/`bedtime`/`wakeup`/`duration`/`quality`/`awakenings`/`mealToSleep`/`notes` **unchanged**, and append:

```ts
inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100, sourceQualityPct: 95, source: 'screenshot', hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' }
```

> Then adjust that row's `duration` to `7.5` and its `bedtime`/`wakeup` to `'00:42'`/`'09:03'` so the phases, the span and the hypnogram length all agree. This is the canonical screenshot night and it is what the components are designed against.

- [ ] **Step 5: Enrich the MSW rows**

In `frontend/src/test/msw/handlers.ts`, replace the GET sleep handler with three rows (real mode needs enough nights that the average card's 3-night gate can be exercised, and one row without phases so the sparse path is covered):

```ts
  http.get(`${API_BASE}/api/biometrics/sleep`, () =>
    HttpResponse.json([
      { id: 's1', date: '2026-05-30', bedtime: '23:10', wakeup: '06:40', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null },
      { id: 's2', date: '2026-05-31', bedtime: '23:20', wakeup: '06:50', duration: 7.4, quality: 8, awakenings: 1, mealToSleep: 0, notes: null,
        inBedMin: 470, awakeMin: 24, lightMin: 204, remMin: 140, deepMin: 100, sourceQualityPct: 85, source: 'screenshot' },
      { id: 's3', date: '2026-06-01', bedtime: '00:42', wakeup: '09:03', duration: 7.5, quality: 9, awakenings: 1, mealToSleep: 0, notes: null,
        inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100, sourceQualityPct: 95, source: 'screenshot',
        hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' } },
    ]),
  ),
```

In the POST handler, echo the field back — add `hypnogram: body.hypnogram ?? null,` to the response object and widen the body type with `hypnogram?: { bucketMin: number; stages: string } | null`.

- [ ] **Step 6: Run the existing data-layer tests in both modes**

```bash
cd frontend && pnpm test sleepHooks sleepShotHooks
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test sleepHooks sleepShotHooks
```
Expected: PASS in both. Use Bash `timeout: 600000`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/ frontend/src/test/msw/handlers.ts
git commit --no-verify -m "feat(sleep): carry the hypnogram through the FE data layer + seed phase data (mezo-fk9a)"
```

---

## Task 4: `sleepPhases.ts` — all the maths, TDD

**Files:**
- Create: `frontend/src/features/me/logic/sleepPhases.ts`
- Test: `frontend/src/features/me/logic/sleepPhases.test.ts`

**Interfaces:**
- Consumes: `SleepEntry`, `Hypnogram` from `@/data/types` (Task 3).
- Produces: everything below. Later tasks import **only** from `@/features/me/logic/sleepPhases`.

```ts
export type Stage = 'D' | 'L' | 'R' | 'A'
export interface PhaseBreakdown { deep, light, rem, awake, asleep, inBed: number }
export const DEEP_REF: { lo: 13, hi: 23 }
export const REM_REF: { lo: 20, hi: 25 }
export const MIN_AVERAGE_NIGHTS = 3
export const MIN_DEEP_BUCKETS = 4
export const MIN_NIGHTS_PER_SIDE = 3
export const SHORT_NIGHT_H = 7
export function phaseBreakdown(entry: SleepEntry): PhaseBreakdown | null
export function phasePct(b: PhaseBreakdown, key: 'deep' | 'light' | 'rem'): number
export function averageBreakdown(entries: SleepEntry[], windowDays: number): { avg: PhaseBreakdown; nights: number } | null
export function parseHypnogram(entry: SleepEntry): Stage[] | null
export function halfNightSplit(stages: Stage[], bucketMin: number): { first: PhaseBreakdown; second: PhaseBreakdown }
export function deepFrontLoadPct(stages: Stage[]): number | null
export function remByDuration(entries: SleepEntry[]): { shortAvg, longAvg, deltaMin, shortNights, longNights: number } | null
```

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/me/logic/sleepPhases.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { SleepEntry } from '@/data/types'
import {
  averageBreakdown, deepFrontLoadPct, halfNightSplit, parseHypnogram,
  phaseBreakdown, phasePct, remByDuration,
} from '@/features/me/logic/sleepPhases'

const base: SleepEntry = {
  date: '2026-05-22', bedtime: '00:42', wakeup: '09:03', duration: 7.5,
  quality: 9, awakenings: 1, mealToSleep: 0, notes: null,
}
const night = (over: Partial<SleepEntry> = {}): SleepEntry => ({
  ...base, inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100, ...over,
})

describe('phaseBreakdown', () => {
  it('computes asleep as the sum of the three sleep stages, not from duration', () => {
    // duration says 7.5h = 450 min; the stages sum to 450 — but a mismatched duration
    // must not change the answer, because duration is rounded hours.
    const b = phaseBreakdown(night({ duration: 6.1 }))!
    expect(b.asleep).toBe(450)
    expect(b.inBed).toBe(502)
  })

  it('returns null when any of deep/light/rem is missing', () => {
    expect(phaseBreakdown(night({ deepMin: null }))).toBeNull()
    expect(phaseBreakdown(night({ lightMin: null }))).toBeNull()
    expect(phaseBreakdown(night({ remMin: null }))).toBeNull()
  })

  it('treats a missing awake as zero rather than as missing data', () => {
    const b = phaseBreakdown(night({ awakeMin: null }))!
    expect(b.awake).toBe(0)
    expect(b.inBed).toBe(450)
  })

  it('returns null on a plain manual row', () => {
    expect(phaseBreakdown(base)).toBeNull()
  })
})

describe('phasePct', () => {
  it('denominates on asleep, never on inBed', () => {
    const b = phaseBreakdown(night())!
    expect(Math.round(phasePct(b, 'deep'))).toBe(22)  // 100/450, not 100/502
    expect(Math.round(phasePct(b, 'rem'))).toBe(32)
  })
})

describe('averageBreakdown', () => {
  it('returns null below three qualifying nights', () => {
    expect(averageBreakdown([night(), night(), base], 14)).toBeNull()
  })

  it('averages only the qualifying nights and reports how many', () => {
    const r = averageBreakdown([base, night({ deepMin: 90 }), night(), night({ deepMin: 110 })], 14)!
    expect(r.nights).toBe(3)
    expect(r.avg.deep).toBe(100)
  })

  it('keeps the parts summing to the whole after rounding', () => {
    const r = averageBreakdown([night({ deepMin: 99 }), night({ deepMin: 100 }), night({ deepMin: 101 })], 14)!
    expect(r.avg.asleep).toBe(r.avg.deep + r.avg.light + r.avg.rem)
    expect(r.avg.inBed).toBe(r.avg.asleep + r.avg.awake)
  })

  it('honours the window', () => {
    const many = [night(), night(), night(), base, base]
    expect(averageBreakdown(many, 2)).toBeNull()
  })
})

describe('parseHypnogram', () => {
  it('returns the stage array', () => {
    expect(parseHypnogram(night({ hypnogram: { bucketMin: 15, stages: 'ALDR' } }))).toEqual(['A', 'L', 'D', 'R'])
  })

  it('returns null when absent or empty', () => {
    expect(parseHypnogram(night())).toBeNull()
    expect(parseHypnogram(night({ hypnogram: { bucketMin: 15, stages: '' } }))).toBeNull()
  })

  it('rejects an out-of-alphabet sequence rather than dropping the bad letters', () => {
    expect(parseHypnogram(night({ hypnogram: { bucketMin: 15, stages: 'ALDX' } }))).toBeNull()
  })
})

describe('halfNightSplit', () => {
  it('gives the middle bucket to the first half on an odd count', () => {
    const { first, second } = halfNightSplit(['D', 'D', 'D', 'R', 'R'], 15)
    expect(first.deep).toBe(45)
    expect(second.rem).toBe(30)
  })

  it('scales by the bucket width from the data', () => {
    const { first } = halfNightSplit(['D', 'D'], 30)
    expect(first.deep).toBe(30)
  })
})

describe('deepFrontLoadPct', () => {
  it('returns the share of deep buckets in the first half', () => {
    expect(deepFrontLoadPct(['D', 'D', 'D', 'R', 'D', 'R'])).toBe(75)
  })

  it('returns null below four deep buckets, where the number would be noise', () => {
    expect(deepFrontLoadPct(['D', 'D', 'D', 'R', 'R', 'R'])).toBeNull()
  })
})

describe('remByDuration', () => {
  const short = (rem: number) => night({ lightMin: 150, remMin: rem, deepMin: 90, awakeMin: 20 })
  const long = (rem: number) => night({ lightMin: 210, remMin: rem, deepMin: 105, awakeMin: 20 })

  it('returns null unless there are three nights on each side of 7h', () => {
    expect(remByDuration([short(100), short(105), short(110), long(150), long(155)])).toBeNull()
  })

  it('reports the REM gap between short and long nights', () => {
    const r = remByDuration([
      short(100), short(110), short(120), long(140), long(150), long(160),
    ])!
    expect(r.shortNights).toBe(3)
    expect(r.longNights).toBe(3)
    expect(r.shortAvg).toBe(110)
    expect(r.longAvg).toBe(150)
    expect(r.deltaMin).toBe(40)
  })

  it('classifies by the computed asleep sum, not by the duration field', () => {
    // asleep = 150+120+90 = 360 min = 6h, even though duration claims 7.5
    const r = remByDuration([
      short(100), short(110), short(120), long(140), long(150), long(160),
    ])!
    expect(r.shortAvg).toBeLessThan(r.longAvg)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && pnpm test sleepPhases
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/me/logic/sleepPhases.ts`:

```ts
import type { SleepEntry } from '@/data/types'

/** The alphabet of a quantised hypnogram (mezo-fk9a): D=mély, L=könnyű, R=REM, A=éber. */
export type Stage = 'D' | 'L' | 'R' | 'A'

export interface PhaseBreakdown {
  deep: number
  light: number
  rem: number
  awake: number
  /** deep + light + rem — the denominator for every phase percentage. */
  asleep: number
  /** asleep + awake — the denominator for the rail's segment widths. */
  inBed: number
}

/** Adult reference ranges as a share of total sleep. Informational, never a grade (spec section 9). */
export const DEEP_REF = { lo: 13, hi: 23 } as const
export const REM_REF = { lo: 20, hi: 25 } as const

/** An average of two nights is a lie with a number attached. */
export const MIN_AVERAGE_NIGHTS = 3
/** Below this the front-load percentage is quantisation noise wearing a number's clothes. */
export const MIN_DEEP_BUCKETS = 4
/** Six nights all on one side of the line cannot support the claim. */
export const MIN_NIGHTS_PER_SIDE = 3
export const SHORT_NIGHT_H = 7

const STAGES: readonly Stage[] = ['D', 'L', 'R', 'A']

function make(deep: number, light: number, rem: number, awake: number): PhaseBreakdown {
  const asleep = deep + light + rem
  return { deep, light, rem, awake, asleep, inBed: asleep + awake }
}

/**
 * The night's phase composition, or null when the row cannot support one.
 * `asleep` is always the computed sum — never `entry.duration`, which is rounded hours
 * and would disagree with the minute totals.
 */
export function phaseBreakdown(entry: SleepEntry): PhaseBreakdown | null {
  const { deepMin, lightMin, remMin } = entry
  if (deepMin == null || lightMin == null || remMin == null) return null
  const b = make(deepMin, lightMin, remMin, entry.awakeMin ?? 0)
  return b.asleep > 0 ? b : null
}

/** Always denominated on total sleep — awake time is fragmentation, not a sleep stage. */
export function phasePct(b: PhaseBreakdown, key: 'deep' | 'light' | 'rem'): number {
  return (b[key] / b.asleep) * 100
}

export function averageBreakdown(
  entries: SleepEntry[],
  windowDays: number,
): { avg: PhaseBreakdown; nights: number } | null {
  const parts = entries
    .slice(-windowDays)
    .map(phaseBreakdown)
    .filter((b): b is PhaseBreakdown => b !== null)
  if (parts.length < MIN_AVERAGE_NIGHTS) return null
  const mean = (pick: (b: PhaseBreakdown) => number) =>
    Math.round(parts.reduce((sum, b) => sum + pick(b), 0) / parts.length)
  // Rebuilt through make() so the rounded parts always sum to the whole — otherwise the
  // rail's segments would not fill it.
  const avg = make(mean(b => b.deep), mean(b => b.light), mean(b => b.rem), mean(b => b.awake))
  return { avg, nights: parts.length }
}

/** All-or-nothing: a sequence with an unknown letter is a wrong picture, not a partial one. */
export function parseHypnogram(entry: SleepEntry): Stage[] | null {
  const stages = entry.hypnogram?.stages
  if (!stages) return null
  const chars = [...stages] as Stage[]
  return chars.length > 0 && chars.every(c => STAGES.includes(c)) ? chars : null
}

function countStages(stages: Stage[], bucketMin: number): PhaseBreakdown {
  const minutes = (s: Stage) => stages.filter(c => c === s).length * bucketMin
  return make(minutes('D'), minutes('L'), minutes('R'), minutes('A'))
}

/** Buckets are uniform, so an index split is a time split. Odd count: the middle joins the first. */
export function halfNightSplit(
  stages: Stage[],
  bucketMin: number,
): { first: PhaseBreakdown; second: PhaseBreakdown } {
  const mid = Math.ceil(stages.length / 2)
  return {
    first: countStages(stages.slice(0, mid), bucketMin),
    second: countStages(stages.slice(mid), bucketMin),
  }
}

/**
 * Share of deep buckets landing in the first half. A ratio between two halves of the same
 * noisy series, so the quantisation error largely cancels — which is why this is the one
 * statistic the hypnogram is allowed to produce (spec section 2).
 */
export function deepFrontLoadPct(stages: Stage[]): number | null {
  const total = stages.filter(c => c === 'D').length
  if (total < MIN_DEEP_BUCKETS) return null
  const mid = Math.ceil(stages.length / 2)
  const inFirst = stages.slice(0, mid).filter(c => c === 'D').length
  return Math.round((inFirst / total) * 100)
}

export function remByDuration(entries: SleepEntry[]): {
  shortAvg: number
  longAvg: number
  deltaMin: number
  shortNights: number
  longNights: number
} | null {
  const parts = entries
    .map(phaseBreakdown)
    .filter((b): b is PhaseBreakdown => b !== null)
  // Classified by the computed asleep sum, never by the rounded duration field.
  const short = parts.filter(b => b.asleep / 60 < SHORT_NIGHT_H)
  const long = parts.filter(b => b.asleep / 60 >= SHORT_NIGHT_H)
  if (short.length < MIN_NIGHTS_PER_SIDE || long.length < MIN_NIGHTS_PER_SIDE) return null
  const avgRem = (xs: PhaseBreakdown[]) => Math.round(xs.reduce((s, b) => s + b.rem, 0) / xs.length)
  const shortAvg = avgRem(short)
  const longAvg = avgRem(long)
  return {
    shortAvg, longAvg, deltaMin: longAvg - shortAvg,
    shortNights: short.length, longNights: long.length,
  }
}
```

- [ ] **Step 4: Run the tests in both modes**

```bash
cd frontend && pnpm test sleepPhases
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test sleepPhases
```
Expected: PASS in both (the module is pure, but the gate is the house rule).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/logic/sleepPhases.ts frontend/src/features/me/logic/sleepPhases.test.ts
git commit --no-verify -m "feat(sleep): sleepPhases logic module — composition, averages, half-night split (mezo-fk9a)"
```

---

## Task 5: `PhaseRail` + `PhaseReferenceRow` + the CSS family

**Files:**
- Create: `frontend/src/features/me/components/PhaseRail.tsx`
- Create: `frontend/src/features/me/components/PhaseRail.test.tsx`
- Create: `frontend/src/features/me/components/PhaseReferenceRow.tsx`
- Create: `frontend/src/features/me/components/PhaseReferenceRow.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `PhaseBreakdown` from Task 4.
- Produces:
  - `<PhaseRail breakdown={b} showLegend?={boolean} height?={number} />`
  - `<PhaseReferenceRow label={string} pct={number} range={{lo,hi}} color={string} />`
  - `export function fmtHm(min: number): string` from `PhaseRail.tsx` (`'1ó 40p'` / `'52p'`).
  - CSS classes `.phrail`, `.phleg`, `.phleg-it`, `.phleg-dot`, `.phleg-v`, `.phleg-p`, `.phref`, `.phref-t`, `.phref-bar`, `.phref-band`, `.phref-pin`; tokens `--ph-deep`, `--ph-light`, `--ph-rem`, `--ph-awake`.

- [ ] **Step 1: Add the tokens and the CSS family**

In `frontend/src/styles/prototype.css`, add the four tokens to the **`:root` block** (next to the other Napív aliases). They are aliases, so the dark override block stays empty — that is what makes them theme-follow:

```css
  /* Sleep-phase accents (mezo-fk9a) — aliases onto Napív, so the dark swap carries them. */
  --ph-deep:  var(--lav-deep);
  --ph-light: var(--sky);
  --ph-rem:   var(--rose);
  --ph-awake: var(--faint);
```

Then add the class family next to the existing `.sstat*` / `.sesc*` sleep block:

```css
/* ===== Sleep-phase family (mezo-fk9a) — feature-scoped to the sleep surfaces ===== */
.phrail { display: flex; overflow: hidden; background: var(--surface-2); }
.phrail i { display: block; height: 100%; }

.phleg { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 14px; margin-top: 12px; }
.phleg-it { display: flex; align-items: baseline; gap: 7px; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); }
.phleg-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; align-self: center; }
.phleg-v { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 800; color: var(--text-primary); }
.phleg-p { font-size: 10px; color: var(--faint); font-weight: 800; min-width: 30px; text-align: right; font-variant-numeric: tabular-nums; }

.phref-t { display: flex; align-items: baseline; gap: 6px; font-size: 11px; font-weight: 800; color: var(--text-secondary); margin-bottom: 5px; }
.phref-t b { font-family: var(--ff-display); font-size: 13.5px; color: var(--text-primary); }
.phref-t em { font-style: normal; margin-left: auto; font-size: 10px; font-weight: 800; color: var(--faint); }
.phref-bar { position: relative; height: 6px; border-radius: 3px; background: var(--surface-2); }
.phref-band { position: absolute; top: 0; bottom: 0; border-radius: 3px; background: color-mix(in srgb, var(--sage) 35%, transparent); }
.phref-pin { position: absolute; top: -3px; width: 3px; height: 12px; border-radius: 2px; transform: translateX(-1.5px); }
```

- [ ] **Step 2: Write the failing component tests**

Create `frontend/src/features/me/components/PhaseRail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhaseRail } from '@/features/me/components/PhaseRail'
import type { PhaseBreakdown } from '@/features/me/logic/sleepPhases'

const b: PhaseBreakdown = { deep: 100, light: 206, rem: 144, awake: 52, asleep: 450, inBed: 502 }

describe('PhaseRail', () => {
  it('labels every stage with its minutes', () => {
    render(<PhaseRail breakdown={b} />)
    expect(screen.getByText('Mély')).toBeInTheDocument()
    expect(screen.getByText('1ó 40p')).toBeInTheDocument()
    expect(screen.getByText('3ó 26p')).toBeInTheDocument()
    expect(screen.getByText('52p')).toBeInTheDocument()
  })

  it('shows percentages against total sleep for the three sleep stages', () => {
    render(<PhaseRail breakdown={b} />)
    expect(screen.getByText('22%')).toBeInTheDocument()  // 100/450
    expect(screen.getByText('32%')).toBeInTheDocument()  // 144/450
    expect(screen.getByText('46%')).toBeInTheDocument()  // 206/450
  })

  it('gives awake minutes but no percentage — it is not a sleep stage', () => {
    render(<PhaseRail breakdown={b} />)
    expect(screen.getByText('Éber')).toBeInTheDocument()
    expect(screen.queryByText('12%')).not.toBeInTheDocument()
  })

  it('can render without the legend', () => {
    render(<PhaseRail breakdown={b} showLegend={false} />)
    expect(screen.queryByText('Mély')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('omits a zero-length stage entirely', () => {
    render(<PhaseRail breakdown={{ ...b, awake: 0, inBed: 450 }} />)
    expect(screen.queryByText('Éber')).not.toBeInTheDocument()
  })
})
```

Create `frontend/src/features/me/components/PhaseReferenceRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhaseReferenceRow } from '@/features/me/components/PhaseReferenceRow'
import { DEEP_REF } from '@/features/me/logic/sleepPhases'

describe('PhaseReferenceRow', () => {
  it('reports a value inside the band as located, never as a grade', () => {
    render(<PhaseReferenceRow label="Mély" pct={22} range={DEEP_REF} color="var(--ph-deep)" />)
    expect(screen.getByText('22%')).toBeInTheDocument()
    expect(screen.getByText(/a sávban/)).toBeInTheDocument()
    expect(screen.getByText(/13–23%/)).toBeInTheDocument()
  })

  it('says above the band, not "too much"', () => {
    render(<PhaseReferenceRow label="Mély" pct={31} range={DEEP_REF} color="var(--ph-deep)" />)
    expect(screen.getByText(/a sáv felett/)).toBeInTheDocument()
  })

  it('says below the band, not "low"', () => {
    render(<PhaseReferenceRow label="Mély" pct={7} range={DEEP_REF} color="var(--ph-deep)" />)
    expect(screen.getByText(/a sáv alatt/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify they fail**

```bash
cd frontend && pnpm test PhaseRail PhaseReferenceRow
```
Expected: FAIL — modules not found.

- [ ] **Step 4: Write `PhaseRail`**

Create `frontend/src/features/me/components/PhaseRail.tsx`:

```tsx
import type { PhaseBreakdown } from '@/features/me/logic/sleepPhases'

/** Stack order — deep at the base, awake last: the night read from its floor upwards. */
const SEGMENTS = [
  { key: 'deep', label: 'Mély', color: 'var(--ph-deep)' },
  { key: 'light', label: 'Könnyű', color: 'var(--ph-light)' },
  { key: 'rem', label: 'REM', color: 'var(--ph-rem)' },
  { key: 'awake', label: 'Éber', color: 'var(--ph-awake)' },
] as const

export function fmtHm(min: number): string {
  const h = Math.floor(min / 60)
  return h > 0 ? `${h}ó ${min % 60}p` : `${min}p`
}

/**
 * The proportional phase rail (mezo-fk9a). Segment WIDTHS denominate on `inBed` so the four
 * segments fill the rail; legend PERCENTAGES denominate on `asleep` because awake time is
 * fragmentation, not a sleep stage. The two denominators differ on purpose.
 */
export function PhaseRail({
  breakdown,
  showLegend = true,
  height = 13,
}: {
  breakdown: PhaseBreakdown
  showLegend?: boolean
  height?: number
}) {
  const label = SEGMENTS
    .filter(s => breakdown[s.key] > 0)
    .map(s => `${s.label} ${fmtHm(breakdown[s.key])}`)
    .join(', ')

  return (
    <>
      <div
        className="phrail"
        style={{ height, borderRadius: height / 2 }}
        role="img"
        aria-label={`Alvásfázisok: ${label}`}
      >
        {SEGMENTS.map(s =>
          breakdown[s.key] > 0 ? (
            <i
              key={s.key}
              style={{ width: `${(breakdown[s.key] / breakdown.inBed) * 100}%`, background: s.color }}
            />
          ) : null,
        )}
      </div>
      {showLegend && (
        <div className="phleg">
          {SEGMENTS.map(s =>
            breakdown[s.key] > 0 ? (
              <div key={s.key} className="phleg-it">
                <span className="phleg-dot" style={{ background: s.color }} />
                {s.label}
                <span className="phleg-v">{fmtHm(breakdown[s.key])}</span>
                {s.key !== 'awake' && (
                  <span className="phleg-p">
                    {Math.round((breakdown[s.key] / breakdown.asleep) * 100)}%
                  </span>
                )}
              </div>
            ) : null,
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 5: Write `PhaseReferenceRow`**

Create `frontend/src/features/me/components/PhaseReferenceRow.tsx`:

```tsx
/** The bar spans 0-40% of total sleep — wide enough that both reference bands and any
 *  realistic value land inside it without a scale label. */
const SCALE_PCT = 40

/**
 * One reference row (mezo-fk9a). Verdicts are LOCATIONAL by design (spec section 9): the band
 * is sage, never red, and the copy says where the value sits — never that it is wrong.
 */
export function PhaseReferenceRow({
  label,
  pct,
  range,
  color,
}: {
  label: string
  pct: number
  range: { lo: number; hi: number }
  color: string
}) {
  const verdict = pct < range.lo ? 'a sáv alatt' : pct > range.hi ? 'a sáv felett' : 'a sávban'
  return (
    <div className="phref">
      <div className="phref-t">
        {label} <b>{Math.round(pct)}%</b>
        <em>{verdict} · ref {range.lo}–{range.hi}%</em>
      </div>
      <div className="phref-bar">
        <span
          className="phref-band"
          style={{
            left: `${(range.lo / SCALE_PCT) * 100}%`,
            width: `${((range.hi - range.lo) / SCALE_PCT) * 100}%`,
          }}
        />
        <span
          className="phref-pin"
          style={{ left: `${Math.min(100, (pct / SCALE_PCT) * 100)}%`, background: color }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run the tests in both modes**

```bash
cd frontend && pnpm test PhaseRail PhaseReferenceRow
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test PhaseRail PhaseReferenceRow
```
Expected: PASS in both, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/me/components/PhaseRail.tsx frontend/src/features/me/components/PhaseRail.test.tsx frontend/src/features/me/components/PhaseReferenceRow.tsx frontend/src/features/me/components/PhaseReferenceRow.test.tsx frontend/src/styles/prototype.css
git commit --no-verify -m "feat(sleep): PhaseRail + PhaseReferenceRow + the .ph* CSS family (mezo-fk9a)"
```

---

## Task 6: Hero phase block + the log-sheet review strip + the manual-save leak fix

**Files:**
- Modify: `frontend/src/features/me/pages/SleepPage.tsx`
- Modify: `frontend/src/features/me/sheets/SleepLogSheet.tsx`
- Test: `frontend/src/features/me/pages/SleepPage.test.tsx` (extend)
- Test: `frontend/src/features/me/sheets/SleepLogSheet.test.tsx` (extend)

**Interfaces:**
- Consumes: `PhaseRail`, `PhaseReferenceRow`, `fmtHm` (Task 5); `phaseBreakdown`, `phasePct`, `DEEP_REF`, `REM_REF` (Task 4).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/features/me/pages/SleepPage.test.tsx` (match the file's existing render helper and imports rather than inventing new ones):

```tsx
  it('renders the phase rail and both reference rows for a screenshot night', async () => {
    renderSleepPage()
    expect(await screen.findByText('Mély')).toBeInTheDocument()
    expect(screen.getByText('REM')).toBeInTheDocument()
    expect(screen.getAllByText(/ref \d+–\d+%/).length).toBe(2)
  })
```

Append to `frontend/src/features/me/sheets/SleepLogSheet.test.tsx`:

```tsx
  it('keeps the extracted phase fields when the user switches back to manual', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<SleepLogSheet onClose={() => {}} onSave={onSave} />, { wrapper })

    // 1. switch to screenshot mode and upload, driving the sheet to the review step
    await user.click(screen.getByText('Screenshot'))
    const file = new File(['x'], 'shot.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/screenshot kiválasztása/i), file)
    await screen.findByText('Mély')            // the review-step rail has rendered

    // 2. flip back to manual — this is the path that used to drop everything
    await user.click(screen.getByText('Kézi'))
    await user.click(screen.getByRole('button', { name: /ment/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      deepMin: 100, lightMin: 206, remMin: 144, awakeMin: 52,
      sourceQualityPct: 95, source: 'screenshot',
    }))
  })
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd frontend && pnpm test SleepPage SleepLogSheet
```
Expected: FAIL on the two new cases.

- [ ] **Step 3: Add the hero phase block**

In `SleepPage.tsx`, add the imports and derive the breakdown next to the existing `lastEfficiency` / `lastBedDelta` derivations:

```tsx
import { PhaseRail } from '@/features/me/components/PhaseRail'
import { PhaseReferenceRow } from '@/features/me/components/PhaseReferenceRow'
import { DEEP_REF, phaseBreakdown, phasePct, REM_REF } from '@/features/me/logic/sleepPhases'
```

```tsx
  const lastPhases = lastNight ? phaseBreakdown(lastNight) : null
```

Inside the hero card, insert this block **after** the day-anchor readout `<div className="col" style={{ gap: 3, marginTop: 8 }}>…</div>` and **before** the `{lastNight.notes && …}` block:

```tsx
                {lastPhases && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                        Fázisok
                      </span>
                      {lastNight.source === 'screenshot' && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--faint)' }}>screenshotból</span>
                      )}
                    </div>
                    <PhaseRail breakdown={lastPhases} height={20} />
                    <div className="col" style={{ gap: 11, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                      <PhaseReferenceRow label="Mély" pct={phasePct(lastPhases, 'deep')} range={DEEP_REF} color="var(--ph-deep)" />
                      <PhaseReferenceRow label="REM" pct={phasePct(lastPhases, 'rem')} range={REM_REF} color="var(--ph-rem)" />
                    </div>
                  </div>
                )}
```

- [ ] **Step 4: Replace the review strip and fix the leak**

In `SleepLogSheet.tsx`, replace the text-strip block at the `{isShot && draft && (draft.awakeMin != null || draft.sourceQualityPct != null) && (…)}` site with a rail. Derive it from the draft:

```tsx
import { PhaseRail } from '@/features/me/components/PhaseRail'
import { phaseBreakdown } from '@/features/me/logic/sleepPhases'
```

```tsx
  // The draft is shaped like a SleepEntry for this purpose — reuse the one breakdown rule
  // rather than re-deriving it here.
  const draftPhases = draft
    ? phaseBreakdown({
        ...EMPTY_ENTRY_SHAPE,
        awakeMin: draft.awakeMin, lightMin: draft.lightMin,
        remMin: draft.remMin, deepMin: draft.deepMin,
      })
    : null
```

where `EMPTY_ENTRY_SHAPE` is a module-level const supplying the non-phase `SleepEntry` fields (`date: '', bedtime: '', wakeup: '', duration: 0, quality: 0, awakenings: 0, mealToSleep: 0, notes: null`).

Render:

```tsx
              {isShot && draftPhases && (
                <div style={{ padding: '10px 12px 0' }}>
                  <PhaseRail breakdown={draftPhases} />
                </div>
              )}
```

**The leak fix.** Extract the phase payload once and use it in **both** save paths, so switching back to `Kézi` after an extraction no longer discards it:

```tsx
  /** Phase fields ride along whenever an extraction happened, regardless of the active mode —
   *  switching back to 'Kézi' used to discard them silently (mezo-fk9a). */
  const phasePayload = draft
    ? {
        source: 'screenshot' as const,
        sourceQualityPct: draft.sourceQualityPct ?? undefined,
        awakeMin: draft.awakeMin ?? undefined,
        lightMin: draft.lightMin ?? undefined,
        remMin: draft.remMin ?? undefined,
        deepMin: draft.deepMin ?? undefined,
        hypnogram: draft.hypnogram ?? undefined,
      }
    : {}
```

Spread `...phasePayload` into the object passed to `onSave` in **both** `save()` and `saveShot()`, and add `hypnogram: draft.hypnogram ?? undefined` to `saveShot`'s payload if it is not already covered by the spread.

- [ ] **Step 5: Run the tests in both modes**

```bash
cd frontend && pnpm test SleepPage SleepLogSheet
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test SleepPage SleepLogSheet
```
Expected: PASS in both. Existing assertions about the old `fázisok: …` text string must be updated to the rail, not deleted.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/me/pages/SleepPage.tsx frontend/src/features/me/pages/SleepPage.test.tsx frontend/src/features/me/sheets/SleepLogSheet.tsx frontend/src/features/me/sheets/SleepLogSheet.test.tsx
git commit --no-verify -m "feat(sleep): phase rail on the last-night hero + fix the manual-save phase leak (mezo-fk9a)"
```

---

## Task 7: `NightArcCard` — the silhouette, the half-night rails, the front-load sentence

**Files:**
- Create: `frontend/src/features/me/components/NightArcCard.tsx`
- Create: `frontend/src/features/me/components/NightArcCard.test.tsx`
- Modify: `frontend/src/features/me/pages/SleepPage.tsx`

**Interfaces:**
- Consumes: `parseHypnogram`, `halfNightSplit`, `deepFrontLoadPct` (Task 4); `PhaseRail` (Task 5).
- Produces: `<NightArcCard entry={SleepEntry} />` — renders `null` when the entry has no valid hypnogram, so the caller needs no guard of its own.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/me/components/NightArcCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NightArcCard } from '@/features/me/components/NightArcCard'
import type { SleepEntry } from '@/data/types'

const base: SleepEntry = {
  date: '2026-05-22', bedtime: '00:42', wakeup: '09:03', duration: 7.5,
  quality: 9, awakenings: 1, mealToSleep: 0, notes: null,
  inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100,
  hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' },
}

describe('NightArcCard', () => {
  it('renders the arc with the bed and wake times pinned to the ends', () => {
    render(<NightArcCard entry={base} />)
    expect(screen.getByText('00:42')).toBeInTheDocument()
    expect(screen.getByText('09:03')).toBeInTheDocument()
  })

  it('draws one bar per bucket', () => {
    const { container } = render(<NightArcCard entry={base} />)
    expect(container.querySelectorAll('rect[data-stage]')).toHaveLength(34)
  })

  it('labels both halves of the night', () => {
    render(<NightArcCard entry={base} />)
    expect(screen.getByText(/Első fél/)).toBeInTheDocument()
    expect(screen.getByText(/Második fél/)).toBeInTheDocument()
  })

  it('states the norm before the number in the front-load sentence', () => {
    render(<NightArcCard entry={base} />)
    expect(screen.getByText(/normális minta/)).toBeInTheDocument()
  })

  it('carries the standing caption about what the height means', () => {
    render(<NightArcCard entry={base} />)
    expect(screen.getByText(/nem mért mélységet/)).toBeInTheDocument()
  })

  it('renders nothing without a hypnogram', () => {
    const { container } = render(<NightArcCard entry={{ ...base, hypnogram: null }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the sequence is out of alphabet', () => {
    const { container } = render(
      <NightArcCard entry={{ ...base, hypnogram: { bucketMin: 15, stages: 'ALDX' } }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('omits the front-load sentence when there is too little deep sleep to speak of', () => {
    render(<NightArcCard entry={{ ...base, hypnogram: { bucketMin: 15, stages: 'ALLRRLLRR' } }} />)
    expect(screen.queryByText(/normális minta/)).not.toBeInTheDocument()
    expect(screen.getByText(/Első fél/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && pnpm test NightArcCard
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `frontend/src/features/me/components/NightArcCard.tsx`:

```tsx
import type { SleepEntry } from '@/data/types'
import { PhaseRail } from '@/features/me/components/PhaseRail'
import {
  deepFrontLoadPct, halfNightSplit, parseHypnogram, type Stage,
} from '@/features/me/logic/sleepPhases'

/** How far each stage dips from the top baseline. Deep hangs lowest — the same reading
 *  direction as the tracker's own curve; an upward silhouette would invert the metaphor
 *  and make "deep" look like "more". */
const DEPTH: Record<Stage, number> = { A: 0.2, R: 0.52, L: 0.74, D: 1 }
const COLOR: Record<Stage, string> = {
  A: 'var(--ph-awake)', R: 'var(--ph-rem)', L: 'var(--ph-light)', D: 'var(--ph-deep)',
}

const W = 400
const H = 132
const TOP = 4
const AXIS_H = 18
const INNER_H = H - TOP - AXIS_H
/** Hour ticks nearer than this to either end would collide with the bed/wake labels. */
const EDGE_GUARD_MIN = 26

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function hourTicks(startMin: number, spanMin: number) {
  const ticks: { x: number; label: string }[] = []
  for (let m = Math.ceil(startMin / 60) * 60; m <= startMin + spanMin; m += 60) {
    const offset = m - startMin
    if (offset < EDGE_GUARD_MIN || offset > spanMin - EDGE_GUARD_MIN) continue
    ticks.push({
      x: (offset / spanMin) * W,
      label: String(Math.floor(m / 60) % 24).padStart(2, '0'),
    })
  }
  return ticks
}

/**
 * "Az éjszaka íve" (mezo-fk9a) — the quantised hypnogram as a hanging depth silhouette,
 * plus the two half-night rails and the front-load sentence. Returns null when the row has
 * no valid hypnogram, so callers need no guard.
 */
export function NightArcCard({ entry }: { entry: SleepEntry }) {
  const stages = parseHypnogram(entry)
  if (!stages) return null

  const bucketMin = entry.hypnogram?.bucketMin ?? 15
  const spanMin = stages.length * bucketMin
  const barW = W / stages.length
  const { first, second } = halfNightSplit(stages, bucketMin)
  const frontLoad = deepFrontLoadPct(stages)
  const ticks = hourTicks(toMin(entry.bedtime), spanMin)

  return (
    <div className="card" style={{ padding: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}
           role="img" aria-label="Az éjszaka lefutása fázisonként">
        {stages.map((s, i) => (
          <rect
            key={i}
            data-stage={s}
            x={i * barW + 0.6}
            y={TOP}
            width={barW - 1.2}
            height={INNER_H * DEPTH[s]}
            rx={Math.min(2.2, barW / 3)}
            fill={COLOR[s]}
            opacity={s === 'A' ? 0.45 : 0.92}
          />
        ))}
        {ticks.map(t => (
          <g key={t.label}>
            <line x1={t.x} y1={TOP} x2={t.x} y2={TOP + INNER_H} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={t.x} y={H - 5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--faint)">
              {t.label}
            </text>
          </g>
        ))}
        <text x={0} y={H - 5} textAnchor="start" fontSize="8.5" fontWeight="800" fill="var(--faint)">
          {entry.bedtime}
        </text>
        <text x={W} y={H - 5} textAnchor="end" fontSize="8.5" fontWeight="800" fill="var(--faint)">
          {entry.wakeup}
        </text>
      </svg>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          Első fél
        </span>
        <div style={{ marginTop: 6 }}><PhaseRail breakdown={first} showLegend={false} /></div>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', display: 'block', marginTop: 12 }}>
          Második fél
        </span>
        <div style={{ marginTop: 6 }}><PhaseRail breakdown={second} showLegend={false} /></div>
      </div>

      {frontLoad != null && (
        <p style={{ marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          A mély alvásod <b style={{ color: 'var(--text-primary)' }}>{frontLoad}%-a</b> az éjszaka
          első felében volt — ez a normális minta. A REM a hajnali órákban sűrűsödik, ezért a
          korán kelés aránytalanul azt vágja le.
        </p>
      )}

      <p style={{ marginTop: 10, fontSize: 10.5, fontWeight: 700, color: 'var(--faint)', lineHeight: 1.5 }}>
        A sziluett magassága a fázist kódolja, nem mért mélységet. {bucketMin} perces felbontás.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Wire it into the page**

In `SleepPage.tsx`, import `NightArcCard` and insert, immediately after the hero card's closing `</div>` wrapper and **before** the trend chart block:

```tsx
          {lastNight && (
            <div style={{ padding: '0 24px 16px' }}>
              <div style={{ marginBottom: 10 }}><Eyebrow>Az éjszaka íve</Eyebrow></div>
              <NightArcCard entry={lastNight} />
            </div>
          )}
```

> The `Eyebrow` renders even when the card returns null, which would leave a stray heading. Guard the whole block on a valid hypnogram by lifting the check: compute `const lastArc = lastNight ? parseHypnogram(lastNight) : null` alongside `lastPhases`, and use `{lastArc && ( … )}` as the condition instead of `{lastNight && ( … )}`.

- [ ] **Step 5: Run the tests in both modes**

```bash
cd frontend && pnpm test NightArcCard SleepPage
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test NightArcCard SleepPage
```
Expected: PASS in both, 8 new tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/me/components/NightArcCard.tsx frontend/src/features/me/components/NightArcCard.test.tsx frontend/src/features/me/pages/SleepPage.tsx
git commit --no-verify -m "feat(sleep): NightArcCard — hanging depth silhouette + half-night split (mezo-fk9a)"
```

---

## Task 8: `PhaseAverageCard` + `RemDurationCard`

**Files:**
- Create: `frontend/src/features/me/components/PhaseAverageCard.tsx`
- Create: `frontend/src/features/me/components/PhaseAverageCard.test.tsx`
- Create: `frontend/src/features/me/components/RemDurationCard.tsx`
- Create: `frontend/src/features/me/components/RemDurationCard.test.tsx`
- Modify: `frontend/src/features/me/pages/SleepPage.tsx`

**Interfaces:**
- Consumes: `averageBreakdown`, `remByDuration`, `phasePct`, `DEEP_REF`, `REM_REF`, `SHORT_NIGHT_H` (Task 4); `PhaseRail`, `PhaseReferenceRow`, `fmtHm` (Task 5).
- Produces: `<PhaseAverageCard entries={SleepEntry[]} windowDays={number} />` and `<RemDurationCard entries={SleepEntry[]} />`. **Both render `null` (including their own heading) when under threshold**, so the page needs no guard.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/me/components/PhaseAverageCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhaseAverageCard } from '@/features/me/components/PhaseAverageCard'
import type { SleepEntry } from '@/data/types'

const night = (over: Partial<SleepEntry> = {}): SleepEntry => ({
  date: '2026-05-22', bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8,
  awakenings: 1, mealToSleep: 0, notes: null,
  inBedMin: 470, awakeMin: 20, lightMin: 200, remMin: 140, deepMin: 100, ...over,
})
const manual: SleepEntry = { ...night(), awakeMin: null, lightMin: null, remMin: null, deepMin: null }

describe('PhaseAverageCard', () => {
  it('renders nothing below three qualifying nights — no misleading average', () => {
    const { container } = render(<PhaseAverageCard entries={[night(), night(), manual]} windowDays={14} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names how many nights the average rests on', () => {
    render(<PhaseAverageCard entries={[night(), night(), night(), manual]} windowDays={14} />)
    expect(screen.getByText(/3 éjszakából/)).toBeInTheDocument()
  })

  it('shows both reference rows', () => {
    render(<PhaseAverageCard entries={[night(), night(), night()]} windowDays={14} />)
    expect(screen.getAllByText(/ref \d+–\d+%/)).toHaveLength(2)
  })
})
```

Create `frontend/src/features/me/components/RemDurationCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RemDurationCard } from '@/features/me/components/RemDurationCard'
import type { SleepEntry } from '@/data/types'

const base = {
  date: '2026-05-22', bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 8,
  awakenings: 1, mealToSleep: 0, notes: null, inBedMin: 470, awakeMin: 20,
}
const short = (rem: number): SleepEntry => ({ ...base, lightMin: 150, remMin: rem, deepMin: 90 })
const long = (rem: number): SleepEntry => ({ ...base, lightMin: 210, remMin: rem, deepMin: 105 })

describe('RemDurationCard', () => {
  it('renders nothing without three nights on each side of the 7h line', () => {
    const { container } = render(<RemDurationCard entries={[short(100), short(110), long(150)]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('states the REM gap in minutes', () => {
    render(<RemDurationCard entries={[short(100), short(110), short(120), long(140), long(150), long(160)]} />)
    expect(screen.getByText(/40 perccel/)).toBeInTheDocument()
  })

  it('plots one dot per qualifying night', () => {
    const { container } = render(
      <RemDurationCard entries={[short(100), short(110), short(120), long(140), long(150), long(160)]} />,
    )
    expect(container.querySelectorAll('circle')).toHaveLength(6)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd frontend && pnpm test PhaseAverageCard RemDurationCard
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `PhaseAverageCard`**

Create `frontend/src/features/me/components/PhaseAverageCard.tsx`:

```tsx
import type { SleepEntry } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PhaseRail } from '@/features/me/components/PhaseRail'
import { PhaseReferenceRow } from '@/features/me/components/PhaseReferenceRow'
import { averageBreakdown, DEEP_REF, phasePct, REM_REF } from '@/features/me/logic/sleepPhases'

/**
 * Average phase composition over the window (mezo-fk9a). Owns its own heading and returns
 * null under the 3-night floor, so the page never renders a stray eyebrow over nothing.
 */
export function PhaseAverageCard({
  entries,
  windowDays,
}: {
  entries: SleepEntry[]
  windowDays: number
}) {
  const result = averageBreakdown(entries, windowDays)
  if (!result) return null
  const { avg, nights } = result

  return (
    <div style={{ padding: '0 24px 16px' }}>
      <div style={{ marginBottom: 10 }}>
        <Eyebrow>Átlagos összetétel · {nights} éjszakából</Eyebrow>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <PhaseRail breakdown={avg} height={20} />
        <div className="col" style={{ gap: 11, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <PhaseReferenceRow label="Mély" pct={phasePct(avg, 'deep')} range={DEEP_REF} color="var(--ph-deep)" />
          <PhaseReferenceRow label="REM" pct={phasePct(avg, 'rem')} range={REM_REF} color="var(--ph-rem)" />
        </div>
      </div>
    </div>
  )
}
```

> Check `Eyebrow`'s real import path in `SleepPage.tsx` and match it exactly rather than assuming `@/shared/ui/Eyebrow`.

- [ ] **Step 4: Write `RemDurationCard`**

Create `frontend/src/features/me/components/RemDurationCard.tsx`:

```tsx
import type { SleepEntry } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import {
  type PhaseBreakdown, phaseBreakdown, remByDuration, SHORT_NIGHT_H,
} from '@/features/me/logic/sleepPhases'

const W = 400
const H = 128
const PAD_L = 26
const PAD_B = 18
const PAD_T = 6
const X_RANGE = [5.5, 8.5] as const
const Y_RANGE = [90, 190] as const

/**
 * Duration vs REM (mezo-fk9a) — the personal evidence that a short night cuts REM rather
 * than cutting proportionally. Owns its heading; returns null under the per-side floor.
 */
export function RemDurationCard({ entries }: { entries: SleepEntry[] }) {
  const stats = remByDuration(entries)
  if (!stats) return null

  const points = entries
    .map(phaseBreakdown)
    .filter((b): b is PhaseBreakdown => b !== null)
    .map(b => ({ hours: b.asleep / 60, rem: b.rem }))

  const innerW = W - PAD_L
  const innerH = H - PAD_T - PAD_B
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const px = (h: number) => PAD_L + ((clamp(h, X_RANGE[0], X_RANGE[1]) - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * innerW
  const py = (r: number) => PAD_T + innerH - ((clamp(r, Y_RANGE[0], Y_RANGE[1]) - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * innerH

  return (
    <div style={{ padding: '0 24px 16px' }}>
      <div style={{ marginBottom: 10 }}><Eyebrow>Ha rövidebb az éjszaka</Eyebrow></div>
      <div className="card" style={{ padding: 14 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}
             role="img" aria-label="Alváshossz és REM összefüggése">
          {[120, 150, 180].map(g => (
            <g key={g}>
              <line x1={PAD_L} y1={py(g)} x2={W} y2={py(g)} stroke="var(--border-subtle)" strokeWidth="1" />
              <text x={0} y={py(g) + 3} fontSize="8.5" fontWeight="800" fill="var(--faint)">{g}p</text>
            </g>
          ))}
          <line x1={px(SHORT_NIGHT_H)} y1={PAD_T} x2={px(SHORT_NIGHT_H)} y2={PAD_T + innerH}
                stroke="var(--warning)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          <text x={px(SHORT_NIGHT_H)} y={H - 5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--warning)">
            {SHORT_NIGHT_H}ó
          </text>
          {points.map((p, i) => (
            <circle key={i} cx={px(p.hours)} cy={py(p.rem)} r="3.4" fill="var(--ph-rem)"
                    opacity={p.hours < SHORT_NIGHT_H ? 0.5 : 0.95} />
          ))}
        </svg>
        <p style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          A {SHORT_NIGHT_H} óra alatti éjszakáidon átlagosan{' '}
          <b style={{ color: 'var(--text-primary)' }}>{stats.deltaMin} perccel</b> kevesebb a REM-ed.
          A rövid éjszaka nem arányosan vág — a hajnali REM-et veszi el.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire both into the page**

In `SleepPage.tsx`, insert `<PhaseAverageCard entries={sleepLog} windowDays={period === '7d' ? 7 : 14} />` **before** the trend-chart block, and `<RemDurationCard entries={sleepLog} />` **after** it (before the "Napló" block). Neither needs a guard — both self-gate.

- [ ] **Step 6: Run the tests in both modes**

```bash
cd frontend && pnpm test PhaseAverageCard RemDurationCard SleepPage
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test PhaseAverageCard RemDurationCard SleepPage
```
Expected: PASS in both, 6 new tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/me/components/PhaseAverageCard.tsx frontend/src/features/me/components/PhaseAverageCard.test.tsx frontend/src/features/me/components/RemDurationCard.tsx frontend/src/features/me/components/RemDurationCard.test.tsx frontend/src/features/me/pages/SleepPage.tsx
git commit --no-verify -m "feat(sleep): phase-average and REM-vs-duration cards, both self-gating (mezo-fk9a)"
```

---

## Task 9: Phase-stacked `SleepChart`

**Files:**
- Modify: `frontend/src/features/me/components/SleepChart.tsx`
- Test: `frontend/src/features/me/components/SleepChart.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `phaseBreakdown` (Task 4).
- Produces: nothing for later tasks.

**The one structural change:** today the bars are drawn on a **truncated scale** (`minDur = Math.min(5.5, …)`), so a bar's height is *duration minus ~5.5h*. Splitting such a bar proportionally would misrepresent the composition — the segments would not be to scale. Stacking requires a **zero baseline**, so the scale changes to `0 → max(9, maxDuration) + 0.2`. Bars become less dramatic (a 6h night is 65% of a 8h night's height instead of ~25%), which is the honest picture. This moves the visual goldens.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/me/components/SleepChart.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SleepChart } from '@/features/me/components/SleepChart'
import type { SleepEntry } from '@/data/types'

const base = {
  bedtime: '23:00', wakeup: '06:30', quality: 8, awakenings: 1, mealToSleep: 0, notes: null,
}
const withPhases = (date: string): SleepEntry => ({
  ...base, date, duration: 7.5, inBedMin: 470, awakeMin: 20, lightMin: 200, remMin: 140, deepMin: 110,
})
const plain = (date: string): SleepEntry => ({ ...base, date, duration: 7.0 })

describe('SleepChart', () => {
  it('splits a phase-carrying night into three stacked segments', () => {
    const { container } = render(
      <SleepChart entries={[withPhases('2026-05-21'), withPhases('2026-05-22')]} period="7d" />,
    )
    expect(container.querySelectorAll('rect[data-phase]')).toHaveLength(6)
  })

  it('leaves a phase-less night as a single plain bar — the gap stays visible', () => {
    const { container } = render(
      <SleepChart entries={[plain('2026-05-21'), withPhases('2026-05-22')]} period="7d" />,
    )
    expect(container.querySelectorAll('rect[data-phase]')).toHaveLength(3)
    expect(container.querySelectorAll('rect[data-plain]')).toHaveLength(1)
  })

  it('measures bars from a zero baseline so the stacked proportions are true', () => {
    const { container } = render(
      <SleepChart entries={[withPhases('2026-05-21'), withPhases('2026-05-22')]} period="7d" />,
    )
    const segments = [...container.querySelectorAll('rect[data-phase]')]
    const deep = segments.find(r => r.getAttribute('data-phase') === 'deep')!
    const light = segments.find(r => r.getAttribute('data-phase') === 'light')!
    // light (200 min) must be drawn taller than deep (110 min), in the same ratio
    const ratio = Number(light.getAttribute('height')) / Number(deep.getAttribute('height'))
    expect(ratio).toBeCloseTo(200 / 110, 1)
  })

  it('still returns null below two points', () => {
    const { container } = render(<SleepChart entries={[plain('2026-05-22')]} period="7d" />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && pnpm test SleepChart
```
Expected: FAIL — no `data-phase` attributes.

- [ ] **Step 3: Rewrite the bar rendering**

In `SleepChart.tsx`, import `phaseBreakdown` from `@/features/me/logic/sleepPhases`, then replace the scale and the bar block.

Replace the three scale lines:

```tsx
  const maxDur = Math.max(9, ...data.map(d => d.duration)) + 0.2
  const minDur = Math.min(5.5, ...data.map(d => d.duration))
  const durRange = maxDur - minDur
```

with:

```tsx
  // Zero baseline: stacking is only truthful when the bar's height IS the duration.
  // The old truncated scale (min 5.5h) exaggerated differences and cannot carry segments.
  const maxDur = Math.max(9, ...data.map(d => d.duration)) + 0.2
  const yForDur = (v: number) => padY + (1 - v / maxDur) * innerH
```

and delete the old `yForDur` definition (keep `xFor` and `yForQual` unchanged).

Replace the duration-bars block with:

```tsx
        {/* Duration bars — split into deep/light/REM where the night carries phase data;
            phase-less nights stay one plain bar so the gaps in the series remain visible. */}
        {data.map((d, i) => {
          const x = xFor(i) - barW / 2
          const top = yForDur(d.duration)
          const total = padY + innerH - top
          const phases = phaseBreakdown(d)
          if (!phases) {
            const isLow = d.duration < 7 || d.quality <= 5
            return (
              <rect key={i} data-plain="" x={x} y={top} width={barW} height={total}
                    fill={isLow ? 'var(--warning)' : 'url(#sleep-bar)'} opacity={isLow ? 0.55 : 1} />
            )
          }
          const stack = [
            { key: 'deep', min: phases.deep, color: 'var(--ph-deep)' },
            { key: 'light', min: phases.light, color: 'var(--ph-light)' },
            { key: 'rem', min: phases.rem, color: 'var(--ph-rem)' },
          ] as const
          let offset = 0
          return (
            <g key={i}>
              {stack.map(s => {
                const h = (s.min / phases.asleep) * total
                const y = top + total - offset - h
                offset += h
                return (
                  <rect key={s.key} data-phase={s.key} x={x} y={y} width={barW} height={h}
                        fill={s.color} opacity={0.9} />
                )
              })}
            </g>
          )
        })}
```

Extend the legend row at the bottom to name the three phases instead of "időtartam":

```tsx
      <div className="row mt-sm gap-md" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { label: 'mély', color: 'var(--ph-deep)' },
          { label: 'könnyű', color: 'var(--ph-light)' },
          { label: 'REM', color: 'var(--ph-rem)' },
        ].map(l => (
          <div className="row gap-xs" key={l.label}>
            <div style={{ width: 10, height: 4, background: l.color }} />
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{l.label}</span>
          </div>
        ))}
        <div className="row gap-xs">
          <div style={{ width: 10, height: 2, background: 'var(--lav-deep)' }} />
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>minőség 1-10</span>
        </div>
      </div>
```

- [ ] **Step 4: Run the tests in both modes**

```bash
cd frontend && pnpm test SleepChart SleepPage
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test SleepChart SleepPage
```
Expected: PASS in both, 4 new tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/components/SleepChart.tsx frontend/src/features/me/components/SleepChart.test.tsx
git commit --no-verify -m "feat(sleep): phase-stacked trend chart on a zero baseline (mezo-fk9a)"
```

---

## Task 10: Docs — ADR, feature doc, design-system doc, lint

**Files:**
- Create: `docs/decisions/0015-hypnogram-display-only.md`
- Modify: `docs/features/me.md`
- Modify: `docs/features/_platform-design-system.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Write the ADR**

Read `docs/README.md` for the ADR template and match its exact frontmatter and section order. Create `docs/decisions/0015-hypnogram-display-only.md` capturing:

- **Context:** the tracker's stage graph is a smoothed continuous curve with no sharp segment boundaries; we quantise it to 15-minute buckets via an LLM reading colour. The per-phase minute *totals*, by contrast, are printed as text on the same screenshot and are already cross-checked by the existing validator.
- **Decision:** the hypnogram is display-only provenance. It feeds the drawing and the first-half/second-half split, and nothing else. Every phase percentage, average and trend value derives from the exact minute totals. It is stored as `jsonb` on `sleep_log` rather than in a child table because it is never queried independently. It is dropped to `null` whenever it fails V1–V3, independently of `confidence`/`needsReview`.
- **Consequences:** a bad extraction costs one card, never a wrong number; no backfill path for old nights; a future finer resolution needs no migration because `bucketMin` travels with the data; anyone later tempted to compute "deep %" from the bucket counts must not — the totals are right there and are exact.

- [ ] **Step 2: Update the feature doc**

In `docs/features/me.md`, in the `### Alvás` section, extend the prose to describe the phase layer: the hero's phase rail + reference rows, `Az éjszaka íve` (silhouette + half-night rails + front-load sentence), `Átlagos összetétel`, the phase-stacked trend, `Ha rövidebb az éjszaka`, and the gating thresholds (3 nights / 3 per side / 4 deep buckets). State the display-only rule and link ADR 0015. Update the `## 4. Data model & API` section with the `hypnogram jsonb` column and the `Hypnogram` schema, and extend the `### Add a field to weight or sleep` recipe if the steps changed. **Overwrite in place — no changelog, no dated snapshot** (the `features/` maintenance policy).

- [ ] **Step 3: Update the design-system doc**

In `docs/features/_platform-design-system.md`, next to the existing `### Sleep night-layer classes` section, document the `.ph*` family and the four `--ph-*` tokens: the alias-onto-Napív architecture (and why the dark override block stays empty), the two different denominators in `PhaseRail`, and the sage-band/locational-verdict rule for `PhaseReferenceRow`.

- [ ] **Step 4: Run the doc lint**

```bash
node scripts/lint-docs.mjs
```
Expected: clean, with no staleness flag on `me.md` or `_platform-design-system.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/decisions/0015-hypnogram-display-only.md docs/features/me.md docs/features/_platform-design-system.md
git commit --no-verify -m "docs(sleep): ADR 0015 display-only hypnogram + feature and design-system docs (mezo-fk9a)"
```

---

## Final gate (coordinator, after Task 10)

Not a subagent task — the coordinator runs this before opening the PR.

```bash
cd frontend && pnpm build
```
```bash
cd frontend && pnpm test
```
```bash
cd frontend && VITE_USE_MOCK=true pnpm test
```
```bash
cd backend && ./mvnw clean test -Dtest='Sleep*,ArchitectureTest'
```

Then: push the branch, open the self-PR, let CI run the authoritative full suite, regenerate the `/me/sleep` visual baselines (linux via `gh workflow run update-visual-baselines.yml -r feat/sleep-depth-stats`, darwin locally), merge `--no-ff`, push main.

