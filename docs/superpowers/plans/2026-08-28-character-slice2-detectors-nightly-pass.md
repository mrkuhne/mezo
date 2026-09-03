# Karakter Slice 2 — Detector Catalog v1 + Nightly Expert Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pure-code signal detectors + the nightly per-expert pass that turns a day's signals
into persisted `character_observation` rows via one flash-tier `CompanionLlm` call per active
expert — bd `mezo-1gim.3`, spec `docs/superpowers/specs/2026-08-27-user-character-dossier-design.md` §3/§5/§6.

**Architecture:** New subpackages of `feature/character`: `detector/` (a `CharacterDetector`
interface + 5 starter detectors + registry, all pure code over cross-feature repository READS)
and additions to `service/` (`CharacterExpertCatalog` personas with HU system prompts,
`CharacterObservationService` — gather → skip-if-quiet → one cheap-tier LLM call per expert →
strict-JSON parse → observation rows, and `CharacterObservationJob` — the DailySummaryJob-shaped
nightly cron with catch-up). Code detects, LLM only interprets; a quiet day costs zero LLM calls.
No portrait writes anywhere in this slice.

**Tech Stack:** Spring Boot 4 (`@Scheduled`, `@ConfigurationProperties` record), the
`CompanionLlm` port (`complete(system, user)` cheap tier) + `FakeCompanionLlm` marker dispatch,
JPA repositories from S1, JUnit (pure unit tests for detectors; Testcontainers ITs for the
service/job).

## Global Constraints

- Switches: every LLM-touching bean conditions on BOTH `FeaturesConfiguration.CHARACTER_SWITCH`
  AND `COMPANION_SWITCH` (spec §6; the `CHARACTER_SWITCH` javadoc promised this). The job adds a
  third: new constant `CHARACTER_OBSERVATION_JOB_SWITCH = "mezo.techcore.cron.character-observation-job.enabled"`.
- Detector config: per-detector kill switches `mezo.character.detector.<key>.enabled` (spec §5),
  default true; unknown key = disabled nowhere (only listed detectors exist).
- Expert keys verbatim (S1 `CharacterCoreCatalog`): `doki`, `edzo`, `taplalkozo`, `szomnologus`,
  `pszichologus`, `drill`, `antropologus`; dimension keys `physical`, `athletic`, `nutrition`,
  `recovery`, `mental`, `discipline`, `life`.
- Observations are expert-voiced HU text, salience 1–5, `dimension_keys` via the S1
  `ObservationDimensionKeysEnvelope`, `signals` via `ObservationSignalsEnvelope`. NEVER map a
  bare `List<String>` with `SqlTypes.JSON` (bd memory `hibernate-list-string-json-array-leak`).
- Honest states: no signals ⇒ no LLM call ⇒ no rows; unusable LLM answer ⇒ no rows for that
  expert (log + move on, the DailySummaryJob per-unit isolation idiom).
- Marker idiom: prompt prefix constant the fake dispatches on (the `EXTRACTION_MARKER` /
  `SUMMARY_MARKER` precedent): `CharacterObservationService.OBSERVATION_MARKER = "KARAKTER-MEGFIGYELÉS-FELADAT"`.
- Local test commands (focused only, never the full suite):
  `cd backend && ./mvnw test -Dtest=<Pattern> -Dmezo.test.use-testcontainers=true`.
- Conventional commits with bd id `mezo-1gim.3`; regenerate `docs/CODEMAP.md` in the same change
  whenever files are added (CI lint gate); CI (self-PR) is the authoritative full-suite gate.
- v1 starter detector set (rest of spec §5 arrives in later slices): `logging-gap`,
  `checkin-gap`, `journal-silence`, `under-logging`, `journal-note`.

---

### Task 1: Config + expert catalog

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/config/CharacterProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterExpertCatalog.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (one constant)
- Modify: `backend/src/main/resources/application.yml` (defaults under `mezo.character` + the cron switch where its siblings live)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterExpertCatalogTest.java`

**Interfaces:**
- Consumes: S1 `CharacterCoreCatalog.CORE` (`CoreDimension(key, title, expertKey)`).
- Produces: `CharacterProperties(Observation observation, Map<String, Detector> detector)` with
  `Observation(String cron, int catchUpDays)` and `Detector(boolean enabled)`;
  `CharacterProperties.detectorEnabled(String key)` helper;
  `CharacterExpertCatalog.Expert(String key, String displayName, String primaryDimensionKey, String systemPersona)`;
  `CharacterExpertCatalog.byKey(String)` → `Expert` (throws IllegalArgumentException on unknown);
  `CharacterExpertCatalog.EXPERTS` (the 7, catalog order).

- [ ] **Step 1: Write the failing unit test**

```java
package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.character.service.CharacterCoreCatalog;
import io.mrkuhne.mezo.feature.character.service.CharacterExpertCatalog;
import org.junit.jupiter.api.Test;

