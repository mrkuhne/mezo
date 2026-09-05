package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SportSlotSkipPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.List;
import java.util.UUID;
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

    @Test
    void testHasScheduledTrainingOn_shouldReturnFalse_whenTheOnlyScheduledThingIsASkippedSportSlot() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);          // Wednesday → dayOfWeek index 2
        train.createScheduleSlot(owner, 2, "17:00", 60, "training");
        skips.createSkip(owner, 2, "17:00", wed);

        assertThat(service.hasScheduledTrainingOn(owner, wed)).isFalse();
    }

    @Test
    void testHasScheduledTrainingOn_shouldReturnTrue_whenASkippedSportSlotCoexistsWithAGymSlot() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createScheduleSlot(owner, 2, "17:00", 60, "training");
        skips.createSkip(owner, 2, "17:00", wed);
        train.createGymSlot(owner, 2, "09:00");

        assertThat(service.hasScheduledTrainingOn(owner, wed)).isTrue();
    }

    @Test
    void testHasScheduledTrainingOn_shouldReturnTrue_whenASkippedSportSlotCoexistsWithAOneOffSportEvent() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createScheduleSlot(owner, 2, "17:00", 60, "training");
        skips.createSkip(owner, 2, "17:00", wed);
        train.createSportEvent(owner, wed, "19:30", 120);

        assertThat(service.hasScheduledTrainingOn(owner, wed)).isTrue();
    }

    /**
     * mezo-jcpt.6: the ranged {@code windowsFor(userId, from, to)} must return EXACTLY what calling
     * the single-date overload once per date would — same windows, same {@code done} — even though
     * it sources every field from range-batched queries instead. One user seeded with every kind of
     * window this class exercises elsewhere (gym w/ a partially-done multi-slot day, a sport
     * session consuming a one-off event, an untouched recurring sport slot, a skipped occurrence on
     * one date but not the next, and a prescribed run) over a week that spans two running-block
     * weeks, so the range genuinely exercises multiple distinct days' worth of every branch.
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
}
