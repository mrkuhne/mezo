package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.api.dto.GoalGap;
import io.mrkuhne.mezo.api.dto.GoalOverviewDiet;
import io.mrkuhne.mezo.api.dto.GoalOverviewResponse;
import io.mrkuhne.mezo.api.dto.GoalOverviewResponse.CourseStatusEnum;
import io.mrkuhne.mezo.api.dto.GoalOverviewResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.GoalSuggestionPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

class GoalOverviewApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalPlanLinkPopulator linkPopulator;
    @Autowired private GoalSuggestionPopulator suggestionPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;

    @Test
    void testGetGoalOverview_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/goals/" + UUID.randomUUID() + "/overview", null,
            HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetGoalOverview_shouldReturn404_whenGoalBelongsToAnotherUser() {
        UUID owner = ownerId();
        GoalEntity goal = goalPopulator.createGoalFull(
            owner, LocalDate.now().minusWeeks(2), LocalDate.now().plusWeeks(6),
            prescription(), 4, "06:30", "22:30");

        String body = getForBody("/api/goals/" + goal.getId() + "/overview",
            registerUser("Másik felhasználó").headers(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetGoalOverview_shouldUseLatestWeight_whenOnlyOneMeasurementExists() {
        LocalDate today = LocalDate.now();
        UUID owner = ownerId();
        GoalEntity goal = goalPopulator.createGoalFull(
            owner, today.minusWeeks(2), today.plusWeeks(6), null, 4, "06:30", "22:30");
        weightLogPopulator.createWeightLog(owner, today, new BigDecimal("81.75"));

        GoalOverviewResponse response = getForBody(
            "/api/goals/" + goal.getId() + "/overview", ownerAuthHeaders(),
            HttpStatus.OK, GoalOverviewResponse.class);

        assertThat(response.getCourseStatus()).isEqualTo(CourseStatusEnum.LEARNING);
        assertThat(response.getCurrentWeightKg()).isEqualByComparingTo("81.750");
        assertThat(response.getDiet().getTodayDayType())
            .isEqualTo(GoalOverviewDiet.TodayDayTypeEnum.UNAVAILABLE);
    }

    @Test
    void testGetGoalOverview_shouldComposeGoalDietSegmentPlansGuardsAndSuggestion_whenActiveCutExists() {
        LocalDate today = LocalDate.now();
        UUID owner = ownerId();
        GoalEntity goal = goalPopulator.createGoalFull(
            owner, today.minusWeeks(2), today.plusWeeks(6), prescription(), 4, "06:30", "22:30");
        weightLogPopulator.createWeightLog(owner, today.minusDays(7), new BigDecimal("84.20"));
        weightLogPopulator.createWeightLog(owner, today, new BigDecimal("83.20"));
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Shoulder & Back", "active");
        linkPopulator.createLink(owner, goal.getId(), "mesocycle", meso.getId(), 1, 6);
        trainPopulator.createScheduleSlot(
            owner, today.getDayOfWeek().getValue() - 1, "18:00", 90, "training");
        GoalSuggestionEntity suggestion = suggestionPopulator.createOpen(
            owner, goal.getId(), "weekly_correction", "weekly:" + today, suggestionPayload(today));

        GoalOverviewResponse response = getForBody(
            "/api/goals/" + goal.getId() + "/overview", ownerAuthHeaders(),
            HttpStatus.OK, GoalOverviewResponse.class);

        assertThat(response.getGoalId()).isEqualTo(goal.getId());
        assertThat(response.getTitle()).isEqualTo("Nyári cut");
        assertThat(response.getCurrentWeek()).isEqualTo(3);
        assertThat(response.getTotalWeeks()).isEqualTo(8);
        assertThat(response.getCompletionPct()).isBetween(0, 100);
        assertThat(response.getCurrentWeightKg()).isPositive();
        assertThat(response.getTargetWeightKg()).isEqualByComparingTo("80.00");
        assertThat(response.getDataSufficiency()).isEqualTo(DataSufficiencyEnum.PROVISIONAL);
        assertThat(response.getCourseStatus()).isEqualTo(CourseStatusEnum.WATCH);
        assertThat(response.getCourseReasonCode()).isEqualTo("rate_off_track");
        assertThat(response.getObservedRateKgPerWeek()).isNegative();

        assertThat(response.getDiet().getWeekAverageKcal()).isEqualTo(2780);
        assertThat(response.getDiet().getTodayDayType()).isEqualTo(GoalOverviewDiet.TodayDayTypeEnum.TRAINING);
        assertThat(response.getDiet().getTodayKcal()).isEqualTo(2820);
        assertThat(response.getDiet().getTrainingDayKcal()).isEqualTo(2820);
        assertThat(response.getDiet().getRestDayKcal()).isEqualTo(2460);
        assertThat(response.getDiet().getProteinG()).isEqualTo(214);
        assertThat(response.getDiet().getCarbsG()).isEqualTo(300);
        assertThat(response.getDiet().getFatG()).isEqualTo(80);
        assertThat(response.getDiet().getBasis()).isEqualTo(GoalOverviewDiet.BasisEnum.FORMULA);

        assertThat(response.getSegment().getAvailable()).isTrue();
        assertThat(response.getSegment().getLabel()).isEqualTo("alapozó (MAV)");
        assertThat(response.getSegment().getFromWeek()).isEqualTo(1);
        assertThat(response.getSegment().getToWeek()).isEqualTo(4);
        assertThat(response.getSegment().getNextLabel()).isEqualTo("csak alapozó");
        assertThat(response.getSegment().getNextChangeDate()).isEqualTo(today.plusWeeks(2));

        assertThat(response.getPlans().getLinks()).hasSize(1);
        assertThat(response.getPlans().getGaps())
            .extracting(GoalGap::getFromWeek, GoalGap::getToWeek)
            .containsExactly(tuple(7, 8));
        assertThat(response.getPlans().getSportSchedule()).singleElement()
            .satisfies(slot -> assertThat(slot.getDurationMin()).isEqualTo(90));
        assertThat(response.getPlans().getActiveLinkCount()).isEqualTo(1);
        assertThat(response.getPlans().getUncoveredWeekCount()).isEqualTo(2);

        assertThat(response.getGuards().getHealthyCount()).isEqualTo(2);
        assertThat(response.getGuards().getTotalCount()).isEqualTo(2);
        assertThat(response.getGuards().getTopIssueCode()).isNull();
        assertThat(response.getOpenSuggestionCount()).isEqualTo(1);
        assertThat(response.getLatestSuggestionId()).isEqualTo(suggestion.getId());
    }

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private static GoalSuggestionPayloadJson suggestionPayload(LocalDate today) {
        return new GoalSuggestionPayloadJson(
            "A mért trend alapján kis korrekció javasolt.", null, null, null, null, null, null, "cut",
            today.toString(), -120, new BigDecimal("-0.20"), new BigDecimal("-0.50"), false,
            5, 2800, 2920, OffsetDateTime.now(), new BigDecimal("0.70"), 0);
    }

    private static GoalPrescriptionJson prescription() {
        var strength = new GoalPrescriptionJson.GuardStatus.Strength(
            true, new BigDecimal("-1.0"), false, List.of());
        var muscle = new GoalPrescriptionJson.GuardStatus.Muscle(
            true, 8, List.of(), true, true, List.of());
        return new GoalPrescriptionJson(
            OffsetDateTime.now(), "formula",
            List.of(
                segment(1, 4, "alapozó (MAV)", 2780, 2820, 2460),
                segment(5, 8, "csak alapozó", 2660, 2700, 2340)),
            new GoalPrescriptionJson.GuardStatus(strength, muscle),
            new GoalPrescriptionJson.Feasibility("feasible", List.of()));
    }

    private static GoalPrescriptionJson.Segment segment(
        int from, int to, String label, int kcal, int trainingKcal, int restKcal) {
        return new GoalPrescriptionJson.Segment(
            from, to, label, kcal, 214, 300, 80, new BigDecimal("8.0"), List.of(7),
            new BigDecimal("-0.50"), -500, trainingKcal, restKcal, "Teszt recept.");
    }
}