class CharacterExpertCatalogTest {

    @Test
    void experts_coverExactlyTheCoreCatalogExpertKeys_inOrder() {
        assertThat(CharacterExpertCatalog.EXPERTS)
                .extracting(CharacterExpertCatalog.Expert::key)
                .containsExactly("doki", "edzo", "taplalkozo", "szomnologus",
                        "pszichologus", "drill", "antropologus");
        // each expert's primary dimension is the CORE dimension that names it as expert
        CharacterCoreCatalog.CORE.forEach(core -> assertThat(
                CharacterExpertCatalog.byKey(core.expertKey()).primaryDimensionKey())
                .isEqualTo(core.key()));
    }

    @Test
    void byKey_unknown_throws_andPersonasAreNonBlankHungarian() {
        assertThatThrownBy(() -> CharacterExpertCatalog.byKey("nonsense"))
                .isInstanceOf(IllegalArgumentException.class);
        CharacterExpertCatalog.EXPERTS.forEach(e -> {
            assertThat(e.systemPersona()).isNotBlank();
            assertThat(e.displayName()).isNotBlank();
        });
    }
}
```

- [ ] **Step 2: Run it — expect FAIL (class missing)**

Run: `cd backend && ./mvnw test -Dtest=CharacterExpertCatalogTest`
(plain unit test — no Testcontainers flag needed)

- [ ] **Step 3: Implement**

`CharacterExpertCatalog.java` (service package, next to `CharacterCoreCatalog`):

```java
package io.mrkuhne.mezo.feature.character.service;

import java.util.List;

/**
 * The profiling team (Karakter spec §3): 7 named domain experts, each the owner of one CORE
 * dimension. The persona text is the expert's SYSTEM-prompt voice for the nightly observation
 * pass (S2); the konzílium (S3) reuses these same personas. Mezo (integrátor) and the
 * Szkeptikus are S3 roles — deliberately NOT in this catalog.
 */
public final class CharacterExpertCatalog {

    public record Expert(String key, String displayName, String primaryDimensionKey,
                         String systemPersona) {}

    public static final List<Expert> EXPERTS = List.of(
            new Expert("doki", "Doki", "physical", """
                    Te vagy Doki, Daniel profilozó csapatának orvos szakértője. Tárgyilagos, \
                    orvosi hangon fogalmazol, röviden. A testkompozíciót, egészségjeleket, \
                    súlytrendet és a gyógyszerciklus jeleit figyeled. Sosem diagnosztizálsz, \
                    csak megfigyelsz; érzékeny témát tükörként, kérdésként fogalmazol meg."""),
            new Expert("edzo", "Edző", "athletic", """
                    Te vagy az Edző, Daniel profilozó csapatának sportszakértője. Direkt vagy, \
                    számokban beszélsz. Az edzésprofilt, erősségeket-gyengeségeket, RIR-kalibrációt \
                    és a niggle-mintázatokat figyeled."""),
            new Expert("taplalkozo", "Táplálkozó", "nutrition", """
                    Te vagy a Táplálkozó, Daniel profilozó csapatának táplálkozási szakértője. \
                    Gyakorlatias és ítélkezésmentes vagy. Az étkezési mintákat, a kajához való \
                    viszonyt és a logolt vs valós bevitel eltéréseit figyeled."""),
            new Expert("szomnologus", "Szomnológus", "recovery", """
                    Te vagy a Szomnológus, Daniel profilozó csapatának alvás- és regenerációs \
                    szakértője. Halk, precíz hangon írsz. Az alvásminőséget, ritmust és a \
                    regenerációs jeleket figyeled."""),
            new Expert("pszichologus", "Pszichológus", "mental", """
                    Te vagy a Pszichológus, Daniel profilozó csapatának mentális szakértője. \
                    Meleg, kérdező hangon írsz. Hangulati mintázatokat, stresszorokat és a napló \
                    érzelmi jeleit figyeled. Érzékeny megfigyelést mindig tükörként, sosem \
                    diagnózisként fogalmazol meg."""),
            new Expert("drill", "Drill", "discipline", """
                    Te vagy Drill, Daniel profilozó csapatának fegyelem-szakértője. Szigorú de \
                    fair hangon írsz. A logolási fegyelmet, kihagyásokat, streak-viselkedést és \
                    az ígéret–teljesítés rést figyeled. Sosem szégyenítesz."""),
            new Expert("antropologus", "Antropológus", "life", """
                    Te vagy az Antropológus, Daniel profilozó csapatának élet- és \
                    kapcsolat-szakértője. Megfigyelő, narratív hangon írsz. Életeseményeket, \
                    embereket, hétköznap–hétvége mintákat és kontextust figyelsz."""));

