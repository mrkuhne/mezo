# Karakter 3. kör (psziché & viselkedés-meta) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire six new domain reads into the Karakter detector pipeline and add twelve deterministic detectors covering the "Psziché & viselkedés-meta" inventory round, taking the catalog from 20 to 32.

**Architecture:** All new series live ONLY in the 8-week `DetectorInput.TrendWindow`; each detector windows them internally by an `asOf` parameter and computes a **qualitative** state as of `day` and as of `day − 1`, firing only on a non-null change (round-2's state-change gate, spec §4.2). Detectors stay pure functions over `DetectorInput`; every cross-feature read is composed in `CharacterSignalReads`. No LLM work inside any detector — raw text reaches the expert persona only as bounded, deterministically-selected evidence.

**Tech Stack:** Spring Boot 4 / Hibernate 7 backend (Java 21 records, Lombok), JUnit 5 + AssertJ, React/TypeScript frontend, Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-01-character-round3-psziche-viselkedes-design.md`](../specs/2026-09-01-character-round3-psziche-viselkedes-design.md)

## Global Constraints

- **State keys are QUALITATIVE.** A detector's state string may contain band names and label values only — **never a count, mean, percentage, or any other moving number**. A count-valued state defeats the state-change gate (it changes every day) and was the round-2 final review's most serious finding. A test that passes with a count-valued state is a broken test.
- **Absent ≠ zero.** A day or entity with no row is omitted from its collection — never synthesized as a zero, false, or empty-but-present value. A null context (`NeedsContext`) means "the user has none of this".
- **Catch-up honesty.** Every read is bounded ABOVE by the observed `day`, via the finder's upper bound or an in-memory filter (the weight-read precedent, `CharacterSignalReads.java:138-147`). A catch-up run for a past day must never see data written afterwards.
- **Timezone.** Every `Instant → LocalDate/LocalTime` conversion uses `ZoneId.systemDefault()`. No other zone, anywhere.
- **`createdAt`, never `savedAt`** for check-in write-time: `CheckInService.save()` overwrites `savedAt` on every upsert.
- **Hungarian output.** Every summary is one Hungarian sentence. Decimal comma via `TrailingWindow.hu()` — never `BigDecimal.toString()`.
- **Every threshold is a named constant** in its detector class. No magic numbers in expressions.
- **Detector wiring:** `@Component`, `@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")`, implements `CharacterDetector`, returns `DetectorSignal(key, expertKey, summary, salience)`. Valid `expertKey` values: `doki`, `edzo`, `taplalkozo`, `szomnologus`, `pszichologus`, `drill`, `antropologus`.
- **Backend gate (per task):** `./mvnw test -Dtest='*Character*,DetectorTest' -Dmezo.test.use-testcontainers=true` from `backend/`. NEVER the full suite locally. Any task changing cross-feature imports ALSO runs `-Dtest=ArchitectureTest` explicitly. **`DetectorTest` must be named separately**: surefire's `-Dtest` matches the SIMPLE class name, and `DetectorTest` contains no "Character", so the bare `*Character*` sweep silently skips the entire detector unit-test file — the one file this round changes most. Rounds 1 and 2 ran that blind gate; CI's full suite covered them, the local gate did not.
- **Frontend gate:** both modes — `pnpm test` AND `VITE_USE_MOCK=false pnpm test` — plus `pnpm build`.
- **Work in the worktree** `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba` on branch `feat/character-s12-psziche`. Never `cd` to the primary repo.
- Commit subjects carry `(mezo-1gim.15)` and end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## File Structure

**Backend — `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/`**
- `DetectorInput.java` — MODIFY: seven new nested records + two new `TrendWindow` components.
- `RoundTwoWindow.java` → `TrailingWindow.java` — `git mv` + rename; gains a `days`-parameterised `inWindow`.
- `DetectorGates.java` — MODIFY: three new gate methods (intention, decision, gratitude only).
- Twelve NEW detector classes (one file each, one responsibility each).

**Backend — `.../feature/character/service/`**
- `CharacterSignalReads.java` — MODIFY: six new gatherers, six new repository deps.

**Backend — new finders (one method each, no new files):**
- `IntentionFocusRepository`, `DailyIntentionRepository`, `NeedsDayRepository`, `AiMessageRepository`.

**Backend tests**
- `DetectorTest.java` — MODIFY: new fixtures + 36 new tests.
- `CharacterSignalReadsIT.java` — MODIFY: new read-layer ITs.

**Frontend**
- `features/character/pages/DetektorokPage.tsx` — catalog 20 → 32.
- `features/character/inventory.ts` — round-3 object deleted, six reads appended, round-4 "Életjel-gyűrűk" row deleted.
- `data/character/characterMock.ts` — twelve new `CHAIN_POOL` seeds.

**Docs**
- `docs/features/character.md`, `docs/CODEMAP.md` (regenerated).

---

## Task 1: Foundation — window helper rename, input records, gates

**Files:**
- Rename: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/RoundTwoWindow.java` → `TrailingWindow.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/DetectorInput.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/DetectorGates.java`
- Modify: every round-2 detector that references `RoundTwoWindow` (mechanical rename)

**Design note carried into every later task:** a new-data pre-filter is added ONLY for intention,
decision and gratitude. Needs and chat get none on purpose — see the `DetectorGates` javadoc below
and spec §4.2. Do not "helpfully" add the missing ones.

**Interfaces:**
- Consumes: nothing.
- Produces: `TrailingWindow.inWindow(LocalDate, LocalDate)`, `TrailingWindow.inWindow(LocalDate, LocalDate, int days)`, `TrailingWindow.hu(BigDecimal,int)`, `TrailingWindow.pct(double)`, `TrailingWindow.WINDOW_DAYS`; the seven new `DetectorInput` records listed below; `DetectorGates.newIntentionData/newDecisionData/newGratitudeData`.

- [ ] **Step 1: Rename the window helper**

```bash
cd backend/src/main/java/io/mrkuhne/mezo/feature/character/detector
git mv RoundTwoWindow.java TrailingWindow.java
```

Then in `TrailingWindow.java` rename the class and its private constructor, replace the javadoc, and add the `days` overload. The whole file after the edit:

```java
package io.mrkuhne.mezo.feature.character.detector;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Shared trailing-window arithmetic + Hungarian number formatting for the detectors that use the
 * state-change gate (round-2 spec §4/§6, round-3 spec §4.2).
 *
 * <p>Such a detector computes its finding as a {@code String} state AS OF a date, over a trailing
 * window of the 8-week series, and fires only when the state as of {@code day} is non-null and
 * differs from the state as of {@code day - 1}. These sources arrive daily, so the new-data gate
 * alone would re-announce an unchanged pattern every night.
 *
 * <p>Named {@code TrailingWindow} rather than after any one round: rounds 2 and 3 both use it, and
 * round 3 adds longer windows for its episodic sources (decisions 42 days, gratitude and restart
 * 28 days) alongside the 14-day default.
 */
final class TrailingWindow {
    private TrailingWindow() {}

    static final int WINDOW_DAYS = 14;

    /** True when {@code date} falls in the trailing WINDOW_DAYS days ending at (and including) asOf. */
    static boolean inWindow(LocalDate date, LocalDate asOf) {
        return inWindow(date, asOf, WINDOW_DAYS);
    }

    /**
     * True when {@code date} falls in the trailing {@code days} days ending at (and including)
     * asOf. Any window used here must fit inside the 8-week series with room for the day-1
     * evaluation too — i.e. {@code days + 1 <= 56}.
     */
    static boolean inWindow(LocalDate date, LocalDate asOf, int days) {
        return !date.isAfter(asOf) && !date.isBefore(asOf.minusDays(days - 1L));
    }

    /** Hungarian decimal comma — never let a raw '.' separator reach a summary. */
    static String hu(BigDecimal v, int scale) {
        return v.setScale(scale, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    /** A 0..1 ratio rendered as a whole-percent string. */
    static String pct(double ratio) {
        return String.valueOf(Math.round(ratio * 100));
    }
}
```

- [ ] **Step 2: Update every `RoundTwoWindow` reference**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba
grep -rl 'RoundTwoWindow' backend/src | xargs sed -i '' 's/RoundTwoWindow/TrailingWindow/g'
grep -rn 'RoundTwoWindow' backend/src   # must print nothing
```

Also fix any javadoc sentence that now reads oddly (e.g. "round-2 detectors" in `DetectorGates` stays correct — it describes history, not the class name).

- [ ] **Step 3: Add the new `DetectorInput` records**

Insert these records into `DetectorInput` immediately before the `TrendWindow` record:

```java
    /** One day of the intention loop. {@code focusCount} is how many foci were set that morning;
     *  {@code reflection} is the evening day-close verdict ("yes"/"partial"/"no" — the
     *  {@code DailyIntentionEntity.REFLECTION_*} values) or null when the day was never closed.
     *  A day with neither a focus nor a reflection is OMITTED, never carried as a zero row. */
    public record IntentionDayPoint(LocalDate date, int focusCount, String reflection) {}

    /** One decision-journal entry. {@code writtenOn} is {@code createdAt} in the JVM default zone;
     *  {@code reviewedOn} is {@code reviewedAt} in the same zone, or null when not yet reviewed.
     *  {@code outcomeRating} is the 1..5 scale, null until reviewed. {@code textPreview} is the raw
     *  decision text truncated for EVIDENCE only — no detector may parse or interpret it. */
    public record DecisionPoint(LocalDate decidedOn, LocalDate writtenOn, LocalDate reviewDue,
                                LocalDate reviewedOn, Short outcomeRating, String textPreview) {}

    /** One gratitude entry. {@code lifeArea} is the closed tag (mindfulness|mindset|cooking|
     *  financial|productivity|learning|connection|recovery) or null when the user left it off —
     *  null is "untagged", never a category. */
    public record GratitudePoint(LocalDate occurredOn, LocalDate writtenOn, String lifeArea) {}

    /** The Életjel (needs) day series plus the domain threshold that defines "green"; null when the
     *  owner has never closed a day. {@code greenThreshold} is carried because a detector may not
     *  read configuration — it mirrors {@code NeedsProperties.greenThreshold}, exactly as round 2
     *  carried the macro targets rather than re-deriving them. */
    public record NeedsContext(int greenThreshold, List<NeedsDayPoint> days) {}

    /** One closed Életjel day. The six domains are 0..100. {@code streakDays} is the streak as of
     *  THAT day, snapshotted by {@code NeedsService.closeNew} — the only per-day streak history in
     *  the system ({@code GamificationProfileEntity} carries live state only). An unclosed day has
     *  NO row here; per the domain's own rule that is a streak break, not a zero. */
    public record NeedsDayPoint(LocalDate date, int energia, int hidratacio, int pihenes,
                                int mozgas, int lelek, int rend, int greenCount,
                                boolean allGreen, int streakDays) {}

    /** One check-in ROW (not a day aggregate — {@link CheckinDayPoint} carries the scales).
     *  {@code slotTime} is the slot label stored on the row itself ("HH:mm"), which is the only
     *  historically-faithful nominal time available: {@code notification_schedule} is replaced
     *  wholesale on every save and has no history. {@code writtenAt} is {@code createdAt} in the
     *  JVM default zone — deliberately NOT {@code savedAt}, which every edit moves forward.
     *  {@code notePreview} is the raw note truncated for EVIDENCE only, or null. */
    public record CheckinSlotPoint(LocalDate date, String slotTime, LocalDateTime writtenAt,
                                   String notePreview) {}

    /** One logged record's "the day it is about" vs "the day it was written" pair.
     *  {@code genre} is {@code "esemeny"} (gym, run, sport, weight, sleep, meal) or
     *  {@code "reflexio"} (check-in, journal, gratitude, decision, focus); {@code source} names the
     *  entity for debugging. Same-day is the literature's "live logging" boundary; anything later
     *  is retrospective (round-3 spec §2). */
    public record LogLatencyPoint(String genre, String source, LocalDate aboutDate,
                                  LocalDate writtenDate) {}
```

Add `import java.time.LocalDateTime;` to the file's imports.

- [ ] **Step 4: Extend `TrendWindow`**

Replace the `TrendWindow` record with:

```java
    /** Raw 8-week series ending at day — detectors aggregate these themselves so they can
     *  recompute their state both as-of day and as-of day-1 (stateless state-change gate).
     *  Round-2 and round-3 series live ONLY here: every such detector windows them by an
     *  {@code asOf} parameter, so a duplicated shorter copy would be dead weight. Round 3's
     *  episodic sources use longer windows (decisions 42 days, gratitude and restart 28 days),
     *  which is why they need the full 8 weeks rather than 14 days.
     *
     *  <p>{@code sleepEightWeeks} widens the existing 14-day {@code sleepPoints} slice for the same
     *  reason: {@code self-calibration} evaluates its state as of day AND as of day-1, and a
     *  14-day slice would leave the day-1 window one day short — the state could then change
     *  because a day fell off the end rather than because the behaviour changed. */
    public record TrendWindow(List<RunPoint> runsEightWeeks, List<GymDay> gymEightWeeks,
                              List<MealDayPoint> mealDays, List<WaterDayPoint> waterDays,
                              StackContext stack, List<CheckinDayPoint> checkinDays,
                              MedContext med,
                              List<SleepPoint> sleepEightWeeks,
                              List<IntentionDayPoint> intentionDays,
                              List<DecisionPoint> decisions,
                              List<GratitudePoint> gratitudes,
                              NeedsContext needs,
                              List<CheckinSlotPoint> checkinSlots,
                              List<LocalDateTime> userChatTimes,
                              List<LogLatencyPoint> logLatencies) {}
```

- [ ] **Step 5: Add the new gates**

Append to `DetectorGates`, beside the existing methods:

```java
    static boolean newIntentionData(DetectorInput in) {
        return in.trend().intentionDays().stream().anyMatch(i -> i.date().equals(in.day()));
    }

    static boolean newDecisionData(DetectorInput in) {
        return in.trend().decisions().stream()
                .anyMatch(d -> in.day().equals(d.writtenOn()) || in.day().equals(d.reviewedOn()));
    }

    static boolean newGratitudeData(DetectorInput in) {
        return in.trend().gratitudes().stream().anyMatch(g -> g.occurredOn().equals(in.day()));
    }
```

Extend the class javadoc with the round-3 rule, because "add a gate for every new source" is the
obvious-but-wrong instinct here:

```
 * <p>Round 3 adds a limit to this pattern: where ABSENCE is the signal, a new-data pre-filter is
 * wrong. A review backlog grows because time passes, a streak breaks because no row is written, a
 * check-in slot dies out because nobody fills it — on the very day each of those transitions
 * happens, nothing arrives. Gating those detectors on new data would silence exactly what they
 * exist to catch, so they rely on their state-change gate alone. Only three gates are added here
 * (intention, decision, gratitude); needs and chat deliberately get none.
```

- [ ] **Step 6: Fix every `DetectorInput`/`TrendWindow` construction site so the tree compiles**

`CharacterSignalReads.gather()` and every test helper that builds a `TrendWindow` must pass the seven new arguments. For now pass `List.of()` for the five lists, `null` for `NeedsContext`, and `List.of()` for `userChatTimes`/`logLatencies` — Task 2 and 3 fill them for real. In `DetectorTest`, the existing `trendInput`/`emptyTrend`/`trend(...)` helpers are the single place this changes.

- [ ] **Step 7: Compile and run the existing suite**

```bash
cd backend && ./mvnw test -Dtest='*Character*,DetectorTest' -Dmezo.test.use-testcontainers=true
```
Expected: PASS, unchanged test count. This task adds no behavior — a failure here means the rename or the record widening broke something.

- [ ] **Step 8: Commit**

```bash
git add -A backend/src
git commit -m "refactor(character): TrailingWindow rename + round-3 input records and gates (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Read layer A — intention, needs, decisions, gratitude

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/intention/repository/IntentionFocusRepository.java`
- Modify: `.../feature/intention/repository/DailyIntentionRepository.java`
- Modify: `.../feature/needs/repository/NeedsDayRepository.java`
- Modify: `.../feature/character/service/CharacterSignalReads.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterSignalReadsIT.java`

**Interfaces:**
- Consumes: Task 1's `IntentionDayPoint`, `DecisionPoint`, `GratitudePoint`, `NeedsContext`, `NeedsDayPoint`.
- Produces: `CharacterSignalReads` now fills `TrendWindow.intentionDays/decisions/gratitudes/needs`. New one-way imports `character → intention` and `character → needs`.

- [ ] **Step 1: Add the three range finders**

`IntentionFocusRepository`:
```java
    List<IntentionFocusEntity> findByCreatedByAndFocusDateBetweenAndDeletedFalseOrderByFocusDateAsc(
            UUID createdBy, LocalDate from, LocalDate to);
```

`DailyIntentionRepository`:
```java
    List<DailyIntentionEntity> findByCreatedByAndIntentionDateBetweenAndDeletedFalseOrderByIntentionDateAsc(
            UUID createdBy, LocalDate from, LocalDate to);
```

`NeedsDayRepository`:
```java
    List<NeedsDayEntity> findByCreatedByAndNeedsDateBetweenAndDeletedFalseOrderByNeedsDateAsc(
            UUID createdBy, LocalDate from, LocalDate to);
```

Add the `java.time.LocalDate`, `java.util.List`, `java.util.UUID` imports where missing.

- [ ] **Step 2: Add the repository dependencies**

In `CharacterSignalReads`, add to the `final` field block (Lombok `@RequiredArgsConstructor` wires them):

```java
    private final IntentionFocusRepository intentionFocusRepository;
    private final DailyIntentionRepository dailyIntentionRepository;
    private final DecisionEntryRepository decisionEntryRepository;
    private final GratitudeEntryRepository gratitudeEntryRepository;
    private final NeedsDayRepository needsDayRepository;
    private final NeedsProperties needsProperties;
```

with the matching imports.

- [ ] **Step 3: Write the four gatherers**

Add these private methods to `CharacterSignalReads`:

```java
    /**
     * One row per day on which the user either set a focus or closed the day — a day with neither
     * is absent, not a zero row. {@code reflection} stays null when the morning happened but the
     * evening did not; that asymmetry IS the promise-vs-delivery signal, so it must survive here.
     */
    private List<DetectorInput.IntentionDayPoint> gatherIntentionDays(UUID owner, LocalDate from,
                                                                      LocalDate to) {
        Map<LocalDate, Integer> focusCounts = new TreeMap<>();
        for (IntentionFocusEntity f : intentionFocusRepository
                .findByCreatedByAndFocusDateBetweenAndDeletedFalseOrderByFocusDateAsc(owner, from, to)) {
            focusCounts.merge(f.getFocusDate(), 1, Integer::sum);
        }
        Map<LocalDate, String> reflections = new TreeMap<>();
        for (DailyIntentionEntity d : dailyIntentionRepository
                .findByCreatedByAndIntentionDateBetweenAndDeletedFalseOrderByIntentionDateAsc(
                        owner, from, to)) {
            reflections.put(d.getIntentionDate(), d.getReflection());
        }
        Set<LocalDate> dates = new java.util.TreeSet<>(focusCounts.keySet());
        dates.addAll(reflections.keySet());
        List<DetectorInput.IntentionDayPoint> out = new ArrayList<>();
        for (LocalDate d : dates) {
            out.add(new DetectorInput.IntentionDayPoint(d, focusCounts.getOrDefault(d, 0),
                    reflections.get(d)));
        }
        return List.copyOf(out);
    }

    /**
     * Every decision the owner has, bounded above by {@code day}. The whole history is read rather
     * than a window because {@code decision-review-backlog} asks "what is still unreviewed as of
     * day" — an entry decided months ago can be the backlog. Catch-up honesty is applied on BOTH
     * timestamps: an entry written after {@code day} did not exist yet, and a review performed
     * after {@code day} had not happened yet, so it is carried as still-unreviewed.
     */
    private List<DetectorInput.DecisionPoint> gatherDecisions(UUID owner, LocalDate day) {
        List<DetectorInput.DecisionPoint> out = new ArrayList<>();
        for (DecisionEntryEntity e : decisionEntryRepository
                .findByCreatedByAndDeletedFalseOrderByDecidedOnDescCreatedAtDesc(owner)) {
            LocalDate writtenOn = localDate(e.getCreatedAt());
            if (writtenOn == null || writtenOn.isAfter(day)) {
                continue;
            }
            LocalDate reviewedOn = localDate(e.getReviewedAt());
            Short rating = e.getOutcomeRating();
            if (reviewedOn != null && reviewedOn.isAfter(day)) {
                reviewedOn = null;   // not yet reviewed AS OF day
                rating = null;
            }
            out.add(new DetectorInput.DecisionPoint(e.getDecidedOn(), writtenOn, e.getReviewDue(),
                    reviewedOn, rating, preview(e.getDecisionText())));
        }
        return List.copyOf(out);
    }

    private List<DetectorInput.GratitudePoint> gatherGratitudes(UUID owner, LocalDate from,
                                                                LocalDate to) {
        List<DetectorInput.GratitudePoint> out = new ArrayList<>();
        for (GratitudeEntryEntity e : gratitudeEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        owner, from, to)) {
            LocalDate writtenOn = localDate(e.getCreatedAt());
            if (writtenOn != null && writtenOn.isAfter(to)) {
                continue;
            }
            out.add(new DetectorInput.GratitudePoint(e.getOccurredOn(), writtenOn, e.getLifeArea()));
        }
        return List.copyOf(out);
    }

    /**
     * The Életjel day series; null when the owner has never closed a day (absent, not "all zero").
     * The green threshold travels with the series because a detector may not read configuration.
     */
    private DetectorInput.NeedsContext gatherNeeds(UUID owner, LocalDate from, LocalDate to) {
        List<NeedsDayEntity> rows = needsDayRepository
                .findByCreatedByAndNeedsDateBetweenAndDeletedFalseOrderByNeedsDateAsc(owner, from, to);
        if (rows.isEmpty()) {
            return null;
        }
        List<DetectorInput.NeedsDayPoint> days = rows.stream()
                .map(r -> new DetectorInput.NeedsDayPoint(r.getNeedsDate(), r.getEnergia(),
                        r.getHidratacio(), r.getPihenes(), r.getMozgas(), r.getLelek(), r.getRend(),
                        r.getGreenCount(), r.isAllGreen(), r.getStreakDays()))
                .toList();
        return new DetectorInput.NeedsContext(needsProperties.greenThreshold(), days);
    }

    /** {@code Instant} → local date in the JVM default zone, the read layer's one convention. */
    private static LocalDate localDate(java.time.Instant at) {
        return at == null ? null : at.atZone(ZoneId.systemDefault()).toLocalDate();
    }

    /** Raw text truncated for EVIDENCE only. Never parsed, never interpreted (spec §4.4). */
    private static String preview(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String trimmed = text.strip();
        return trimmed.length() <= EVIDENCE_CHARS ? trimmed
                : trimmed.substring(0, EVIDENCE_CHARS).strip() + "…";
    }
```

Add `private static final int EVIDENCE_CHARS = 120;` beside the other constants.

- [ ] **Step 4: Call them from `gather()`**

Inside `gather()`, before the `return`:

```java
        List<DetectorInput.IntentionDayPoint> intentionDays =
                gatherIntentionDays(owner, trendStart, day);
        List<DetectorInput.DecisionPoint> decisions = gatherDecisions(owner, day);
        List<DetectorInput.GratitudePoint> gratitudes = gatherGratitudes(owner, trendStart, day);
        DetectorInput.NeedsContext needs = gatherNeeds(owner, trendStart, day);
```

and pass them into the `TrendWindow` constructor in place of the Task-1 placeholders (`checkinSlots`, `userChatTimes`, `logLatencies` stay `List.of()` until Task 3).

- [ ] **Step 5: Write the read-layer ITs**

Add to `CharacterSignalReadsIT`, following the file's existing fixture style:

```java
    @Test
    void gather_shouldPairFocusCountWithReflection_andKeepUnclosedDaysWithNullReflection() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveFocus(day.minusDays(1), "reggeli fókusz");
        saveFocus(day.minusDays(1), "második fókusz");
        saveReflection(day.minusDays(1), DailyIntentionEntity.REFLECTION_PARTIAL);
        saveFocus(day, "csak fókusz, lezárás nélkül");

        List<DetectorInput.IntentionDayPoint> days = reads.gather(owner, day).trend().intentionDays();

        assertThat(days).hasSize(2);
        assertThat(days.get(0).focusCount()).isEqualTo(2);
        assertThat(days.get(0).reflection()).isEqualTo(DailyIntentionEntity.REFLECTION_PARTIAL);
        assertThat(days.get(1).focusCount()).isEqualTo(1);
        assertThat(days.get(1).reflection()).isNull();
    }

    @Test
    void gather_shouldTreatAReviewAfterTheObservedDay_asStillUnreviewed() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        DecisionEntryEntity e = saveDecision(day.minusDays(10), day.minusDays(3), "döntés szövege");
        e.setReviewedAt(day.plusDays(2).atStartOfDay(ZoneId.systemDefault()).toInstant());
        e.setOutcomeRating((short) 5);
        decisionEntryRepository.save(e);

        DetectorInput.DecisionPoint p = reads.gather(owner, day).trend().decisions().getFirst();

        assertThat(p.reviewedOn()).isNull();
        assertThat(p.outcomeRating()).isNull();
    }

    @Test
    void gather_shouldReturnNullNeedsContext_whenNoDayWasEverClosed() {
        assertThat(reads.gather(owner, LocalDate.of(2026, 5, 20)).trend().needs()).isNull();
    }

    @Test
    void gather_shouldCarryTheConfiguredGreenThreshold_andThePerDayStreakSnapshot() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveNeedsDay(day.minusDays(1), 80, 80, 80, 80, 80, 80, 6, true, 4);
        saveNeedsDay(day, 80, 30, 80, 80, 80, 80, 5, false, 0);

        DetectorInput.NeedsContext ctx = reads.gather(owner, day).trend().needs();

        assertThat(ctx.greenThreshold()).isEqualTo(60);
        assertThat(ctx.days()).extracting(DetectorInput.NeedsDayPoint::streakDays)
                .containsExactly(4, 0);
    }

    @Test
    void gather_shouldTruncateDecisionEvidence_andNeverExceedTheEvidenceBudget() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveDecision(day.minusDays(2), day.plusDays(5), "x".repeat(400));

        String preview = reads.gather(owner, day).trend().decisions().getFirst().textPreview();

        assertThat(preview).hasSizeLessThanOrEqualTo(121).endsWith("…");
    }
```

Write the `saveFocus`, `saveReflection`, `saveDecision`, `saveNeedsDay` helpers in the same style as the file's existing savers, and inject the four new repositories into the IT.

- [ ] **Step 6: Run the gates**

```bash
cd backend && ./mvnw test -Dtest='*Character*,DetectorTest' -Dmezo.test.use-testcontainers=true
./mvnw test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true
```
Expected: both PASS. `ArchitectureTest` must pass WITHOUT regenerating the freeze store — the two new edges (`character → intention`, `character → needs`) are one-way and introduce no cycle. **If it reports a widened frozen cycle, stop and report BLOCKED** rather than regenerating the store; that would mean a real cycle exists and the design is wrong.

- [ ] **Step 7: Commit**

```bash
git add -A backend/src
git commit -m "feat(character): read intention, needs, decisions and gratitude into the trend window (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Read layer B — check-in rows, chat timestamps, logging latency

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/AiMessageRepository.java`
- Modify: `.../feature/meal/repository/MealRepository.java`
- Modify: `.../feature/character/service/CharacterSignalReads.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterSignalReadsIT.java`

**Interfaces:**
- Consumes: Task 1's `CheckinSlotPoint`, `LogLatencyPoint`; Task 2's `localDate(...)` and `preview(...)` helpers and the intention focus finder.
- Produces: `TrendWindow.checkinSlots`, `TrendWindow.userChatTimes`, `TrendWindow.logLatencies` are filled for real. `DetectorInput` is now complete — Tasks 4-6 add no read-layer work.

- [ ] **Step 1: Add the two finders**

`AiMessageRepository` — an upper bound beside the existing lower-bounded finder, so catch-up runs cannot see later chat:
```java
    List<AiMessageEntity> findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
            UUID createdBy, String role, Instant from, Instant toExclusive);
```

`MealRepository` — a light row read (no item join fetch; only the two timestamps are needed):
```java
    List<MealEntity> findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(
            UUID createdBy, LocalDate from, LocalDate to);
```

- [ ] **Step 2: Add the `AiMessageRepository` dependency**

Add `private final AiMessageRepository aiMessageRepository;` to `CharacterSignalReads` with its import. `MealRepository` is already injected.

- [ ] **Step 3: Derive the check-in row series**

`gather()` already reads `List<CheckInEntity> checkins` over `trendStart..day`. Add this mapper and call it with that list — no second query:

```java
    /**
     * Per-ROW check-in facts for the slot-behaviour detectors, beside the per-day scale aggregate.
     *
     * <p>{@code writtenAt} comes from {@code createdAt} and NOT from {@code savedAt}:
     * {@code CheckInService.save()} overwrites {@code savedAt} on every upsert, so a check-in
     * edited a week later would look like it was filled a week late. {@code createdAt} is the
     * first write and never moves. A row whose {@code createdAt} is null (legacy) is dropped —
     * absent, not "written at midnight".
     */
    private List<DetectorInput.CheckinSlotPoint> toCheckinSlots(List<CheckInEntity> checkins) {
        List<DetectorInput.CheckinSlotPoint> out = new ArrayList<>();
        for (CheckInEntity c : checkins) {
            if (c.getCreatedAt() == null) {
                continue;
            }
            out.add(new DetectorInput.CheckinSlotPoint(c.getDate(), c.getSlotTime(),
                    c.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                    preview(c.getNote())));
        }
        out.sort(Comparator.comparing(DetectorInput.CheckinSlotPoint::date)
                .thenComparing(DetectorInput.CheckinSlotPoint::slotTime));
        return List.copyOf(out);
    }
```

- [ ] **Step 4: Gather the chat timestamps**

```java
    /**
     * Local timestamps of the owner's OWN chat messages — the only deterministic proof that a
     * person was using the app at a given wall-clock moment. Push and notification rows prove the
     * SYSTEM acted, not the user, and {@code llm_log_history} moves 1:1 with this anyway.
     * Bounded above by the end of {@code to} so a catch-up run sees no later activity.
     */
    private List<LocalDateTime> gatherUserChatTimes(UUID owner, LocalDate from, LocalDate to) {
        Instant fromInstant = from.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant toExclusive = to.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        return aiMessageRepository
                .findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
                        owner, CHAT_ROLE_USER, fromInstant, toExclusive)
                .stream()
                .map(m -> m.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDateTime())
                .toList();
    }
```

Add `private static final String CHAT_ROLE_USER = "user";` beside the other constants.

- [ ] **Step 5: Gather the logging-latency pairs**

```java
    /**
     * Every (the day this record is about, the day it was actually written) pair in the 14-day
     * window, tagged with its genre. Two genres are kept apart deliberately: a workout entered the
     * next morning and a gratitude note backfilled a week later are different behaviours, and one
     * blended ratio would be mush (round-3 spec §5.8).
     *
     * <p>A record whose write timestamp is missing is dropped, and a record written after
     * {@code day} is dropped too — during a catch-up run it had not been written yet.
     */
    private List<DetectorInput.LogLatencyPoint> gatherLogLatencies(UUID owner, LocalDate from,
                                                                   LocalDate to) {
        List<DetectorInput.LogLatencyPoint> out = new ArrayList<>();

        for (WorkoutSessionEntity s : workoutSessionRepository.findDoneInstancesBetween(owner, from, to)) {
            addLatency(out, GENRE_EVENT, "gym", s.getDate(), s.getCreatedAt(), to);
        }
        for (RunSessionLogEntity r : runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to)) {
            addLatency(out, GENRE_EVENT, "futas", r.getDate(), r.getCreatedAt(), to);
        }
        for (SportSessionEntity s : sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to)) {
            addLatency(out, GENRE_EVENT, "sport", s.getDate(), s.getCreatedAt(), to);
        }
        for (SleepLogEntity s : sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to)) {
            addLatency(out, GENRE_EVENT, "alvas", s.getDate(), s.getCreatedAt(), to);
        }
        for (WeightLogEntity w : weightLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(owner, from)) {
            if (!w.getDate().isAfter(to)) {   // this finder bounds only below
                addLatency(out, GENRE_EVENT, "suly", w.getDate(), w.getCreatedAt(), to);
            }
        }
        for (MealEntity m : mealRepository
                .findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(owner, from, to)) {
            addLatency(out, GENRE_EVENT, "etkezes", m.getMealDate(), m.getLoggedAt(), to);
        }

        for (CheckInEntity c : checkInRepository
                .findByCreatedByAndDeletedFalseAndDateBetween(owner, from, to)) {
            addLatency(out, GENRE_REFLECTION, "checkin", c.getDate(), c.getCreatedAt(), to);
        }
        for (JournalEntryEntity j : journalEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        owner, from, to)) {
            addLatency(out, GENRE_REFLECTION, "naplo", j.getOccurredOn(), j.getCreatedAt(), to);
        }
        for (GratitudeEntryEntity g : gratitudeEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        owner, from, to)) {
            addLatency(out, GENRE_REFLECTION, "hala", g.getOccurredOn(), g.getCreatedAt(), to);
        }
        for (DecisionEntryEntity d : decisionEntryRepository
                .findByCreatedByAndDecidedOnBetweenAndDeletedFalseOrderByDecidedOnAsc(owner, from, to)) {
            addLatency(out, GENRE_REFLECTION, "dontes", d.getDecidedOn(), d.getCreatedAt(), to);
        }
        for (IntentionFocusEntity f : intentionFocusRepository
                .findByCreatedByAndFocusDateBetweenAndDeletedFalseOrderByFocusDateAsc(owner, from, to)) {
            addLatency(out, GENRE_REFLECTION, "fokusz", f.getFocusDate(), f.getCreatedAt(), to);
        }
        return List.copyOf(out);
    }

    private static void addLatency(List<DetectorInput.LogLatencyPoint> out, String genre,
                                   String source, LocalDate aboutDate, java.time.Instant writtenAt,
                                   LocalDate upperBound) {
        LocalDate writtenOn = localDate(writtenAt);
        if (writtenOn == null || writtenOn.isAfter(upperBound)) {
            return;
        }
        out.add(new DetectorInput.LogLatencyPoint(genre, source, aboutDate, writtenOn));
    }
```

Add `private static final String GENRE_EVENT = "esemeny";` and `private static final String GENRE_REFLECTION = "reflexio";` beside the other constants.

- [ ] **Step 6: Call all three from `gather()` and finish the `TrendWindow`**

```java
        List<DetectorInput.CheckinSlotPoint> checkinSlots = toCheckinSlots(checkins);
        List<LocalDateTime> userChatTimes = gatherUserChatTimes(owner, windowStart, day);
        List<DetectorInput.LogLatencyPoint> logLatencies =
                gatherLogLatencies(owner, windowStart, day);
```

Note the window: `checkinSlots` uses the 8-week `checkins` list (slot-drift compares two 14-day windows, so it needs 28 days), while the chat and latency reads use `windowStart` — both are 14-day detectors and nothing needs more.

Also widen the sleep read to feed `sleepEightWeeks`. Today `gather()` reads sleep over `windowStart..day` and maps it to `sleepPoints`; change it to read over `trendStart..day`, map that to `sleepEightWeeks`, and derive the existing 14-day `sleepPoints` from it by filtering — exactly the shape `runsEightWeeks`/`runLogs` and `gymEightWeeks`/`gymDays` already use:

```java
        List<DetectorInput.SleepPoint> sleepEightWeeks = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, trendStart, day)
                .stream()
                .map(this::toSleepPoint)
                .toList();
        List<DetectorInput.SleepPoint> sleepPoints = sleepEightWeeks.stream()
                .filter(s -> !s.date().isBefore(windowStart))
                .toList();
```

Replace the remaining Task-1 placeholders in the `TrendWindow` constructor with these four.

- [ ] **Step 7: Write the read-layer ITs**

```java
    @Test
    void gather_shouldUseCreatedAtNotSavedAt_forTheCheckinWriteTime() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        CheckInEntity c = saveCheckIn(day, "07:00", 6, 4, 6, 6, null);
        c.setSavedAt(day.plusDays(3).atTime(18, 0).atZone(ZoneId.systemDefault()).toInstant());
        checkInRepository.save(c);

        DetectorInput.CheckinSlotPoint p = reads.gather(owner, day).trend().checkinSlots().getFirst();

        assertThat(p.writtenAt().toLocalDate()).isEqualTo(localDateOf(c.getCreatedAt()));
        assertThat(p.slotTime()).isEqualTo("07:00");
    }

    @Test
    void gather_shouldTagLatenciesByGenre_andDropRecordsWrittenAfterTheObservedDay() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveSleep(day.minusDays(1), 7, new BigDecimal("7.5"), 1);
        saveGratitude(day.minusDays(1), "hála", "connection");

        List<DetectorInput.LogLatencyPoint> pts = reads.gather(owner, day).trend().logLatencies();

        assertThat(pts).extracting(DetectorInput.LogLatencyPoint::genre)
                .containsOnly("esemeny", "reflexio");
        assertThat(pts).allSatisfy(p -> assertThat(p.writtenDate()).isBeforeOrEqualTo(day));
    }

    @Test
    void gather_shouldBoundChatTimesAboveByTheObservedDay() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveUserMessage(day.atTime(23, 30));
        saveUserMessage(day.plusDays(1).atTime(1, 0));

        assertThat(reads.gather(owner, day).trend().userChatTimes())
                .allSatisfy(t -> assertThat(t.toLocalDate()).isBeforeOrEqualTo(day));
    }
```

Add the `saveUserMessage`, `saveGratitude`, `saveSleep` helpers (reuse existing ones where the file already has them) and a `localDateOf(Instant)` helper.

- [ ] **Step 8: Run the gates**

```bash
cd backend && ./mvnw test -Dtest='*Character*,DetectorTest' -Dmezo.test.use-testcontainers=true
./mvnw test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 9: Commit**

```bash
git add -A backend/src
git commit -m "feat(character): read check-in rows, chat timestamps and logging latency (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Detectors 1-4 — self-calibration, promise-vs-delivery, decision-profile, decision-review-backlog

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/SelfCalibrationDetector.java`
- Create: `.../detector/PromiseVsDeliveryDetector.java`
- Create: `.../detector/DecisionProfileDetector.java`
- Create: `.../detector/DecisionReviewBacklogDetector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes: `TrendWindow.checkinDays/sleepEightWeeks/gymEightWeeks/checkinSlots/intentionDays/decisions`, `TrailingWindow.inWindow`, `DetectorGates.newCheckinData/newIntentionData/newDecisionData`.
- Produces: detector keys `self-calibration`, `promise-vs-delivery`, `decision-profile`, `decision-review-backlog`; the `TrendBuilder` test helper that Tasks 5 and 6 reuse.

- [ ] **Step 1: Replace the `trend(...)` test helper with a builder**

`TrendWindow` now has fourteen components; a positional helper is unreadable and every later task would have to edit it. In `DetectorTest`, delete the existing `trend(...)` method and add:

```java
    /** Fluent {@link DetectorInput.TrendWindow} builder — every component defaults to empty. */
    private static final class TrendBuilder {
        private List<DetectorInput.RunPoint> runs = List.of();
        private List<DetectorInput.GymDay> gym = List.of();
        private List<DetectorInput.MealDayPoint> meals = List.of();
        private List<DetectorInput.WaterDayPoint> water = List.of();
        private DetectorInput.StackContext stack;
        private List<DetectorInput.CheckinDayPoint> checkins = List.of();
        private DetectorInput.MedContext med;
        private List<DetectorInput.SleepPoint> sleep = List.of();
        private List<DetectorInput.IntentionDayPoint> intentions = List.of();
        private List<DetectorInput.DecisionPoint> decisions = List.of();
        private List<DetectorInput.GratitudePoint> gratitudes = List.of();
        private DetectorInput.NeedsContext needs;
        private List<DetectorInput.CheckinSlotPoint> slots = List.of();
        private List<LocalDateTime> chat = List.of();
        private List<DetectorInput.LogLatencyPoint> latencies = List.of();

        TrendBuilder runs(List<DetectorInput.RunPoint> v) { this.runs = v; return this; }
        TrendBuilder gym(List<DetectorInput.GymDay> v) { this.gym = v; return this; }
        TrendBuilder meals(List<DetectorInput.MealDayPoint> v) { this.meals = v; return this; }
        TrendBuilder water(List<DetectorInput.WaterDayPoint> v) { this.water = v; return this; }
        TrendBuilder stack(DetectorInput.StackContext v) { this.stack = v; return this; }
        TrendBuilder checkins(List<DetectorInput.CheckinDayPoint> v) { this.checkins = v; return this; }
        TrendBuilder med(DetectorInput.MedContext v) { this.med = v; return this; }
        TrendBuilder sleep(List<DetectorInput.SleepPoint> v) { this.sleep = v; return this; }
        TrendBuilder intentions(List<DetectorInput.IntentionDayPoint> v) { this.intentions = v; return this; }
        TrendBuilder decisions(List<DetectorInput.DecisionPoint> v) { this.decisions = v; return this; }
        TrendBuilder gratitudes(List<DetectorInput.GratitudePoint> v) { this.gratitudes = v; return this; }
        TrendBuilder needs(DetectorInput.NeedsContext v) { this.needs = v; return this; }
        TrendBuilder slots(List<DetectorInput.CheckinSlotPoint> v) { this.slots = v; return this; }
        TrendBuilder chat(List<LocalDateTime> v) { this.chat = v; return this; }
        TrendBuilder latencies(List<DetectorInput.LogLatencyPoint> v) { this.latencies = v; return this; }

        DetectorInput.TrendWindow build() {
            return new DetectorInput.TrendWindow(runs, gym, meals, water, stack, checkins, med,
                    sleep, intentions, decisions, gratitudes, needs, slots, chat, latencies);
        }
    }

    /** A DetectorInput carrying only a trend window — the shape every round-2/3 detector reads. */
    private static DetectorInput trendOnly(LocalDate day, DetectorInput.TrendWindow trend) {
        return new DetectorInput(day, Set.of(), Map.of(), List.of(), Map.of(), List.of(),
                List.of(), List.of(), List.of(), null, trend);
    }
```

Rewrite the existing round-2 test call sites to use `new TrendBuilder().meals(...).build()` etc. This is a mechanical transformation — **the fixtures' VALUES must not change**, only how the window is constructed. If any round-2 test's expected output changes, stop: something was altered that should not have been.

- [ ] **Step 2: Write `SelfCalibrationDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Self-calibration (round 3, spec §5.1) — ÉRZÉKENY. Does the user's own rating move together with
 * the measurable counterpart of the same thing? Two pairs are evaluated over the trailing 14 days:
 * the energy scale against the previous night's sleep quality, and the body scale against the
 * day's worst joint pain (inverted, so higher is better on both sides).
 *
 * <p>The mental and stress scales are DELIBERATELY excluded: nothing in the system measures them
 * objectively, and inventing a composite index to compare them against would put an arbitrary
 * number into a sensitive claim (spec §4.3). The detector says so in its own summary.
 *
 * <p>Method: split the window's days at the MEDIAN of the self-rating, then compare the objective
 * mean of the high-rating group with the low-rating group. A direction is claimed only when the
 * groups are {@link #MIN_SEPARATION} apart — below that the honest answer is "no direction".
 * Days sitting exactly on the median belong to neither group, so a flat self-rating simply fails
 * the {@link #MIN_DAYS_PER_GROUP} contrast gate rather than producing a fake verdict.
 *
 * <p>Sensitivity is enforced at CLAIM level, so the wording here is the safeguard: this reports a
 * relationship, never a verdict on whether the user "knows themselves", and states outright that
 * one 14-day window shows a direction rather than a trait (spec §2 — the validating literature
 * measures over weeks-to-months against instrumented ground truth).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class SelfCalibrationDetector implements CharacterDetector {

    private static final int MIN_PAIRED_DAYS = 8;
    private static final int MIN_DAYS_PER_GROUP = 3;
    private static final double MIN_SEPARATION = 1.0;
    private static final int MAX_NOTES = 2;
    private static final int PAIN_SCALE_TOP = 11;

    private static final String EGYEZIK = "egyezik";
    private static final String FORDITOTT = "forditott";
    private static final String NINCS_JEL = "nincs-jel";

    @Override
    public String key() {
        return "self-calibration";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newCheckinData(in)) {
            return List.of();
        }
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        StringBuilder sb = new StringBuilder("Az önértékelés és a mérhető adat viszonya az elmúlt két hétben: ")
                .append(String.join("; ", today.phrases()))
                .append(". A mentális és a stressz skálának nincs objektív párja a rendszerben, ezért kimaradt, és egy kéthetes ablak irányt mutat, nem jellemvonást.");
        for (String note : today.notes()) {
            sb.append(" Aznapi jegyzet: „").append(note).append("”.");
        }
        int salience = today.key().contains(FORDITOTT) ? 4 : 2;
        return List.of(new DetectorSignal(key(), "pszichologus", sb.toString(), salience));
    }

    private record State(String key, List<String> phrases, List<String> notes) {}

    private record Pair(LocalDate date, double self, double objective) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        String energia = verdict(energyPairs(in, asOf));
        String testi = verdict(bodyPairs(in, asOf));
        List<String> keyParts = new ArrayList<>();
        List<String> phrases = new ArrayList<>();
        if (energia != null) {
            keyParts.add("energia:" + energia);
            phrases.add(switch (energia) {
                case EGYEZIK -> "az energia-értékelés együtt mozog az előző éjszakai alvásminőséggel";
                case FORDITOTT -> "az energia-értékelés az előző éjszakai alvásminőséggel ellentétesen mozog";
                default -> "az energia-értékelés és az előző éjszakai alvásminőség között nem látszik irány";
            });
        }
        if (testi != null) {
            keyParts.add("testi:" + testi);
            phrases.add(switch (testi) {
                case EGYEZIK -> "a testi értékelés együtt mozog az aznapi ízületi terheltséggel";
                case FORDITOTT -> "a testi értékelés az aznapi ízületi terheltséggel ellentétesen mozog";
                default -> "a testi értékelés és az aznapi ízületi terheltség között nem látszik irány";
            });
        }
        if (keyParts.isEmpty()) {
            return null;
        }
        return new State(String.join("|", keyParts), phrases, notes(in, asOf));
    }

    /** Energy scale vs the sleep of the night leading into the SAME day (the companion convention). */
    private static List<Pair> energyPairs(DetectorInput in, LocalDate asOf) {
        List<Pair> pairs = new ArrayList<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (!TrailingWindow.inWindow(c.date(), asOf) || c.energy() == null) {
                continue;
            }
            for (DetectorInput.SleepPoint s : in.trend().sleepEightWeeks()) {
                if (s.date().equals(c.date()) && s.quality() != null) {
                    pairs.add(new Pair(c.date(), c.energy().doubleValue(), s.quality()));
                    break;
                }
            }
        }
        return pairs;
    }

    /** Body scale vs the day's worst joint pain, inverted so that higher means "better" on both. */
    private static List<Pair> bodyPairs(DetectorInput in, LocalDate asOf) {
        List<Pair> pairs = new ArrayList<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (!TrailingWindow.inWindow(c.date(), asOf) || c.body() == null) {
                continue;
            }
            Integer worst = worstPain(in, c.date());
            if (worst != null) {
                pairs.add(new Pair(c.date(), c.body().doubleValue(), PAIN_SCALE_TOP - worst));
            }
        }
        return pairs;
    }

    private static Integer worstPain(DetectorInput in, LocalDate date) {
        Integer worst = null;
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            if (!g.date().equals(date)) {
                continue;
            }
            for (DetectorInput.ExerciseWork e : g.exercises()) {
                if (e.worstJointPain() != null && (worst == null || e.worstJointPain() > worst)) {
                    worst = e.worstJointPain();
                }
            }
        }
        return worst;
    }

    /** null when the pair is not evaluable at all — an unevaluable pair is omitted, not guessed. */
    private static String verdict(List<Pair> pairs) {
        if (pairs.size() < MIN_PAIRED_DAYS) {
            return null;
        }
        double median = median(pairs.stream().map(Pair::self).sorted().toList());
        List<Double> high = pairs.stream().filter(p -> p.self() > median).map(Pair::objective).toList();
        List<Double> low = pairs.stream().filter(p -> p.self() < median).map(Pair::objective).toList();
        if (high.size() < MIN_DAYS_PER_GROUP || low.size() < MIN_DAYS_PER_GROUP) {
            return null;
        }
        double diff = mean(high) - mean(low);
        if (diff >= MIN_SEPARATION) {
            return EGYEZIK;
        }
        return diff <= -MIN_SEPARATION ? FORDITOTT : NINCS_JEL;
    }

    private static double median(List<Double> sorted) {
        int n = sorted.size();
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private static double mean(List<Double> values) {
        double sum = 0;
        for (double v : values) {
            sum += v;
        }
        return sum / values.size();
    }

    /**
     * Raw check-in notes from the window's highest- and lowest-rated energy day, passed through as
     * EVIDENCE for the expert persona. Deterministic selection, zero interpretation — the shipped
     * {@code JournalNoteDetector} precedent (spec §4.1).
     */
    private static List<String> notes(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.CheckinDayPoint> rated = in.trend().checkinDays().stream()
                .filter(c -> TrailingWindow.inWindow(c.date(), asOf) && c.energy() != null)
                .sorted(Comparator.comparing(DetectorInput.CheckinDayPoint::energy))
                .toList();
        if (rated.isEmpty()) {
            return List.of();
        }
        List<LocalDate> wanted = new ArrayList<>();
        wanted.add(rated.getLast().date());
        if (rated.size() > 1) {
            wanted.add(rated.getFirst().date());
        }
        List<String> notes = new ArrayList<>();
        for (LocalDate d : wanted) {
            for (DetectorInput.CheckinSlotPoint s : in.trend().checkinSlots()) {
                if (s.date().equals(d) && s.notePreview() != null && notes.size() < MAX_NOTES) {
                    notes.add(s.notePreview());
                    break;
                }
            }
        }
        return List.copyOf(notes);
    }
}
```

Keep the import list to exactly what compiles — `Comparator.comparing(...::energy)` needs no
`BigDecimal` import of its own.

- [ ] **Step 3: Write `PromiseVsDeliveryDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Promise vs delivery (round 3, spec §5.2): the morning sets foci, the evening records a day-close
 * verdict. Two independent things can go wrong, so two dimensions are tracked — how the closed days
 * went ({@code tart}) and whether the days get closed at all ({@code zaras}). A user who keeps every
 * promise but never closes the day looks identical to one who never promises, unless closure is
 * measured separately.
 *
 * <p>The verdict comes from {@code DailyIntentionEntity.reflection}, a closed enum — no text is
 * read anywhere in this detector.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class PromiseVsDeliveryDetector implements CharacterDetector {

    private static final int MIN_FOCUS_DAYS = 5;
    private static final int MIN_CLOSED_DAYS = 4;
    private static final double TARTJA_MIN = 0.75;
    private static final double RESZBEN_MIN = 0.40;
    private static final double ZARAS_TELJES_MIN = 0.70;

    private static final String REFLECTION_YES = "yes";
    private static final String REFLECTION_PARTIAL = "partial";

    @Override
    public String key() {
        return "promise-vs-delivery";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newIntentionData(in)) {
            return List.of();
        }
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String closurePhrase = "teljes".equals(today.closure())
                ? "a fókusszal induló napok többségét le is zárja"
                : "a fókusszal induló napok jelentős részét nem zárja le";
        StringBuilder sb = new StringBuilder("A napi fókusz és a napzárás viszonya: ")
                .append(closurePhrase)
                .append(" (").append(today.focusDays()).append(" fókusznapból ")
                .append(today.closedDays()).append(" lezárva, 14 nap)");
        if (today.delivery() != null) {
            sb.append("; a lezárt napokon ").append(switch (today.delivery()) {
                case "tartja" -> "többnyire teljesítette, amit kitűzött";
                case "reszben" -> "jellemzően részben teljesítette, amit kitűzött";
                default -> "többnyire nem teljesítette, amit kitűzött";
            });
        }
        return List.of(new DetectorSignal(key(), "drill", sb.append(".").toString(), salience(today)));
    }

    private static int salience(State s) {
        return "csuszik".equals(s.delivery()) || "hianyos".equals(s.closure()) ? 4 : 2;
    }

    private record State(String key, String delivery, String closure, int focusDays, int closedDays) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.IntentionDayPoint> focusDays = new ArrayList<>();
        for (DetectorInput.IntentionDayPoint p : in.trend().intentionDays()) {
            if (TrailingWindow.inWindow(p.date(), asOf) && p.focusCount() > 0) {
                focusDays.add(p);
            }
        }
        if (focusDays.size() < MIN_FOCUS_DAYS) {
            return null;
        }
        List<DetectorInput.IntentionDayPoint> closed = focusDays.stream()
                .filter(p -> p.reflection() != null)
                .toList();
        double closureRate = (double) closed.size() / focusDays.size();
        String closure = closureRate >= ZARAS_TELJES_MIN ? "teljes" : "hianyos";

        String delivery = null;
        if (closed.size() >= MIN_CLOSED_DAYS) {
            double score = 0;
            for (DetectorInput.IntentionDayPoint p : closed) {
                score += switch (p.reflection()) {
                    case REFLECTION_YES -> 1.0;
                    case REFLECTION_PARTIAL -> 0.5;
                    default -> 0.0;
                };
            }
            double mean = score / closed.size();
            delivery = mean >= TARTJA_MIN ? "tartja" : mean >= RESZBEN_MIN ? "reszben" : "csuszik";
        }
        String key = (delivery == null ? "" : "tart:" + delivery + "|") + "zaras:" + closure;
        return new State(key, delivery, closure, focusDays.size(), closed.size());
    }
}
```

- [ ] **Step 4: Write `DecisionProfileDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Decision outcome profile (round 3, spec §5.3): how the decisions the user actually went back and
 * reviewed turned out, on the journal's own 1..5 {@code outcomeRating} scale. The window is 42 days
 * rather than 14 because reviews are episodic — a fortnight rarely holds enough of them to say
 * anything, and a detector that can never reach its own gate is dead code.
 *
 * <p>The decision texts are passed through as EVIDENCE only (the best- and worst-rated entry), never
 * parsed. The rating itself carries the whole computation.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class DecisionProfileDetector implements CharacterDetector {

    private static final int WINDOW_DAYS = 42;
    private static final int MIN_REVIEWS = 4;
    private static final double JO_MIN = 3.75;
    private static final double VEGYES_MIN = 2.25;

    @Override
    public String key() {
        return "decision-profile";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newDecisionData(in)) {
            return List.of();
        }
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String phrase = switch (today.band()) {
            case "jo" -> "a visszanézett döntései többnyire jól sültek el";
            case "vegyes" -> "a visszanézett döntései vegyes képet mutatnak";
            default -> "a visszanézett döntései többségét utólag gyengének értékelte";
        };
        StringBuilder sb = new StringBuilder("A döntésnapló szerint ").append(phrase)
                .append(" (").append(today.reviews()).append(" értékelt döntés, hat hét).");
        for (String text : today.evidence()) {
            sb.append(" Példa: „").append(text).append("”.");
        }
        int salience = "gyenge".equals(today.band()) ? 4 : 3;
        return List.of(new DetectorSignal(key(), "pszichologus", sb.toString(), salience));
    }

    private record State(String key, String band, int reviews, List<String> evidence) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.DecisionPoint> reviewed = new ArrayList<>();
        for (DetectorInput.DecisionPoint d : in.trend().decisions()) {
            if (d.reviewedOn() != null && d.outcomeRating() != null
                    && !d.reviewedOn().isAfter(asOf)
                    && TrailingWindow.inWindow(d.reviewedOn(), asOf, WINDOW_DAYS)) {
                reviewed.add(d);
            }
        }
        if (reviewed.size() < MIN_REVIEWS) {
            return null;
        }
        double sum = 0;
        for (DetectorInput.DecisionPoint d : reviewed) {
            sum += d.outcomeRating();
        }
        double mean = sum / reviewed.size();
        String band = mean >= JO_MIN ? "jo" : mean >= VEGYES_MIN ? "vegyes" : "gyenge";

        List<DetectorInput.DecisionPoint> sorted = reviewed.stream()
                .sorted(Comparator.comparing(DetectorInput.DecisionPoint::outcomeRating))
                .toList();
        List<String> evidence = new ArrayList<>();
        if (sorted.getLast().textPreview() != null) {
            evidence.add(sorted.getLast().textPreview());
        }
        if (sorted.getFirst().textPreview() != null && sorted.size() > 1) {
            evidence.add(sorted.getFirst().textPreview());
        }
        return new State("kimenet:" + band, band, reviewed.size(), List.copyOf(evidence));
    }
}
```

- [ ] **Step 5: Write `DecisionReviewBacklogDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Decision review backlog (round 3, spec §5.4): how many decisions are past their own review date
 * and still unreviewed. {@code decision-profile} is about OUTCOMES; this is about whether the user
 * goes back and looks at all — a different behaviour from the same table.
 *
 * <p>No window: an entry decided months ago is exactly what a backlog is made of. Catch-up honesty
 * is applied on both timestamps, so a review performed after the observed day still counts as
 * outstanding on that day. The band is qualitative — the count appears in the sentence, never in
 * the state key, or the state would change on every single entry and defeat the gate.
 *
 * <p>Deliberately NO new-data pre-filter. Every other detector here also requires its source to
 * have moved today, but a backlog grows because TIME passes, not because a row arrives: the day an
 * entry crosses its own review date, nothing is written anywhere. Gating on new decision data would
 * silence exactly the transition this detector exists to catch. The state-change gate alone is the
 * correct and sufficient protection.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class DecisionReviewBacklogDetector implements CharacterDetector {

    private static final int NEHANY_MAX = 2;

    @Override
    public String key() {
        return "decision-review-backlog";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String summary = switch (today.band()) {
            case "nincs" -> "A döntésnaplóban nincs lejárt, át nem nézett döntés.";
            case "nehany" -> "A döntésnaplóban " + today.overdue()
                    + " döntés van, aminek lejárt a visszanézési ideje.";
            default -> "A döntésnaplóban " + today.overdue()
                    + " döntés vár visszanézésre a saját határidején túl.";
        };
        int salience = "halmozodik".equals(today.band()) ? 4 : 2;
        return List.of(new DetectorSignal(key(), "drill", summary, salience));
    }

    private record State(String key, String band, int overdue) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        int existing = 0;
        int overdue = 0;
        for (DetectorInput.DecisionPoint d : in.trend().decisions()) {
            if (d.writtenOn() == null || d.writtenOn().isAfter(asOf)) {
                continue;   // did not exist yet on asOf
            }
            existing++;
            boolean reviewed = d.reviewedOn() != null && !d.reviewedOn().isAfter(asOf);
            if (!reviewed && !d.reviewDue().isAfter(asOf)) {
                overdue++;
            }
        }
        if (existing == 0) {
            return null;   // no decision journal at all — silence, not "zero backlog"
        }
        String band = overdue == 0 ? "nincs" : overdue <= NEHANY_MAX ? "nehany" : "halmozodik";
        return new State("backlog:" + band, band, overdue);
    }
}
```

- [ ] **Step 6: Write the tests**

Add to `DetectorTest`. `DAY` is the file's existing observed-day constant.

```java
    private static DetectorInput.CheckinDayPoint scale(LocalDate d, String energy, String body) {
        return new DetectorInput.CheckinDayPoint(d, 1, new BigDecimal(energy), new BigDecimal("5"),
                new BigDecimal(body), new BigDecimal("6"));
    }

    private static DetectorInput.SleepPoint sleep(LocalDate d, int quality) {
        return new DetectorInput.SleepPoint(d, quality, new BigDecimal("7.0"), 1);
    }

    private static DetectorInput.IntentionDayPoint intention(LocalDate d, int foci, String reflection) {
        return new DetectorInput.IntentionDayPoint(d, foci, reflection);
    }

    private static DetectorInput.DecisionPoint decision(LocalDate reviewedOn, Integer rating) {
        return new DetectorInput.DecisionPoint(DAY.minusDays(40), DAY.minusDays(40),
                DAY.minusDays(20), reviewedOn, rating == null ? null : rating.shortValue(),
                "döntés szövege");
    }

    @Test
    void selfCalibration_firesWhenHighEnergyDaysHadWorseSleep() {
        // 10 paired days; the 5 highest self-rated days slept badly, the 5 lowest slept well.
        List<DetectorInput.CheckinDayPoint> scales = new ArrayList<>();
        List<DetectorInput.SleepPoint> sleeps = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            LocalDate d = DAY.minusDays(i);
            boolean highSelf = i < 5;
            scales.add(scale(d, highSelf ? "8" : "3", "6"));
            sleeps.add(sleep(d, highSelf ? 3 : 8));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(scales).sleep(sleeps).build());

        List<DetectorSignal> fired = new SelfCalibrationDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("ellentétesen mozog")
                .contains("nincs objektív párja");
        assertThat(fired.getFirst().expertKey()).isEqualTo("pszichologus");
    }

    @Test
    void selfCalibration_silentWhenOneSideOfTheContrastIsTooThin() {
        // 10 paired days but only ONE day above the median -> no contrast group.
        List<DetectorInput.CheckinDayPoint> scales = new ArrayList<>();
        List<DetectorInput.SleepPoint> sleeps = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            LocalDate d = DAY.minusDays(i);
            scales.add(scale(d, i == 0 ? "9" : "5", "6"));
            sleeps.add(sleep(d, i == 0 ? 2 : 8));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(scales).sleep(sleeps).build());

        assertThat(new SelfCalibrationDetector().detect(in)).isEmpty();
    }

    @Test
    void selfCalibration_silentWhenTheDirectionIsUnchangedSinceYesterday() {
        // 11 paired days with the SAME direction on both evaluations -> state unchanged -> silent.
        List<DetectorInput.CheckinDayPoint> scales = new ArrayList<>();
        List<DetectorInput.SleepPoint> sleeps = new ArrayList<>();
        for (int i = 0; i < 11; i++) {
            LocalDate d = DAY.minusDays(i);
            boolean highSelf = i % 2 == 0;
            scales.add(scale(d, highSelf ? "8" : "3", "6"));
            sleeps.add(sleep(d, highSelf ? 8 : 3));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(scales).sleep(sleeps).build());

        assertThat(new SelfCalibrationDetector().detect(in)).isEmpty();
    }

    @Test
    void promiseVsDelivery_firesOnPoorClosure() {
        List<DetectorInput.IntentionDayPoint> days = new ArrayList<>();
        days.add(intention(DAY, 2, null));
        for (int i = 1; i <= 5; i++) {
            days.add(intention(DAY.minusDays(i), 1, i <= 3 ? null : "yes"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().intentions(days).build());

        List<DetectorSignal> fired = new PromiseVsDeliveryDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("nem zárja le");
        assertThat(fired.getFirst().expertKey()).isEqualTo("drill");
    }

    @Test
    void promiseVsDelivery_silentBelowTheFocusDayGate() {
        List<DetectorInput.IntentionDayPoint> days = List.of(
                intention(DAY, 1, "yes"), intention(DAY.minusDays(1), 1, "no"));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().intentions(days).build());

        assertThat(new PromiseVsDeliveryDetector().detect(in)).isEmpty();
    }

    @Test
    void decisionProfile_firesOnWeakOutcomes_andCarriesEvidence() {
        List<DetectorInput.DecisionPoint> decisions = List.of(
                decision(DAY, 1), decision(DAY.minusDays(3), 2),
                decision(DAY.minusDays(9), 1), decision(DAY.minusDays(20), 2));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().decisions(decisions).build());

        List<DetectorSignal> fired = new DecisionProfileDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("gyengének").contains("döntés szövege");
    }

    @Test
    void decisionProfile_silentBelowTheReviewGate() {
        List<DetectorInput.DecisionPoint> decisions = List.of(decision(DAY, 1), decision(DAY, 2));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().decisions(decisions).build());

        assertThat(new DecisionProfileDetector().detect(in)).isEmpty();
    }

    @Test
    void decisionReviewBacklog_firesWhenOverdueEntriesPileUp() {
        List<DetectorInput.DecisionPoint> decisions = List.of(
                new DetectorInput.DecisionPoint(DAY.minusDays(30), DAY.minusDays(30),
                        DAY.minusDays(5), null, null, "a"),
                new DetectorInput.DecisionPoint(DAY.minusDays(29), DAY.minusDays(29),
                        DAY.minusDays(4), null, null, "b"),
                new DetectorInput.DecisionPoint(DAY.minusDays(28), DAY.minusDays(28),
                        DAY, null, null, "c"));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().decisions(decisions).build());

        List<DetectorSignal> fired = new DecisionReviewBacklogDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("3 döntés");
    }

    @Test
    void decisionReviewBacklog_stateKeyIsQualitative_soAnExtraOverdueEntryDoesNotRefire() {
        // Four overdue yesterday, five today: the COUNT moved, the BAND did not -> silent.
        // If this test ever fails, the state key has picked up a moving number (Global Constraints).
        List<DetectorInput.DecisionPoint> decisions = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            decisions.add(new DetectorInput.DecisionPoint(DAY.minusDays(30), DAY.minusDays(30),
                    i == 0 ? DAY : DAY.minusDays(5), null, null, "x"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().decisions(decisions).build());

        assertThat(new DecisionReviewBacklogDetector().detect(in)).isEmpty();
    }
```

- [ ] **Step 7: Verify the qualitative-state test actually bites**

Temporarily change `DecisionReviewBacklogDetector`'s state key to `"backlog:" + overdue` and re-run `decisionReviewBacklog_stateKeyIsQualitative_soAnExtraOverdueEntryDoesNotRefire`. It MUST fail. Revert the change. Record in the report that you did this — a state-change test that passes either way is worthless (round-2's lesson).

- [ ] **Step 8: Run the gate**

```bash
cd backend && ./mvnw test -Dtest='*Character*,DetectorTest' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 9: Commit**

```bash
git add -A backend/src
git commit -m "feat(character): self-calibration, promise-vs-delivery, decision-profile, decision-review-backlog (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Detectors 5-8 — gratitude-focus, streak-break-response, restart-pattern, retro-logging-ratio

**Files:**
- Create: `.../detector/GratitudeFocusDetector.java`, `StreakBreakResponseDetector.java`, `RestartPatternDetector.java`, `RetroLoggingRatioDetector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes: `TrendWindow.gratitudes/needs/logLatencies`, `TrailingWindow`, `DetectorGates.newGratitudeData`, and Task 4's `TrendBuilder`/`trendOnly` test helpers.
- Produces: a shared private helper shape for "the most recent streak break as of a date" is duplicated in the two needs detectors ON PURPOSE — see the note in Step 3.

- [ ] **Step 1: Write `GratitudeFocusDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Gratitude focus (round 3, spec §5.5): which life area the user's gratitude entries cluster in
 * over the trailing 28 days, and whether they cluster at all. Runs entirely on {@code lifeArea},
 * the journal's own closed tag — the entry TEXT is never read here.
 *
 * <p>{@code lifeArea} is optional, so a coverage gate is required: naming a "dominant area" from
 * two tagged entries out of twenty would be a fabrication. This mirrors round 2's
 * {@code MIN_NOVA_COVERAGE}, which exists for exactly the same reason.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class GratitudeFocusDetector implements CharacterDetector {

    private static final int WINDOW_DAYS = 28;
    private static final int MIN_ENTRIES = 6;
    private static final double MIN_AREA_COVERAGE = 0.60;
    private static final double CONCENTRATED_MIN = 0.50;

    private static final Map<String, String> AREA_HU = Map.ofEntries(
            Map.entry("mindfulness", "jelenlét"),
            Map.entry("mindset", "szemlélet"),
            Map.entry("cooking", "főzés"),
            Map.entry("financial", "pénzügyek"),
            Map.entry("productivity", "produktivitás"),
            Map.entry("learning", "tanulás"),
            Map.entry("connection", "kapcsolatok"),
            Map.entry("recovery", "regeneráció"));

    @Override
    public String key() {
        return "gratitude-focus";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newGratitudeData(in)) {
            return List.of();
        }
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String area = AREA_HU.getOrDefault(today.area(), today.area());
        String summary = "koncentralt".equals(today.spread())
                ? "A hála-bejegyzések négy hét alatt a(z) " + area
                        + " területre húznak (" + today.dominant() + " a " + today.tagged()
                        + " címkézett bejegyzésből)."
                : "A hála-bejegyzések négy hét alatt több terület között oszlanak meg, a leggyakoribb a(z) "
                        + area + " (" + today.dominant() + " a " + today.tagged() + " címkézettből).";
        return List.of(new DetectorSignal(key(), "antropologus", summary, 3));
    }

    private record State(String key, String area, String spread, int dominant, int tagged) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        int total = 0;
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (DetectorInput.GratitudePoint g : in.trend().gratitudes()) {
            if (!TrailingWindow.inWindow(g.occurredOn(), asOf, WINDOW_DAYS)) {
                continue;
            }
            total++;
            if (g.lifeArea() != null) {
                counts.merge(g.lifeArea(), 1, Integer::sum);
            }
        }
        if (total < MIN_ENTRIES) {
            return null;
        }
        int tagged = counts.values().stream().mapToInt(Integer::intValue).sum();
        if ((double) tagged / total < MIN_AREA_COVERAGE) {
            return null;   // too few tagged entries to name a dominant area honestly
        }
        String area = null;
        int best = 0;
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            // Ties resolve to the alphabetically first key so the state is stable across runs.
            if (e.getValue() > best || (e.getValue() == best && area != null
                    && e.getKey().compareTo(area) < 0)) {
                best = e.getValue();
                area = e.getKey();
            }
        }
        String spread = (double) best / tagged >= CONCENTRATED_MIN ? "koncentralt" : "szort";
        return new State("terulet:" + area + "|eloszlas:" + spread, area, spread, best, tagged);
    }
}
```

- [ ] **Step 2: Write `StreakBreakResponseDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Streak break response (round 3, spec §5.6): after the most recent break of the Életjel all-green
 * streak, did the next three days cascade or recover? This is the "what-the-hell effect" / abstinence
 * violation effect in the literature — a real construct, though the literature also says collapse is
 * a RISK, not the default outcome (spec §2), which is why the summary states the fact rather than
 * grading the response.
 *
 * <p>A day with NO closed row counts as a break. That is not a violation of "absent ≠ zero": it is a
 * deliberate mirror of {@code NeedsService.closeNew}, which resets the streak when the previous
 * calendar day has no row. The domain owns that rule; this detector follows it rather than inventing
 * a second, contradictory one.
 *
 * <p>No new-data pre-filter: a cascade means no rows are being written at all, so gating on new
 * needs data would silence precisely the case of interest (spec §4.2).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class StreakBreakResponseDetector implements CharacterDetector {

    private static final int RESPONSE_DAYS = 3;
    private static final int VISSZAALL_MIN = 2;

    @Override
    public String key() {
        return "streak-break-response";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().needs() == null) {
            return List.of();
        }
        String today = state(in, in.day());
        String yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = switch (today) {
            case "toresvalasz:kaszkad" -> "A legutóbbi megszakadt Életjel-sorozat után a következő három nap egyike sem lett teljes.";
            case "toresvalasz:vontatott" -> "A legutóbbi megszakadt Életjel-sorozat után a következő három napból egy lett teljes.";
            default -> "A legutóbbi megszakadt Életjel-sorozat után a következő három napból legalább kettő ismét teljes lett.";
        };
        int salience = "toresvalasz:kaszkad".equals(today) ? 4 : 3;
        return List.of(new DetectorSignal(key(), "pszichologus", summary, salience));
    }

    static Map<LocalDate, DetectorInput.NeedsDayPoint> byDate(DetectorInput in) {
        Map<LocalDate, DetectorInput.NeedsDayPoint> map = new HashMap<>();
        for (DetectorInput.NeedsDayPoint d : in.trend().needs().days()) {
            map.put(d.date(), d);
        }
        return map;
    }

    /** True when the streak was alive on {@code date}: a closed, all-green row exists for it. */
    static boolean allGreen(Map<LocalDate, DetectorInput.NeedsDayPoint> days, LocalDate date) {
        DetectorInput.NeedsDayPoint d = days.get(date);
        return d != null && d.allGreen();
    }

    /**
     * The most recent day in the trailing {@code windowDays} on which an alive streak broke, or
     * null when there was none. A break is: the previous day was all-green, this day is not (either
     * unclosed or closed without all six rings) — the {@code NeedsService.closeNew} rule.
     */
    static LocalDate lastBreak(Map<LocalDate, DetectorInput.NeedsDayPoint> days, LocalDate asOf,
                               int windowDays) {
        for (LocalDate d = asOf; !d.isBefore(asOf.minusDays(windowDays - 1L)); d = d.minusDays(1)) {
            if (allGreen(days, d.minusDays(1)) && !allGreen(days, d)) {
                return d;
            }
        }
        return null;
    }

    private static String state(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.NeedsDayPoint> days = byDate(in);
        LocalDate broke = lastBreak(days, asOf, TrailingWindow.WINDOW_DAYS);
        if (broke == null || broke.plusDays(RESPONSE_DAYS).isAfter(asOf)) {
            return null;   // no break, or the response window has not fully elapsed yet
        }
        int recovered = 0;
        for (int i = 1; i <= RESPONSE_DAYS; i++) {
            if (allGreen(days, broke.plusDays(i))) {
                recovered++;
            }
        }
        String band = recovered >= VISSZAALL_MIN ? "visszaall" : recovered == 1 ? "vontatott" : "kaszkad";
        return "toresvalasz:" + band;
    }
}
```

- [ ] **Step 3: Write `RestartPatternDetector`**

The two needs detectors share `byDate`/`allGreen`/`lastBreak`, which live as package-private statics on `StreakBreakResponseDetector` and are reused here. Do NOT copy them — one owner, one definition.

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Restart pattern (round 3, spec §5.7): how long it took to get back to a complete Életjel day after
 * the most recent break, over a 28-day window.
 *
 * <p><b>These bands are an admitted heuristic.</b> The streak literature has no validated cut-off for
 * "healthy" restart latency — the only real empirical data point is a small qualitative study of
 * broken run streaks, and the popular "missing twice starts a new pattern" rule is a loose paraphrase
 * of a habit-automaticity finding, not a result (spec §2). The summary therefore states the elapsed
 * days as a fact and does not grade them, and this caveat is repeated in the Gépterem catalog entry.
 *
 * <p>No new-data pre-filter, for the same reason as {@code streak-break-response}: an open restart is
 * precisely the state in which nothing is being written.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class RestartPatternDetector implements CharacterDetector {

    private static final int WINDOW_DAYS = 28;
    private static final int ROVID_MAX = 3;
    private static final int HOSSZU_MAX = 7;

    @Override
    public String key() {
        return "restart-pattern";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().needs() == null) {
            return List.of();
        }
        String today = state(in, in.day());
        String yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = switch (today) {
            case "ujraindulas:azonnal" -> "A legutóbbi megszakadás után már a következő nap ismét teljes Életjel-nap lett.";
            case "ujraindulas:rovid" -> "A legutóbbi megszakadás után néhány napon belül lett újra teljes Életjel-nap.";
            case "ujraindulas:hosszu" -> "A legutóbbi megszakadás után több mint három nap telt el az első újra teljes Életjel-napig.";
            default -> "A legutóbbi megszakadás óta még nem volt újra teljes Életjel-nap.";
        };
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }

    private static String state(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.NeedsDayPoint> days = StreakBreakResponseDetector.byDate(in);
        LocalDate broke = StreakBreakResponseDetector.lastBreak(days, asOf, WINDOW_DAYS);
        if (broke == null) {
            return null;
        }
        for (LocalDate d = broke; !d.isAfter(asOf); d = d.plusDays(1)) {
            if (StreakBreakResponseDetector.allGreen(days, d)) {
                long gap = java.time.temporal.ChronoUnit.DAYS.between(broke, d);
                String band = gap <= 1 ? "azonnal" : gap <= ROVID_MAX ? "rovid"
                        : gap <= HOSSZU_MAX ? "hosszu" : "nyitott";
                return "ujraindulas:" + band;
            }
        }
        return "ujraindulas:nyitott";
    }
}
```

