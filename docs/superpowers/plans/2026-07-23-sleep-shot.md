# Sleep Cycle Screenshot Ingestion Implementation Plan (mezo-66ab)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload a Sleep Cycle screenshot → one LLM-vision call extracts the night's data → editable draft in the SleepLogSheet's new Screenshot mode → save through the existing `POST /api/biometrics/sleep` with `source: 'screenshot'`.

**Architecture:** Third instance of the ADR 0012 consumer-owned LLM port (after `MealDraftLlm` and `PhotoExtractLlm`): `SleepShotLlm` in the sleep feature + `SleepShotLlmAdapter` on the companion side. Draft endpoint only (`POST /api/sleep/screenshot`, own tag `SleepShot`, own flag) — nothing persists until the FE confirms via the normal log path. Confidence is deterministic (consistency validator), never from the LLM.

**Tech Stack:** Spring Boot 4 / Java 21 / openapi-generator (multipart) / Spring AI vision via `CompanionLlm`; React 19 + TanStack Query + MSW/Vitest.

**Spec:** `docs/superpowers/specs/2026-07-23-sleep-shot-design.md` (D1–D8, approved 2026-07-23). Driving bd: `mezo-66ab`. Branch: `feat/sleep-shot` (off main, slice A already landed).

## Global Constraints

