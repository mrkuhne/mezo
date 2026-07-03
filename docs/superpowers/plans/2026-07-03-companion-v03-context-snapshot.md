# Companion V0.3 — ContextSnapshotAssembler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only, deterministic `ContextSnapshotAssembler` in `feature/companion` that renders "today" (profile+weight trend, goal+prescription, train, fuel, medication, recovery) as a compact Hungarian text block injected into the `ChatService` system prompt — so the chat's first message already knows Daniel's day.

**Architecture:** One switch-gated `@Service` composition root in `feature/companion/service/` that injects EXISTING services/repositories from other features (one-directional: companion → others, never back) and renders six labelled blocks with stable ordering and explicit `nincs adat` for gaps. No new tables, no contract change, no LLM in the loop — pure string assembly, integration-tested against populator-seeded data.

**Tech Stack:** Spring Boot 4 / Java 21, Spring Data JPA derived finders, AssertJ ITs on `AbstractIntegrationTest` (real Postgres), `FakeCompanionLlm` echo for the ChatService wiring test.

**Driver:** bd `mezo-fnnq.3` · Spec: `docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md` §4 · Roadmap: `docs/superpowers/plans/2026-07-03-companion-roadmap.md` §V0.3 · Living doc: `docs/features/companion.md` §5.5/§7.

## Global Constraints

- Base package `io.mrkuhne.mezo`; layout `feature/companion/{service,config,…}` per `java_package_structure.md`.
- Constructor DI via `@RequiredArgsConstructor`; no field injection; no `@Value` (config via `@Validated` `CompanionProperties`).
- Every new companion bean carries `@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")` — the context must boot with the switch off.
- Tests: integration-first, extend `AbstractIntegrationTest` (+`@Transactional`), populator data, AssertJ only, naming `test{Method}_should{Result}_when{Condition}`. LLM never on the network — `companion-fake` profile.
- Coupling rule: companion imports other features; **no other feature may import companion** (ArchUnit `feature_slices_are_cycle_free` is frozen — a new cycle fails the build).
- No contract change (system prompt is server-internal) → skip the api/ merge step. No migration → skip Liquibase.
- ALWAYS `./mvnw clean test` (Lombok+MapStruct incremental compile is flaky). Run from `backend/`, compose Postgres up.
- Commits: conventional subjects carrying the bd id, e.g. `feat(companion): … (mezo-fnnq.3)`.

## Decisions locked (open decisions from the roadmap brief)

1. **Class name `ContextSnapshotAssembler`** (not `*Service`): the design-of-record name used by the spec §4, roadmap §V0.3, living doc §5.5 and the bd issue title; it is still a `@Service` bean in `service/`.
2. **API: `String render(UUID userId, LocalDate today)`** — `today` is a parameter (deterministic, boundary-testable); `ChatService` passes `LocalDate.now()` (codebase convention — no `Clock` bean, see `TdeeBootstrapService` Javadoc).
3. **Block order** = spec §4 table order: `[Profil]` → `[Cél]` → `[Edzés]` → `[Mai üzemanyag]` → `[Gyógyszer]` → `[Regeneráció]`, one line each, under the header `AKTUÁLIS ÁLLAPOT (pillanatkép — {ISO dátum}):`.
4. **Token budget by construction, no hard truncation:** the block is bounded by the digest window (7 nap) and one-line-per-block rendering (~0.5–1k token) — well inside the 2–4k spec budget; a hard cap would only mutilate determinism.
5. **Check-in verbatim, truncated:** the note is included verbatim up to `mezo.companion.snapshot.checkin-note-max-chars` (default 200) — summarizing would need an LLM (deferred by design).
6. **Config:** `mezo.companion.snapshot.digest-days` = 7 (`@Min(1) @Max(30)`), `checkin-note-max-chars` = 200 (`@Min(0) @Max(1000)`) on a new `Snapshot` record in `CompanionProperties`.
7. **Mesocycle week is DERIVED from `startDate`** (`ChronoUnit.DAYS/7+1`, clamped to `[1, weeks]`) — the `TrainService.clampWeek` idiom; the stored `currentWeek` field can lag.
8. **Goal current-week segment**: week = `DAYS.between(goal.startDate, today)/7 + 1`; the segment whose `fromWeek..toWeek` contains it (no match → targets omitted, planner fields still render).
9. **Graceful absence everywhere:** the assembler NEVER throws for missing data — it uses the `Optional`-returning repo finders (`BiometricProfileRepository`, `MedicationRepository`) instead of the 404-throwing service reads, and status-filtered repo finders for active goal/meso.
10. **New derived finders in other features' repos are allowed** (sleep latest, check-in latest, sport/run since-date) — they add no companion import to those features; `findAllOwned` full-table scans per chat turn would be waste.
11. **Number rendering:** `BigDecimal.stripTrailingZeros().toPlainString()` (dot decimal, locale-independent); dates ISO `yyyy-MM-dd`; day-of-week HU rövidítés `H K Sze Cs P Szo V` (index 0=Hétfő, matching `GymScheduleSlotEntity.dayOfWeek`).

### Rendered shape (the target artifact — full-data example)

```
\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — 2026-07-03):
[Profil] 183 cm, 45 év, férfi; súlytrend: 84.2 kg, heti -0.45 kg (-0.53%/hét)
[Cél] Nyári cut (cut): 84.2 → 80 kg, 2026-06-01 → 2026-07-27, 5. hét; e heti recept: 2100 kcal, 180 g fehérje, alvás 7.5 h, pihenőnap: Szo, V; étkezés/nap: 4, ébredés: 06:30, lefekvés: 22:30
[Edzés] mezociklus: Hipertrófia blokk — 3/6. hét (upper-lower); gym-rend: H 18:00, Sze 18:00; sport-rend: K 19:00 röplabda (90 perc); elmúlt 7 nap: 1 gym-edzés (2026-07-01), 1 sportalkalom, 1 futás
[Mai üzemanyag] 165/2400 kcal, fehérje 34.5/190 g, szénhidrát 0/240 g, zsír 2.25/80 g, víz 500/4000 ml; protokoll: v2 aktív, mai bevitel: 1
[Gyógyszer] Retatrutide: ciklus 4. nap (Stabil)
[Regeneráció] alvás (2026-07-02): 7.2 h, minőség 4/5; check-in (2026-07-03 08:00): energia 4/5, stressz 2/5, megjegyzés: "fáradtan ébredtem"
```

