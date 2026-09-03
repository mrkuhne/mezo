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
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalTriggerRules;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
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
 *
 * <p>The "nothing is emitted" cases use Awaitility's {@code during(...)} settle window rather than
 * a bare assertion, because the immediate branch is asynchronous — an empty table right after the
 * write would pass even for a broken guard.
 *
 * <p>Not covered here (no no-mock seam): the "the signal is ASLEEP because no {@code SignalSource}
 * bean supports it" skip. That state needs the companion switch off inside a life-goal context, a
 * context combination this suite does not carry; the guard lives in {@code LifeGoalTriggerService}
 * next to the same {@code supports()} dispatch {@code LifeGoalSignalService} uses for liveness,
 * which {@code LifeGoalSignalsLivenessIT} does exercise for the companion-off case. Faking a
 * {@code SignalSource} would be a mock, which the house rules forbid in integration tests.
 */
class LifeGoalTriggerIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalEvalJob evalJob;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RitualPopulator ritualPopulator;
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
        return seedActiveGoalWithPlan(userId, title, ha, akkor, triggerSource, condition, delayHours);
    }

    private UUID seedActiveGoalWithPlan(UUID owner, String title, String ha, String akkor,
            String triggerSource, String condition, Integer delayHours) {
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
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
        return notificationsOf(userId, kind);
    }

    private List<AppNotificationEntity> notificationsOf(UUID owner, String kind) {
        return notificationRepository
            .findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(owner, Pageable.unpaged())
            .stream().filter(n -> kind.equals(n.getKind())).toList();
    }

    private void awaitNotification(String kind) {
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> assertThat(notifications(kind)).isNotEmpty());
    }

    /** Settle window: the async listener gets a real chance to (wrongly) emit before we conclude. */
    private void awaitNoNotification(UUID owner, String kind) {
        await().during(Duration.ofSeconds(1)).atMost(Duration.ofSeconds(5))
            .untilAsserted(() -> assertThat(notificationsOf(owner, kind)).isEmpty());
    }

    private String dedupKey(UUID goalId, String ha, String akkor, String source, LocalDate day) {
        return goalId + ":" + LifeGoalTriggerRules.planKey(ha, akkor, source) + ":" + day;
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
        // A dedup-kulcs a terv TARTALMI lenyomatát viszi, nem a lista-indexét (review F2).
        assertThat(notifications("life_goal_plan").get(0).getDedupKey())
            .isEqualTo(dedupKey(goalId, "ha edzés volt", "másnap 10 perc mobilizáció",
                "sport_session_logged", LocalDate.now().minusDays(1)));
    }

    /**
     * Review F3: a késleltetett ág UGYANAZT a három lezárt napot nézi, amit az {@code evaluateDays} —
     * egy 3 napja történt, de MOST beírt edzés is megkapja a bökését, és a második futás néma.
     */
    @Test
    void job_shouldStillNudgeForASessionLoggedLate_threeClosedDaysBack() {
        UUID goalId = seedActiveGoalWithPlan(
            "Félmaraton", "ha edzés volt", "másnap 10 perc mobilizáció",
            "sport_session_logged", null, 4);
        LocalDate threeDaysAgo = LocalDate.now().minusDays(3);
        seedSportSession(threeDaysAgo, 60); // késve rögzítve, de a napja 3 napja volt

        evalJob.runEval();

        assertThat(notifications("life_goal_plan")).hasSize(1);
        assertThat(notifications("life_goal_plan").get(0).getDedupKey())
            .isEqualTo(dedupKey(goalId, "ha edzés volt", "másnap 10 perc mobilizáció",
                "sport_session_logged", threeDaysAgo));

        evalJob.runEval();

        assertThat(notifications("life_goal_plan")).hasSize(1);
    }

    /** Review F4: van adopció (3 napja lezárt rituálé), tegnap nincs → megszólal. */
    @Test
    void job_shouldEmitTheRitualMissedPlan_whenTheUserAdoptedTheRitualButMissedTheDay() {
        seedActiveGoalWithPlan("Fegyelem", "kimarad a napzárás", "másnap reggel 2 percben pótolom",
            "ritual_missed", null, 10);
        ritualPopulator.closedDay(userId, LocalDate.now().minusDays(3));

        evalJob.runEval();

        // A job három lezárt napot néz. A -3. nap LE VAN zárva → nem szólal meg rá (és őt magát
        // amúgy sem előzi meg lezárt nap). A -1 és a -2 hiányzó nap, és mindkettő elé esik a -3-i
        // lezárás a 14 napos adopciós ablakon belül → két külön napra, két külön dedup-kulccsal szól.
        assertThat(notifications("life_goal_plan")).hasSize(2);
        assertThat(notifications("life_goal_plan")).extracting(AppNotificationEntity::getDedupKey)
            .doesNotHaveDuplicates();
    }

    /** Review F4: aki soha nem zárt le rituálé-napot, azt nem nyaggatjuk — ez nem hiány, hanem nem-használat. */
    @Test
    void job_shouldStaySilentForRitualMissed_whenTheUserNeverAdoptedTheRitual() {
        seedActiveGoalWithPlan("Fegyelem", "kimarad a napzárás", "másnap reggel 2 percben pótolom",
            "ritual_missed", null, 10);

        evalJob.runEval();

        assertThat(notifications("life_goal_plan")).isEmpty();
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
            .isEqualTo(dedupKey(goalId, "ha alacsony az energia", "sétálok egyet",
                "checkin_energy_lte", LocalDate.now()));
    }

    /** Review F11/a: a küszöb FÖLÖTTI energia nem esemény — a predikátum nem teljesül. */
    @Test
    void immediate_shouldStaySilent_whenTheCheckInEnergyIsAboveTheThreshold() {
        seedActiveGoalWithPlan("Nyugalom", "ha alacsony az energia",
            "sétálok egyet", "checkin_energy_lte", "5", 0);

        checkInService.save(userId, checkInRequest(LocalDate.now(), 8));

        awaitNoNotification(userId, "life_goal_plan");
    }

    /** Review F11/b: a késleltetett terv NEM az esemény pillanatában szólal meg (spec D-3). */
    @Test
    void immediate_shouldNotFireADelayedPlan_evenWhenItsSourceEventArrives() {
        seedActiveGoalWithPlan("Nyugalom", "ha alacsony az energia",
            "másnap reggel sétálok", "checkin_energy_lte", "5", 6); // delayHours 6 → csak a job-ág

        checkInService.save(userId, checkInRequest(LocalDate.now(), 3));

        awaitNoNotification(userId, "life_goal_plan");
    }

    /** Review F11/c: a jel a tulajdonosé — B aktív célja nem szólal meg A check-injére. */
    @Test
    void immediate_shouldNotLeakAcrossUsers() {
        UUID otherUserId = userPopulator.createUser().getId();
        seedActiveGoalWithPlan(otherUserId, "Nyugalom", "ha alacsony az energia",
            "sétálok egyet", "checkin_energy_lte", "5", 0);
        seedActiveGoalWithPlan("Nyugalom (A)", "ha alacsony az energia",
            "sétálok egyet", "checkin_energy_lte", "5", 0);

        checkInService.save(userId, checkInRequest(LocalDate.now(), 3));
        awaitNotification("life_goal_plan");

        assertThat(notifications("life_goal_plan")).hasSize(1);
        assertThat(notificationsOf(otherUserId, "life_goal_plan")).isEmpty();
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
