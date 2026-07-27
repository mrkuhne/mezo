package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
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