Empty-user shape: every block renders its label + `nincs adat` sub-parts (fuel targets still render — they come from config; counts render as 0). Example: `[Gyógyszer] nincs adat`, `[Edzés] mezociklus: nincs adat; gym-rend: nincs adat; sport-rend: nincs adat; elmúlt 7 nap: 0 gym-edzés, 0 sportalkalom, 0 futás`.

## File map

- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` (add `Snapshot`)
- Modify: `backend/src/main/resources/application.yml` (add `mezo.companion.snapshot.*`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` (inject + insert between voice and history)
- Modify (derived finders only): `SleepLogRepository`, `CheckInRepository`, `SportSessionRepository`, `RunSessionLogRepository`
- Test create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java`
- Test create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/CheckInPopulator.java`
- Test modify: `CompanionPropertiesIT`, `ChatServiceIT`, `GoalPopulator` (full overload), `TrainPopulator` (gym slot), `AbstractIntegrationTest` (`@Import` += CheckInPopulator)
- Docs: `docs/features/companion.md`, `docs/milestones/roadmap.md`

---

### Task 1: Snapshot config keys (`mezo.companion.snapshot.*`)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java`

**Interfaces:**
- Produces: `properties.snapshot().digestDays()` → `int` (7), `properties.snapshot().checkinNoteMaxChars()` → `int` (200) — Task 3–5 consume these.

- [ ] **Step 1: Write the failing test** — append to `CompanionPropertiesIT`:

```java
    @Test
    void testSnapshotConfig_shouldBindWindowsFromYaml_whenContextStarts() {
        assertThat(properties.snapshot().digestDays()).isEqualTo(7);
        assertThat(properties.snapshot().checkinNoteMaxChars()).isEqualTo(200);
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=CompanionPropertiesIT`
Expected: COMPILE ERROR — `cannot find symbol: method snapshot()`.

- [ ] **Step 3: Implement** — in `CompanionProperties`, add the component + record (keep `Llm`/`Chat` untouched):

```java
public record CompanionProperties(
    @NotNull @Valid Llm llm,
    @NotNull @Valid Chat chat,
    @NotNull @Valid Snapshot snapshot
) {
    // ... existing Llm + Chat records ...

    /** Context-snapshot (V0.3) windows — how much of "today" the system prompt carries. */
    public record Snapshot(
        /** How many days back the train digest (gym/sport/run counts) looks, including today. */
        @Min(1) @Max(30) int digestDays,
        /** The latest check-in note is included verbatim, truncated to this many characters. */
        @Min(0) @Max(1000) int checkinNoteMaxChars
    ) {}
}
```

In `application.yml`, extend the `mezo.companion` block (after `chat:`):

```yaml
    snapshot:
      # How many days back the context-snapshot train digest looks (including today)
      digest-days: 7
      # The latest check-in note is included verbatim, truncated to this many characters
      checkin-note-max-chars: 200
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=CompanionPropertiesIT`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java
git commit -m "feat(companion): mezo.companion.snapshot.* config keys (mezo-fnnq.3)"
```

---

### Task 2: Read-surface finders + test-data factories

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/repository/CheckInRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/SportSessionRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/RunSessionLogRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/CheckInPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/GoalPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (`@Import` += `CheckInPopulator`)

**Interfaces (produced for Tasks 3–5):**
- `SleepLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDesc(UUID)` → `Optional<SleepLogEntity>`
- `CheckInRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescSlotTimeDesc(UUID)` → `Optional<CheckInEntity>`
- `SportSessionRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(UUID, LocalDate)` → `List<SportSessionEntity>`
- `RunSessionLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(UUID, LocalDate)` → `List<RunSessionLogEntity>`
- `CheckInPopulator.createCheckIn(UUID owner, LocalDate date, String slotTime, Integer energy, Integer stress, String note)` → `CheckInEntity`
- `GoalPopulator.createGoalFull(UUID owner, LocalDate startDate, LocalDate targetDate, GoalPrescriptionJson prescription, Integer mealsPerDay, String wakeTime, String bedTime)` → `GoalEntity` (status `active`, trajectory `cut`)
- `TrainPopulator.createGymSlot(UUID createdBy, int dayOfWeek, String time)` → `GymScheduleSlotEntity`

- [ ] **Step 1: Add the four derived finders** (each one line inside the existing interface, mirroring the sibling Javadoc style):

```java
// SleepLogRepository
    /** Latest sleep row ("last night") for the companion context snapshot. */
    Optional<SleepLogEntity> findFirstByCreatedByAndDeletedFalseOrderByDateDesc(UUID createdBy);

// CheckInRepository
    /** Latest check-in across days (date, then slot) for the companion context snapshot. */
    Optional<CheckInEntity> findFirstByCreatedByAndDeletedFalseOrderByDateDescSlotTimeDesc(UUID createdBy);

// SportSessionRepository
    /** Sessions on/after {@code from} — the companion snapshot's last-N-days digest. */
    List<SportSessionEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
        UUID createdBy, LocalDate from);

// RunSessionLogRepository
    /** Logs on/after {@code from} — the companion snapshot's last-N-days digest. */
    List<RunSessionLogEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
        UUID createdBy, LocalDate from);
