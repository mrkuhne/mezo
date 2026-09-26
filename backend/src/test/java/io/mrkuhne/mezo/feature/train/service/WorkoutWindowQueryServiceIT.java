package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.goal.engine.service.TdeeBootstrapService;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SportSlotSkipPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class WorkoutWindowQueryServiceIT extends AbstractIntegrationTest {

    @Autowired private WorkoutWindowQueryService service;
    @Autowired private TrainPopulator train;
    @Autowired private RunningPopulator running;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private SportSlotSkipPopulator skips;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testWindowsFor_shouldReturnGymWindow_whenSlotOnThatWeekday() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);      // Wednesday → dayOfWeek index 2
        train.createGymSlot(owner, 2, "14:30");

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().start()).isEqualTo(LocalTime.of(14, 30));
        assertThat(windows.getFirst().kind()).isEqualTo("gym");
        assertThat(windows.getFirst().done()).isFalse();   // no completed instance seeded
    }

    @Test
    void testWindowsFor_shouldReturnEmpty_whenNoSlotOnThatWeekday() {
        UUID owner = owner();
        train.createGymSlot(owner, 2, "14:30");                 // Wednesday slot
        LocalDate thu = LocalDate.of(2026, 6, 25);              // Thursday → index 3
        assertThat(service.windowsFor(owner, thu)).isEmpty();
    }

    @Test
    void testWindowsFor_shouldLabelTheGymWindow_withThePlannedTemplateDaysType() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);          // Wednesday → HU day label "Sze"
        train.createGymSlot(owner, 2, "18:00");
        var meso = train.createActiveMeso(owner);
        train.createWorkoutSession(owner, meso.getId(), "Sze", "Pull", 0, "active");

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().label()).isEqualTo("Pull");
    }

    @Test
    void testWindowsFor_shouldLeaveTheGymLabelNull_whenNoTemplateDayIsPlanned() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createGymSlot(owner, 2, "18:00");             // slot without an active meso day

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().label()).isNull();    // nothing names it — never invented
    }

    @Test
    void testWindowsFor_shouldLabelTheSportWindow_withTheSportName() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createSportSession(owner, wed);               // sport defaults to "volleyball"

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().label()).isEqualTo("volleyball");
    }

    @Test
    void testWindowsFor_shouldLabelTheRunWindow_withThePrescribedSessionLabel() {
        UUID owner = owner();
        LocalDate start = LocalDate.of(2026, 6, 16);
        LocalDate wedOfWeek2 = LocalDate.of(2026, 6, 24);
        running.createBlockAnchored(owner, start, 8, 3, 2, 2, "18:00");

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wedOfWeek2);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().label()).isEqualTo("Sprint-intervallum");
    }

    @Test
    void testWindowsFor_shouldMarkNoGymSlotDone_whenOneOfTwoSlotsWasCompleted() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createGymSlot(owner, 2, "09:00");
        train.createGymSlot(owner, 2, "18:00");
        var meso = train.createActiveMeso(owner);
        train.createWorkoutInstance(owner,
            train.createTemplateDay(owner, meso.getId(), "Sze reggel"), wed, "completed");

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        // A gym instance carries no clock time, so a single done cannot be pinned to either slot —
        // neither gets the recovery bonus rather than one of them getting it wrongly.
        assertThat(windows).hasSize(2);
        assertThat(windows).noneMatch(WorkoutWindowQueryService.Window::done);
    }

    @Test
    void testWindowsFor_shouldMarkEveryGymSlotDone_whenDoneInstancesCoverAllSlots() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createGymSlot(owner, 2, "09:00");
        train.createGymSlot(owner, 2, "18:00");
        var meso = train.createActiveMeso(owner);
        train.createWorkoutInstance(owner,
            train.createTemplateDay(owner, meso.getId(), "Sze reggel"), wed, "completed");
        train.createWorkoutInstance(owner,
            train.createTemplateDay(owner, meso.getId(), "Sze este"), wed, "completed");

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(2);
        assertThat(windows).allMatch(WorkoutWindowQueryService.Window::done);
    }

    @Test
    void testWindowsFor_shouldReturnSportWindowFromSession_whenNoRecurringSlotThatWeekday() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createSportSession(owner, wed);       // 18:15, 90 min — logged, no schedule slot

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().kind()).isEqualTo("sport");
        assertThat(windows.getFirst().start()).isEqualTo(LocalTime.of(18, 15));
        assertThat(windows.getFirst().end()).isEqualTo(LocalTime.of(19, 45));
        assertThat(windows.getFirst().done()).isTrue();
    }

    @Test
    void testWindowsFor_shouldPreferTheSessionTime_whenTheDayAlsoHasARecurringSlot() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createScheduleSlot(owner, 2, "17:00", 60, "training");
        train.createSportSession(owner, wed);       // actually played 18:15 for 90 min

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);             // the session IS that slot, played later
        assertThat(windows.getFirst().start()).isEqualTo(LocalTime.of(18, 15));
        assertThat(windows.getFirst().end()).isEqualTo(LocalTime.of(19, 45));
        assertThat(windows.getFirst().done()).isTrue();
    }

    @Test
    void testWindowsFor_shouldMatchTheSessionToTheNearestSlot_whenTheDayHasTwoSportSlots() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createScheduleSlot(owner, 2, "09:00", 60, "training");
        train.createScheduleSlot(owner, 2, "18:00", 90, "match");
        train.createSportSession(owner, wed);       // played 18:15 → that is the evening slot

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(2);
        assertThat(windows).anySatisfy(w -> {
            assertThat(w.start()).isEqualTo(LocalTime.of(9, 0));    // morning: planned, not played
            assertThat(w.done()).isFalse();
        });
        assertThat(windows).anySatisfy(w -> {
            assertThat(w.start()).isEqualTo(LocalTime.of(18, 15));  // evening: the played session
            assertThat(w.done()).isTrue();
        });
    }

    @Test
    void testWindowsFor_shouldReturnSportWindowFromOneOffEvent_whenEventOnDate() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createSportEvent(owner, wed, "19:30", 120);   // one-off match, not played yet

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().kind()).isEqualTo("sport");
        assertThat(windows.getFirst().start()).isEqualTo(LocalTime.of(19, 30));
        assertThat(windows.getFirst().end()).isEqualTo(LocalTime.of(21, 30));
        assertThat(windows.getFirst().done()).isFalse();
    }

    @Test
    void testWindowsFor_shouldNotReturnOneOffEvent_whenQueriedForAnotherDate() {
        UUID owner = owner();
        train.createSportEvent(owner, LocalDate.of(2026, 6, 24), "19:30", 120);

        assertThat(service.windowsFor(owner, LocalDate.of(2026, 6, 25))).isEmpty();
    }

    @Test
    void testWindowsFor_shouldConsumeTheOneOffEvent_whenTheSessionWasPlayedNearItsTime() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createScheduleSlot(owner, 2, "09:00", 60, "training");
        train.createSportEvent(owner, wed, "18:00", 90);    // one-off near the played 18:15
        train.createSportSession(owner, wed);               // played 18:15 for 90 min

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(2);
        assertThat(windows).anySatisfy(w -> {
            assertThat(w.start()).isEqualTo(LocalTime.of(9, 0));    // recurring slot: planned, not played
            assertThat(w.done()).isFalse();
        });
        assertThat(windows).anySatisfy(w -> {
            assertThat(w.start()).isEqualTo(LocalTime.of(18, 15));  // the played one-off event
            assertThat(w.done()).isTrue();
        });
    }

    @Test
    void testWindowsFor_shouldReturnRunWindow_whenStoredCurrentWeekIsStale() {
        UUID owner = owner();
        LocalDate start = LocalDate.of(2026, 6, 16);        // Tue — week 1 = 06-16..06-22
        LocalDate wedOfWeek2 = LocalDate.of(2026, 6, 24);   // Wed of week 2 → dayOfWeek index 2
        running.createBlockAnchored(owner, start, 8, 3, 2, 2, "18:00");  // stale currentWeek = 3

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wedOfWeek2);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().kind()).isEqualTo("run");
        assertThat(windows.getFirst().start()).isEqualTo(LocalTime.of(18, 0));
        assertThat(windows.getFirst().end()).isEqualTo(LocalTime.of(18, 45));  // runDefaultMinutes
        assertThat(windows.getFirst().done()).isFalse();                       // run windows are pre-only in v1
    }

    @Test
    void testWindowsFor_shouldReturnEmpty_whenPrescribedWeekHasNullSessions() {
        UUID owner = owner();
        LocalDate start = LocalDate.of(2026, 6, 16);     // week 1 contains the start date itself
        running.createBlockWithStructure(owner, start, 8, new RunningBlockStructure(
            List.of(new RunningBlockStructure.RunWeek(1, "Alapozás", null))));

        assertThat(service.windowsFor(owner, start)).isEmpty();
    }

    @Test
    void testWindowsFor_shouldMarkGymDone_whenCompletedInstanceOnDate() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createGymSlot(owner, 2, "09:00");
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Sze");
        train.createWorkoutInstance(owner, day, wed, "completed");

        var windows = service.windowsFor(owner, wed);
        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().done()).isTrue();
    }

    @Test
    void testWindowsFor_shouldNotReturnSportWindow_whenTheSlotOccurrenceIsSkippedOnThatDate() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);          // Wednesday → dayOfWeek index 2
        train.createScheduleSlot(owner, 2, "17:00", 60, "training");
        skips.createSkip(owner, 2, "17:00", wed);

        assertThat(service.windowsFor(owner, wed)).isEmpty();
    }

    @Test
    void testWindowsFor_shouldStillReturnSportWindow_onADifferentDateTheSameSlotIsNotSkipped() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);          // Wednesday → dayOfWeek index 2
        LocalDate nextWed = LocalDate.of(2026, 7, 1);       // same weekday, different date
        train.createScheduleSlot(owner, 2, "17:00", 60, "training");
        skips.createSkip(owner, 2, "17:00", wed);           // only this date's occurrence is skipped

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, nextWed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().kind()).isEqualTo("sport");
        assertThat(windows.getFirst().start()).isEqualTo(LocalTime.of(17, 0));
    }

    // hasLoggedTrainingOn is deleted (mezo-32m82) — movementOn(...).plannedDone() replaces it. A
    // logged session on a slotless day now reads plannedDone=false (spec D2/D3): a planned
    // session is already priced into the weekly base, so only PLANNED adherence — not any logged
    // movement — is allowed to flip the day-type kcal pick; an unplanned (extra) session's energy
    // is credited separately via extraKcal, never by pretending the day was "planned".

    @Test
    void testMovementOn_shouldReadPlannedDoneFalse_whenTheDayIsOnlyPlanned() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);          // Wednesday → dayOfWeek index 2
        train.createGymSlot(owner, 2, "09:00");
        train.createScheduleSlot(owner, 2, "17:00", 60, "training");
        train.createSportEvent(owner, wed, "19:30", 120);

        assertThat(service.movementOn(owner, wed).plannedDone()).isFalse();
    }

    @Test
    void testMovementOn_shouldReadPlannedDoneTrue_whenAGymWorkoutWasCompletedThatDay() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createGymSlot(owner, 2, "09:00");
        UUID mesoId = train.createActiveMeso(owner).getId();
        WorkoutSessionEntity template = train.createTemplateDay(owner, mesoId, "Sze");
        train.createWorkoutInstance(owner, template, wed, "completed");

        assertThat(service.movementOn(owner, wed).plannedDone()).isTrue();
    }

    @Test
    void testMovementOn_shouldReadPlannedDoneFalse_whenTheGymWorkoutIsStillInProgress() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createGymSlot(owner, 2, "09:00");
        UUID mesoId = train.createActiveMeso(owner).getId();
        WorkoutSessionEntity template = train.createTemplateDay(owner, mesoId, "Sze");
        train.createWorkoutInstance(owner, template, wed, "active");

        // Not-done (only completed instances are ever read) — and an in-progress instance adds
        // no extra kcal either, so the whole day reads as untouched.
        assertThat(service.movementOn(owner, wed)).isEqualTo(WorkoutWindowQueryService.DayMovement.NONE);
    }

    @Test
    void testMovementOn_shouldReadPlannedDoneFalse_whenASportSessionWasLoggedOnASlotlessDay() {
        // spec D2/D3: a slotless day has no plan to fulfil — the session is EXTRA, not planned.
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createSportSession(owner, wed, 90);

        assertThat(service.movementOn(owner, wed).plannedDone()).isFalse();
        assertThat(service.movementOn(owner, wed.plusDays(1))).isEqualTo(WorkoutWindowQueryService.DayMovement.NONE);
    }

    @Test
    void testMovementOn_shouldReadPlannedDoneTrue_whenARunWasLoggedAgainstAPrescribedSessionThatDay() {
        UUID owner = owner();
        LocalDate start = LocalDate.of(2026, 6, 16);
        LocalDate wedOfWeek2 = LocalDate.of(2026, 6, 24);
        UUID blockId = running.createBlockAnchored(owner, start, 8, 3, 2, 2, "18:00").getId();
        running.createRunLog(owner, blockId, 2, "w2-sprint", wedOfWeek2, 6, 8, null, null, 30);

        assertThat(service.movementOn(owner, wedOfWeek2).plannedDone()).isTrue();
    }

    /**
     * mezo-jcpt.6 F2: a sport session with NO clock time must sort LAST among the day's sessions —
     * matching Postgres's {@code ORDER BY time ASC} default ({@code NULLS LAST}) that the old
     * single-date finder relied on. With one plan (a 09:00 slot) and two sessions — one AT 09:00,
     * one with no time — the timed session must be resolved first and consume the only plan; the
     * timeless one, processed after, has nothing left to borrow a time from and contributes no
     * window (never a fabricated one). Sorting nulls FIRST instead (the bug this pins) would let
     * the timeless session consume the plan instead, changing both the window count and which
     * session's label survives — silently, since no populator ever left {@code time} null before
     * this test, so nothing else in this suite could catch it.
     */
    @Test
    void testWindowsFor_shouldResolveTheTimedSessionBeforeTheTimelessOne_whenBothCouldConsumeTheSamePlan() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);          // Wednesday → dayOfWeek index 2
        train.createScheduleSlot(owner, 2, "09:00", 60, "training");
        train.createSportSessionAt(owner, wed, "09:00", 60);   // timed: must consume the plan
        train.createSportSessionNoTime(owner, wed, 45);        // timeless: sorts after, finds nothing

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().start()).isEqualTo(LocalTime.of(9, 0));
        assertThat(windows.getFirst().done()).isTrue();
    }

    /**
     * mezo-jcpt.6: the ranged {@code windowsFor(userId, from, to)} must return EXACTLY what calling
     * the single-date overload once per date would — same windows, same {@code done}. Now a
     * tautology at the code level (F1: the single-date overload delegates straight into this one),
     * but kept as a BEHAVIORAL pin: it still fixes the observable contract (one window set per date
     * in range, matching the day-by-day reading) against any future change that reintroduces two
     * diverging resolution paths. One user seeded with every kind of window this class exercises
     * elsewhere (gym w/ a partially-done multi-slot day, a sport session consuming a one-off event,
     * an untouched recurring sport slot, a skipped occurrence on one date but not the next, and a
     * prescribed run) over a week that spans two running-block weeks, so the range genuinely
     * exercises multiple distinct days' worth of every branch.
     */
    @Test
    void testWindowsFor_ranged_shouldMatchCallingTheSingleDateOverloadForEveryDayInTheRange() {
        UUID owner = owner();
        LocalDate monday = LocalDate.of(2026, 6, 22);       // Mon → dayOfWeek index 0
        LocalDate wed = LocalDate.of(2026, 6, 24);          // Wed → dayOfWeek index 2
        LocalDate sunday = monday.plusDays(6);

        // Gym: two Wednesday slots, only one completed → neither reads done.
        train.createGymSlot(owner, 2, "09:00");
        train.createGymSlot(owner, 2, "18:00");
        var meso = train.createActiveMeso(owner);
        train.createWorkoutInstance(owner,
            train.createTemplateDay(owner, meso.getId(), "Sze reggel"), wed, "completed");

        // Sport: a recurring Wednesday slot the session doesn't touch, plus a one-off event the
        // logged session consumes.
        train.createScheduleSlot(owner, 2, "09:00", 60, "training");
        train.createSportEvent(owner, wed, "18:00", 90);
        train.createSportSession(owner, wed);               // played 18:15/90 min, consumes the event

        // Skip: only this week's Thursday occurrence — the recurring slot still applies on other
        // Thursdays (a range read must not smear one date's skip across the whole week).
        train.createScheduleSlot(owner, 3, "17:00", 45, "match");
        skips.createSkip(owner, 3, "17:00", wed.plusDays(1));

        // Run: prescribed session anchored so it lands within this range.
        running.createBlockAnchored(owner, monday.minusDays(7), 8, 3, 2, 2, "06:30");

        Map<LocalDate, List<WorkoutWindowQueryService.Window>> ranged =
            service.windowsFor(owner, monday, sunday);

        assertThat(ranged.keySet()).hasSize(7);
        for (LocalDate day = monday; !day.isAfter(sunday); day = day.plusDays(1)) {
            assertThat(ranged.getOrDefault(day, List.of()))
                .as("windows on %s", day)
                .containsExactlyInAnyOrderElementsOf(service.windowsFor(owner, day));
        }
    }

    /**
     * {@code movementOn} (mezo-32m82, spec §5): was the day's PLANNED training done, and how many
     * kcal of UNPLANNED movement did it hold. Replaces {@code hasLoggedTrainingOn}.
     */
    @Nested
    class MovementOn {

        @Autowired private BiometricProfilePopulator biometricProfilePopulator;
        @Autowired private WeightLogPopulator weightLogPopulator;
        @Autowired private TdeeBootstrapService tdeeBootstrapService;

        /** The prototype-default profile (M, born 1991-03-01, 15% body fat) plus one weigh-in
         *  (mirrors {@code SportServiceIT#seedBody}). */
        private BiometricProfileEntity seedBody(UUID owner, String weightKg) {
            BiometricProfileEntity profile = biometricProfilePopulator.create(owner);
            weightLogPopulator.createWeightLog(owner, LocalDate.parse("2026-05-30"), new BigDecimal(weightKg));
            return profile;
        }

        // (a) A Wednesday with a volleyball slot and one logged volleyball session with kcal 480
        // → plannedDone=true, extraKcal=0.
        @Test
        void testMovementOn_shouldReadPlannedDoneTrueAndNoExtra_whenTheOnlyLoggedSessionMatchesTheSlot() {
            UUID owner = owner();
            LocalDate wed = LocalDate.of(2026, 6, 24);          // Wednesday → dayOfWeek index 2
            train.createScheduleSlot(owner, 2, "18:00", 90, "training");
            train.withKcal(train.createSportSession(owner, wed), 480);   // 18:15/90 min, volleyball

            WorkoutWindowQueryService.DayMovement m = service.movementOn(owner, wed);

            assertThat(m.plannedDone()).isTrue();
            assertThat(m.extraKcal()).isZero();
        }

        // (b) A Saturday with no slots and a logged volleyball session with kcal 573 →
        // plannedDone=false, extraKcal=573.
        @Test
        void testMovementOn_shouldReadPlannedDoneFalseAndFullExtra_whenNoSlotExistsThatWeekday() {
            UUID owner = owner();
            LocalDate sat = LocalDate.of(2026, 6, 27);          // Saturday → dayOfWeek index 5
            train.withKcal(train.createSportSession(owner, sat), 573);

            WorkoutWindowQueryService.DayMovement m = service.movementOn(owner, sat);

            assertThat(m.plannedDone()).isFalse();
            assertThat(m.extraKcal()).isEqualTo(573);
        }

        // (c) A Wednesday with one volleyball slot and two logged sessions (kcal 480, 300) →
        // plannedDone=true, extraKcal=300. The later one is extra because the first consumes the plan.
        @Test
        void testMovementOn_shouldChargeOnlyTheUnmatchedSession_whenTwoSessionsCompeteForOneSlot() {
            UUID owner = owner();
            LocalDate wed = LocalDate.of(2026, 6, 24);
            train.createScheduleSlot(owner, 2, "18:00", 90, "training");
            train.withKcal(train.createSportSessionAt(owner, wed, "18:00", 90), 480);  // consumes the plan
            train.withKcal(train.createSportSessionAt(owner, wed, "20:00", 60), 300);  // extra

            WorkoutWindowQueryService.DayMovement m = service.movementOn(owner, wed);

            assertThat(m.plannedDone()).isTrue();
            assertThat(m.extraKcal()).isEqualTo(300);
        }

        // (d) A Monday with a gym slot, a completed meso instance and a completed custom instance
        // with activeSeconds=3600 → plannedDone=true. extraKcal = round(2.5 × bmr/24).
        @Test
        void testMovementOn_shouldChargeOnlyTheCustomInstance_whenAMesoAndACustomInstanceBothCompletedThatDay() {
            UUID owner = owner();
            LocalDate monday = LocalDate.of(2026, 6, 22);       // Monday → dayOfWeek index 0
            BiometricProfileEntity profile = seedBody(owner, "80.00");
            train.createGymSlot(owner, 0, "09:00");

            UUID mesoId = train.createActiveMeso(owner).getId();
            WorkoutSessionEntity mesoTemplate = train.createTemplateDay(owner, mesoId, "Hét");
            train.createWorkoutInstance(owner, mesoTemplate, monday, "completed");

            WorkoutSessionEntity customTemplate = train.createCustomTemplateDay(owner, "Saját");
            train.createWorkoutInstance(owner, customTemplate, monday, "completed", 3600);

            // Independent of ActivityEnergyModel#netKcal (the code under test): the brief's own
            // formula, extraKcal = round(2.5 × bmr/24) — 2.5 = the gym MODERATE MET (3.5) − 1,
            // moderate because a null RPE always bands moderate (global constraints §Bands).
            BigDecimal bmr = tdeeBootstrapService.bmr(profile, new BigDecimal("80.00"));
            int expectedExtra = bmr.multiply(new BigDecimal("2.5"))
                .divide(BigDecimal.valueOf(24), MathContext.DECIMAL64)
                .setScale(0, RoundingMode.HALF_UP)
                .intValueExact();

            WorkoutWindowQueryService.DayMovement m = service.movementOn(owner, monday);

            assertThat(m.plannedDone()).isTrue();
            assertThat(m.extraKcal()).isEqualTo(expectedExtra);
        }

        // (e) A skipped slot (sport-slot skip on that date) plus a logged session → extra.
        @Test
        void testMovementOn_shouldTreatTheSessionAsExtra_whenItsSlotIsSkippedOnThatDate() {
            UUID owner = owner();
            LocalDate wed = LocalDate.of(2026, 6, 24);
            train.createScheduleSlot(owner, 2, "17:00", 60, "training");
            skips.createSkip(owner, 2, "17:00", wed);
            train.withKcal(train.createSportSession(owner, wed), 400);

            WorkoutWindowQueryService.DayMovement m = service.movementOn(owner, wed);

            assertThat(m.plannedDone()).isFalse();
            assertThat(m.extraKcal()).isEqualTo(400);
        }

        // (f) Nothing logged → DayMovement.NONE-equal.
        @Test
        void testMovementOn_shouldEqualNone_whenNothingWasLoggedOrPlanned() {
            UUID owner = owner();
            LocalDate wed = LocalDate.of(2026, 6, 24);

            assertThat(service.movementOn(owner, wed)).isEqualTo(WorkoutWindowQueryService.DayMovement.NONE);
        }

        // (h) movementBetween (the batched path movementOn now delegates to) over a 7-day range must
        // equal per-day movementOn for a mixed fixture: a planned sport day, an unplanned Saturday
        // session, a custom gym day, and empty days.
        @Test
        void testMovementBetween_shouldMatchPerDayMovementOn_forAMixedWeek() {
            UUID owner = owner();
            LocalDate monday = LocalDate.of(2026, 6, 22);
            LocalDate wed = monday.plusDays(2);
            LocalDate sat = monday.plusDays(5);
            LocalDate sunday = monday.plusDays(6);
            seedBody(owner, "80.00");
            // Monday: a custom gym day (no gym slot) → extra via the net model.
            train.createWorkoutInstance(owner, train.createCustomTemplateDay(owner, "Saját"), monday,
                "completed", 3600);
            // Wednesday: a volleyball slot the logged session fulfils → planned.
            train.createScheduleSlot(owner, 2, "18:00", 90, "training");
            train.withKcal(train.createSportSession(owner, wed), 480);
            // Saturday: an unplanned session → extra at its persisted kcal.
            int satKcal = 573;
            train.withKcal(train.createSportSession(owner, sat), satKcal);

            Map<LocalDate, WorkoutWindowQueryService.DayMovement> ranged =
                service.movementBetween(owner, monday, sunday);

            assertThat(ranged.keySet()).hasSize(7);
            for (LocalDate day = monday; !day.isAfter(sunday); day = day.plusDays(1)) {
                assertThat(ranged.get(day)).as("movement on %s", day).isEqualTo(service.movementOn(owner, day));
            }
            assertThat(ranged.get(monday).plannedDone()).isFalse();
            assertThat(ranged.get(monday).extraKcal()).isPositive();
            assertThat(ranged.get(wed)).isEqualTo(new WorkoutWindowQueryService.DayMovement(true, 0));
            assertThat(ranged.get(sat)).isEqualTo(new WorkoutWindowQueryService.DayMovement(false, satKcal));
            assertThat(ranged.get(monday.plusDays(1))).isEqualTo(WorkoutWindowQueryService.DayMovement.NONE);
        }

        // (g) A logged session with null kcal on a slotless day → plannedDone=false, extraKcal=0.
        @Test
        void testMovementOn_shouldNeverInventKcal_whenTheExtraSessionCarriesNoKcal() {
            UUID owner = owner();
            LocalDate wed = LocalDate.of(2026, 6, 24);
            train.createSportSession(owner, wed);   // no kcal set — null, honest-null

            WorkoutWindowQueryService.DayMovement m = service.movementOn(owner, wed);

            assertThat(m.plannedDone()).isFalse();
            assertThat(m.extraKcal()).isZero();
        }
    }
}
