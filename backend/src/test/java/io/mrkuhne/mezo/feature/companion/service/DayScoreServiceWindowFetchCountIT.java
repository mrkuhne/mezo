package io.mrkuhne.mezo.feature.companion.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * mezo-jcpt.6 (found reviewing mezo-jcpt.4): {@code DayScoreService.rhythmFreeInputs} used to call
 * {@link WorkoutWindowQueryService#windowsFor(UUID, LocalDate)} once per date in the loaded
 * window — 7 rendered days + 7 rhythm-window priors = 14 calls for one week's {@code scores},
 * each repeating the user's ENTIRE gym-slot query and the running-block query even though both
 * are user-global and identical across all 14 dates. The fix is the RANGED {@link
 * WorkoutWindowQueryService#windowsFor(UUID, LocalDate, LocalDate)} overload: one call for the
 * whole window. This test pins that shape directly — a regression back to the per-date loop
 * turns both assertions red (the ranged call stops happening exactly once, or the per-date
 * overload starts getting called again).
 *
 * <p>Own IT class — the {@code @MockitoSpyBean} forks the application context (the {@code
 * MeWeekServiceFuelFetchCountIT} precedent), so it must not leak into {@code DayScoreServiceIT}'s
 * non-spy context.
 */
@ActiveProfiles("companion-fake")
class DayScoreServiceWindowFetchCountIT extends AbstractIntegrationTest {

    /** Deliberately far in the past so every day of the window is {@code closed}. */
    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 15);
    private static final LocalDate SUNDAY = MONDAY.plusDays(6);

    @Autowired private DayScoreService dayScoreService;
    @Autowired private UserPopulator userPopulator;
    @MockitoSpyBean private WorkoutWindowQueryService workoutWindowQueryService;

    @Test
    void weekReadFetchesWorkoutWindowsOnceForTheWholeRange_notOncePerDate() {
        UUID owner = userPopulator.createUser().getId();
        // scores(from, to) loads [from - rhythmWindowDays, to]; MONDAY..SUNDAY spans a 7-day
        // rendered range plus its 7-day rhythm-window prior — the 14-call fan-out the issue named.
        LocalDate loadedFrom = MONDAY.minusDays(7);

        dayScoreService.scores(owner, MONDAY, SUNDAY);

        verify(workoutWindowQueryService, times(1))
            .windowsFor(eq(owner), eq(loadedFrom), eq(SUNDAY));
        verify(workoutWindowQueryService, never()).windowsFor(eq(owner), any());
    }
}