```

(`SleepLogRepository` needs `import java.util.Optional; import java.util.UUID;`; the two train repos need `import java.time.LocalDate;`.)

- [ ] **Step 2: Create `CheckInPopulator`** (pattern: `SleepLogPopulator`):

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the CheckIn aggregate — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class CheckInPopulator {

    private final CheckInRepository repository;

    public CheckInEntity createCheckIn(
        UUID owner, LocalDate date, String slotTime, Integer energy, Integer stress, String note) {
        CheckInEntity e = new CheckInEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setSlotTime(slotTime);
        e.setState("ok");
        e.setEnergy(energy);
        e.setStress(stress);
        e.setBody(3);
        e.setMental(3);
        e.setNote(note);
        e.setSavedAt(Instant.now());
        return repository.saveAndFlush(e);
    }
}
```

Register it: add `CheckInPopulator.class` to the `@Import({...})` list on `AbstractIntegrationTest`.

- [ ] **Step 3: Add `GoalPopulator.createGoalFull`** (keep the existing `createGoal` untouched):

```java
    /** Active cut goal with explicit dates, prescription and day-planner fields — snapshot tests. */
    public GoalEntity createGoalFull(UUID owner, LocalDate startDate, LocalDate targetDate,
        GoalPrescriptionJson prescription, Integer mealsPerDay, String wakeTime, String bedTime) {
        GoalEntity g = new GoalEntity();
        g.setCreatedBy(owner);
        g.setTitle("Nyári cut");
        g.setTrajectory("cut");
        g.setGuards(List.of("strength", "muscle"));
        g.setStatus("active");
        g.setStartDate(startDate);
        g.setTargetDate(targetDate);
        g.setStartWeightKg(new BigDecimal("84.20"));
        g.setTargetWeightKg(new BigDecimal("80.00"));
        g.setRateTargetPctPerWeek(new BigDecimal("0.70"));
        g.setPrescription(prescription);
        g.setMealsPerDay(mealsPerDay);
        g.setWakeTime(wakeTime);
        g.setBedTime(bedTime);
        return goalRepository.saveAndFlush(g);
    }
```

(Import `io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson`.)

- [ ] **Step 4: Add `TrainPopulator.createGymSlot`** — inject `GymScheduleSlotRepository gymScheduleSlotRepository` as a new `private final` field (constructor grows via `@RequiredArgsConstructor`), then:

```java
    public GymScheduleSlotEntity createGymSlot(UUID createdBy, int dayOfWeek, String time) {
        GymScheduleSlotEntity s = new GymScheduleSlotEntity();
        s.setCreatedBy(createdBy);
        s.setDayOfWeek(dayOfWeek);
        s.setTime(time);
        return gymScheduleSlotRepository.saveAndFlush(s);
    }
```

(Imports: `GymScheduleSlotEntity`, `GymScheduleSlotRepository`.)

- [ ] **Step 5: Compile-verify**

Run: `cd backend && ./mvnw clean test-compile`
Expected: BUILD SUCCESS (finders are derived — Spring Data validates them at context start; they get exercised by Task 3–5 ITs).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/repository/CheckInRepository.java backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/SportSessionRepository.java backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/RunSessionLogRepository.java backend/src/test/java/io/mrkuhne/mezo/support/populator/CheckInPopulator.java backend/src/test/java/io/mrkuhne/mezo/support/populator/GoalPopulator.java backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java
git commit -m "feat(companion): snapshot read-surface finders + test factories (mezo-fnnq.3)"
```

---

### Task 3: `ContextSnapshotAssembler` skeleton — empty-user render

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java`

**Interfaces:**
- Produces: `String render(UUID userId, LocalDate today)`; constants `ContextSnapshotAssembler.HEADER` (`"\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — "`) and `NO_DATA` (`"nincs adat"`) — package-private `static final`, consumed by ChatServiceIT asserts in Task 6.

- [ ] **Step 1: Write the failing test:**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0.3 context snapshot — deterministic, LLM-free (spec §4). The fake profile keeps the
 * Gemini adapter out of the context; the assembler itself never touches the port.
 */
@Transactional
@ActiveProfiles("companion-fake")
class ContextSnapshotAssemblerIT extends AbstractIntegrationTest {

    @Autowired private ContextSnapshotAssembler assembler;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRender_shouldRenderAllBlocksWithNincsAdat_whenUserHasNoData() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String block = assembler.render(owner, today);