- Worktree: run everything from `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-2`, branch `feat/sleep-shot`. Commit with `git -c core.hooksPath=/dev/null commit ...`; subjects end with `(mezo-66ab)`.
- Backend tests: ALWAYS `./mvnw clean test`, focused `-Dtest=...`, `-DargLine=-Xmx3g`; compose Postgres on :15432 must be up; NEVER the full suite locally (CI is the gate).
- Frontend gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- Contract-first: validation in the fragment; boundary DTOs generated; controller implements the generated `SleepShotApi`, no own mapping annotations. New fragment MUST be registered in `api/generate/merge.yml`.
- Error trio (exact codes): 400 FIELD `VALIDATION_INVALID_VALUE`/`photo` (empty/oversized/bad-mime), 502 `SLEEP_SHOT_EXTRACT_FAILED`, 503 `SLEEP_SHOT_LLM_UNAVAILABLE`; both new codes get `messages.properties` entries.
- Config: flag `mezo.feature.sleep-goal…` NO — this slice's flag is exactly `mezo.feature.sleep-shot.enabled` (+ `FeaturesConfiguration.SLEEP_SHOT_SWITCH`); values under `mezo.sleep-shot`: `max-photo-bytes: 5000000`, `allowed-mime-types: [image/jpeg, image/png, image/webp]`, `confidence-threshold: 0.6`. No `@Value` anywhere.
- The fake LLM path needs NO changes: `FakeCompanionLlm.complete(system, user, List<InlineImage>)` already decodes every image's bytes against `PHOTO_SENTINEL` `\[fake-photo:(\{.*?})]` and returns the captured JSON; no sentinel → prompt echo → the service's parse fails → 502. ITs run `@ActiveProfiles("companion-fake")`.
- Times are HH:mm zero-padded strings; the service normalizes (`0:42` → `00:42`). `durationH` = `asleepMin / 60` rounded HALF_UP to 2 decimals.
- Canonical extraction example (Daniel's Sleep Cycle screenshot, used in mocks + ITs): bedtime 00:42, wakeup 09:03, asleepMin 449 (→ durationH 7.48), inBedMin 501, awake 52 / light 206 / rem 144 / deep 100 (sum 502), qualityPct 95. Span 00:42→09:03 = 501 min = inBedMin → all checks pass, confidence 1.
- D6 checks (spec, corrected): (1) `asleepMin ≤ inBedMin`; (2) `|awake+light+rem+deep − inBedMin| ≤ 0.10 · inBedMin` (only when ALL four phases AND inBedMin present); (3) `|span(bedtime→wakeup) − inBedMin| ≤ 15` min, midnight-wrapped (only when both times AND inBedMin present); (4) bedtime/wakeup parse as HH:mm (only when present). `confidence = passed / applicable` (no applicable checks → 0). `needsReview = confidence <= 0.6 (boundary-inclusive) OR bedtime/wakeup/asleepMin missing`.
- FE: hooks via the `data/hooks.ts` barrel; deep `@/` imports; no `../`; dual-mode honesty (mock draft never leaks to real mode — extraction is an action, not a query, so this is trivially held); manual-mode behavior of `SleepLogSheet` must NOT change (its existing tests stay green unmodified except where a test adds coverage).

### Plan-level refinements of the spec

1. **TimePicker tolerance (new, forced by reality):** `TimePicker` renders fixed `<option>` lists (hours from its `hours` prop, minutes only `[0, 30]`) — an extracted `00:42` cannot display. Task 5 adds a minimal, backward-compatible enhancement: the CURRENT value's hour/minute are injected as options when missing from the list. Manual mode is pixel-identical (current values 23:00/06:30 are always in-list).
2. **Screenshot-mode duration is its own editable field, not derived:** manual mode computes `durationH` from the bedtime→wakeup span; for a screenshot the asleep duration is independent of the span (the gap IS the awake time). The review phase shows an editable number input (hours, step 0.1) prefilled with the draft's `durationH`, and does NOT recompute it when times are edited.
3. **The mock-mode `useSleep.logSleep` optimistic entry** currently drops the enriched fields; Task 4 fixes it to pass them through (spec §5 folds `mezo-njrc` item 4 in here because the screenshot demo depends on it).

## File Structure (created/modified)

```
api/feature/sleep-shot/sleep-shot.yml                       CREATE  POST /api/sleep/screenshot contract
api/generate/merge.yml                                      MODIFY  register fragment
api/openapi.yml + frontend/src/data/_client/api.gen.ts      REGEN   committed

backend/.../feature/biometrics/sleep/service/SleepShotLlm.java            CREATE  port (ADR 0012)
backend/.../feature/companion/llm/SleepShotLlmAdapter.java                CREATE  adapter (COMPANION_SWITCH)
backend/.../feature/biometrics/sleep/service/SleepShotDraftValidator.java CREATE  pure D6 scorer
backend/.../feature/biometrics/sleep/service/SleepShotService.java        CREATE  gated, extract+compose
backend/.../feature/biometrics/sleep/controller/SleepShotController.java  CREATE  gated, implements SleepShotApi
backend/.../feature/biometrics/sleep/config/SleepShotProperties.java      CREATE  mezo.sleep-shot
backend/.../techcore/configuration/FeaturesConfiguration.java             MODIFY  +SLEEP_SHOT_SWITCH
backend/src/main/resources/application.yml                                MODIFY  +flag +mezo.sleep-shot block
backend/src/main/resources/messages.properties                            MODIFY  +2 codes
backend/src/test/.../feature/biometrics/sleep/SleepShotDraftValidatorTest.java  CREATE  unit
backend/src/test/.../feature/biometrics/sleep/SleepShotApiIT.java               CREATE
backend/src/test/.../feature/biometrics/sleep/SleepShotDisabledApiIT.java       CREATE
backend/src/test/.../feature/biometrics/sleep/SleepShotLlmUnavailableApiIT.java CREATE

frontend/src/data/types.ts                                  MODIFY  +SleepShotDraft; SleepLogInput +source
frontend/src/data/me/sleepShot.ts                           CREATE  MOCK_SLEEP_SHOT_DRAFT
frontend/src/data/me/biometricsApi.ts                       MODIFY  +sleepShotApi; sleepApi.log +source
frontend/src/data/me/sleepHooks.ts                          MODIFY  +useSleepShot; mock logSleep enriched pass-through
frontend/src/data/hooks.ts                                  MODIFY  barrel line
frontend/src/data/me/sleepShotHooks.test.tsx                CREATE
frontend/src/features/me/components/TimePicker.tsx          MODIFY  value-outside-list tolerance (+test)
frontend/src/features/me/sheets/SleepLogSheet.tsx           MODIFY  Kézi|Screenshot toggle + phases + review (+test)
docs/features/me.md, _platform-api-backend.md, _platform-data-layer.md, companion.md  MODIFY
docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md                      MODIFY  status
```

---

### Task 1: API contract — sleep-shot fragment + regen

**Files:**
- Create: `api/feature/sleep-shot/sleep-shot.yml`
- Modify: `api/generate/merge.yml` (append after the sleep-goal line)
- Regen+commit: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (backend, at build): `io.mrkuhne.mezo.api.controller.SleepShotApi` with `SleepShotDraftResponse draftSleepFromScreenshot(MultipartFile photo)`; `api.dto.SleepShotDraftResponse` (Lombok `@Builder`; nullable extraction fields + required `confidence: BigDecimal`, `needsReview: Boolean`).
- Produces (frontend): `components['schemas']['SleepShotDraftResponse']`.

- [ ] **Step 1: Write the fragment** (`api/feature/sleep-shot/sleep-shot.yml`, complete file):

```yaml
openapi: 3.0.3
info: { title: mezo sleep-shot fragment, version: 1.0.0 }
tags:
  - name: SleepShot
    description: Sleep Cycle screenshot -> LLM-vision draft (nothing persisted; confirm rides POST /api/biometrics/sleep)
paths:
  /api/sleep/screenshot:
    post:
      tags: [SleepShot]
      operationId: draftSleepFromScreenshot
      summary: Extract an editable sleep-log draft from a Sleep Cycle screenshot (SleepShot)
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [photo]
              properties:
                photo:
                  type: string
                  format: binary
                  description: The Sleep Cycle screenshot (jpeg/png/webp, max 5 MB)
      responses:
        '200':
          description: Extracted draft — all extraction fields nullable (honest partial), confidence deterministic
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SleepShotDraftResponse' }
        '400':
          description: Missing/oversized/unsupported photo
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '502':
          description: SLEEP_SHOT_EXTRACT_FAILED — the model answer was unusable
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '503':
          description: SLEEP_SHOT_LLM_UNAVAILABLE — companion LLM port absent
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    SleepShotDraftResponse:
      type: object
      required: [confidence, needsReview]
      properties:
        bedtime:
          type: string
          pattern: '^([01]\d|2[0-3]):[0-5]\d$'
          description: Went-to-bed time, HH:mm (normalized zero-padded)
        wakeup:
          type: string
          pattern: '^([01]\d|2[0-3]):[0-5]\d$'
          description: Woke-up time, HH:mm
        durationH:
          type: number
          description: Asleep duration in hours (from the screenshot's Asleep value, 2 decimals)
        inBedMin:
          type: integer
          minimum: 1
          description: Total time in bed, minutes
        awakeMin: { type: integer, minimum: 0, description: 'Awake minutes (phase)' }
        lightMin: { type: integer, minimum: 0, description: 'Light-sleep minutes (phase)' }
        remMin: { type: integer, minimum: 0, description: 'REM minutes (Sleep Cycle calls it Dream)' }
        deepMin: { type: integer, minimum: 0, description: 'Deep-sleep minutes (phase)' }
        sourceQualityPct:
          type: integer
          minimum: 0
          maximum: 100
          description: Sleep Cycle's own 0-100 quality
        confidence:
          type: number
          minimum: 0
          maximum: 1
          description: Deterministic consistency score (validator, never the LLM)
        needsReview:
          type: boolean
          description: confidence <= threshold or a key field missing
```

- [ ] **Step 2: Register the fragment.** In `api/generate/merge.yml`, append after the sleep-goal input line:

```yaml
  - inputFile: ../feature/sleep-shot/sleep-shot.yml
```

- [ ] **Step 3: Regenerate + sanity**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && grep -c "SleepShotDraftResponse" ../api/openapi.yml src/data/_client/api.gen.ts && pnpm build`
Expected: both greps ≥ 1; build PASS.

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): sleep screenshot draft contract (mezo-66ab)"
```

---

### Task 2: Backend foundation — properties, switch, port, adapter, validator (+unit test)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/resources/messages.properties`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/config/SleepShotProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepShotLlm.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/SleepShotLlmAdapter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepShotDraftValidator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/SleepShotDraftValidatorTest.java`

**Interfaces:**
- Produces: `SleepShotLlm.complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType): String`; `SleepShotDraftValidator.Score score(Extracted e)` where `record Extracted(String bedtime, String wakeup, Integer asleepMin, Integer inBedMin, Integer awakeMin, Integer lightMin, Integer remMin, Integer deepMin, Integer qualityPct)` and `record Score(BigDecimal confidence, boolean needsReview)` — Task 3's service consumes BOTH records verbatim; `SleepShotProperties(int maxPhotoBytes, List<String> allowedMimeTypes, double confidenceThreshold)`; `FeaturesConfiguration.SLEEP_SHOT_SWITCH`.

- [ ] **Step 1: Switch + config + messages.** `FeaturesConfiguration.java`, after `SLEEP_GOAL_SWITCH`:

```java
    /** Sleep screenshot ingestion (mezo-66ab) — Sleep Cycle screenshot -> LLM-vision draft. */
    public static final String SLEEP_SHOT_SWITCH = "mezo.feature.sleep-shot.enabled";
```

`application.yml` — under `mezo.feature:` after the `sleep-goal:` block:

```yaml
    # Sleep screenshot ingestion (mezo-66ab): Sleep Cycle screenshot -> LLM-vision draft.
    sleep-shot:
      enabled: true
```

and a value block after the `mezo.sleep:` block:

```yaml
  # Sleep screenshot extraction tuning (mezo-66ab). Binds onto SleepShotProperties.
  sleep-shot:
    max-photo-bytes: 5000000
    allowed-mime-types: [image/jpeg, image/png, image/webp]
    confidence-threshold: 0.6
```

`messages.properties` — append after the pantry-photo pair (Hungarian, matching the meal-ai neighbours):

```properties
SLEEP_SHOT_EXTRACT_FAILED=A screenshot beolvasása nem sikerült. Próbáld újra, vagy naplózz kézzel.
SLEEP_SHOT_LLM_UNAVAILABLE=Az AI-alvásimport jelenleg nem érhető el.
```

- [ ] **Step 2: `SleepShotProperties`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Sleep screenshot extraction tuning (mezo.sleep-shot): caps + review threshold are config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.sleep-shot")
public record SleepShotProperties(

    /** Service-level upload cap in bytes (container multipart caps sit above this). */
    @Min(1)
    int maxPhotoBytes,

    /** Accepted photo mime types. */
    @NotEmpty
    List<String> allowedMimeTypes,

    /** needsReview when confidence <= this (boundary-inclusive, house pattern). */
    @DecimalMin("0.0") @DecimalMax("1.0")
    double confidenceThreshold
) {}
```

- [ ] **Step 3: `SleepShotLlm` port** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

/**
 * Sleep-owned LLM-vision port (ADR 0012): the sleep feature defines what it needs,
 * the companion feature adapts its provider onto it. Sleep never imports companion.
 */
public interface SleepShotLlm {

    /** One multimodal completion over a single screenshot. */
    String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType);
}
```

- [ ] **Step 4: `SleepShotLlmAdapter`** (complete file, companion side — mirror `MealDraftLlmAdapter`'s exact import style from that file):

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotLlm;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Companion-side adapter for the sleep screenshot port (ADR 0012) — companion -> sleep edge only. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SleepShotLlmAdapter implements SleepShotLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType) {
        return companionLlm.complete(systemPrompt, userMessage,
            List.of(new CompanionLlm.InlineImage(imageBytes, mimeType)));
    }
}
```

- [ ] **Step 5: Write the failing validator unit test** (`SleepShotDraftValidatorTest.java`, complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Extracted;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Score;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** Pure D6 consistency scoring — the one spot unit tests beat ITs (no Spring, no DB). */
class SleepShotDraftValidatorTest {

    private final SleepShotDraftValidator validator = new SleepShotDraftValidator();
    private static final double THRESHOLD = 0.6;

    private static Extracted canonical() {
        // Daniel's Sleep Cycle example: span 00:42->09:03 = 501 = inBed; phases sum 502 (~inBed); asleep 449.
        return new Extracted("00:42", "09:03", 449, 501, 52, 206, 144, 100, 95);
    }

    @Test
    void testScore_shouldBeFullConfidence_whenAllChecksPass() {
        Score s = validator.score(canonical(), THRESHOLD);

        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(s.needsReview()).isFalse();
    }

    @Test
    void testScore_shouldFailAsleepCheck_whenAsleepExceedsInBed() {
        Extracted e = new Extracted("00:42", "09:03", 550, 501, 52, 206, 144, 100, 95);

        Score s = validator.score(e, THRESHOLD);

        // 3 of 4 applicable checks pass -> 0.75, above threshold.
        assertThat(s.confidence()).isEqualByComparingTo(new BigDecimal("0.75"));
        assertThat(s.needsReview()).isFalse();
    }

    @Test
    void testScore_shouldNeedReview_whenConfidenceAtThresholdBoundary(){
        // Phases sum way off (200 vs 501) AND span mismatch via bedtime shift -> 2/4 = 0.5 <= 0.6.
        Extracted e = new Extracted("02:00", "09:03", 400, 501, 50, 50, 50, 50, 95);

        Score s = validator.score(e, THRESHOLD);

        assertThat(s.confidence()).isEqualByComparingTo(new BigDecimal("0.5"));
        assertThat(s.needsReview()).isTrue();
    }

    @Test
    void testScore_shouldSkipPhaseCheck_whenAnyPhaseMissing() {
        Extracted e = new Extracted("00:42", "09:03", 449, 501, null, 206, 144, 100, 95);

        Score s = validator.score(e, THRESHOLD);

        // Applicable: asleep<=inBed, span~inBed, times parse -> 3/3.
        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(s.needsReview()).isFalse();
    }

    @Test
    void testScore_shouldNeedReview_whenKeyFieldMissing() {
        Extracted e = new Extracted(null, "09:03", 449, 501, 52, 206, 144, 100, 95);

        Score s = validator.score(e, THRESHOLD);

        assertThat(s.needsReview()).isTrue(); // bedtime missing forces review regardless of score
    }

    @Test
    void testScore_shouldWrapMidnight_whenSpanCrossesIt() {
        // 23:00 -> 07:21 = 501 min across midnight; inBed 501 -> span check passes.
        Extracted e = new Extracted("23:00", "07:21", 449, 501, null, null, null, null, null);

        Score s = validator.score(e, THRESHOLD);

        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ONE);
    }

    @Test
    void testScore_shouldFailTimeParse_whenNotHHmm() {
        Extracted e = new Extracted("25:99", "09:03", 449, null, null, null, null, null, null);

        Score s = validator.score(e, THRESHOLD);

        // Applicable: times-parse only (no inBed -> no span/asleep/phase checks) -> 0/1.
        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(s.needsReview()).isTrue();
    }

    @Test
    void testScore_shouldBeZeroConfidenceAndReview_whenNothingExtracted() {
        Score s = validator.score(new Extracted(null, null, null, null, null, null, null, null, null), THRESHOLD);

        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(s.needsReview()).isTrue();
    }
}
```