- [ ] **Step 4: Write `RetroLoggingRatioDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Retro-logging ratio (round 3, spec §5.8): how much of what the user records is written on the day
 * it is about, versus reconstructed later. The same-calendar-day boundary is the diary-research
 * convention rather than an invented threshold (spec §2).
 *
 * <p>The two genres are reported SEPARATELY on purpose. A workout entered the next morning and a
 * gratitude note backfilled a week later are different behaviours, and one blended ratio would be
 * mush. A genre with too few records simply drops out of the state.
 *
 * <p>Deliberate limit on the claim: the literature measures loss of DETAIL with delay, not that a
 * late-recorded number is false. The summary therefore says when things were written and never that
 * retrospective entries are inaccurate.
 *
 * <p>No new-data pre-filter: the window shifting is itself enough to change the picture, and a quiet
 * day writes nothing to gate on.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class RetroLoggingRatioDetector implements CharacterDetector {

    private static final int MIN_RECORDS_PER_GROUP = 6;
    private static final double AZONNALI_MAX = 0.20;
    private static final double VEGYES_MAX = 0.50;

    private static final String GENRE_EVENT = "esemeny";
    private static final String GENRE_REFLECTION = "reflexio";

    @Override
    public String key() {
        return "retro-logging-ratio";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        List<String> parts = new ArrayList<>();
        if (today.event() != null) {
            parts.add("az edzés- és testadatokat " + phrase(today.event()));
        }
        if (today.reflection() != null) {
            parts.add("a naplózó bejegyzéseket " + phrase(today.reflection()));
        }
        String summary = "A rögzítés időzítése az elmúlt két hétben: " + String.join(", ", parts)
                + ". Ez arról szól, mikor íródtak, nem arról, hogy pontosak-e.";
        int salience = "utolagos".equals(today.reflection()) || "utolagos".equals(today.event()) ? 3 : 2;
        return List.of(new DetectorSignal(key(), "drill", summary, salience));
    }

    private static String phrase(String band) {
        return switch (band) {
            case "azonnali" -> "szinte mindig aznap rögzíti";
            case "vegyes" -> "hol aznap, hol utólag rögzíti";
            default -> "többnyire utólag rögzíti";
        };
    }

    private record State(String key, String event, String reflection) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        String event = band(in, asOf, GENRE_EVENT);
        String reflection = band(in, asOf, GENRE_REFLECTION);
        if (event == null && reflection == null) {
            return null;
        }
        String key = (event == null ? "" : GENRE_EVENT + ":" + event + "|")
                + (reflection == null ? "" : GENRE_REFLECTION + ":" + reflection);
        return new State(key, event, reflection);
    }

    private static String band(DetectorInput in, LocalDate asOf, String genre) {
        int total = 0;
        int retro = 0;
        for (DetectorInput.LogLatencyPoint p : in.trend().logLatencies()) {
            if (!genre.equals(p.genre()) || !TrailingWindow.inWindow(p.aboutDate(), asOf)
                    || p.writtenDate().isAfter(asOf)) {
                continue;
            }
            total++;
            if (!p.writtenDate().equals(p.aboutDate())) {
                retro++;
            }
        }
        if (total < MIN_RECORDS_PER_GROUP) {
            return null;
        }
        double ratio = (double) retro / total;
        return ratio < AZONNALI_MAX ? "azonnali" : ratio <= VEGYES_MAX ? "vegyes" : "utolagos";
    }
}
```