        assertThat(block).startsWith("\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — " + today + "):");
        // all six blocks present, in spec §4 order
        int profil = block.indexOf("[Profil]");
        int cel = block.indexOf("[Cél]");
        int edzes = block.indexOf("[Edzés]");
        int fuel = block.indexOf("[Mai üzemanyag]");
        int med = block.indexOf("[Gyógyszer]");
        int rege = block.indexOf("[Regeneráció]");
        assertThat(profil).isPositive();
        assertThat(cel).isGreaterThan(profil);
        assertThat(edzes).isGreaterThan(cel);
        assertThat(fuel).isGreaterThan(edzes);
        assertThat(med).isGreaterThan(fuel);
        assertThat(rege).isGreaterThan(med);
        // absences are explicit, never invented (spec §4)
        assertThat(block)
            .contains("[Profil] nincs adat")
            .contains("[Cél] nincs adat")
            .contains("mezociklus: nincs adat")
            .contains("gym-rend: nincs adat")
            .contains("sport-rend: nincs adat")
            .contains("0 gym-edzés, 0 sportalkalom, 0 futás")
            .contains("protokoll: nincs adat, mai bevitel: 0")
            .contains("[Gyógyszer] nincs adat")
            .contains("alvás: nincs adat")
            .contains("check-in: nincs adat");
        // fuel targets come from config, so the fuel line renders numbers even on an empty day
        assertThat(block).contains("[Mai üzemanyag] 0/");
    }

    @Test
    void testRender_shouldBeDeterministic_whenCalledTwice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        assertThat(assembler.render(owner, today)).isEqualTo(assembler.render(owner, today));
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ContextSnapshotAssemblerIT`
Expected: COMPILE ERROR — `ContextSnapshotAssembler` does not exist.

- [ ] **Step 3: Implement the full skeleton** (all six blocks with absence paths; data paths land in Tasks 4–5 — but write the structure completely now):

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.GymScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.fuel.service.IntakeService;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * V0.3 — the "pain-killer" (spec §4): renders today's cross-feature state as a compact,
 * deterministic Hungarian text block for the chat system prompt. Read-only composition of
 * EXISTING feature reads — companion depends on the other features, never the reverse.
 * Missing data renders as explicit "nincs adat", never invented; no LLM anywhere.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ContextSnapshotAssembler {

    static final String HEADER = "\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — ";
    static final String NO_DATA = "nincs adat";
    /** dayOfWeek 0=Hétfő..6=Vasárnap (GymScheduleSlotEntity convention). */
    private static final List<String> HU_DAYS = List.of("H", "K", "Sze", "Cs", "P", "Szo", "V");

    private final BiometricProfileRepository biometricProfileRepository;
    private final WeightTrendService weightTrendService;
    private final GoalRepository goalRepository;
    private final MesocycleRepository mesocycleRepository;
    private final GymScheduleService gymScheduleService;
    private final SportService sportService;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final FuelDayService fuelDayService;
    private final ProtocolService protocolService;
    private final IntakeService intakeService;
    private final MedicationRepository medicationRepository;
    private final MedicationCycleService medicationCycleService;
    private final SleepLogRepository sleepLogRepository;
    private final CheckInRepository checkInRepository;
    private final CompanionProperties properties;

    public String render(UUID userId, LocalDate today) {
        return HEADER + today + "):\n"
                + profileBlock(userId, today) + '\n'
                + goalBlock(userId, today) + '\n'
                + trainBlock(userId, today) + '\n'
                + fuelBlock(userId, today) + '\n'
                + medicationBlock(userId, today) + '\n'
                + recoveryBlock(userId);
    }

    private String profileBlock(UUID userId, LocalDate today) { /* Task 4 */ }

    private String goalBlock(UUID userId, LocalDate today) { /* Task 4 */ }

    private String trainBlock(UUID userId, LocalDate today) { /* Task 5 */ }

    private String fuelBlock(UUID userId, LocalDate today) { /* Task 5 */ }

    private String medicationBlock(UUID userId, LocalDate today) { /* Task 5 */ }

    private String recoveryBlock(UUID userId) { /* Task 5 */ }

    /** Locale-independent compact number: strip trailing zeros, plain (non-scientific) string. */
    private static String num(BigDecimal v) {
        return v == null ? "?" : v.stripTrailingZeros().toPlainString();
    }

    private static String huDay(Integer dayOfWeek) {
        return dayOfWeek != null && dayOfWeek >= 0 && dayOfWeek < 7 ? HU_DAYS.get(dayOfWeek) : "?";
    }
}
```

For THIS task the block methods must already return the absence shapes the test asserts (fill the data paths with the absence branch only where data lookups land in later tasks — the lookups that are pure repo `Optional`s can be wired immediately):

```java
    private String profileBlock(UUID userId, LocalDate today) {
        BiometricProfileEntity profile =
                biometricProfileRepository.findByCreatedByAndDeletedFalse(userId).orElse(null);
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        StringBuilder b = new StringBuilder("[Profil] ");
        if (profile == null) {
            b.append(NO_DATA);
        } else {
            b.append(num(profile.getHeightCm())).append(" cm");
            if (profile.getBirthDate() != null) {
                b.append(", ").append(ChronoUnit.YEARS.between(profile.getBirthDate(), today)).append(" év");
            }
            b.append(", ").append("M".equals(profile.getSex()) ? "férfi" : "nő");
        }
        b.append("; súlytrend: ");
        if (trend.getLatestTrendKg() == null) {
            b.append(NO_DATA);
        } else {
            b.append(num(trend.getLatestTrendKg())).append(" kg");
            if (trend.getWeeklyRateKgPerWeek() != null) {
                b.append(", heti ").append(num(trend.getWeeklyRateKgPerWeek())).append(" kg");
            }
            if (trend.getWeeklyRatePctPerWeek() != null) {
                b.append(" (").append(num(trend.getWeeklyRatePctPerWeek())).append("%/hét)");
            }
        }
        return b.toString();
    }
```

…and analogous absence-first bodies for the other five (goal: `[Cél] nincs adat` when no active goal; train: the three `nincs adat` sub-parts + zero counts via the Task 2 finders + `workoutSessionRepository.findDoneInstanceDates(userId, from, today)` where `from = today.minusDays(properties.snapshot().digestDays() - 1L)`; fuel: `fuelDayService.getDay(userId, today)` + `protocolService.getView(userId).getActive()` null-check + `intakeService.listForDay(userId, today).getIntakes().size()`; medication: `medicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse` → absent = `[Gyógyszer] nincs adat`; recovery: the two Task 2 `Optional` finders → `alvás: nincs adat; check-in: nincs adat`). Write them fully — Task 4/5 only ENRICH the present-data branches that populator seeding exercises; the structure and every absence string is final here.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ContextSnapshotAssemblerIT`
Expected: PASS (2 tests). If the fuel/train/recovery present-branches are still partial, the empty-user test only exercises absence paths — it must pass regardless.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java
git commit -m "feat(companion): ContextSnapshotAssembler skeleton — empty-day render (mezo-fnnq.3)"
```

---

### Task 4: Data paths — `[Profil]` + `[Cél]` (trend, prescription week, planner)