- [ ] **Step 6: Run to verify failure**

Run: `cd backend && ./mvnw clean test -Dtest=SleepShotDraftValidatorTest -DargLine=-Xmx3g`
Expected: COMPILE FAILURE (validator class missing).

- [ ] **Step 7: Implement `SleepShotDraftValidator`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

/**
 * Deterministic consistency scoring for a screenshot extraction (spec D6) — the LLM never
 * grades itself. confidence = passed / applicable checks; needsReview on threshold
 * (boundary-inclusive) or a missing key field (bedtime, wakeup, asleepMin).
 */
@Component
public class SleepShotDraftValidator {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final int SPAN_TOLERANCE_MIN = 15;
    private static final double PHASE_TOLERANCE_PCT = 0.10;

    public record Extracted(String bedtime, String wakeup, Integer asleepMin, Integer inBedMin,
                            Integer awakeMin, Integer lightMin, Integer remMin, Integer deepMin,
                            Integer qualityPct) {}

    public record Score(BigDecimal confidence, boolean needsReview) {}

    public Score score(Extracted e, double threshold) {
        int applicable = 0;
        int passed = 0;

        boolean timesPresent = e.bedtime() != null || e.wakeup() != null;
        boolean timesParse = parses(e.bedtime()) && parses(e.wakeup());
        if (timesPresent) {
            applicable++;
            if (e.bedtime() != null && e.wakeup() != null && timesParse) {
                passed++;
            }
        }

        if (e.asleepMin() != null && e.inBedMin() != null) {
            applicable++;
            if (e.asleepMin() <= e.inBedMin()) {
                passed++;
            }
        }

        boolean allPhases = Stream.of(e.awakeMin(), e.lightMin(), e.remMin(), e.deepMin())
            .allMatch(p -> p != null);
        if (allPhases && e.inBedMin() != null) {
            applicable++;
            int sum = e.awakeMin() + e.lightMin() + e.remMin() + e.deepMin();
            if (Math.abs(sum - e.inBedMin()) <= PHASE_TOLERANCE_PCT * e.inBedMin()) {
                passed++;
            }
        }

        if (e.bedtime() != null && e.wakeup() != null && timesParse && e.inBedMin() != null) {
            applicable++;
            int span = Math.floorMod(toMin(e.wakeup()) - toMin(e.bedtime()), 24 * 60);
            if (Math.abs(span - e.inBedMin()) <= SPAN_TOLERANCE_MIN) {
                passed++;
            }
        }

        BigDecimal confidence = applicable == 0
            ? BigDecimal.ZERO
            : BigDecimal.valueOf(passed).divide(BigDecimal.valueOf(applicable), 2, RoundingMode.HALF_UP);
        boolean keyMissing = e.bedtime() == null || e.wakeup() == null || e.asleepMin() == null;
        boolean needsReview = keyMissing || confidence.doubleValue() <= threshold;
        return new Score(confidence, needsReview);
    }

