package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.api.dto.SportSessionCreateRequest;
import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalEvalJob;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;

/**
 * The ha-akkor trigger wiring end to end (mezo-iizd.7): the immediate branch through the real
 * {@code CheckInService.save} / {@code SportService.logSportSession} writes (AFTER_COMMIT ->
 * {@code LifeGoalTriggerListener}, @Async — hence the Awaitility waits below), and the delayed
 * branch through the existing nightly {@code LifeGoalEvalJob}. No mocks: every immediate-branch
 * scenario goes through the real service, exactly like {@code FlagEvaluationListenerIT}.
 */
class LifeGoalTriggerIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalEvalJob evalJob;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LifeGoalRepository goalRepository;
    @Autowired private AppNotificationRepository notificationRepository;
    @Autowired private CheckInService checkInService;
    @Autowired private SportService sportService;

    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = userPopulator.createUser().getId();
    }

    private UUID seedActiveGoalWithPlan(String title, String ha, String akkor,
            String triggerSource, String condition, Integer delayHours) {
        LifeGoalEntity goal = lifeGoalPopulator.goal(userId, "active");
        goal.setTitle(title);
        goal.setIfThenPlans(
            List.of(new IfThenPlanJson(ha, akkor, new PlanTriggerJson(triggerSource, condition, delayHours))));
        return goalRepository.saveAndFlush(goal).getId();
    }

    private void seedSportSession(LocalDate date, int durationMin) {
        trainPopulator.createSportSession(userId, date, durationMin);
    }

    private void parkGoal(UUID goalId) {
        LifeGoalEntity goal = goalRepository.findById(goalId).orElseThrow();
        goal.setStatus("parked");
        goalRepository.saveAndFlush(goal);
    }

    private SaveCheckInRequest checkInRequest(LocalDate date, int energy) {
        return SaveCheckInRequest.builder()
            .date(date).slotTime("08:00").state("done").energy(energy).stress(5).build();
    }

    private SportSessionCreateRequest sportSessionRequest(LocalDate date, int durationMin) {
        return SportSessionCreateRequest.builder().date(date).duration(durationMin).build();
    }

    private List<AppNotificationEntity> notifications(String kind) {
        return notificationRepository
            .findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(userId, Pageable.unpaged())
            .stream().filter(n -> kind.equals(n.getKind())).toList();
    }

    private void awaitNotification(String kind) {
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> assertThat(notifications(kind)).isNotEmpty());
    }

    @Test
    void job_shouldEmitADelayedPlanOnceForTheClosedDay_andStaySilentOnASecondRun() {
        UUID goalId = seedActiveGoalWithPlan(
            "Félmaraton", "ha edzés volt", "másnap 10 perc mobilizáció",
            "sport_session_logged", null, 4); // delayHours 4 → késleltetett ág
        seedSportSession(LocalDate.now().minusDays(1), 60);

        evalJob.runEval();
        evalJob.runEval();

        assertThat(notifications("life_goal_plan")).hasSize(1);
        assertThat(notifications("life_goal_plan").get(0).getDeeplink()).isEqualTo("/me/goals/" + goalId);
        assertThat(notifications("life_goal_plan").get(0).getDedupKey())
            .isEqualTo(goalId + ":0:" + LocalDate.now().minusDays(1));
    }

    @Test
    void job_shouldEmitTheRitualMissedPlan_whenYesterdayHasNoClosedRitual() {
        seedActiveGoalWithPlan("Fegyelem", "kimarad a napzárás", "másnap reggel 2 percben pótolom",
            "ritual_missed", null, 10);

        evalJob.runEval();

        assertThat(notifications("life_goal_plan")).hasSize(1);
    }

    @Test
    void job_shouldStaySilentForAParkedGoal() {
        UUID goalId = seedActiveGoalWithPlan("Félmaraton", "ha edzés volt", "nyújts",
            "sport_session_logged", null, 4);
        seedSportSession(LocalDate.now().minusDays(1), 60);
        parkGoal(goalId);

        evalJob.runEval();

        assertThat(notifications("life_goal_plan")).isEmpty();
    }

    @Test
    void immediate_shouldEmitOnTheEventDay_whenTheCheckInEnergyIsAtOrBelowTheThreshold() {
        UUID goalId = seedActiveGoalWithPlan("Nyugalom", "ha alacsony az energia",
            "sétálok egyet", "checkin_energy_lte", "5", 0); // delayHours 0 → azonnali ág

        // Nincs mock: a valódi CheckInService-en megyünk be, az publikálja a CheckInSavedEvent-et.
        checkInService.save(userId, checkInRequest(LocalDate.now(), 3));
        awaitNotification("life_goal_plan");

        assertThat(notifications("life_goal_plan")).hasSize(1);
        assertThat(notifications("life_goal_plan").get(0).getDedupKey())
            .isEqualTo(goalId + ":0:" + LocalDate.now());
    }

    @Test
    void immediate_shouldEmitOnASportSessionLog_throughTheTrainEvent() {
        seedActiveGoalWithPlan("Félmaraton", "ha lement a sport", "beírom a jegyzetet",
            "sport_session_logged", null, 0);

        sportService.logSportSession(userId, sportSessionRequest(LocalDate.now(), 45));
        awaitNotification("life_goal_plan");

        assertThat(notifications("life_goal_plan")).hasSize(1);
    }
}