**Files:**
- Modify: `ContextSnapshotAssembler.java` (`goalBlock` full body; `profileBlock` done in Task 3)
- Test: `ContextSnapshotAssemblerIT.java`

**Interfaces:**
- Consumes: `GoalPopulator.createGoalFull(...)`, `BiometricProfilePopulator.create(owner)`, `WeightLogPopulator.createWeightLog(owner, date, kg)`.

- [ ] **Step 1: Write the failing tests:**

```java
    @Autowired private BiometricProfilePopulator biometricProfilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private GoalPopulator goalPopulator;

    @Test
    void testRender_shouldRenderProfileAndTrend_whenProfileAndWeightsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        biometricProfilePopulator.create(owner);
        for (int i = 14; i >= 0; i--) {
            weightLogPopulator.createWeightLog(owner, today.minusDays(i),
                new BigDecimal("85.00").subtract(new BigDecimal("0.05").multiply(BigDecimal.valueOf(14 - i))));
        }

        String block = assembler.render(owner, today);

        assertThat(block).contains("[Profil] ").doesNotContain("[Profil] nincs adat");
        assertThat(block).contains(" cm").contains(" év");
        assertThat(block).contains("súlytrend: ").contains(" kg");
        assertThat(block).doesNotContain("súlytrend: nincs adat");
    }

    @Test
    void testRender_shouldPickCurrentWeekSegmentAndPlanner_whenActiveGoalWithPrescription() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(
                new GoalPrescriptionJson.Segment(1, 2, "bevezető", 2300, 170,
                    new BigDecimal("7.5"), List.of(5, 6), null, null),
                new GoalPrescriptionJson.Segment(3, 6, "vágás", 2100, 180,
                    new BigDecimal("7.5"), List.of(5, 6), null, null)),
            null, null);
        // started 2 weeks + 1 day ago → day 15 → week 3 → the second segment
        goalPopulator.createGoalFull(owner, today.minusWeeks(2).minusDays(1), today.plusWeeks(6),
            prescription, 4, "06:30", "22:30");

        String block = assembler.render(owner, today);

        assertThat(block).contains("[Cél] Nyári cut (cut): 84.2 → 80 kg");
        assertThat(block).contains("3. hét");
        assertThat(block).contains("e heti recept: 2100 kcal, 180 g fehérje, alvás 7.5 h, pihenőnap: Szo, V");
        assertThat(block).contains("étkezés/nap: 4, ébredés: 06:30, lefekvés: 22:30");
    }
```

(Add imports: `java.math.BigDecimal`, `java.util.List`, `GoalPrescriptionJson`, the three populators.)

- [ ] **Step 2: Run to verify the goal test fails**

Run: `cd backend && ./mvnw clean test -Dtest=ContextSnapshotAssemblerIT`
Expected: `testRender_shouldPickCurrentWeekSegmentAndPlanner…` FAILS (goalBlock has no data branch yet); the profile test may already pass from Task 3 — that is fine.

- [ ] **Step 3: Implement `goalBlock`:**

```java
    private String goalBlock(UUID userId, LocalDate today) {
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
                .stream().findFirst().orElse(null);
        if (goal == null) {
            return "[Cél] " + NO_DATA;
        }
        StringBuilder b = new StringBuilder("[Cél] ");
        b.append(goal.getTitle()).append(" (").append(goal.getTrajectory()).append("): ")
                .append(num(goal.getStartWeightKg())).append(" → ")
                .append(goal.getTargetWeightKg() != null ? num(goal.getTargetWeightKg()) : "?")
                .append(" kg, ").append(goal.getStartDate()).append(" → ").append(goal.getTargetDate());
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), today) / 7 + 1;
        b.append(", ").append(week).append(". hét");
        GoalPrescriptionJson.Segment seg = currentSegment(goal.getPrescription(), week);
        if (seg != null) {
            b.append("; e heti recept: ").append(seg.kcal()).append(" kcal, ")
                    .append(seg.proteinG()).append(" g fehérje");
            if (seg.sleepTargetH() != null) {
                b.append(", alvás ").append(num(seg.sleepTargetH())).append(" h");
            }
            if (seg.restDays() != null && !seg.restDays().isEmpty()) {
                b.append(", pihenőnap: ").append(seg.restDays().stream()
                        .map(ContextSnapshotAssembler::huDay).collect(Collectors.joining(", ")));
            }
        }
        if (goal.getMealsPerDay() != null) {
            b.append("; étkezés/nap: ").append(goal.getMealsPerDay());
        }
        if (goal.getWakeTime() != null) {
            b.append(", ébredés: ").append(goal.getWakeTime());
        }
        if (goal.getBedTime() != null) {
            b.append(", lefekvés: ").append(goal.getBedTime());
        }
        return b.toString();
    }

    /** The prescription segment whose fromWeek..toWeek (inclusive) contains {@code week}; null when none. */
    private static GoalPrescriptionJson.Segment currentSegment(GoalPrescriptionJson prescription, long week) {
        if (prescription == null || prescription.segments() == null) {
            return null;
        }
        return prescription.segments().stream()
                .filter(s -> s.fromWeek() != null && s.toWeek() != null
                        && week >= s.fromWeek() && week <= s.toWeek())
                .findFirst().orElse(null);
    }
```