- [ ] **Step 5: Write the tests**

```java
    private static DetectorInput.GratitudePoint gratitude(LocalDate d, String area) {
        return new DetectorInput.GratitudePoint(d, d, area);
    }

    private static DetectorInput.NeedsDayPoint needsDay(LocalDate d, boolean allGreen) {
        int v = allGreen ? 80 : 30;
        return new DetectorInput.NeedsDayPoint(d, 80, 80, 80, 80, allGreen ? 80 : 30, v,
                allGreen ? 6 : 4, allGreen, allGreen ? 3 : 0);
    }

    private static DetectorInput.LogLatencyPoint latency(String genre, LocalDate about, int lagDays) {
        return new DetectorInput.LogLatencyPoint(genre, "teszt", about, about.plusDays(lagDays));
    }

    @Test
    void gratitudeFocus_firesOnAConcentratedArea() {
        List<DetectorInput.GratitudePoint> entries = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            entries.add(gratitude(DAY.minusDays(i), i < 4 ? "connection" : "learning"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().gratitudes(entries).build());

        List<DetectorSignal> fired = new GratitudeFocusDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("kapcsolatok");
        assertThat(fired.getFirst().expertKey()).isEqualTo("antropologus");
    }

    @Test
    void gratitudeFocus_silentWhenTooFewEntriesCarryAnArea() {
        List<DetectorInput.GratitudePoint> entries = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            entries.add(gratitude(DAY.minusDays(i), i < 2 ? "connection" : null));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().gratitudes(entries).build());

        assertThat(new GratitudeFocusDetector().detect(in)).isEmpty();
    }

    @Test
    void streakBreakResponse_firesOnACascade() {
        // all-green up to DAY-4, break on DAY-3, then nothing complete on DAY-2..DAY.
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 10; i >= 4; i--) {
            days.add(needsDay(DAY.minusDays(i), true));
        }
        for (int i = 3; i >= 0; i--) {
            days.add(needsDay(DAY.minusDays(i), false));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        List<DetectorSignal> fired = new StreakBreakResponseDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("egyike sem lett teljes");
    }

    @Test
    void streakBreakResponse_silentWhileTheResponseWindowHasNotElapsed() {
        // break on DAY-1: only one of the three response days exists yet.
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 10; i >= 2; i--) {
            days.add(needsDay(DAY.minusDays(i), true));
        }
        days.add(needsDay(DAY.minusDays(1), false));
        days.add(needsDay(DAY, false));
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        assertThat(new StreakBreakResponseDetector().detect(in)).isEmpty();
    }

    @Test
    void restartPattern_reportsAnOpenRestart() {
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 20; i >= 9; i--) {
            days.add(needsDay(DAY.minusDays(i), true));
        }
        for (int i = 8; i >= 0; i--) {
            days.add(needsDay(DAY.minusDays(i), false));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        List<DetectorSignal> fired = new RestartPatternDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("még nem volt újra teljes");
    }

    @Test
    void retroLogging_firesWhenReflectionEntriesAreMostlyBackfilled() {
        List<DetectorInput.LogLatencyPoint> pts = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            pts.add(latency("reflexio", DAY.minusDays(i), i % 4 == 0 ? 0 : 2));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().latencies(pts).build());

        List<DetectorSignal> fired = new RetroLoggingRatioDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("többnyire utólag rögzíti")
                .contains("nem arról, hogy pontosak-e");
    }

    @Test
    void retroLogging_silentBelowThePerGroupMinimum() {
        List<DetectorInput.LogLatencyPoint> pts = List.of(
                latency("reflexio", DAY, 3), latency("esemeny", DAY.minusDays(1), 2));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().latencies(pts).build());

        assertThat(new RetroLoggingRatioDetector().detect(in)).isEmpty();
    }
```