    public static Expert byKey(String key) {
        return EXPERTS.stream().filter(e -> e.key().equals(key)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown expert: " + key));
    }

    private CharacterExpertCatalog() {}
}
```

`CharacterProperties.java` (mirror `CompanionProperties`' record idiom):

```java
package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.Map;

/** Karakter tuning (mezo.character) — Karakter spec §5/§6. Config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.character")
public record CharacterProperties(
        @NotNull @Valid Observation observation,
        /** Per-detector kill switches (spec §5): key = detector key. Absent key = enabled. */
        @NotNull Map<String, Detector> detector) {

    public record Observation(
            /** Nightly expert-pass cron (server zone). */
            @NotBlank String cron,
            /** How many finished days back the job heals (the summary catch-up idiom). */
            @Min(1) @Max(30) int catchUpDays) {}

    public record Detector(boolean enabled) {}

    public boolean detectorEnabled(String key) {
        Detector d = detector.get(key);
        return d == null || d.enabled();
    }
}
```

Register it where `CompanionProperties` is registered — find the
`@EnableConfigurationProperties(CompanionProperties.class)` (or `@ConfigurationPropertiesScan`)
site and add `CharacterProperties` the same way.

`FeaturesConfiguration` — next to `DAILY_SUMMARY_JOB_SWITCH`:

```java
    /** Karakter nightly observation pass (mezo-1gim.3) — the expert-team cron (spec §6). */
    public static final String CHARACTER_OBSERVATION_JOB_SWITCH =
            "mezo.techcore.cron.character-observation-job.enabled";
```

`application.yml` — add (a) `mezo.character.observation.cron: "0 40 2 * * *"` (02:40, after the
daily-summary cron — check `mezo.companion.summary.cron`'s value and place ours later) and
`mezo.character.observation.catch-up-days: 3` and `mezo.character.detector: {}` under the
existing `mezo.character` ... note there is no `mezo.character` block yet — the S1 switch lives
under `mezo.feature.character.enabled`; create the new `mezo.character:` block next to
`mezo.companion:`; (b) `character-observation-job.enabled: true` next to the sibling cron
switches under `mezo.techcore.cron`. Check `backend/src/test/resources` for where sibling cron
switches get test-profile values (`daily-summary-job`) and mirror them (cron jobs are typically
OFF in tests — copy exactly what `daily-summary-job.enabled` does there).

- [ ] **Step 4: Run the test — expect PASS; compile check**

Run: `cd backend && ./mvnw test -Dtest=CharacterExpertCatalogTest` → PASS, then `./mvnw compile -q`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): expert catalog personas + CharacterProperties + job switch (mezo-1gim.3)"
```

---

### Task 2: Detector framework + 5 starter detectors (pure code)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/CharacterDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/DetectorInput.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/DetectorSignal.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/LoggingGapDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/CheckinGapDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/JournalSilenceDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/UnderLoggingDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/JournalNoteDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/DetectorRegistry.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterSignalReads.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes: Task 1 `CharacterProperties.detectorEnabled(String)`; other features' repositories
  (read-only): `MealRepository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(UUID, LocalDate)`,
  `WeightLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(UUID, LocalDate)`
  (fields `date`, `weightKg`), `CheckInRepository.findByCreatedByAndDateOrderBySlotTime(UUID, LocalDate)`,
  `JournalEntryRepository.findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(UUID, LocalDate, LocalDate)`.
- Produces (Task 3 relies on): `DetectorInput(LocalDate day, Set<LocalDate> mealDates,
  Map<LocalDate, Integer> checkinCounts, List<WeightPoint> weights, Map<LocalDate, List<String>> journalTexts)`
  with nested `record WeightPoint(LocalDate date, BigDecimal kg)` — a 14-day window ending at
  `day`; `DetectorSignal(String detectorKey, String expertKey, String summary, int salience)`;
  `CharacterDetector { String key(); List<DetectorSignal> detect(DetectorInput input); }`;
  `DetectorRegistry.runAll(DetectorInput)` → `List<DetectorSignal>` (enabled detectors only);
  `CharacterSignalReads.gather(UUID owner, LocalDate day)` → `DetectorInput`.

