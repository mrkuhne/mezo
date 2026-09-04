package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.service.GoalInvariantValidator;
import io.mrkuhne.mezo.feature.goal.service.GoalOverviewCourseService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GoalOverviewCourseServiceTest {

    private final GoalOverviewCourseService service = new GoalOverviewCourseService(
        new GoalInvariantValidator(), properties());

    @Test
    void testClassify_shouldReturnInvalid_whenGoalDirectionIsIncoherent() {
        GoalEntity goal = goal("bulk", "84.2", "78.0", "0.70");

        var course = service.classify(goal, trend("82.0", "0.5", DataSufficiencyEnum.FULL));

        assertThat(course.status()).isEqualTo("invalid");
        assertThat(course.reasonCode()).isEqualTo("goal_invalid");
    }

    @Test
    void testClassify_shouldReturnLearning_whenTrendIsMissing() {
        var course = service.classify(
            goal("cut", "84.2", "78.0", "0.70"),
            trend("84.2", "0", DataSufficiencyEnum.NONE));

        assertThat(course.status()).isEqualTo("learning");
        assertThat(course.reasonCode()).isEqualTo("trend_missing");
        assertThat(course.signedObservedRate()).isNull();
    }

    @Test
    void testClassify_shouldReturnOnTrack_whenCutRateHasCorrectSignAndFallsWithinBand() {
        var course = service.classify(
            goal("cut", "84.2", "78.0", "0.70"),
            trend("80.0", "-0.55", DataSufficiencyEnum.PROVISIONAL));

        assertThat(course.status()).isEqualTo("on_track");
        assertThat(course.signedTargetRate()).isEqualByComparingTo("-0.560");
        assertThat(course.reasonCode()).isEqualTo("rate_on_track");
        assertThat(course.projectedTargetDate()).isEqualTo(LocalDate.now().plusWeeks(4));
    }

    @Test
    void testClassify_shouldReturnOnTrack_whenBulkRateHasCorrectSignAndFallsWithinBand() {
        var course = service.classify(
            goal("bulk", "80.0", "86.0", "0.70"),
            trend("82.0", "0.60", DataSufficiencyEnum.FULL));

        assertThat(course.status()).isEqualTo("on_track");
        assertThat(course.signedTargetRate()).isEqualByComparingTo("0.574");
    }

    @Test
    void testClassify_shouldReturnWatchWrongDirection_whenObservedRateOpposesCut() {
        var course = service.classify(
            goal("cut", "84.2", "78.0", "0.70"),
            trend("82.0", "0.20", DataSufficiencyEnum.FULL));

        assertThat(course.status()).isEqualTo("watch");
        assertThat(course.reasonCode()).isEqualTo("rate_wrong_direction");
        assertThat(course.projectedTargetDate()).isNull();
    }

    @Test
    void testClassify_shouldUseAbsoluteFloor_whenTwentyPercentToleranceIsSmaller() {
        var course = service.classify(
            goal("cut", "84.2", "78.0", "0.125"),
            trend("80.0", "-0.19", DataSufficiencyEnum.FULL));

        assertThat(course.status()).isEqualTo("on_track");
    }

    @Test
    void testClassify_shouldUseFloorAroundZero_whenMaintaining() {
        GoalEntity goal = goal("maintain", "84.2", null, "0");

        var onTrack = service.classify(goal, trend("84.1", "0.09", DataSufficiencyEnum.FULL));
        var watch = service.classify(goal, trend("84.1", "0.11", DataSufficiencyEnum.FULL));

        assertThat(onTrack.status()).isEqualTo("on_track");
        assertThat(watch.status()).isEqualTo("watch");
        assertThat(watch.reasonCode()).isEqualTo("rate_off_track");
    }

    private static GoalEntity goal(String trajectory, String start, String target, String ratePct) {
        GoalEntity goal = new GoalEntity();
        goal.setTrajectory(trajectory);
        goal.setStartWeightKg(new BigDecimal(start));
        goal.setTargetWeightKg(target == null ? null : new BigDecimal(target));
        goal.setRateTargetPctPerWeek(new BigDecimal(ratePct));
        goal.setStartDate(LocalDate.now().minusWeeks(2));
        goal.setTargetDate(LocalDate.now().plusWeeks(6));
        return goal;
    }

    private static WeightTrendResponse trend(String current, String rate, DataSufficiencyEnum sufficiency) {
        BigDecimal observed = new BigDecimal(rate);
        return new WeightTrendResponse(
            List.of(), new BigDecimal(current), observed, BigDecimal.ZERO, observed, sufficiency);
    }

    private static GoalEngineProperties properties() {
        return new GoalEngineProperties(
            new GoalEngineProperties.Neat(1.2, 1.35, 1.5), 7700,
            new GoalEngineProperties.Protein(2.0, 1.6, 2.2, 2.3, 3.1, 2.6),
            new GoalEngineProperties.Rate(0.7, 1.0, 0.5, 1.0),
            new GoalEngineProperties.Volume(8, 6), new GoalEngineProperties.Strength(-5.0),
            new GoalEngineProperties.Ewma(10),
            new GoalEngineProperties.Diet(0.275, 0.20, 0.40, 0.22, 0.5),
            0, 300, new GoalEngineProperties.Suggestion(Map.of()),
            new GoalEngineProperties.Adaptive(120, 50, 7, 4, 5.0),
            new GoalEngineProperties.Overview(new BigDecimal("20"), new BigDecimal("0.10")));
    }
}