Check the fixture arithmetic before running: `retroLogging_firesWhenReflectionEntriesAreMostlyBackfilled` has 8 reflection records, of which `i % 4 == 0` (i = 0 and 4) are same-day, so retro = 6/8 = 0,75 > 0,50 → `utolagos`. As of DAY-1 the i=0 record is out of window and every remaining record written after DAY-1 is filtered, so the state differs — the detector fires. If the counts do not work out when you run it, fix the FIXTURE, never the threshold.

- [ ] **Step 6: Run the gate**

```bash
cd backend && ./mvnw test -Dtest='*Character*,DetectorTest' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 7: Commit**

```bash
git add -A backend/src
git commit -m "feat(character): gratitude-focus, streak-break-response, restart-pattern, retro-logging-ratio (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Detectors 9-12 — night-activity, checkin-latency, checkin-slot-drift, needs-domain-imbalance

**Files:**
- Create: `.../detector/NightActivityDetector.java`, `CheckinLatencyDetector.java`, `CheckinSlotDriftDetector.java`, `NeedsDomainImbalanceDetector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes: `TrendWindow.userChatTimes/checkinSlots/needs`, `TrailingWindow`, `DetectorGates.newCheckinData`, Task 4's test helpers, Task 5's `needsDay` fixture helper.
- Produces: nothing further — this completes the twelve.

- [ ] **Step 1: Write `NightActivityDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Night activity (round 3, spec §5.9): on how many of the trailing 14 days did the user write a chat
 * message between midnight and 05:00?
 *
 * <p><b>Attribution limit, stated in the summary itself:</b> this proves CHAT use at that hour, not
 * app use in general. Push and notification rows would prove the system acted rather than the user,
 * and {@code llm_log_history} moves 1:1 with chat anyway, so the user's own messages are both the
 * most direct evidence available and the honest bound on the claim.
 *
 * <p>No new-data pre-filter: the transition down to "no night activity" happens on a day when
 * nothing is written, which is exactly what such a gate would block (spec §4.2).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class NightActivityDetector implements CharacterDetector {

    private static final LocalTime NIGHT_FROM = LocalTime.MIDNIGHT;
    private static final LocalTime NIGHT_TO = LocalTime.of(5, 0);
    private static final int ALKALMI_MAX = 2;

    @Override
    public String key() {
        return "night-activity";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String summary = "nincs".equals(today.band())
                ? "Az elmúlt két hétben nem írt éjfél és hajnali öt óra között a társnak."
                : "Az elmúlt két hétből " + today.nights()
                        + " napon írt éjfél és hajnali öt között a társnak; ez a chat használatát mutatja, nem az ébrenlét teljes képét.";
        int salience = "rendszeres".equals(today.band()) ? 4 : 2;
        return List.of(new DetectorSignal(key(), "szomnologus", summary, salience));
    }

    private record State(String key, String band, int nights) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        Set<LocalDate> nightDays = new HashSet<>();
        boolean anyChat = false;
        for (LocalDateTime t : in.trend().userChatTimes()) {
            if (!TrailingWindow.inWindow(t.toLocalDate(), asOf)) {
                continue;
            }
            anyChat = true;
            if (!t.toLocalTime().isBefore(NIGHT_FROM) && t.toLocalTime().isBefore(NIGHT_TO)) {
                nightDays.add(t.toLocalDate());
            }
        }
        if (!anyChat) {
            return null;   // the user does not chat at all — silence, not "no night activity"
        }
        int n = nightDays.size();
        String band = n == 0 ? "nincs" : n <= ALKALMI_MAX ? "alkalmi" : "rendszeres";
        return new State("ejszakai:" + band, band, n);
    }
}
```

- [ ] **Step 2: Write `CheckinLatencyDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Check-in latency (round 3, spec §5.10): the median delay between a check-in slot's own nominal
 * time and the moment the row was actually first written.
 *
 * <p>Two source choices are load-bearing and must not be "simplified" later:
 * <ul>
 *   <li>The nominal time comes from {@code slotTime} ON THE ROW, not from {@code notification_schedule}.
 *       That table is replaced wholesale on every save and keeps no history, so using it would
 *       retroactively judge past days against today's schedule.</li>
 *   <li>The actual time comes from {@code createdAt}, not {@code savedAt}: {@code CheckInService.save()}
 *       overwrites {@code savedAt} on every edit, so a check-in corrected a week later would look
 *       like it was filled a week late.</li>
 * </ul>
 *
 * <p>Negative delays are clamped to zero — filling a slot early is punctual, not "minus 40 minutes".
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CheckinLatencyDetector implements CharacterDetector {

    private static final int MIN_CHECKINS = 6;
    private static final long PONTOS_MAX_MIN = 60;
    private static final long KESES_MAX_MIN = 240;

    @Override
    public String key() {
        return "checkin-latency";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newCheckinData(in)) {
            return List.of();
        }
        String today = state(in, in.day());
        String yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = switch (today) {
            case "keses:pontos" -> "A check-ineket jellemzően a saját idősávjuk körül tölti ki.";
            case "keses:keses" -> "A check-inek jellemzően néhány órával a saját idősávjuk után készülnek el.";
            default -> "A check-inek jellemzően jóval a saját idősávjuk után, gyakran a nap későbbi részében készülnek el.";
        };
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }

    private static String state(DetectorInput in, LocalDate asOf) {
        List<Long> delays = new ArrayList<>();
        for (DetectorInput.CheckinSlotPoint p : in.trend().checkinSlots()) {
            if (!TrailingWindow.inWindow(p.date(), asOf) || p.writtenAt().toLocalDate().isAfter(asOf)) {
                continue;
            }
            LocalTime slot = parseSlot(p.slotTime());
            if (slot == null) {
                continue;   // unparseable label — dropped, never guessed
            }
            long minutes = Duration.between(LocalDateTime.of(p.date(), slot), p.writtenAt()).toMinutes();
            delays.add(Math.max(0, minutes));
        }
        if (delays.size() < MIN_CHECKINS) {
            return null;
        }
        delays.sort(Long::compareTo);
        long median = delays.size() % 2 == 1
                ? delays.get(delays.size() / 2)
                : (delays.get(delays.size() / 2 - 1) + delays.get(delays.size() / 2)) / 2;
        String band = median < PONTOS_MAX_MIN ? "pontos" : median <= KESES_MAX_MIN ? "keses" : "kesoi";
        return "keses:" + band;
    }

    private static LocalTime parseSlot(String slotTime) {
        try {
            return slotTime == null ? null : LocalTime.parse(slotTime);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
```

- [ ] **Step 3: Write `CheckinSlotDriftDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Check-in slot drift (round 3, spec §5.11): which time-of-day slot the user has stopped filling.
 * "How late" ({@code checkin-latency}) and "which one dies out" are different behaviours from the
 * same rows, so they are different detectors.
 *
 * <p>Compares two adjacent 14-day windows: a slot that had at least {@link #MIN_BASELINE_ROWS} rows
 * in the earlier one and none in the recent one has dropped out. The state carries the slot LABELS,
 * which are stable identifiers rather than moving counts.
 *
 * <p>No new-data pre-filter: a slot dies out precisely by nobody writing it (spec §4.2).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CheckinSlotDriftDetector implements CharacterDetector {

    private static final int MIN_BASELINE_ROWS = 3;

    @Override
    public String key() {
        return "checkin-slot-drift";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        String today = state(in, in.day());
        String yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = "slot:stabil".equals(today)
                ? "A check-in idősávok használata visszaállt: mindegyik korábban rendszeres sáv újra kap kitöltést."
                : "A korábban rendszeres check-in idősávok közül kiesett: "
                        + today.substring("slot:kikopott:".length()).replace(",", ", ") + ".";
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }

    private static String state(DetectorInput in, LocalDate asOf) {
        LocalDate recentFrom = asOf.minusDays(TrailingWindow.WINDOW_DAYS - 1L);
        LocalDate baselineFrom = recentFrom.minusDays(TrailingWindow.WINDOW_DAYS);

        Map<String, Integer> baseline = new HashMap<>();
        Map<String, Integer> recent = new HashMap<>();
        for (DetectorInput.CheckinSlotPoint p : in.trend().checkinSlots()) {
            if (p.slotTime() == null || p.date().isAfter(asOf)) {
                continue;
            }
            if (!p.date().isBefore(recentFrom)) {
                recent.merge(p.slotTime(), 1, Integer::sum);
            } else if (!p.date().isBefore(baselineFrom)) {
                baseline.merge(p.slotTime(), 1, Integer::sum);
            }
        }
        TreeSet<String> established = new TreeSet<>();
        for (Map.Entry<String, Integer> e : baseline.entrySet()) {
            if (e.getValue() >= MIN_BASELINE_ROWS) {
                established.add(e.getKey());
            }
        }
        if (established.isEmpty()) {
            return null;   // no established habit to have drifted from
        }
        List<String> dropped = new ArrayList<>();
        for (String slot : established) {
            if (!recent.containsKey(slot)) {
                dropped.add(slot);
            }
        }
        return dropped.isEmpty() ? "slot:stabil" : "slot:kikopott:" + String.join(",", dropped);
    }
}
```

- [ ] **Step 4: Write `NeedsDomainImbalanceDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.ToIntFunction;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Needs domain imbalance (round 3, spec §5.12): which of the six Életjel domains stays low while the
 * others are green.
 *
 * <p>The signal is the CONTRAST, not the absolute level: a uniformly hard fortnight is not an
 * imbalance, so a domain counts as weak only when at least {@link #MIN_STRONG_DOMAINS} others are
 * comfortably green. The green line is the domain's own configured threshold, carried in
 * {@code NeedsContext} because a detector may not read configuration.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class NeedsDomainImbalanceDetector implements CharacterDetector {

    private static final int MIN_NEEDS_DAYS = 7;
    private static final double WEAK_SHARE = 0.40;
    private static final double STRONG_SHARE = 0.70;
    private static final int MIN_STRONG_DOMAINS = 3;

    private static final Map<String, ToIntFunction<DetectorInput.NeedsDayPoint>> DOMAINS =
            new LinkedHashMap<>(Map.of());   // populated in the static block below, order matters

    static {
        DOMAINS.put("energia", DetectorInput.NeedsDayPoint::energia);
        DOMAINS.put("hidratáció", DetectorInput.NeedsDayPoint::hidratacio);
        DOMAINS.put("pihenés", DetectorInput.NeedsDayPoint::pihenes);
        DOMAINS.put("mozgás", DetectorInput.NeedsDayPoint::mozgas);
        DOMAINS.put("lélek", DetectorInput.NeedsDayPoint::lelek);
        DOMAINS.put("rend", DetectorInput.NeedsDayPoint::rend);
    }

    @Override
    public String key() {
        return "needs-domain-imbalance";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().needs() == null) {
            return List.of();
        }
        String today = state(in, in.day());
        String yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = "gyenge:nincs".equals(today)
                ? "Az Életjel-területek kiegyensúlyozottak: nincs olyan, amelyik tartósan lemaradna a többitől."
                : "Az Életjel-területek közül tartósan lemarad a többitől: "
                        + today.substring("gyenge:".length()).replace(",", ", ") + ".";
        int salience = "gyenge:nincs".equals(today) ? 2 : 4;
        return List.of(new DetectorSignal(key(), "pszichologus", summary, salience));
    }

    private static String state(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.NeedsDayPoint> window = new ArrayList<>();
        for (DetectorInput.NeedsDayPoint d : in.trend().needs().days()) {
            if (TrailingWindow.inWindow(d.date(), asOf)) {
                window.add(d);
            }
        }
        if (window.size() < MIN_NEEDS_DAYS) {
            return null;
        }
        int threshold = in.trend().needs().greenThreshold();
        Map<String, Double> shares = new LinkedHashMap<>();
        for (Map.Entry<String, ToIntFunction<DetectorInput.NeedsDayPoint>> e : DOMAINS.entrySet()) {
            int green = 0;
            for (DetectorInput.NeedsDayPoint d : window) {
                if (e.getValue().applyAsInt(d) >= threshold) {
                    green++;
                }
            }
            shares.put(e.getKey(), (double) green / window.size());
        }
        long strong = shares.values().stream().filter(s -> s >= STRONG_SHARE).count();
        List<String> weak = new ArrayList<>();
        if (strong >= MIN_STRONG_DOMAINS) {
            for (Map.Entry<String, Double> e : shares.entrySet()) {
                if (e.getValue() < WEAK_SHARE) {
                    weak.add(e.getKey());
                }
            }
        }
        return weak.isEmpty() ? "gyenge:nincs" : "gyenge:" + String.join(",", weak);
    }
}
```

Note: `new LinkedHashMap<>(Map.of())` plus a static block is used because `Map.of` does not preserve
order and the summary must list domains in the Életjel ring's own order. If the reviewer prefers, an
equivalent explicit `LinkedHashMap` initialisation is fine — the ORDER is the requirement.

- [ ] **Step 5: Write the tests**

```java
    private static DetectorInput.CheckinSlotPoint slot(LocalDate d, String slotTime, int hour,
                                                       int minute, String note) {
        return new DetectorInput.CheckinSlotPoint(d, slotTime, d.atTime(hour, minute), note);
    }

    private static DetectorInput.NeedsDayPoint needsDomains(LocalDate d, int lelek) {
        return new DetectorInput.NeedsDayPoint(d, 80, 80, 80, 80, lelek, 80,
                lelek >= 60 ? 6 : 5, lelek >= 60, 1);
    }

    @Test
    void nightActivity_firesOnRegularLateNightChat() {
        List<LocalDateTime> chat = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            chat.add(DAY.minusDays(i).atTime(1, 30));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().chat(chat).build());

        List<DetectorSignal> fired = new NightActivityDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("a chat használatát mutatja");
        assertThat(fired.getFirst().expertKey()).isEqualTo("szomnologus");
    }

    @Test
    void nightActivity_silentWhenTheUserDoesNotChatAtAll() {
        DetectorInput in = trendOnly(DAY, new TrendBuilder().build());

        assertThat(new NightActivityDetector().detect(in)).isEmpty();
    }

    @Test
    void checkinLatency_firesOnLateFilling_andIgnoresEarlyAsPunctual() {
        List<DetectorInput.CheckinSlotPoint> slots = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            slots.add(slot(DAY.minusDays(i), "07:00", 18, 0, null));   // 11 hours late
        }
        List<DetectorInput.CheckinDayPoint> scales = List.of(scale(DAY, "6", "6"));
        DetectorInput in = trendOnly(DAY,
                new TrendBuilder().slots(slots).checkins(scales).build());

        List<DetectorSignal> fired = new CheckinLatencyDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("jóval a saját idősávjuk után");
    }

    @Test
    void checkinSlotDrift_namesTheSlotThatStopped() {
        List<DetectorInput.CheckinSlotPoint> slots = new ArrayList<>();
        for (int i = 14; i < 20; i++) {                 // baseline window
            slots.add(slot(DAY.minusDays(i), "07:00", 7, 5, null));
            slots.add(slot(DAY.minusDays(i), "21:00", 21, 5, null));
        }
        for (int i = 0; i < 6; i++) {                   // recent window: only the evening survives
            slots.add(slot(DAY.minusDays(i), "21:00", 21, 5, null));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().slots(slots).build());

        List<DetectorSignal> fired = new CheckinSlotDriftDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("07:00").doesNotContain("21:00");
    }

    @Test
    void needsDomainImbalance_firesWhenOneDomainLagsWhileTheRestAreGreen() {
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            days.add(needsDomains(DAY.minusDays(i), 20));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        List<DetectorSignal> fired = new NeedsDomainImbalanceDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("lélek");
        assertThat(fired.getFirst().expertKey()).isEqualTo("pszichologus");
    }

    @Test
    void needsDomainImbalance_silentBelowTheClosedDayGate() {
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            days.add(needsDomains(DAY.minusDays(i), 20));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        assertThat(new NeedsDomainImbalanceDetector().detect(in)).isEmpty();
    }

    @Test
    void allTwelveRoundThreeDetectorsHaveDistinctKeysAndValidExperts() {
        List<CharacterDetector> detectors = List.of(new SelfCalibrationDetector(),
                new PromiseVsDeliveryDetector(), new DecisionProfileDetector(),
                new DecisionReviewBacklogDetector(), new GratitudeFocusDetector(),
                new StreakBreakResponseDetector(), new RestartPatternDetector(),
                new RetroLoggingRatioDetector(), new NightActivityDetector(),
                new CheckinLatencyDetector(), new CheckinSlotDriftDetector(),
                new NeedsDomainImbalanceDetector());

        assertThat(detectors).extracting(CharacterDetector::key).doesNotHaveDuplicates().hasSize(12);
    }
```

Before running, sanity-check the two fixtures that carry arithmetic:
`checkinLatency_...` — seven rows, each 11 hours (660 minutes) late, median 660 > 240 → `kesoi`; as of DAY-1 only six rows remain, still `kesoi`, so the state is UNCHANGED and the detector would be silent. **Fix the fixture, not the threshold:** make the six older rows punctual (`slot(..., "07:00", 7, 10, null)`) and only the DAY row late, so the median crosses a band between the two evaluations. Verify the median you expect by hand before running.

- [ ] **Step 6: Run the gate**

```bash
cd backend && ./mvnw test -Dtest='*Character*,DetectorTest' -Dmezo.test.use-testcontainers=true
./mvnw test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 7: Commit**

```bash
git add -A backend/src
git commit -m "feat(character): night-activity, checkin-latency, checkin-slot-drift, needs-domain-imbalance (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: Frontend flip, mocks, documentation

**Files:**
- Modify: `frontend/src/features/character/pages/DetektorokPage.tsx`
- Modify: `frontend/src/features/character/inventory.ts`
- Modify: `frontend/src/data/character/characterMock.ts`
- Modify: `docs/features/character.md`
- Regenerate: `docs/CODEMAP.md`
- Test: the existing `DetektorokPage` / `inventory` / navigation tests

**Interfaces:**
- Consumes: the twelve detector keys, expert owners, and honesty caveats from Tasks 4-6. The catalog lines must match what the detectors ACTUALLY compute — read each detector's javadoc, do not paraphrase this plan.

- [ ] **Step 1: Extend the detector catalog to 32**

Append to `DETECTORS` in `DetektorokPage.tsx`, keeping the file's existing one-line style. The
caveats are not decoration — they are the spec's honesty requirements surfaced to the user:

```ts
  { key: 'self-calibration', who: 'pszichologus', line: 'Együtt mozog-e az önértékelés a mérhető párjával: energia × előző éjszakai alvás, testi × ízületi terheltség. A mentális és a stressz skála kimarad — nincs objektív párjuk.' },
  { key: 'promise-vs-delivery', who: 'drill', line: 'A reggel kitűzött fókuszok és az esti napzárás viszonya — külön a lezárás aránya és a lezárt napok teljesülése.' },
  { key: 'decision-profile', who: 'pszichologus', line: 'A visszanézett döntések 1–5 kimenet-értékelése hat hét alatt; a döntés szövege példaként megy át, elemzés nélkül.' },
  { key: 'decision-review-backlog', who: 'drill', line: 'Hány döntés lépte túl a saját visszanézési határidejét anélkül, hogy átnézték volna.' },
  { key: 'gratitude-focus', who: 'antropologus', line: 'Melyik életterületre húznak a hála-bejegyzések négy hét alatt — a zárt címke alapján, sosem a szövegből.' },
  { key: 'streak-break-response', who: 'pszichologus', line: 'A legutóbbi megszakadt Életjel-sorozat utáni három nap: kaszkádol vagy visszaáll.' },
  { key: 'restart-pattern', who: 'drill', line: 'Mennyi idő telt el a megszakadás és az első újra teljes nap között. A sávok bevallottan heurisztikák — a szakirodalomban nincs validált vágópont.' },
  { key: 'retro-logging-ratio', who: 'drill', line: 'Aznap vagy utólag rögzít — az esemény- és a naplózó bejegyzések külön. Arról szól, mikor íródtak, nem arról, hogy pontosak-e.' },
  { key: 'night-activity', who: 'szomnologus', line: 'Hány napon írt éjfél és hajnali öt között a társnak. Ez a chat használatát bizonyítja, nem az ébrenlét teljes képét.' },
  { key: 'checkin-latency', who: 'drill', line: 'Mennyivel a saját idősávja után készül el a check-in (a soron tárolt idősáv és az első írás között).' },
  { key: 'checkin-slot-drift', who: 'drill', line: 'Melyik korábban rendszeres check-in idősáv kopott ki az elmúlt két hétben.' },
  { key: 'needs-domain-imbalance', who: 'pszichologus', line: 'Melyik Életjel-terület marad tartósan a többi mögött — a kontraszt a jel, nem az alacsony szint önmagában.' },
```

If `DetektorokPage.tsx` carries a header comment stating the catalog size or the round history, update it.

- [ ] **Step 2: Flip the inventory**

In `inventory.ts`:
1. DELETE the entire `n: 3` object from `INVENTORY_ROUNDS`.
2. DELETE the `{ t: 'Életjel-gyűrűk' }` row from the `n: 4` object — round 3 pulled it forward via `needs-domain-imbalance`, so leaving it would misreport what is still planned.
3. APPEND to `INVENTORY_READS`:

```ts
  { w: 'Napi fókusz + napzárás (kreed-hurok)', chips: ['8 hét'] },
  { w: 'Döntésnapló (kimenet-értékelés, visszanézési határidő)', chips: ['teljes előzmény'] },
  { w: 'Hála-bejegyzések (életterület-címke)', chips: ['8 hét'] },
  { w: 'Életjel-napok (hat terület, streak-pillanatkép)', chips: ['8 hét'] },
  { w: 'Check-in sorok (idősáv, első írás ideje, jegyzet)', chips: ['8 hét'] },
  { w: 'Naplózási latencia (a nap vs. mikor íródott)', chips: ['14 nap', '10 forrás'] },
  { w: 'Chat-időbélyegek (saját üzenetek)', chips: ['14 nap'] },
```

4. Extend the file's header comment with the round-3 paragraph, in the same voice as the round-1 and round-2 sentences already there, and update the "20 real detectors" figure to 32.

- [ ] **Step 3: Add twelve mock chains**

Add one `CHAIN_POOL` seed per new detector, following the file's rules exactly: `refs: []` (production signals never carry refIds), the REAL `who` from the detector source, and numbers consistent with the real thresholds. Read the detector class before writing each line — a mock whose narrative contradicts its own numbers was a round-2 review finding, and it was found in exactly this file. Concretely: a `night-activity` seed claiming "rendszeres" must name at least 3 nights; a `gratitude-focus` seed must have the dominant area at half or more of the tagged entries; a `needs-domain-imbalance` seed must name a domain and imply at least three others green.

- [ ] **Step 4: Update the domain doc**

In `docs/features/character.md`:
- detector catalog table: add the twelve rows with their real owners.
- a round-3 subsection in the read-widening section: the six new sources, the two new one-way ArchUnit edges (`character → intention`, `character → needs`), and the three read traps (`savedAt`, `notification_schedule` history, `GamificationProfileEntity` history).
- the gate section: record the round-3 rule that a new-data pre-filter is wrong where absence is the signal, and which detectors therefore have none.
- §9 ledger: shrink it by what this round delivered.

- [ ] **Step 5: Regenerate the codemap**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
node scripts/lint-docs.mjs --errors-only
```
Both must pass. Use `--errors-only` exactly: the bare form fails on a pre-existing stale-doc baseline that also exists on origin/main and is NOT a merge blocker.

- [ ] **Step 6: Run the frontend gates in BOTH modes**

```bash
cd frontend
pnpm test
VITE_USE_MOCK=false pnpm test
pnpm build
```
`VITE_USE_MOCK` unset means MOCK mode — a bare `pnpm test` runs mock twice and leaves the real-mode gate vacuous, so both commands are required. If a test asserts the detector count, derive it from the rendered DOM against `DETECTORS.length` rather than hard-coding 32.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src docs
git commit -m "feat(character): flip the round-3 inventory, 32-detector catalog, docs (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final verification (controller, before the PR)

Run every gate once more on the finished branch, because the tasks landed incrementally:

```bash
cd backend && ./mvnw test -Dtest='*Character*,DetectorTest' -Dmezo.test.use-testcontainers=true
cd backend && ./mvnw test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true
cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only
```

Then push, open the self-PR, and wait for CI. **If CI's lint job reports a stale CODEMAP while it is
green locally,** origin/main has moved: pull_request CI runs on the test-MERGE ref. Merge origin/main
into the branch, regenerate the codemap, and re-run ALL the gates on the merged tree — a clean textual
merge can still break things semantically.
