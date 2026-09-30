package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Kihagyás S2 (mezo-q4xt2.2, spec §9.1.8): {@link MomentumAtRiskRule#evaluate} no longer counts an
 * excused skip (serious reason, free pass, advice, kímélő mód) on a planned gym day as a missed
 * gym day — the S1 gap.
 */
class MomentumAtRiskRuleTest {

    private static final UUID USER = UUID.randomUUID();
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 30);
    private static final int WINDOW = 3;
    private static final int BASELINE = 7;

    private final MetricSeriesService metrics = mock(MetricSeriesService.class);
    private final FlagProperties properties = mock(FlagProperties.class);
    private final GymScheduleSlotRepository gymSlots = mock(GymScheduleSlotRepository.class);
    private final WorkoutSessionRepository workouts = mock(WorkoutSessionRepository.class);
    private final PlannedSkipService plannedSkips = mock(PlannedSkipService.class);
    private final MomentumAtRiskRule rule =
        new MomentumAtRiskRule(metrics, properties, gymSlots, workouts, plannedSkips);

    private final LocalDate recentTo = TODAY.minusDays(1);
    private final LocalDate recentFrom = recentTo.minusDays(WINDOW - 1L);

    @BeforeEach
    void habitsCollapsedAndEveryDayIsAGymDay() {
        when(properties.momentum()).thenReturn(new FlagProperties.Momentum(WINDOW, BASELINE, 0.5, 1.0));
        Map<LocalDate, Double> baseline = new HashMap<>();
        LocalDate baselineTo = recentFrom.minusDays(1);
        for (int i = 0; i < BASELINE; i++) {
            baseline.put(baselineTo.minusDays(i), 4.0);
        }
        when(metrics.series(eq(USER), eq(MetricKey.HABITS_DONE), any(), any())).thenAnswer(inv ->
            inv.getArgument(2, LocalDate.class).equals(recentFrom) ? Map.of() : baseline);
        List<GymScheduleSlotEntity> slots = IntStream.range(0, 7).mapToObj(d -> {
            GymScheduleSlotEntity s = new GymScheduleSlotEntity();
            s.setDayOfWeek(d);
            s.setTime("07:00");
            return s;
        }).toList();
        when(gymSlots.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(USER)).thenReturn(slots);
        when(workouts.findDoneInstanceDates(USER, recentFrom, recentTo)).thenReturn(List.of());
    }

    @Test
    void testEvaluate_shouldClear_whenEveryMissedGymDayIsExcused() {
        when(plannedSkips.excusedDates(USER, Kind.GYM, recentFrom, recentTo))
            .thenReturn(Set.of(recentFrom, recentFrom.plusDays(1), recentTo));

        FlagVerdict verdict = rule.evaluate(USER, TODAY);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
    }

    @Test
    void testEvaluate_shouldListOnlyTheUnexcusedDays_whenOneMissedDayIsExcused() {
        when(plannedSkips.excusedDates(USER, Kind.GYM, recentFrom, recentTo)).thenReturn(Set.of(recentTo));

        FlagVerdict verdict = rule.evaluate(USER, TODAY);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(verdict.payload().momentumAtRisk().missedGymDays())
            .containsExactly(recentFrom.toString(), recentFrom.plusDays(1).toString());
    }
}