    private static boolean parses(String hhmm) {
        if (hhmm == null) {
            return false;
        }
        try {
            LocalTime.parse(hhmm, HH_MM);
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private static int toMin(String hhmm) {
        LocalTime t = LocalTime.parse(hhmm, HH_MM);
        return t.getHour() * 60 + t.getMinute();
    }
}
```

Note the `score(Extracted, double threshold)` signature — the threshold comes from the caller (service passes `props.confidenceThreshold()`), keeping the validator Spring-config-free and directly unit-testable.

- [ ] **Step 8: Run the unit test + verify context boots**

Run: `cd backend && docker compose up -d && ./mvnw clean test -Dtest='SleepShotDraftValidatorTest,SleepGoalApiIT' -DargLine=-Xmx3g`
Expected: PASS (8 unit + 6 IT — the IT proves `application.yml` + properties record parse and the adapter wires without error).

- [ ] **Step 9: Commit**

```bash
git add backend/src api/  # api/ only if regen touched it; normally backend only
git -c core.hooksPath=/dev/null commit -m "feat(sleep): screenshot port + adapter + deterministic draft validator + config (mezo-66ab)"
```

---

### Task 3: `SleepShotService` + `SleepShotController` + ITs (TDD)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepShotService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/controller/SleepShotController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/SleepShotApiIT.java`, `SleepShotDisabledApiIT.java`, `SleepShotLlmUnavailableApiIT.java`

**Interfaces:**
- Consumes: Task 1's generated `SleepShotApi` + `api.dto.SleepShotDraftResponse` (builder); Task 2's `SleepShotLlm`, `SleepShotDraftValidator` (`score(Extracted, double)` → `Score(confidence, needsReview)`), `SleepShotProperties`, `SLEEP_SHOT_SWITCH`; the fake-LLM `[fake-photo:{json}]` sentinel (no fake changes).
- Produces: `SleepShotService.extract(UUID userId, MultipartFile photo): SleepShotDraftResponse`.

- [ ] **Step 1: Write the failing ITs.** `SleepShotApiIT.java` (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SleepShotDraftResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/** Screenshot -> draft through the generated SleepShotApi, against the fake companion LLM. */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.sleep-shot.max-photo-bytes=10000")
class SleepShotApiIT extends ApiIntegrationTest {

    private static final String PATH = "/api/sleep/screenshot";

    /** Daniel's canonical Sleep Cycle screenshot values (spec Global Constraints). */
    private static final String DRAFT_JSON =
        "{\"bedtime\":\"0:42\",\"wakeup\":\"9:03\",\"asleepMin\":449,\"inBedMin\":501,"
            + "\"awakeMin\":52,\"lightMin\":206,\"remMin\":144,\"deepMin\":100,\"qualityPct\":95}";

    private static HttpEntity<org.springframework.core.io.ByteArrayResource> pngPart(String content) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_PNG);
        return new HttpEntity<>(photoPart(content.getBytes(UTF_8), "screenshot.png"), h);
    }

    @Test
    void testDraft_shouldExtractAndNormalize_whenScreenshotCarriesSentinel() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", pngPart("[fake-photo:" + DRAFT_JSON + "]"));

        ResponseEntity<SleepShotDraftResponse> res =
            postMultipartForResponse(PATH, parts, SleepShotDraftResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        SleepShotDraftResponse d = res.getBody();
        assertThat(d).isNotNull();
        assertThat(d.getBedtime()).isEqualTo("00:42"); // zero-padded normalization
        assertThat(d.getWakeup()).isEqualTo("09:03");
        assertThat(d.getDurationH()).isEqualByComparingTo(new BigDecimal("7.48")); // 449/60
        assertThat(d.getInBedMin()).isEqualTo(501);
        assertThat(d.getAwakeMin()).isEqualTo(52);
        assertThat(d.getLightMin()).isEqualTo(206);
        assertThat(d.getRemMin()).isEqualTo(144);
        assertThat(d.getDeepMin()).isEqualTo(100);
        assertThat(d.getSourceQualityPct()).isEqualTo(95);
        assertThat(d.getConfidence()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(d.getNeedsReview()).isFalse();
    }

    @Test
    void testDraft_shouldFlagNeedsReview_whenKeyFieldMissing() {
        String partial = "{\"bedtime\":null,\"wakeup\":\"9:03\",\"asleepMin\":449,\"inBedMin\":501,"
            + "\"awakeMin\":null,\"lightMin\":null,\"remMin\":null,\"deepMin\":null,\"qualityPct\":95}";
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", pngPart("[fake-photo:" + partial + "]"));

        ResponseEntity<SleepShotDraftResponse> res =
            postMultipartForResponse(PATH, parts, SleepShotDraftResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getBedtime()).isNull();
        assertThat(res.getBody().getNeedsReview()).isTrue();
    }

    @Test
    void testDraft_shouldReturn502_whenAnswerUnparseable() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", pngPart("no sentinel here"));

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertHasRequestError(res.getBody(), "SLEEP_SHOT_EXTRACT_FAILED");
    }

    @Test
    void testDraft_shouldReturn400_whenPhotoOversized() {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", pngPart("x".repeat(10001))); // cap lowered to 10000 via @TestPropertySource

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "photo", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testDraft_shouldReturn400_whenMimeUnsupported() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_GIF);
        var gif = new HttpEntity<>(photoPart("gif-bytes".getBytes(UTF_8), "screenshot.gif"), h);
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", gif);

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "photo", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testDraft_shouldReturn400_whenPhotoMissing() {
        var parts = new LinkedMultiValueMap<String, Object>();

        ResponseEntity<String> res = postMultipartForResponse(PATH, parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
```

`SleepShotDisabledApiIT.java` (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the sleep-shot switch OFF, the @ConditionalOnProperty controller is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.sleep-shot.enabled=false")
class SleepShotDisabledApiIT extends ApiIntegrationTest {

    @Test
    void testDraft_shouldReturn404_whenSleepShotSwitchOff() {
        postForBody("/api/sleep/screenshot", null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
```

`SleepShotLlmUnavailableApiIT.java` (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/** Companion OFF -> the adapter bean is gone -> surface stays on but answers 503. */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class SleepShotLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testDraft_shouldReturn503_whenCompanionPortAbsent() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_PNG);
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("photo", new HttpEntity<>(photoPart("x".getBytes(UTF_8), "screenshot.png"), h));

        ResponseEntity<String> res = postMultipartForResponse("/api/sleep/screenshot", parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(res.getBody(), "SLEEP_SHOT_LLM_UNAVAILABLE");
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && ./mvnw clean test -Dtest='SleepShot*IT' -DargLine=-Xmx3g`
Expected: COMPILE FAILURE (service/controller missing; the generated `SleepShotApi` exists from Task 1).

- [ ] **Step 3: Implement `SleepShotService`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.api.dto.SleepShotDraftResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepShotProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Extracted;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Score;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

/**
 * Sleep Cycle screenshot -> draft (mezo-66ab, spec D5/D6): ONE multimodal call, deterministic
 * confidence, nothing persisted — the FE confirms via the normal POST /api/biometrics/sleep.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLEEP_SHOT_SWITCH, havingValue = "true")
public class SleepShotService {

    private static final String SYSTEM_PROMPT = """
        You read a screenshot of the Sleep Cycle app. Return ONLY a JSON object, no prose:
        {"bedtime":"H:mm or HH:mm 24h from 'Went to bed'","wakeup":"from 'Woke up'",
        "asleepMin":total asleep minutes from 'Asleep' (e.g. 7h 29m -> 449),
        "inBedMin":total minutes from 'In bed',"awakeMin":minutes from the 'Awake' stage,
        "lightMin":minutes from 'Light',"remMin":minutes from 'Dream' (Dream IS REM),
        "deepMin":minutes from 'Deep',"qualityPct":the 0-100 'Sleep quality' number}
        Use null for anything not visible on the screenshot. Numbers as integers.
        """;

    private final ObjectProvider<SleepShotLlm> llm;
    private final SleepShotDraftValidator validator;
    private final SleepShotProperties props;
    private final ObjectMapper objectMapper;

    public SleepShotDraftResponse extract(UUID userId, MultipartFile photo) {
        Photo p = validated(photo);
        String answer = requireAvailable().complete(SYSTEM_PROMPT, "", p.bytes(), p.mime());
        Extracted e = normalize(parse(answer));
        Score score = validator.score(e, props.confidenceThreshold());
        log.info("Sleep screenshot draft for {}: confidence={} needsReview={}",
            userId, score.confidence(), score.needsReview());
        return SleepShotDraftResponse.builder()
            .bedtime(e.bedtime())
            .wakeup(e.wakeup())
            .durationH(e.asleepMin() == null ? null
                : BigDecimal.valueOf(e.asleepMin()).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP))
            .inBedMin(e.inBedMin())
            .awakeMin(e.awakeMin())
            .lightMin(e.lightMin())
            .remMin(e.remMin())
            .deepMin(e.deepMin())
            .sourceQualityPct(e.qualityPct())
            .confidence(score.confidence())
            .needsReview(score.needsReview())
            .build();
    }

    private record Photo(byte[] bytes, String mime) {}

    /** Size/mime service-level checks (message-bearing 400s; container caps are the safety net). */
    private Photo validated(MultipartFile f) {
        if (f == null || f.isEmpty()) {
            throw badPhoto();
        }
        if (f.getSize() > props.maxPhotoBytes()) {
            throw badPhoto();
        }
        String mime = f.getContentType();
        if (mime == null || !props.allowedMimeTypes().contains(mime)) {
            throw badPhoto();
        }
        try {
            return new Photo(f.getBytes(), mime);
        } catch (Exception e) {
            throw badPhoto();
        }
    }

    private static SystemRuntimeErrorException badPhoto() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
    }

    private SleepShotLlm requireAvailable() {
        SleepShotLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("SLEEP_SHOT_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    /** Same brace-window parse as the meal/pantry pipelines, with sleep-owned 502 semantics. */
    private Extracted parse(String answer) {
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return objectMapper.readValue(json, Extracted.class);
        } catch (Exception e) {
            log.warn("Sleep screenshot extraction unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                SystemMessage.error("SLEEP_SHOT_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }

    /** Zero-pad clock times (Sleep Cycle renders '0:42'); leave everything else as extracted. */
    private static Extracted normalize(Extracted e) {
        return new Extracted(pad(e.bedtime()), pad(e.wakeup()), e.asleepMin(), e.inBedMin(),
            e.awakeMin(), e.lightMin(), e.remMin(), e.deepMin(), e.qualityPct());
    }

    private static String pad(String hhmm) {
        if (hhmm == null) {
            return null;
        }
        String t = hhmm.strip();
        return t.matches("\\d:\\d{2}") ? "0" + t : t;
    }
}
```

Note: `Extracted` doubles as the Jackson target for the LLM JSON (field names match the prompt schema exactly). If Jackson 3 record deserialization needs it, mirror whatever annotation the `ExtractedDraft` in `PantryPhotoService`/scrape uses (check that file) — otherwise plain record binding works.

- [ ] **Step 4: Implement `SleepShotController`** (complete file; mirror `SleepLogController`'s `CurrentUserId` import path):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.controller;

import io.mrkuhne.mezo.api.controller.SleepShotApi;
import io.mrkuhne.mezo.api.dto.SleepShotDraftResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** /api/sleep/screenshot surface (mezo-66ab) — mappings come from the generated {@link SleepShotApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLEEP_SHOT_SWITCH, havingValue = "true")
public class SleepShotController implements SleepShotApi {

    private final SleepShotService service;
    private final CurrentUserId currentUserId;

    @Override
    public SleepShotDraftResponse draftSleepFromScreenshot(MultipartFile photo) {
        return service.extract(currentUserId.get(), photo);
    }
}
```

- [ ] **Step 5: Run the ITs to green**

Run: `cd backend && ./mvnw clean test -Dtest='SleepShot*' -DargLine=-Xmx3g`
Expected: PASS (8 unit + 6 + 1 + 1 IT). If the missing-photo test returns 500 instead of 400, check how `PantryPhotoApiIT.testPhoto_should400_whenPartMissing` passes (the generated interface marks the part required) and mirror the semantics — adjust the expected status ONLY to what the pantry precedent produces, never to 500.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(sleep): screenshot extraction service + /api/sleep/screenshot (mezo-66ab)"
```

---

### Task 4: FE data layer — draft type, mock, API client, hook, enriched mock logSleep

**Files:**
- Modify: `frontend/src/data/types.ts` (+`SleepShotDraft`; `SleepLogInput` +`source`)
- Create: `frontend/src/data/me/sleepShot.ts`
- Modify: `frontend/src/data/me/biometricsApi.ts` (+`sleepShotApi`; `sleepApi.log` +`source`)
- Modify: `frontend/src/data/me/sleepHooks.ts` (+`useSleepShot`; mock `logSleep` enriched pass-through)
- Modify: `frontend/src/data/hooks.ts` (barrel line)
- Test: `frontend/src/data/me/sleepShotHooks.test.tsx`

**Interfaces:**
- Consumes: Task 1's `components['schemas']['SleepShotDraftResponse']`.
- Produces: `SleepShotDraft` (all extraction fields `T | null`, `confidence: number`, `needsReview: boolean`); `useSleepShot(): { extract: (photo: File) => Promise<SleepShotDraft>, pending: boolean }`; `MOCK_SLEEP_SHOT_DRAFT`; `SleepLogInput.source?: 'manual' | 'screenshot'`; `sleepApi.log` sends `source`. Task 6's sheet consumes ALL of these.

- [ ] **Step 1: Types.** In `data/types.ts`, add `source?: 'manual' | 'screenshot'` to `SleepLogInput` (after `inBedMin`), and below the sleep types:

```ts
/** LLM-vision extraction from a Sleep Cycle screenshot (mezo-66ab) — a draft, never persisted as-is. */
export interface SleepShotDraft {
  bedtime: string | null
  wakeup: string | null
  durationH: number | null
  inBedMin: number | null
  awakeMin: number | null
  lightMin: number | null
  remMin: number | null
  deepMin: number | null
  sourceQualityPct: number | null
  /** Deterministic consistency score 0..1 (backend validator, never the LLM). */
  confidence: number
  needsReview: boolean
}
```

- [ ] **Step 2: Mock draft** — `data/me/sleepShot.ts` (complete file):

```ts
import type { SleepShotDraft } from '@/data/types'

// The canonical Sleep Cycle example screenshot (spec Global Constraints): all checks pass.
export const MOCK_SLEEP_SHOT_DRAFT: SleepShotDraft = {
  bedtime: '00:42',
  wakeup: '09:03',
  durationH: 7.48,
  inBedMin: 501,
  awakeMin: 52,
  lightMin: 206,
  remMin: 144,
  deepMin: 100,
  sourceQualityPct: 95,
  confidence: 1,
  needsReview: false,
}
```

- [ ] **Step 3: API client.** In `data/me/biometricsApi.ts`: add `source: input.source` to the `sleepApi.log` body (stays `satisfies LogSleepRequest`), and add (mirroring `pantryApi.photoExtract`'s FormData idiom):

```ts
type SleepShotDraftResponse = components['schemas']['SleepShotDraftResponse']

export const sleepShotApi = {
  // FormData: the browser sets the multipart boundary (apiFetch omits its JSON Content-Type).
  extract: (photo: File): Promise<SleepShotDraft> => {
    const form = new FormData()
    form.append('photo', photo, photo.name || 'screenshot.png')
    return apiFetch<SleepShotDraftResponse>('/api/sleep/screenshot', { method: 'POST', body: form })
      .then(r => ({
        bedtime: r.bedtime ?? null,
        wakeup: r.wakeup ?? null,
        durationH: r.durationH ?? null,
        inBedMin: r.inBedMin ?? null,
        awakeMin: r.awakeMin ?? null,
        lightMin: r.lightMin ?? null,
        remMin: r.remMin ?? null,
        deepMin: r.deepMin ?? null,
        sourceQualityPct: r.sourceQualityPct ?? null,
        confidence: r.confidence,
        needsReview: r.needsReview,
      }))
  },
}
```

Add `SleepShotDraft` to the `@/data/types` type import.

- [ ] **Step 4: Hook + mock logSleep fix.** In `data/me/sleepHooks.ts` add:

```ts
export function useSleepShot() {
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (photo: File): Promise<SleepShotDraft> => {
      if (mock) return MOCK_SLEEP_SHOT_DRAFT
      return sleepShotApi.extract(photo)
    },
  })
  return { extract: (photo: File) => mutation.mutateAsync(photo), pending: mutation.isPending }
}
```

(imports: `sleepShotApi` from `@/data/me/biometricsApi`, `MOCK_SLEEP_SHOT_DRAFT` from `@/data/me/sleepShot`, type `SleepShotDraft` from `@/data/types`). No query key — extraction is a stateless action; nothing to invalidate.

Fix the mock `logSleep` optimistic entry (the spec's refinement 3) — in `useSleep()`'s mock `mutationFn`, extend the constructed `SleepEntry` with the enriched fields:

```ts
          mealToSleep: 0, notes: input.note ?? null,
          inBedMin: input.inBedMin ?? null,
          sourceQualityPct: input.sourceQualityPct ?? null,
          source: input.source ?? 'manual',
```

`SleepLogInput` needs `sourceQualityPct?: number` too for the screenshot confirm to carry it — add it in Step 1 alongside `source` (and send it in `sleepApi.log`'s body: `sourceQualityPct: input.sourceQualityPct`). The phase minutes also ride the confirm: add `awakeMin?: number; lightMin?: number; remMin?: number; deepMin?: number` to `SleepLogInput`, send them in `sleepApi.log`, and pass them through the mock optimistic entry the same way.

- [ ] **Step 5: Barrel.** In `data/hooks.ts`:

```ts
export { useSleep, useSleepGoal, useSleepGoalActions, useSleepShot } from '@/data/me/sleepHooks'
```

- [ ] **Step 6: Hook tests** — `data/me/sleepShotHooks.test.tsx` (complete file):

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useSleepShot } from '@/data/me/sleepHooks'
import { MOCK_SLEEP_SHOT_DRAFT } from '@/data/me/sleepShot'

afterEach(() => vi.unstubAllEnvs())

describe('useSleepShot (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('returns the canonical mock draft without any network', async () => {
    const { result } = renderHook(() => useSleepShot(), { wrapper: makeHookWrapper() })
    const draft = await result.current.extract(new File(['x'], 's.png', { type: 'image/png' }))
    expect(draft).toEqual(MOCK_SLEEP_SHOT_DRAFT)
  })
})

describe('useSleepShot (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('POSTs multipart and maps nullable fields to nulls', async () => {
    let contentType: string | null = null
    server.use(
      http.post(`${API_BASE}/api/sleep/screenshot`, ({ request }) => {
        contentType = request.headers.get('content-type')
        return HttpResponse.json({
          bedtime: '00:42', wakeup: '09:03', durationH: 7.48, inBedMin: 501,
          awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100,
          sourceQualityPct: 95, confidence: 1, needsReview: false,
        })
      }),
    )
    const { result } = renderHook(() => useSleepShot(), { wrapper: makeHookWrapper() })
    const draft = await result.current.extract(new File(['x'], 's.png', { type: 'image/png' }))
    expect(contentType).toMatch(/^multipart\/form-data/)
    expect(draft.bedtime).toBe('00:42')
    expect(draft.inBedMin).toBe(501)

    server.use(http.post(`${API_BASE}/api/sleep/screenshot`, () =>
      HttpResponse.json({ confidence: 0, needsReview: true })))
    const partial = await result.current.extract(new File(['x'], 's.png', { type: 'image/png' }))
    expect(partial.bedtime).toBeNull()
    expect(partial.needsReview).toBe(true)
  })

  it('rejects with ApiError on 502 so the sheet can fall back to pick', async () => {
    server.use(http.post(`${API_BASE}/api/sleep/screenshot`, () =>
      HttpResponse.json([{ code: 'SLEEP_SHOT_EXTRACT_FAILED', type: 'REQUEST' }], { status: 502 })))
    const { result } = renderHook(() => useSleepShot(), { wrapper: makeHookWrapper() })
    await expect(result.current.extract(new File(['x'], 's.png', { type: 'image/png' })))
      .rejects.toMatchObject({ status: 502 })
  })
})
```

- [ ] **Step 7: Run**

Run: `cd frontend && pnpm test src/data/me/sleepShotHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/me/sleepShotHooks.test.tsx && pnpm test src/data/me/sleepHooks.test.tsx src/data/me/sleepGoalHooks.test.tsx && pnpm build`
Expected: all PASS (new file both modes + existing sleep hook tests unaffected + build).

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fe-data): useSleepShot extraction hook + enriched log inputs carry source/phases (mezo-66ab)"
```

---

### Task 5: TimePicker — tolerate a value outside its option lists

**Files:**
- Modify: `frontend/src/features/me/components/TimePicker.tsx`
- Test: `frontend/src/features/me/components/TimePicker.test.tsx` (create if missing; check for an existing test file first and extend it instead)

**Interfaces:**
- Produces: unchanged props (`label, val, onChange, hours: number[]`); NEW behavior — when `val`'s hour is not in `hours`, or its minute is not in `[0, 30]`, that hour/minute renders as an extra `<option>` (sorted in place), so an extracted `00:42` displays exactly. Task 6 relies on this.

- [ ] **Step 1: Write the failing test** (complete file; if a `TimePicker.test.tsx` already exists, add these two `it` blocks to it instead):

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimePicker } from '@/features/me/components/TimePicker'

describe('TimePicker value-outside-list tolerance', () => {
  it('renders an out-of-list value exactly (00:42 with hours=[22,23,0,1])', () => {
    render(<TimePicker label="Lefekvés" val="00:42" onChange={vi.fn()} hours={[22, 23, 0, 1]} />)
    expect(screen.getByLabelText('Lefekvés óra')).toHaveValue('0')
    expect(screen.getByLabelText('Lefekvés perc')).toHaveValue('42')
  })

  it('keeps the plain lists when the value is in-list (manual mode unchanged)', async () => {
    const onChange = vi.fn()
    render(<TimePicker label="Ébredés" val="06:30" onChange={onChange} hours={[5, 6, 7, 8]} />)
    const minute = screen.getByLabelText('Ébredés perc')
    expect(Array.from((minute as HTMLSelectElement).options).map(o => o.value)).toEqual(['0', '30'])
    await userEvent.selectOptions(minute, '0')
    expect(onChange).toHaveBeenCalledWith('06:00')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test src/features/me/components/TimePicker.test.tsx`
Expected: FAIL — the minute select has no option `42` (first test).

- [ ] **Step 3: Implement.** In `TimePicker.tsx`, before the return, derive tolerant option lists (keep everything else identical):

```tsx
  const [h, m] = val.split(':')
  // Screenshot drafts carry exact times (e.g. 00:42) — inject the current value as an
  // option when it's outside the preset lists, so the select can display it (mezo-66ab).
  const hourOptions = hours.includes(parseInt(h)) ? hours : [...hours, parseInt(h)].sort((a, b) => a - b)
  const minuteOptions = [0, 30].includes(parseInt(m)) ? [0, 30] : [0, parseInt(m), 30].sort((a, b) => a - b)
```

and swap the two `.map(...)` sources: `{hourOptions.map(hh => ...)}` and `{minuteOptions.map(mm => ...)}`.

- [ ] **Step 4: Run to green + the sheet regression**

Run: `cd frontend && pnpm test src/features/me/components/TimePicker.test.tsx src/features/me/sheets/SleepLogSheet.test.tsx && VITE_USE_MOCK=true pnpm test src/features/me/components/TimePicker.test.tsx src/features/me/sheets/SleepLogSheet.test.tsx`
Expected: PASS (tolerance + the untouched manual-mode sheet tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/components
git -c core.hooksPath=/dev/null commit -m "feat(me): TimePicker tolerates out-of-list values for extracted times (mezo-66ab)"
```

---

### Task 6: SleepLogSheet — Kézi | Screenshot mode with pick → drafting → review

**Files:**
- Modify: `frontend/src/features/me/sheets/SleepLogSheet.tsx` + `SleepLogSheet.test.tsx`

**Interfaces:**
- Consumes: `useSleepShot` from `@/data/hooks` (`extract(File): Promise<SleepShotDraft>`); `useSleep` (for the duplicate-date warning via `sleepLog`); Task 5's tolerant `TimePicker`; the existing `onSave: (input: SleepLogInput) => void` prop — UNCHANGED signature, the parent (`SleepPage`) needs no edits.
- Produces: manual mode byte-identical; screenshot mode saves `SleepLogInput` incl. `date` (editable), `bedtime/wakeup` (TimePickers, `hours={[...Array(24).keys()]}` in screenshot mode so any extracted hour fits natively), `durationH` (own editable number input, NOT span-derived), `quality` (grid, prefilled `Math.min(10, Math.max(1, Math.round(pct / 10)))` when `sourceQualityPct` present, else 7), `awakenings` (chips, default 1 — not extracted), `inBedMin`, `awakeMin/lightMin/remMin/deepMin`, `sourceQualityPct`, `source: 'screenshot'`, `note`.

- [ ] **Step 1: Extend the test file first.** Keep every existing test untouched. Add (mirroring the file's `test()`/render idiom and mock-mode stubEnv setup):

```tsx
describe('screenshot mode (mezo-66ab)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  const renderSheet = (onSave = vi.fn(), onClose = vi.fn()) => {
    render(<QueryWrapper><SleepLogSheet onClose={onClose} onSave={onSave} /></QueryWrapper>)
    return { onSave, onClose }
  }

  const toReview = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Screenshot' }))
    const file = new File(['shot'], 'sleep.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('Sleep Cycle screenshot'), file)
    await screen.findByText(/fázisok/i) // review phase reached (mock resolves immediately)
  }

  test('toggle shows the two modes and manual stays default', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Kézi' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Screenshot' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Lefekvés óra')).toBeInTheDocument() // manual inputs visible
  })

  test('extract prefills the review: exact times, duration, in-bed, derived quality 10', async () => {
    renderSheet()
    await toReview()
    expect(screen.getByLabelText('Lefekvés óra')).toHaveValue('0')
    expect(screen.getByLabelText('Lefekvés perc')).toHaveValue('42')
    expect(screen.getByLabelText('Ébredés óra')).toHaveValue('9')
    expect(screen.getByLabelText('Alvásidő (óra)')).toHaveValue(7.48)
    expect(screen.getByLabelText('Ágyban összesen (perc)')).toHaveValue(501)
    expect(screen.getByRole('button', { name: '10', pressed: true })).toBeInTheDocument() // 95% -> 10
    expect(screen.getByText(/éber 52p/)).toBeInTheDocument() // read-only phase row
    expect(screen.getByText(/95%/)).toBeInTheDocument()
  })

  test('save posts the full enriched payload with source screenshot and the edited date', async () => {
    const { onSave } = renderSheet()
    await toReview()
    fireEvent.change(screen.getByLabelText('Dátum'), { target: { value: '2026-07-20' } })
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-07-20', bedtime: '00:42', wakeup: '09:03', durationH: 7.48,
      inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100,
      sourceQualityPct: 95, source: 'screenshot', quality: 10,
    }))
  })

  test('duplicate-date hint appears for a date that already has a log', async () => {
    renderSheet()
    await toReview()
    // mock seed's last entry is 2026-05-22
    fireEvent.change(screen.getByLabelText('Dátum'), { target: { value: '2026-05-22' } })
    expect(screen.getByText(/Erre a napra már van bejegyzés/)).toBeInTheDocument()
  })

  test('manual save payload has no screenshot fields (regression)', async () => {
    const { onSave } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ bedtime: '23:00', wakeup: '06:30' }))
    expect(onSave.mock.calls[0][0].source).toBeUndefined()
  })
})
```

Add the imports the block needs (`QueryWrapper` from `@/test/queryWrapper`, `fireEvent`, `describe/beforeEach/afterEach` if missing). The `QueryWrapper` becomes necessary because the sheet now calls `useSleepShot`/`useSleep` — wrap the EXISTING tests' renders with it too (that is the one permitted edit to them; assertions stay identical).

- [ ] **Step 2: Run to verify the new tests fail** — `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/sheets/SleepLogSheet.test.tsx` → FAIL (no toggle).

- [ ] **Step 3: Implement the sheet.** Structure (adapt to the file's existing style; key code below):

State additions:

```tsx
  type Mode = 'manual' | 'shot'
  type ShotPhase = 'pick' | 'drafting' | 'review'
  const { extract } = useSleepShot()
  const { sleepLog } = useSleep()
  const [mode, setMode] = useState<Mode>('manual')
  const [shotPhase, setShotPhase] = useState<ShotPhase>('pick')
  const [shotError, setShotError] = useState<string | null>(null)
  const [draft, setDraft] = useState<SleepShotDraft | null>(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [durationInput, setDurationInput] = useState('') // screenshot mode's own editable duration
```

Mode toggle (top of the sheet body, ImportItemSheet chip idiom):

```tsx
          <div className="row gap-xs" style={{ marginBottom: 14 }}>
            {(['manual', 'shot'] as const).map((m) => (
              <button key={m} className="chip" aria-pressed={mode === m}
                onClick={() => { setMode(m); setShotPhase('pick'); setShotError(null) }}
                style={{
                  flex: 1, justifyContent: 'center', fontSize: 11, padding: '8px 0',
                  background: mode === m ? 'var(--wash-lav)' : 'transparent',
                  color: mode === m ? 'var(--lav-deep)' : 'var(--text-tertiary)',
                }}>
                {m === 'manual' ? 'Kézi' : 'Screenshot'}
              </button>
            ))}
          </div>
```

Pick phase (`mode === 'shot' && shotPhase === 'pick'`): a styled `<label className="chip">` wrapping a hidden `<input type="file" accept="image/*" aria-label="Sleep Cycle screenshot">` — NO `capture` attribute (gallery, not camera; spec D7) — plus `{shotError && <span style={{ fontSize: 10, color: 'var(--warning)' }}>{shotError}</span>}`. On change:

```tsx
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setShotPhase('drafting')
    setShotError(null)
    try {
      const d = await extract(file)
      setDraft(d)
      if (d.bedtime) setBedtime(d.bedtime)
      if (d.wakeup) setWakeup(d.wakeup)
      setDurationInput(d.durationH != null ? String(d.durationH) : '')
      if (d.inBedMin != null) setInBedMin(String(d.inBedMin))
      if (d.sourceQualityPct != null) setQuality(Math.min(10, Math.max(1, Math.round(d.sourceQualityPct / 10))))
      setShotPhase('review')
    } catch {
      setShotError('A screenshot beolvasása nem sikerült — próbáld újra, vagy válts kézire.')
      setShotPhase('pick')
    }
  }
```

Drafting phase: the AiLogSheet spinner card idiom with lav tokens (`Elemzem a screenshotot…`, `np-twinkle` dot bordered `var(--lav-deep)`).

Review phase (`shotPhase === 'review'`): reuse the SAME input rows as manual mode (TimePickers, quality grid, awakenings chips, Ágyban field, note) — render them for `mode === 'manual' || shotPhase === 'review'` — with these screenshot-only differences:
- TimePickers get `hours={mode === 'shot' ? [...Array(24).keys()] : [22, 23, 0, 1]}` (resp. `[5, 6, 7, 8]`) so any extracted hour is natively in-list (Task 5's tolerance still covers exotic minutes).
- An editable duration row ABOVE the quality grid, only in shot mode:

```tsx
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}>
              <span style={SECTION_LABEL}>Alvásidő (óra)</span>
              <input type="number" inputMode="decimal" step={0.1} min={0} aria-label="Alvásidő (óra)"
                value={durationInput} onChange={(e) => setDurationInput(e.target.value)}
                style={{ width: 72, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
            </div>
```

- A read-only phase summary row (only fields that arrived), plus the tracker quality:

```tsx
            {draft && (draft.awakeMin != null || draft.sourceQualityPct != null) && (
              <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-tertiary)' }}>
                fázisok: {[
                  draft.awakeMin != null && `éber ${draft.awakeMin}p`,
                  draft.lightMin != null && `könnyű ${fmtHm(draft.lightMin)}`,
                  draft.remMin != null && `REM ${fmtHm(draft.remMin)}`,
                  draft.deepMin != null && `mély ${fmtHm(draft.deepMin)}`,
                  draft.sourceQualityPct != null && `minőség ${draft.sourceQualityPct}%`,
                ].filter(Boolean).join(' · ')}
              </div>
            )}
```

with `const fmtHm = (min: number) => min >= 60 ? `${Math.floor(min / 60)}ó${String(min % 60).padStart(2, '0')}p` : `${min}p`` as a module-level helper.

- An editable date row + duplicate hint (shot mode only):

```tsx
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}>
              <span style={SECTION_LABEL}>Dátum</span>
              <input type="date" aria-label="Dátum" value={date} onChange={(e) => e.target.value && setDate(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, colorScheme: 'dark' }} />
            </div>
            {sleepLog.some((s) => s.date === date) && (
              <span style={{ fontSize: 10, color: 'var(--warning)' }}>Erre a napra már van bejegyzés — mentéskor új sor készül.</span>
            )}
            {draft?.needsReview && (
              <span style={{ fontSize: 10, color: 'var(--warning)' }}>Az AI bizonytalan volt — nézd át az értékeket mentés előtt.</span>
            )}
```

Save: keep the manual `save` for manual mode untouched; shot mode saves:

```tsx
  const saveShot = (close: () => void) => {
    onSave({
      date,
      bedtime, wakeup,
      durationH: durationInput ? Number(durationInput) : computeDuration(bedtime, wakeup),
      quality, awakenings,
      inBedMin: inBedMin ? Number(inBedMin) : undefined,
      awakeMin: draft?.awakeMin ?? undefined,
      lightMin: draft?.lightMin ?? undefined,
      remMin: draft?.remMin ?? undefined,
      deepMin: draft?.deepMin ?? undefined,
      sourceQualityPct: draft?.sourceQualityPct ?? undefined,
      source: 'screenshot',
      note: note || undefined,
    })
    close()
  }
```

The Mentés CTA calls `mode === 'shot' ? saveShot(close) : save(close)`; in shot mode it renders only in the `review` phase.

- [ ] **Step 4: Run the sheet tests in both modes**

Run: `cd frontend && pnpm test src/features/me/sheets/SleepLogSheet.test.tsx && VITE_USE_MOCK=true pnpm test src/features/me/sheets/SleepLogSheet.test.tsx`
Expected: PASS — existing manual tests (with the QueryWrapper edit only) + the 5 new ones.

- [ ] **Step 5: Full FE gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: ALL green both modes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(me): SleepLogSheet screenshot mode — extract, review, confirm via the normal log path (mezo-66ab)"
```

---

### Task 7: Living docs + cluster notes

**Files:**
- Modify: `docs/features/me.md` (§ sleep: screenshot mode, useSleepShot, draft flow), `docs/features/_platform-api-backend.md` (new `/api/sleep/screenshot` + `SleepShot` tag + flag), `docs/features/_platform-data-layer.md` (`useSleepShot`, no query key — action only), `docs/features/companion.md` (third ADR 0012 adapter: `SleepShotLlmAdapter`)
- Modify: `docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md` (§0/§3: slice B implemented; §5 playbook → slice C / consumers next)

- [ ] **Step 1:** Update the touched sections only, fresh `file:line` pointers into the real code (verify by opening the files); overwrite in place, no changelogs; each doc's existing language respected.
- [ ] **Step 2:** Run: `node scripts/lint-docs.mjs` → touched docs clean (pre-existing stale docs out of scope).
- [ ] **Step 3: Commit**

```bash
git add docs
git -c core.hooksPath=/dev/null commit -m "docs(sleep): screenshot ingestion feature docs + cluster notes (mezo-66ab)"
```

---

### Task 8: Final verification + PR

- [ ] **Step 1: Focused backend gate:** `cd backend && ./mvnw clean test -Dtest='SleepShot*,SleepGoal*IT,SleepLog*IT,BiometricsContractIT' -DargLine=-Xmx3g` → PASS.
- [ ] **Step 2: Full FE gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → both modes green.
- [ ] **Step 3: Contract drift:** `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && git diff --exit-code -- ../api/openapi.yml src/data/_client/api.gen.ts` → exit 0.
- [ ] **Step 4: Runtime verify (mock FE, per the project `verify` skill):** open `/me/sleep` → Log → Screenshot mode → pick any image file → the canonical mock draft fills the review (00:42/09:03/7.48/501/quality 10, phase row, date field) → Mentés → the new entry appears in the log list with its enriched data; manual mode unchanged. Screenshot the review phase. `/me/sleep` is not in the visual-golden set — no golden refresh expected.
- [ ] **Step 5: Push + PR + CI + merge** (worktree flow; check PR `mergeable` before watching CI — a parallel session may land on main mid-flight, then back-merge + regen contracts exactly like slice A did):

```bash
git push -u origin feat/sleep-shot
gh pr create --title "feat(sleep): Sleep Cycle screenshot ingestion — LLM-vision draft into the enriched sleep log (mezo-66ab)" --body "..."
# CI green -> gh pr merge --merge --delete-branch
```

- [ ] **Step 6: bd close** (from `~/MrKuhne/mezo`): `bd close mezo-66ab` + `bd update mezo-66ab --notes="..."` + `bd dolt push`.

---

## Self-Review (done at authoring)

- **Spec coverage:** D1 → Task 6 toggle; D2 → Task 6 review (editable keys, read-only phase row); D3 → Task 6 quality prefill `round(pct/10)` clamp; D4 → Task 6 date row + duplicate hint; D5 → Tasks 1/3 (draft endpoint) + Task 6 `saveShot` via `onSave` → normal path with `source:'screenshot'`; D6 → Task 2 validator (corrected span-vs-inBed check) + Task 3 service wiring; D7 → Task 3 validation (5 MB/mime, raw bytes, no resize) + Task 6 no-`capture` input; D8 → Tasks 1/2/3 (own tag/flag/controller). Spec §5 mock draft → Task 4; §7 tests → Tasks 2/3/4/5/6; §8 out-of-scope respected (no photo2, no auto-ingestion, no goal/habit changes).
- **Type consistency:** `SleepShotDraftValidator.Extracted/Score` identical in Tasks 2 (def) and 3 (use); `score(Extracted, double)` threshold-passing consistent; FE `SleepShotDraft` field names identical across Tasks 4 (def) and 6 (use); `useSleepShot().extract/pending` consistent; `SleepLogInput` gains `source`/`sourceQualityPct`/phase fields in Task 4, consumed by Task 6's `saveShot`; TimePicker props unchanged (Task 5) and consumed with `hours={[...Array(24).keys()]}` in Task 6.
- **Placeholders:** none — the two "mirror the real file's idiom" notes (adapter imports, sheet style) are adapt-to-actual instructions with the behavior fully specified. Jackson-record note in Task 3 names the exact precedent file to check (`ExtractedDraft`).