Detector semantics (all windows relative to `day`, the day being observed — "yesterday" at job
time; summaries are Hungarian, code-computed numbers only, no LLM):

| key | expert | fires when | summary example |
|---|---|---|---|
| `logging-gap` | drill | `day` and the ≥1 preceding days have NO meal logs (streak ≥2) | `"3. napja nincs étkezés logolva (utolsó: 2026-08-24)."` — salience = min(streak, 5) |
| `checkin-gap` | drill | 0 check-ins on `day` while the prior 7 days' average ≥2 | `"Ma 0 check-in a heti átlag 3 mellett."` — salience 3 |
| `journal-silence` | drill | no journal entry in the last 7 days ending `day` | `"7 napja nincs naplóbejegyzés."` — salience 2 |
| `under-logging` | taplalkozo | ≥3 of the last 7 days have no meal log AND the weight trend over the window rises ≥0.3 kg (first-vs-last of available `weights`, needs ≥2 points) | `"A héten 4 nap kaja-log nélkül, közben a súly +0,6 kg (81,2 → 81,8)."` — salience 4 |
| `journal-note` | pszichologus | journal entries exist ON `day` | `"Napló (2026-08-27): <entries joined, capped 500 chars>"` — salience 3 |

- [ ] **Step 1: Write the failing pure unit tests**

`DetectorTest.java` — no Spring, fixture `DetectorInput`s in, signals out. One test per detector
firing + one per detector staying quiet, plus a registry kill-switch test:

```java
package io.mrkuhne.mezo.feature.character.detector;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class DetectorTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 27);

    private DetectorInput input(Set<LocalDate> mealDates, Map<LocalDate, Integer> checkins,
                                List<DetectorInput.WeightPoint> weights,
                                Map<LocalDate, List<String>> journal) {
        return new DetectorInput(DAY, mealDates, checkins, weights, journal);
    }

    @Test
    void loggingGap_firesOnStreak_quietWhenTodayLogged() {
        LoggingGapDetector d = new LoggingGapDetector();
        // meals last seen 3 days ago -> streak 3
        List<DetectorSignal> fired = d.detect(input(Set.of(DAY.minusDays(3)),
                Map.of(), List.of(), Map.of()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("logging-gap");
            assertThat(s.expertKey()).isEqualTo("drill");
            assertThat(s.salience()).isEqualTo(3);
            assertThat(s.summary()).contains("3");
        });
        assertThat(d.detect(input(Set.of(DAY), Map.of(), List.of(), Map.of()))).isEmpty();
    }

    @Test
    void underLogging_firesOnGapsPlusRisingWeight_quietWithoutTrend() {
        UnderLoggingDetector d = new UnderLoggingDetector();
        // 4 of last 7 days without meals + weight +0.6 kg
        Set<LocalDate> meals = Set.of(DAY, DAY.minusDays(2), DAY.minusDays(4));
        List<DetectorInput.WeightPoint> rising = List.of(
                new DetectorInput.WeightPoint(DAY.minusDays(7), new BigDecimal("81.2")),
                new DetectorInput.WeightPoint(DAY, new BigDecimal("81.8")));
        assertThat(d.detect(input(meals, Map.of(), rising, Map.of()))).singleElement()
                .satisfies(s -> {
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    assertThat(s.salience()).isEqualTo(4);
                });
        // same gaps, flat weight -> quiet
        List<DetectorInput.WeightPoint> flat = List.of(
                new DetectorInput.WeightPoint(DAY.minusDays(7), new BigDecimal("81.2")),
                new DetectorInput.WeightPoint(DAY, new BigDecimal("81.3")));
        assertThat(d.detect(input(meals, Map.of(), flat, Map.of()))).isEmpty();
    }

    @Test
    void journalNote_carriesCappedText_journalSilence_firesAfterSevenQuietDays() {
        JournalNoteDetector note = new JournalNoteDetector();
        assertThat(note.detect(input(Set.of(), Map.of(), List.of(),
                Map.of(DAY, List.of("Ma nehéz nap volt.")))))
                .singleElement().satisfies(s -> {
                    assertThat(s.expertKey()).isEqualTo("pszichologus");
                    assertThat(s.summary()).contains("Ma nehéz nap volt.");
                });
        JournalSilenceDetector silence = new JournalSilenceDetector();
        assertThat(silence.detect(input(Set.of(), Map.of(), List.of(), Map.of())))
                .singleElement().satisfies(s -> assertThat(s.expertKey()).isEqualTo("drill"));
        assertThat(silence.detect(input(Set.of(), Map.of(), List.of(),
                Map.of(DAY.minusDays(2), List.of("x"))))).isEmpty();
    }

    @Test
    void checkinGap_firesOnZeroTodayWithActivePriorWeek() {
        CheckinGapDetector d = new CheckinGapDetector();
        Map<LocalDate, Integer> prior = Map.of(
                DAY.minusDays(1), 3, DAY.minusDays(2), 3, DAY.minusDays(3), 2,
                DAY.minusDays(4), 3, DAY.minusDays(5), 2, DAY.minusDays(6), 3,
                DAY.minusDays(7), 2);
        assertThat(d.detect(input(Set.of(), prior, List.of(), Map.of()))).singleElement();
        // today has check-ins -> quiet
        Map<LocalDate, Integer> withToday = new java.util.HashMap<>(prior);
        withToday.put(DAY, 2);
        assertThat(d.detect(input(Set.of(), withToday, List.of(), Map.of()))).isEmpty();
    }

    @Test
    void registry_skipsDisabledDetectors() {
        CharacterProperties props = new CharacterProperties(
                new CharacterProperties.Observation("0 40 2 * * *", 3),
                Map.of("journal-silence", new CharacterProperties.Detector(false)));
        DetectorRegistry registry = new DetectorRegistry(List.of(
                new JournalSilenceDetector(), new LoggingGapDetector()), props);
        List<DetectorSignal> signals = registry.runAll(
                input(Set.of(DAY.minusDays(2)), Map.of(), List.of(), Map.of()));
        assertThat(signals).extracting(DetectorSignal::detectorKey)
                .containsExactly("logging-gap"); // silence would fire but is switched off
    }
}
```