(`huDay` signature widens to `huDay(Integer dayOfWeek)` — rest days share the 0=Hétfő indexing.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ContextSnapshotAssemblerIT`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java
git commit -m "feat(companion): snapshot Profil + Cél data paths (mezo-fnnq.3)"
```

---

### Task 5: Data paths — `[Edzés]`, `[Mai üzemanyag]`, `[Gyógyszer]`, `[Regeneráció]` + window edge

**Files:**
- Modify: `ContextSnapshotAssembler.java` (remaining block bodies)
- Test: `ContextSnapshotAssemblerIT.java`

**Interfaces:**
- Consumes (populators): `TrainPopulator.createMesocycle/createWorkoutSession/createWorkoutInstance/createExercise/createLoggedSet/createSportSession/createScheduleSlot/createGymSlot`, `RunningPopulator.createBlock/createRunLog`, `PantryItemPopulator.createFood/createSupplement`, `MealPopulator.createPantryMeal`, `WaterLogPopulator.createWaterLog`, `ProtocolPopulator.createProtocol`, `SupplementIntakePopulator.createIntake`, `MedicationPopulator.createReta`, `MedicationDosePopulator.createDose`, `SleepLogPopulator.createSleepLog`, `CheckInPopulator.createCheckIn`.

- [ ] **Step 1: Write the failing tests:**

```java
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private ProtocolPopulator protocolPopulator;
    @Autowired private SupplementIntakePopulator supplementIntakePopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testRender_shouldRenderTrainDigestAndSchedules_whenActiveMesoAndSessions() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var meso = trainPopulator.createMesocycle(owner, "Hipertrófia blokk", "active");
        var template = trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "upper", 0, "planned");
        var instance = trainPopulator.createWorkoutInstance(owner, template, today.minusDays(2), "finished");
        var exercise = trainPopulator.createExercise(owner, template.getId(), "Húzódzkodás", 0);
        trainPopulator.createLoggedSet(owner, exercise.getId(), instance.getId(), 0, "80", 8, 1);
        trainPopulator.createGymSlot(owner, 0, "18:00");
        trainPopulator.createScheduleSlot(owner, 1, "19:00", "volleyball", 90);
        trainPopulator.createSportSession(owner, today.minusDays(1));
        var block5 = runningPopulator.createBlock(owner, "Sprint blokk", "active");
        runningPopulator.createRunLog(owner, block5.getId(), 1, "w1-sprint", today.minusDays(3), 6, 8, null, null, 25);

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("mezociklus: Hipertrófia blokk");
        assertThat(snapshot).contains("gym-rend: H 18:00");
        assertThat(snapshot).contains("sport-rend: K 19:00");
        assertThat(snapshot).contains("1 gym-edzés (" + today.minusDays(2) + ")");
        assertThat(snapshot).contains("1 sportalkalom").contains("1 futás");
    }

    @Test
    void testRender_shouldExcludeSessionsOutsideDigestWindow_whenOlderThanConfiguredDays() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        trainPopulator.createSportSession(owner, today.minusDays(10)); // outside the 7-day window
        trainPopulator.createSportSession(owner, today.minusDays(3));  // inside

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("1 sportalkalom");
    }

    @Test
    void testRender_shouldRenderFuelDayProtocolAndIntakes_whenLoggedToday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var pantry = pantryItemPopulator.createFood(owner, "Csirkemell", today.plusDays(3));
        mealPopulator.createPantryMeal(owner, pantry);
        waterLogPopulator.createWaterLog(owner, today, 500);
        var supplement = pantryItemPopulator.createSupplement(owner, "Kreatin");
        protocolPopulator.createProtocol(owner, 2, "active", List.of(supplement.getId()));
        supplementIntakePopulator.createIntake(owner, supplement.getId(), java.time.Instant.now());

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("víz 500/");
        assertThat(snapshot).contains("protokoll: v2 aktív, mai bevitel: 1");
        assertThat(snapshot).doesNotContain("[Mai üzemanyag] 0/"); // the meal's kcal landed
    }

    @Test
    void testRender_shouldRenderRetaDayAndPhase_whenActiveMedicationWithDose() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var med = medicationPopulator.createReta(owner);
        medicationDosePopulator.createDose(owner, med.getId(), today.minusDays(3), new BigDecimal("6"));

        String snapshot = assembler.render(owner, today);

        // dose 3 days ago → retaDay 4 → "Stabil" phase (3-5) of the populator's 7-day cycle
        assertThat(snapshot).contains("[Gyógyszer] Retatrutide: ciklus 4. nap (Stabil)");
    }

    @Test
    void testRender_shouldRenderSleepAndCheckIn_whenLogged() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.2"), 4);
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, "fáradtan ébredtem");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("alvás (" + today.minusDays(1) + "): 7.2 h, minőség 4/5");
        assertThat(snapshot).contains("check-in (" + today + " 08:00): energia 4/5, stressz 2/5, megjegyzés: \"fáradtan ébredtem\"");
    }

    @Test
    void testRender_shouldTruncateCheckInNote_whenLongerThanConfiguredMax() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 3, "x".repeat(300));

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("megjegyzés: \"" + "x".repeat(200) + "…\"");
        assertThat(snapshot).doesNotContain("x".repeat(201));
    }
```

Note on `createScheduleSlot`: check its exact overload in `TrainPopulator` (line ~279: `createScheduleSlot(UUID createdBy, int dayOfWeek, String time, …)`) and pass matching args — the kind/duration params follow the signature found there.

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && ./mvnw clean test -Dtest=ContextSnapshotAssemblerIT`
Expected: the five new tests FAIL (absence-only branches from Task 3).

- [ ] **Step 3: Implement the four remaining blocks:**

```java
    private String trainBlock(UUID userId, LocalDate today) {
        StringBuilder b = new StringBuilder("[Edzés] mezociklus: ");
        MesocycleEntity meso = mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
                .stream().findFirst().orElse(null);
        if (meso == null) {
            b.append(NO_DATA);
        } else {
            b.append(meso.getTitle());
            if (meso.getStartDate() != null && meso.getWeeks() != null) {
                // week derived from startDate (TrainService.clampWeek idiom) — the stored currentWeek can lag
                long week = Math.clamp(ChronoUnit.DAYS.between(meso.getStartDate(), today) / 7 + 1, 1, meso.getWeeks());
                b.append(" — ").append(week).append('/').append(meso.getWeeks()).append(". hét");
            }
            if (meso.getSplit() != null) {
                b.append(" (").append(meso.getSplit()).append(')');
            }
        }
        List<GymScheduleSlotResponse> gym = gymScheduleService.getSchedule(userId);
        b.append("; gym-rend: ").append(gym.isEmpty() ? NO_DATA : gym.stream()
                .map(s -> huDay(s.getDayOfWeek()) + " " + s.getTime()).collect(Collectors.joining(", ")));
        List<SportScheduleSlotResponse> sport = sportService.getSchedule(userId);
        b.append("; sport-rend: ").append(sport.isEmpty() ? NO_DATA : sport.stream()
                .map(s -> huDay(s.getDayOfWeek()) + " " + s.getTime()
                        + (s.getKind() != null ? " " + s.getKind().getValue() : "")
                        + (s.getDurationMin() != null ? " (" + s.getDurationMin() + " perc)" : ""))
                .collect(Collectors.joining(", ")));
        int digestDays = properties.snapshot().digestDays();
        LocalDate from = today.minusDays(digestDays - 1L);
        List<LocalDate> gymDates = workoutSessionRepository.findDoneInstanceDates(userId, from, today)
                .stream().sorted().toList();
        int sportCount = sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from).size();
        int runCount = runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from).size();
        b.append("; elmúlt ").append(digestDays).append(" nap: ").append(gymDates.size()).append(" gym-edzés");
        if (!gymDates.isEmpty()) {
            b.append(" (").append(gymDates.stream().map(LocalDate::toString)
                    .collect(Collectors.joining(", "))).append(')');
        }
        b.append(", ").append(sportCount).append(" sportalkalom, ").append(runCount).append(" futás");
        return b.toString();
    }

    private String fuelBlock(UUID userId, LocalDate today) {
        FuelDayResponse day = fuelDayService.getDay(userId, today);
        MacroSet c = day.getConsumed();
        MacroSet t = day.getTargets();
        StringBuilder b = new StringBuilder("[Mai üzemanyag] ");
        b.append(num(c.getKcal())).append('/').append(num(t.getKcal())).append(" kcal, fehérje ")
                .append(num(c.getP())).append('/').append(num(t.getP())).append(" g, szénhidrát ")
                .append(num(c.getC())).append('/').append(num(t.getC())).append(" g, zsír ")
                .append(num(c.getF())).append('/').append(num(t.getF())).append(" g, víz ")
                .append(num(c.getWater())).append('/').append(num(t.getWater())).append(" ml");
        ProtocolResponse active = protocolService.getView(userId).getActive();
        b.append("; protokoll: ").append(active == null ? NO_DATA : "v" + active.getVersion() + " aktív");
        b.append(", mai bevitel: ").append(intakeService.listForDay(userId, today).getIntakes().size());
        return b.toString();
    }

    private String medicationBlock(UUID userId, LocalDate today) {
        MedicationEntity med =
                medicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return "[Gyógyszer] " + NO_DATA;
        }
        MedicationCycle cycle = medicationCycleService.derive(userId, med, today);
        if (cycle.retaDay() == 0) {
            // honest zero — active med but no recorded dose to anchor the cycle
            return "[Gyógyszer] " + med.getName() + ": nincs rögzített dózis";
        }
        return "[Gyógyszer] " + med.getName() + ": ciklus " + cycle.retaDay() + ". nap ("
                + cycle.phaseLabel() + ")";
    }

    private String recoveryBlock(UUID userId) {
        StringBuilder b = new StringBuilder("[Regeneráció] alvás");
        SleepLogEntity sleep =
                sleepLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDesc(userId).orElse(null);
        if (sleep == null) {
            b.append(": ").append(NO_DATA);
        } else {
            b.append(" (").append(sleep.getDate()).append("): ").append(num(sleep.getDurationH())).append(" h");
            if (sleep.getQuality() != null) {
                b.append(", minőség ").append(sleep.getQuality()).append("/5");
            }
        }
        b.append("; check-in");
        CheckInEntity checkIn = checkInRepository
                .findFirstByCreatedByAndDeletedFalseOrderByDateDescSlotTimeDesc(userId).orElse(null);
        if (checkIn == null) {
            b.append(": ").append(NO_DATA);
        } else {
            b.append(" (").append(checkIn.getDate()).append(' ').append(checkIn.getSlotTime()).append("): ")
                    .append("energia ").append(checkIn.getEnergy()).append("/5, stressz ")
                    .append(checkIn.getStress()).append("/5");
            if (checkIn.getNote() != null && !checkIn.getNote().isBlank()) {
                int max = properties.snapshot().checkinNoteMaxChars();
                String note = checkIn.getNote();
                b.append(", megjegyzés: \"")
                        .append(note.length() <= max ? note : note.substring(0, max) + "…").append('"');
            }
        }
        return b.toString();
    }
