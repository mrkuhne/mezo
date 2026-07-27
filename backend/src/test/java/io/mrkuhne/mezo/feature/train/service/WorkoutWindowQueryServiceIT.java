package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
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
    void testWindowsFor_shouldReturnRunWindow_whenStoredCurrentWeekIsStale() {
        UUID owner = owner();
        LocalDate start = LocalDate.of(2026, 6, 16);        // Tue — week 1 = 06-16..06-22
        LocalDate wedOfWeek2 = LocalDate.of(2026, 6, 24);   // Wed of week 2 → dayOfWeek index 2
        running.createBlockAnchored(owner, start, 8, 3, 2, 2, "18:00");  // stale currentWeek = 3

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wedOfWeek2);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().kind()).isEqualTo("run");
        assertThat(windows.getFirst().start()).isEqualTo(LocalTime.of(18, 0));
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
}