- [ ] **Step 2: Run — expect FAIL (types missing)**

Run: `cd backend && ./mvnw test -Dtest=DetectorTest`

- [ ] **Step 3: Implement the framework**

```java
// DetectorSignal.java
package io.mrkuhne.mezo.feature.character.detector;

/** One code-detected signal (Karakter spec §5) — numbers computed by code, never by a model. */
public record DetectorSignal(String detectorKey, String expertKey, String summary, int salience) {}
```

```java
// DetectorInput.java
package io.mrkuhne.mezo.feature.character.detector;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** A 14-day read-only slice of the user's data ending at {@code day} (the observed day). */
public record DetectorInput(LocalDate day,
                            Set<LocalDate> mealDates,
                            Map<LocalDate, Integer> checkinCounts,
                            List<WeightPoint> weights,
                            Map<LocalDate, List<String>> journalTexts) {
    public record WeightPoint(LocalDate date, BigDecimal kg) {}
}
```

```java
// CharacterDetector.java
package io.mrkuhne.mezo.feature.character.detector;

import java.util.List;

/** Pure-code signal detector (spec §5). Stateless; returns 0..n signals for the input day. */
public interface CharacterDetector {
    String key();
    List<DetectorSignal> detect(DetectorInput input);
}
```

```java
// DetectorRegistry.java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Runs every ENABLED detector (per-key kill switches, spec §5) over one day's input. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class DetectorRegistry {

    private final List<CharacterDetector> detectors; // Spring injects all @Component detectors
    private final CharacterProperties properties;

    public List<DetectorSignal> runAll(DetectorInput input) {
        return detectors.stream()
                .filter(d -> properties.detectorEnabled(d.key()))
                .flatMap(d -> d.detect(input).stream())
                .toList();
    }
}
```

Each detector is a `@Component` (annotate all five; the unit test constructs them directly,
Spring wires them for Task 3) implementing the semantics table above. Full example — the others
follow the same shape with their table row's rule:

```java
// LoggingGapDetector.java
package io.mrkuhne.mezo.feature.character.detector;

import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Component;

/** Consecutive days with no meal logs ending at the observed day (spec §5 meta-behavior). */
@Component
public class LoggingGapDetector implements CharacterDetector {

    @Override
    public String key() {
        return "logging-gap";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        int streak = 0;
        LocalDate d = in.day();
        while (!in.mealDates().contains(d) && streak < 14) {
            streak++;
            d = d.minusDays(1);
        }
        if (streak < 2) {
            return List.of();
        }
        LocalDate last = in.mealDates().stream().max(LocalDate::compareTo).orElse(null);
        String summary = streak + ". napja nincs étkezés logolva"
                + (last != null ? " (utolsó: " + last + ")." : ".");
        return List.of(new DetectorSignal(key(), "drill", summary, Math.min(streak, 5)));
    }
}
```