```

- [ ] **Step 4: Run to verify all pass**

Run: `cd backend && ./mvnw clean test -Dtest=ContextSnapshotAssemblerIT`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java
git commit -m "feat(companion): snapshot Edzés/Üzemanyag/Gyógyszer/Regeneráció data paths (mezo-fnnq.3)"
```

---

### Task 6: Wire the snapshot into the `ChatService` system prompt

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`

**Interfaces:**
- Consumes: `ContextSnapshotAssembler.render(userId, today)`, constants `HEADER`.
- Produces: system prompt shape `SYSTEM_PROMPT + snapshot + history` — the contract V1.1 (facts) extends later.

- [ ] **Step 1: Write the failing test** — append to `ChatServiceIT` (it already runs `companion-fake`; the fake echoes the full system prompt):

```java
    @Test
    void testSendMessage_shouldInjectContextSnapshotBetweenVoiceAndHistory_whenSending() {
        var conversation = conversationService.create(ownerId());   // match the class's existing conversation-creation idiom
        var response = chatService.sendMessage(ownerId(), conversation.getId(),
            new SendMessageRequest().content("mi a mai terv?"));

        String echoed = response.getContent();
        int voice = echoed.indexOf("Te vagy a mezo");
        int snapshot = echoed.indexOf("AKTUÁLIS ÁLLAPOT");
        assertThat(voice).isPositive();
        assertThat(snapshot).isGreaterThan(voice);
        assertThat(echoed).contains("[Profil]").contains("[Regeneráció]");
        // the snapshot renders today's date
        assertThat(echoed).contains("pillanatkép — " + java.time.LocalDate.now());
    }
