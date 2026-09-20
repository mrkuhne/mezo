package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.E1rmPoint;
import io.mrkuhne.mezo.api.dto.E1rmRecord;
import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.techcore.query.WeightTrendQuery;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * Pure-Mockito unit tests for {@link WeightDecompositionInputsAssembler} (mezo-85x5r
 * final-review wave) — no Spring context, the collaborators are mocked directly. Exercises the
 * two bugs fixed in this wave: the kcal-surplus scaling to LOGGED days (not calendar days) with
 * its below-floor null, and the trend/e1RM honest-omission gate for a fully-past anchored week.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WeightDecompositionInputsAssemblerTest {

    @Mock private WeightLogRepository weightLogRepository;
    @Mock private WeightTrendQuery weightTrendQuery;
    @Mock private GoalRepository goalRepository;
    @Mock private MetricSeriesService metricSeriesService;
    @Mock private ExerciseRecordService exerciseRecordService;

    private WeightDecompositionInputsAssembler assembler;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        assembler = new WeightDecompositionInputsAssembler(
                weightLogRepository, weightTrendQuery, goalRepository, metricSeriesService, exerciseRecordService);
        // No weigh-ins, no goal, no exercise history by default — each test opts in to what it needs.
        when(weightLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(
                any(), any(), any())).thenReturn(List.of());
        when(goalRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(eq(userId), eq("active")))
                .thenReturn(List.of());
        when(exerciseRecordService.list(userId)).thenReturn(List.of());
        lenient().when(weightTrendQuery.computeTrend(userId)).thenReturn(new WeightTrendResponse());
    }

    private GoalEntity activeGoal(LocalDate startDate, GoalPrescriptionJson prescription) {
        GoalEntity goal = new GoalEntity();
        goal.setCreatedBy(userId);
        goal.setTrajectory("cut");
        goal.setStatus("active");
        goal.setStartDate(startDate);
        goal.setPrescription(prescription);
        return goal;
    }

    private static GoalPrescriptionJson.Segment segment(int kcal, int dailyEnergyBalanceKcal) {
        return new GoalPrescriptionJson.Segment(1, 52, "cut", kcal, null, null, null, null, null,
                null, dailyEnergyBalanceKcal, null, null, null);
    }

    private static GoalPrescriptionJson prescriptionOf(GoalPrescriptionJson.Segment segment) {
        return new GoalPrescriptionJson(null, "formula", List.of(segment), null, null);
    }

    // ---- IMPORTANT-2: kcal surplus scales to LOGGED days, not the window's calendar length ----

    @Test
    void kcalSurplusScalesTheTdeeSideToTheLoggedDayCountNotTheCalendarWindow() {
        LocalDate windowFrom = LocalDate.now().minusWeeks(2)
                .with(java.time.DayOfWeek.MONDAY);
        LocalDate windowTo = windowFrom.plusDays(6);
        // tdeePerDay = 2500 - (-200) = 2700; ONLY 4 of the 7 days were logged, 600 kcal each.
        when(goalRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(eq(userId), eq("active")))
                .thenReturn(List.of(activeGoal(windowFrom.minusWeeks(4), prescriptionOf(segment(2500, -200)))));
        when(metricSeriesService.series(userId, MetricKey.DAILY_KCAL, windowFrom, windowTo)).thenReturn(Map.of(
                windowFrom, 600.0, windowFrom.plusDays(1), 600.0,
                windowFrom.plusDays(2), 600.0, windowFrom.plusDays(3), 600.0));

        var inputs = assembler.assemble(userId, windowFrom, windowTo);

        // loggedSum(2400) - tdeePerDay(2700) * loggedDayCount(4) = 2400 - 10800 = -8400.
        // The OLD (buggy) formula would have scaled by the 7-day window instead: 2400 - 18900.
        assertThat(inputs.weekKcalSurplus()).isEqualTo(-8400.0);
    }

    @Test
    void kcalSurplusIsNullWhenFewerThanFourDaysAreLogged() {
        LocalDate windowFrom = LocalDate.now().minusWeeks(2).with(java.time.DayOfWeek.MONDAY);
        LocalDate windowTo = windowFrom.plusDays(6);
        when(goalRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(eq(userId), eq("active")))
                .thenReturn(List.of(activeGoal(windowFrom.minusWeeks(4), prescriptionOf(segment(2500, -200)))));
        when(metricSeriesService.series(userId, MetricKey.DAILY_KCAL, windowFrom, windowTo)).thenReturn(Map.of(
                windowFrom, 600.0, windowFrom.plusDays(1), 600.0, windowFrom.plusDays(2), 600.0));

        var inputs = assembler.assemble(userId, windowFrom, windowTo);

        assertThat(inputs.weekKcalSurplus()).isNull();
    }

    // ---- IMPORTANT-3: trend/e1RM are honest-omission for a fully-past anchored week ----

    @Test
    void trendAndE1rmAreNullForAFullyPastAnchoredWeek() {
        LocalDate windowFrom = LocalDate.now().minusWeeks(3).with(java.time.DayOfWeek.MONDAY);
        LocalDate windowTo = windowFrom.plusDays(6); // fully elapsed — before today
        when(weightTrendQuery.computeTrend(userId))
                .thenReturn(new WeightTrendResponse().weeklyRateKgPerWeek(new BigDecimal("-0.5")));
        ExerciseRecordResponse record = new ExerciseRecordResponse()
                .bestE1rm(new E1rmRecord().value(new BigDecimal("100")))
                .e1rmSeries(List.of(
                        new E1rmPoint().date(windowFrom.minusDays(10)).e1rm(new BigDecimal("95")),
                        new E1rmPoint().date(windowFrom.plusDays(2)).e1rm(new BigDecimal("100"))));
        when(exerciseRecordService.list(userId)).thenReturn(List.of(record));

        var inputs = assembler.assemble(userId, windowFrom, windowTo);

        assertThat(inputs.trendDeltaKgPerWeek()).isNull();
        assertThat(inputs.e1rmTopDeltaPct()).isNull();
    }

    @Test
    void trendAndE1rmArePopulatedForTheCurrentRunningWeek() {
        LocalDate today = LocalDate.now();
        LocalDate windowFrom = today.with(java.time.DayOfWeek.MONDAY);
        if (windowFrom.isAfter(today)) {
            windowFrom = windowFrom.minusWeeks(1);
        }
        LocalDate windowTo = today; // still running — clamped to today by the caller
        when(weightTrendQuery.computeTrend(userId))
                .thenReturn(new WeightTrendResponse().weeklyRateKgPerWeek(new BigDecimal("-0.5")));
        ExerciseRecordResponse record = new ExerciseRecordResponse()
                .bestE1rm(new E1rmRecord().value(new BigDecimal("100")))
                .e1rmSeries(List.of(
                        new E1rmPoint().date(windowFrom.minusDays(3)).e1rm(new BigDecimal("95")),
                        new E1rmPoint().date(windowFrom).e1rm(new BigDecimal("100"))));
        when(exerciseRecordService.list(userId)).thenReturn(List.of(record));

        var inputs = assembler.assemble(userId, windowFrom, windowTo);

        assertThat(inputs.trendDeltaKgPerWeek()).isEqualTo(-0.5);
        // (100 - 95) / 95 * 100 = 5.263...
        assertThat(inputs.e1rmTopDeltaPct()).isNotNull();
        assertThat(inputs.e1rmTopDeltaPct()).isCloseTo(5.263, org.assertj.core.data.Offset.offset(0.01));
    }

    // ---- ledger T4: the TOP exercise is picked by max e1RM value, not list order ----

    @Test
    void e1rmTopDeltaPicksTheExerciseWithTheHighestE1rmNotTheFirstInList() {
        LocalDate today = LocalDate.now();
        LocalDate windowFrom = today.with(java.time.DayOfWeek.MONDAY);
        if (windowFrom.isAfter(today)) {
            windowFrom = windowFrom.minusWeeks(1);
        }
        LocalDate windowTo = today;
        // list() order puts the low-e1RM exercise FIRST (as ExerciseRecordService sorts by
        // session count) — the assembler must still pick the SECOND one by e1RM value.
        ExerciseRecordResponse mostSessions = new ExerciseRecordResponse()
                .bestE1rm(new E1rmRecord().value(new BigDecimal("40")))
                .e1rmSeries(List.of(
                        new E1rmPoint().date(windowFrom.minusDays(3)).e1rm(new BigDecimal("38")),
                        new E1rmPoint().date(windowFrom).e1rm(new BigDecimal("40"))));
        ExerciseRecordResponse highestE1rm = new ExerciseRecordResponse()
                .bestE1rm(new E1rmRecord().value(new BigDecimal("180")))
                .e1rmSeries(List.of(
                        new E1rmPoint().date(windowFrom.minusDays(3)).e1rm(new BigDecimal("170")),
                        new E1rmPoint().date(windowFrom).e1rm(new BigDecimal("180"))));
        when(exerciseRecordService.list(userId)).thenReturn(List.of(mostSessions, highestE1rm));

        var inputs = assembler.assemble(userId, windowFrom, windowTo);

        // (180 - 170) / 170 * 100 = 5.88...  (the mostSessions exercise would give (40-38)/38*100 = 5.26)
        assertThat(inputs.e1rmTopDeltaPct()).isCloseTo(5.88, org.assertj.core.data.Offset.offset(0.01));
    }

    @Test
    void e1rmTopDeltaIsNullWhenEitherSideOfTheComparisonIsMissingFromTheWindow() {
        LocalDate today = LocalDate.now();
        LocalDate windowFrom = today.with(java.time.DayOfWeek.MONDAY);
        if (windowFrom.isAfter(today)) {
            windowFrom = windowFrom.minusWeeks(1);
        }
        LocalDate windowTo = today;
        // Only a point BEFORE the window exists — nothing IN the window yet.
        ExerciseRecordResponse record = new ExerciseRecordResponse()
                .bestE1rm(new E1rmRecord().value(new BigDecimal("100")))
                .e1rmSeries(List.of(new E1rmPoint().date(windowFrom.minusDays(3)).e1rm(new BigDecimal("95"))));
        when(exerciseRecordService.list(userId)).thenReturn(List.of(record));

        var inputs = assembler.assemble(userId, windowFrom, windowTo);

        assertThat(inputs.e1rmTopDeltaPct()).isNull();
    }
}