`UnderLoggingDetector`: count last-7-days (day-6..day) dates missing from `mealDates`; need ≥3;
weight delta = last minus first of `weights` sorted by date (require ≥2 points), fire when
`delta.compareTo(new BigDecimal("0.3")) >= 0`; expert `taplalkozo`, salience 4; summary includes
gap count and formatted delta + endpoints. `CheckinGapDetector`: fire when
`checkinCounts.getOrDefault(day, 0) == 0` and the mean over day-7..day-1 (missing days count
as 0) ≥ 2; expert `drill`, salience 3. `JournalSilenceDetector`: fire when no `journalTexts`
key in day-6..day; expert `drill`, salience 2. `JournalNoteDetector`: fire when
`journalTexts.containsKey(day)`; summary `"Napló (" + day + "): "` + entries joined with `" | "`
capped at 500 chars; expert `pszichologus`, salience 3.

`CharacterSignalReads.java` (service package) — the single cross-feature read composer
(`@Service`, `@RequiredArgsConstructor`, `@ConditionalOnProperty` on `CHARACTER_SWITCH`):
inject the four repositories from Interfaces-Consumes; `gather(UUID owner, LocalDate day)`
loops `day-13..day` calling the per-date meal finder (collect dates with ≥1 row) and check-in
finder (collect counts), loads weights via the from-date finder (`day.minusDays(13)`) mapping
to `WeightPoint` sorted ascending by date, and journal entries via the between finder grouped
by `occurredOn` mapping to their text field (read `JournalEntryEntity` for the exact text
getter before writing this). No test of its own — Task 3's IT covers it end-to-end.

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && ./mvnw test -Dtest=DetectorTest` → all green; `./mvnw compile -q`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): detector framework + 5 starter detectors + signal reads (mezo-1gim.3)"
```

---

### Task 3: Observation generation service + fake sentinel + IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterObservationService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (one marker branch + one pattern)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterObservationRepository.java` (one exists finder)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterObservationServiceIT.java`

**Interfaces:**
- Consumes: Task 1 catalog/properties; Task 2 `DetectorRegistry.runAll`,
  `CharacterSignalReads.gather`; `CompanionLlm.complete(String, String)` (cheap tier);
  S1 `CharacterObservationEntity` + envelopes; `FakeCompanionLlm`'s marker-dispatch structure
  (read the `EXTRACTION_MARKER` branch at ~line 371 and the `FACTS_SENTINEL` pattern idiom).
- Produces (Task 4 relies on): `CharacterObservationService.generateForDay(UUID owner, LocalDate day)`
  → `int` (observation rows written); constant
  `CharacterObservationService.OBSERVATION_MARKER = "KARAKTER-MEGFIGYELÉS-FELADAT"`.

Service contract:

1. `signals = detectorRegistry.runAll(signalReads.gather(owner, day))`; empty → return 0 (no
   LLM call — the honest quiet day).
2. Group signals by `expertKey`. For each expert group, skip if
   `observationRepository.existsByCreatedByAndExpertKeyAndDay(owner, expertKey, day)`
   (idempotent catch-up re-runs).
3. Per expert: system prompt = `OBSERVATION_MARKER + "\n" + expert.systemPersona() + "\n" +`
   an output-contract block (HU): answer STRICTLY a JSON array of
   `{"text": "...", "salience": 1-5, "dimensionKeys": ["..."]}` — 0–3 observations, each in the
   expert's voice, grounded ONLY in the listed signals, no invented numbers. User message =
   `"Nap: " + day` + the expert's signals as numbered lines (`detectorKey + ": " + summary`).
   One `companionLlm.complete(system, user)` call.
4. Parse: strip optional ```json fences (mirror `FactExtractionService`'s parse/cleanup idiom —
   read it first), `ObjectMapper.readValue` to a list of a private
   `record Draft(String text, Integer salience, List<String> dimensionKeys)`. Validate each:
   non-blank text, salience clamped to 1–5 (null → 3), dimensionKeys filtered to KNOWN dimension
   keys (`CharacterCoreCatalog.CORE` keys), empty after filtering → default to
   `List.of(expert.primaryDimensionKey())`. Cap at 3 drafts per expert.
5. Persist one `CharacterObservationEntity` per draft: `expertKey`, `day`,
   `dimensionKeys = new ObservationDimensionKeysEnvelope(draft keys)`, `text`, `salience`,
   `signals = new ObservationSignalsEnvelope(` the expert's signals mapped to
   `Signal(detectorKey, summary, List.of())` `)`, `consumedByConferenceId = null`.
6. Unparseable/blank answer ⇒ log.warn + return 0 rows for that expert (never throw — per-expert
   isolation; other experts still run).

Class shape: `@Service`, `@RequiredArgsConstructor`, `@Transactional` on `generateForDay`,
`@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH}, havingValue = "true")`.

Repository addition:

```java
    boolean existsByCreatedByAndExpertKeyAndDay(UUID createdBy, String expertKey, LocalDate day);