```

(Adapt the two setup lines to the file's existing helper idiom — the class already creates conversations and resolves the owner id for its other tests; reuse exactly that. If a history-based test exists, also assert `snapshot < echoed.indexOf("Eddigi beszélgetés")` in it or here when history is present.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ChatServiceIT`
Expected: the new test FAILS (`AKTUÁLIS ÁLLAPOT` not found); existing tests still pass.

- [ ] **Step 3: Implement** — in `ChatService`: add the dependency and change one line:

```java
    private final ContextSnapshotAssembler contextSnapshotAssembler;
```

```java
        // V0.3: snapshot between the static voice and the history transcript (V1.1 adds facts here)
        String systemPrompt = SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, LocalDate.now())
                + renderHistory(loadWindow(userId, conversationId));
```

(Import `java.time.LocalDate`; update the class Javadoc note that V0.3 is now wired.)

- [ ] **Step 4: Run the companion suite**

Run: `cd backend && ./mvnw clean test -Dtest='Companion*,ChatServiceIT,ConversationServiceIT,ContextSnapshotAssemblerIT,AiMessageJsonbRoundTripIT'`
Expected: ALL PASS — including `CompanionApiSwitchOffIT` (assembler is switch-gated, context boots with the switch off) and the existing prompt-assembly asserts (they are `contains`-based; the snapshot insertion must not break them — if one asserts direct voice→history adjacency, update it to assert order via `indexOf` instead).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java
git commit -m "feat(companion): inject context snapshot into the chat system prompt (mezo-fnnq.3)"
```

---

### Task 7: Full gate + docs + merge

**Files:**
- Modify: `docs/features/companion.md` (§1 status table V0.3 row ✅; §3 flow gains the snapshot step; §4 config += `snapshot.*`; §5.5 V0.3 seam → **wired** with the final dependency list; §7 "where next slices plug in" V0.3 entry removed/marked done; §8 new IT class; §9 decisions += this plan's Decisions 1–11 essence; §10 key files += assembler + this plan)
- Modify: `docs/milestones/roadmap.md` (milestone log row: V0.3 shipped)
- No ADR: no new direction decision — the spec §4 already fixed the design; this plan records the slice-level choices.

- [ ] **Step 1: Full backend gate**

Run: `cd backend && ./mvnw clean test`
Expected: BUILD SUCCESS, 0 failures (475+ tests, ArchUnit `feature_slices_are_cycle_free` green — companion edges are one-way).

- [ ] **Step 2: Update the two docs** per the file list above; then:

Run: `node scripts/lint-docs.mjs`
Expected: PASS, no stale flag on `companion.md`.

- [ ] **Step 3: Commit docs**

```bash
git add docs/features/companion.md docs/milestones/roadmap.md docs/superpowers/plans/2026-07-03-companion-v03-context-snapshot.md
git commit -m "docs(companion): V0.3 context snapshot — living doc + roadmap (mezo-fnnq.3)"
```

- [ ] **Step 4: Merge + push + close** (single-dev flow; **pull --rebase BEFORE the merge, never after** — a post-merge rebase flattens the `--no-ff` merge commit):

```bash
git checkout main && git pull --rebase
git merge --no-ff feat/companion-v03 -m "Merge feat/companion-v03: ContextSnapshotAssembler (mezo-fnnq.3)"
git branch -d feat/companion-v03
bd close mezo-fnnq.3
bd update mezo-fnnq.3 --notes "V0.3 shipped: ContextSnapshotAssembler (6 HU blocks, nincs-adat absences, mezo.companion.snapshot.* config), wired into ChatService system prompt; LLM-free ITs; gates green"
bd dolt push && git push
git status   # MUST show "up to date with origin"
```

---

## Self-review notes

- Spec coverage: §4 blocks — profile+weight ✅ T3/T4 · goal+prescription+planner ✅ T4 · meso+week+schedules+7d digest ✅ T5 · FuelDay+protocol+intakes ✅ T5 · retaDay+phase ✅ T5 · sleep+check-in ✅ T5 · HU labels + deterministic ordering + "nincs adat" ✅ T3 · budget by construction (Decision 4) · config windows ✅ T1 · ChatService injection ✅ T6 · LLM-free tests ✅ all · coupling rule ✅ (one-way imports, ArchUnit-guarded).
- The Task 3 skeleton intentionally implements ALL absence branches (the empty-user test pins the full output shape early); Tasks 4–5 only fill present-data branches — no placeholder strings survive past Task 3.
- Type consistency: `render(UUID, LocalDate)` everywhere; populator signatures copied from the live files; generated DTO getters verified against `target/generated-sources` (`MacroSet.getKcal/getP/getC/getF/getWater`, `WeightTrendResponse.getLatestTrendKg/...`, `ProtocolResponse.getVersion`, `GymScheduleSlotResponse.getDayOfWeek/getTime`, `SportScheduleSlotResponse.getKind().getValue()`).
- Known judgment calls left to the implementer: exact `createScheduleSlot` arg list (check the live overload), the `ChatServiceIT` conversation-setup idiom (reuse the file's existing helpers), and whether an existing ChatServiceIT assert needs the `indexOf`-order rewrite (only if it assumed voice→history adjacency).
