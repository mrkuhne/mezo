package io.mrkuhne.mezo.feature.companion.service;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * B1 (mezo-8tp8): {@code MeWeekService.week} used to fetch each day's {@link
 * FuelDayService#getDay} TWICE — once for {@code buildDay}'s own display fields, once more inside
 * {@code DayScoreService.fuelSubscore} — for every day of the rendered week. After the fix,
 * {@code MeWeekService} fetches the rollup once per day and hands it into {@code DayScoreService}'s
 * pre-fetched {@code scores(userId, from, to, fuelDayByDate)} overload, so {@code getDay} is called
 * EXACTLY once per date in the rendered week. (The previous-week score no longer runs a second
 * score pass at all since mezo-d20.7.5 — it comes from the persisted {@code weekly_score} cache,
 * and a previous week with no logs at all is answered by one freshness probe with zero fuel
 * fetches. Either way that window is out of scope for this count.)
 *
 * <p>Own IT class — the {@code @MockitoSpyBean} forks the application context (the
 * {@code ChatServiceGraphBlockFailureIT} precedent), so it must not leak into
 * {@code MeWeekControllerIT}'s / {@code DayScoreServiceIT}'s non-spy contexts.
 */
@ActiveProfiles("companion-fake")
class MeWeekServiceFuelFetchCountIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 15);

    @Autowired private MeWeekService meWeekService;
    @Autowired private UserPopulator userPopulator;
    @MockitoSpyBean private FuelDayService fuelDayService;

    @Test
    void weekFetchesEachDaysFuelRollupExactlyOnce() {
        UUID owner = userPopulator.createUser().getId();

        meWeekService.week(owner, MONDAY);

        for (LocalDate day = MONDAY; !day.isAfter(MONDAY.plusDays(6)); day = day.plusDays(1)) {
            verify(fuelDayService, times(1)).getDay(eq(owner), eq(day));
        }
    }
}