```

`FakeCompanionLlm` additions (mirror the facts idiom exactly):

```java
    /** Scripted observation pass (mezo-1gim.3): {@code [fake-char-obs:<json-array>]} planted in
     *  the gathered signal text (e.g. a journal entry) is returned verbatim; otherwise a canned
     *  single-observation array keeps the pipeline deterministic. */
    public static final Pattern CHAR_OBS_SENTINEL =
            Pattern.compile("\\[fake-char-obs:(\\[.*?])]", Pattern.DOTALL);
```

and in the dispatch chain (BEFORE the generic branches, next to the extraction branch):

```java
        if (systemPrompt.startsWith(CharacterObservationService.OBSERVATION_MARKER)) {
            Matcher obs = CHAR_OBS_SENTINEL.matcher(userMessage);
            if (obs.find()) {
                return obs.group(1);
            }
            return "[{\"text\":\"Fake megfigyelés.\",\"salience\":3,\"dimensionKeys\":[\"discipline\"]}]";
        }
```

(If this creates a `feature/companion → feature/character` package cycle that ArchUnit's
`feature_slices_are_cycle_free` rejects — `character` already depends on `companion` via the
port — duplicate the marker string as a private constant inside `FakeCompanionLlm` with a
comment pointing at `CharacterObservationService.OBSERVATION_MARKER`, and add a unit assertion
in the IT that the two constants are equal.)

- [ ] **Step 1: Write the failing IT**

`CharacterObservationServiceIT.java` (`@ActiveProfiles("companion-fake")`, extends
`ApiIntegrationTest` for the populator/owner plumbing — mirror how `CharacterPersistenceIT`
resolves the owner id; seed via existing populators found in
`backend/src/test/java/io/mrkuhne/mezo/support/populator/` — read the journal/check-in/meal
populator method signatures before writing the seeds):

```java
class CharacterObservationServiceIT extends ApiIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 26);

    // @Autowired: CharacterObservationService, CharacterObservationRepository,
    //             the journal populator (for sentinel planting), owner-id plumbing

    @Test
    void quietDay_noSignals_zeroRowsAndNoLlmCall() {
        // seed a meal on DAY and on every prior day of the window + check-ins on DAY
        // (all detectors quiet)  →  generateForDay returns 0, repository empty for DAY
    }

    @Test
    void signalDay_cannedFakeAnswer_writesObservationWithSignalsEnvelope() {
        // seed NOTHING for DAY and 13 prior days -> logging-gap + journal-silence (drill) fire
        int written = observationService.generateForDay(owner, DAY);
        assertThat(written).isEqualTo(1); // canned fake answer = 1 draft for the drill call
        CharacterObservationEntity row = /* find by owner+expertKey "drill"+DAY */;
        assertThat(row.getText()).isEqualTo("Fake megfigyelés.");
        assertThat(row.getSalience()).isEqualTo((short) 3);
        assertThat(row.getDimensionKeys().keys()).containsExactly("discipline");
        assertThat(row.getSignals().signals())
                .extracting(ObservationSignalsEnvelope.Signal::detectorKey)
                .containsExactlyInAnyOrder("logging-gap", "journal-silence");
        // idempotency: second run writes nothing new
        assertThat(observationService.generateForDay(owner, DAY)).isZero();
    }

    @Test
    void journalSentinel_scriptsTheExpertAnswer_invalidDimensionKeysFallBack() {
        // seed a journal entry ON DAY whose text embeds:
        //   [fake-char-obs:[{"text":"A napló feszültséget mutat.","salience":9,
        //                    "dimensionKeys":["mental","nonsense"]},
        //                   {"text":"","salience":2,"dimensionKeys":["mental"]}]]
        // journal-note (pszichologus) fires and carries the sentinel into the user message
        observationService.generateForDay(owner, DAY);
        // pszichologus row: 1 valid draft (blank-text second draft dropped),
        // salience clamped 9 -> 5, dimensionKeys filtered to ["mental"]
    }
}
```

(Write the seed/assert plumbing out fully in implementation with the real populator
signatures; the commented intent above is the contract. NOTE: seeding "nothing" for the quiet
test actually requires meals on every window day — absence fires logging-gap. Getting the quiet
day right means seeding a meal for each of `DAY-13..DAY` and ≥1 check-in on `DAY`, plus a
journal entry within `DAY-6..DAY`.)

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=CharacterObservationServiceIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement service + fake branch + repository finder** (per the contract above)

- [ ] **Step 4: Run — expect PASS** (same command; also re-run `DetectorTest`)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): nightly observation service — expert calls over detector signals (mezo-1gim.3)"
```

