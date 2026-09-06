package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.LifeGoalTodaySummary;
import io.mrkuhne.mezo.api.dto.PillarDayStatus;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalProgressService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-a9os: {@link LifeGoalProgressService#summary(UUID, LocalDate, LocalDate)} — the windowed
 * generalization of {@code today}, so the weekly review can score the CLOSED week
 * {@code [D-7, D-1]} instead of the trailing {@code [now-6, now]}.
 */
@Transactional
class LifeGoalProgressServiceSummaryIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalProgressService progressService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;

    private UUID createActiveGoalWithHitOn(UUID owner, LocalDate day) {
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity sleep = lifeGoalPopulator.sleepPillar(goal);
        lifeGoalPopulator.pillarDay(sleep, day, "hit");
        return goal.getId();
    }

    /** mezo-a9os: a lezárt hét ablaka — a mai nap NEM számít bele. */
    @Test
    void summary_shouldMeasureTheGivenWindow_notTheTrailingSevenDays() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(7);
        LocalDate weekEnd = today.minusDays(1);
        createActiveGoalWithHitOn(owner, weekStart); // a reviewed hét ELSŐ napja

        LifeGoalTodaySummary summary = progressService.summary(owner, weekStart, weekEnd)
            .getGoals().get(0);

        assertThat(summary.getDays7()).hasSize(7);
        assertThat(summary.getDays7().get(0)).isEqualTo(PillarDayStatus.HIT);
    }

    /** A meglévő today() viselkedése nem változhat: [ma-6, ma]. */
    @Test
    void today_shouldStillMeasureTheTrailingSevenDays() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        createActiveGoalWithHitOn(owner, today.minusDays(7)); // az ablakon KÍVÜL

        LifeGoalTodaySummary summary = progressService.today(owner, today).getGoals().get(0);

        assertThat(summary.getDays7()).hasSize(7);
        assertThat(summary.getDays7()).doesNotContain(PillarDayStatus.HIT);
    }

    @Test
    void summary_shouldRejectAWindowThatIsNotSevenDays() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        assertThatThrownBy(() -> progressService.summary(owner, today.minusDays(2), today))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