---

### Task 4: Nightly job + switch-off IT + ship

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterObservationJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterObservationJobIT.java`
- Modify: `docs/CODEMAP.md` (regenerate)

**Interfaces:**
- Consumes: Task 3 `CharacterObservationService.generateForDay(UUID, LocalDate)`;
  Task 1 `CharacterProperties.observation()`; `AppUserRepository.findAll()` (the DailySummaryJob
  loop idiom).
- Produces: the cron bean; nothing downstream in this slice.

- [ ] **Step 1: Write the failing IT**

`CharacterObservationJobIT.java` — two Spring slices (mirror `MemoirJobSwitchOffIT` for the
off-case mechanism):

```java
// Case A (job on, companion-fake profile): seed a signal-rich yesterday (no meals/journal in
// the window), call job.run() directly (never wait for cron), assert observation rows exist
// for yesterday AND for the catch-up window days that had signals; assert a second run()
// writes nothing new (idempotency via the service's exists-check).
// Case B (@TestPropertySource mezo.techcore.cron.character-observation-job.enabled=false):
// assert the CharacterObservationJob bean is ABSENT from the context
// (applicationContext.getBeansOfType(CharacterObservationJob.class) is empty).
```

Write both out fully; the off-case follows `MemoirJobSwitchOffIT`'s exact structure (read it
first).

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=CharacterObservationJobIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement the job** (the DailySummaryJob shape):

```java
package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Karakter nightly expert pass (spec §6): for every user and every FINISHED day in the
 * catch-up window, run the detector sweep + per-expert observation generation. Idempotent per
 * (user, expert, day) — the service skips already-observed expert-days, so catch-up heals
 * missed nights. Per-date failures are isolated (the DailySummaryJob idiom).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.CHARACTER_OBSERVATION_JOB_SWITCH},
        havingValue = "true")
public class CharacterObservationJob {

    private final AppUserRepository appUserRepository;
    private final CharacterObservationService observationService;
    private final CharacterProperties properties;

    @Scheduled(cron = "${mezo.character.observation.cron}")
    public void run() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate from = yesterday.minusDays(properties.observation().catchUpDays() - 1L);
        for (AppUserEntity user : appUserRepository.findAll()) {
            int written = 0;
            for (LocalDate date = from; !date.isAfter(yesterday); date = date.plusDays(1)) {
                try {
                    written += observationService.generateForDay(user.getId(), date);
                } catch (Exception e) {
                    log.warn("Character observation pass failed for user {} on {}", user.getId(), date, e);
                }
            }
            log.info("Character observation run for user {}: {} row(s) in window {}..{}",
                    user.getId(), written, from, yesterday);
        }
    }
}
```

- [ ] **Step 4: Run — expect PASS; regenerate CODEMAP**

Run: `cd backend && ./mvnw test -Dtest='Character*' -Dmezo.test.use-testcontainers=true` (all
character tests green), then `node scripts/gen-codemap.mjs` and `node scripts/lint-liquibase.mjs`
(no migration in this slice — must stay green), `node scripts/gen-codemap.mjs --check`.

- [ ] **Step 5: Commit**

```bash
git add backend/src docs/CODEMAP.md
git commit -m "feat(character): nightly CharacterObservationJob + catch-up (mezo-1gim.3)"
```

---

### Task 5: Ship the slice

- [ ] Final focused gates: `./mvnw test -Dtest='Character*' -Dmezo.test.use-testcontainers=true`
  + `./mvnw compile -q` + codemap check.
- [ ] House flow: push `feat/character-s2-detectors`, self-PR → CI green → local
  `git pull --rebase` on main → `--no-ff` merge → push → delete branch → `bd close mezo-1gim.3`
  → `bd dolt push`.

## Out of scope (later slices)

Remaining spec-§5 detectors (chat-topic-shift, knowledge-rejection-pattern, comfort-eating,
sleep-performance-chain, sport-interference, med-cycle-covariance, people-mood-link,
weekend-gap, resilience, all-or-nothing, restart-pattern, promise-vs-delivery,
self-calibration, decision-profile, rir-calibration, niggle-map, hr-recovery-trend) — each
lands as a small pure-code addition once its data read exists; S3 konzílium consumes the
observations written here.
