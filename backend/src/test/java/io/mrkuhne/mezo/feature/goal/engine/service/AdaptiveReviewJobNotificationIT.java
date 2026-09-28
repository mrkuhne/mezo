package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.ExpenditureRolloutRunner;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.IntakeDayMarkService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;

/**
 * The Monday bell (mezo-3n2so Task 6): {@link AdaptiveReviewJob} publishes the feed row itself —
 * neither {@link IntakeDayMarkService#mark} nor {@link ExpenditureRolloutRunner} ever go through
 * the job, so neither one ever rings it. Not {@code @Transactional}: the listener is
 * {@code @Async @TransactionalEventListener}, so it needs a real commit (the {@code GoalSuggestionNotificationIT}
 * idiom).
 */
class AdaptiveReviewJobNotificationIT extends AbstractIntegrationTest {

    private static final int HISTORY_DAYS = 35;
    private static final String DAILY_KCAL = "2000";

    @Autowired private AppUserRepository appUserRepository;
    @Autowired private AdaptiveReviewService adaptiveReviewService;
    @Autowired private ExpenditureLearningService expenditureLearning;
    @Autowired private DietPreferencesPort dietPreferences;
    @Autowired private ApplicationEventPublisher eventPublisher;
    @Autowired private AppNotificationRepository notificationRepository;
    @Autowired private GoalEngineService goalEngineService;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private IntakeDayMarkService intakeDayMarkService;
    @Autowired private ExpenditureRolloutRunner rolloutRunner;

    private UUID userId;
    private LocalDate weekStart;
    private LocalDate weekEnd;

    @BeforeEach
    void setUp() {
        // The job always reviews "last Monday" off the real clock (no Clock seam) — anchor the
        // fixture to that same week rather than a literal date (midnight-fragile trap).
        weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        weekEnd = weekStart.plusDays(6);
    }

    @Test
    void publishesExactlyOneBellAfterTwoRuns() {
        seedLearnableWeek();

        job().run();
        job().run();

        awaitCount(1);
        AppNotificationEntity notification = notifications().get(0);
        assertThat(notification.getDeeplink()).isEqualTo("/fuel/tanulas");
        assertThat(notification.getBody()).isEqualTo("Nézd meg, mit tanultam a múlt hétből.");
    }

    @Test
    void aDayMarkAloneNeverPublishes() {
        seedLearnableWeek();
        job().run();
        awaitCount(1); // the job's own row, not the mark's doing

        intakeDayMarkService.mark(userId, weekEnd, IntakeDayMarkService.COMPLETE);

        await().during(Duration.ofSeconds(1)).atMost(Duration.ofSeconds(3))
            .untilAsserted(() -> assertThat(notifications()).hasSize(1)); // unchanged
    }

    @Test
    void theRolloutRunnerAloneNeverPublishes() {
        seedLearnableWeek(); // no row yet — the runner's own not-yet-a-learner path reviews the week

        rolloutRunner.run();

        await().during(Duration.ofSeconds(1)).atMost(Duration.ofSeconds(3))
            .untilAsserted(() -> assertThat(notifications()).isEmpty());
    }

    private AdaptiveReviewJob job() {
        return new AdaptiveReviewJob(appUserRepository, adaptiveReviewService, expenditureLearning, dietPreferences, eventPublisher);
    }

    private List<AppNotificationEntity> notifications() {
        return notificationRepository.findAll().stream()
            .filter(n -> userId.equals(n.getCreatedBy()) && "expenditure_week".equals(n.getKind()))
            .toList();
    }

    private void awaitCount(int count) {
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> assertThat(notifications()).hasSize(count));
    }

    /** A learnable week (the {@code ExpenditureLearningServiceIT.learnsAndServesTheBase} fixture,
     *  anchored to the job's own "last Monday" instead of a literal date): 35 days of intake plus a
     *  daily weigh-in trending down — a nonzero step, so the row is worth saying. */
    private void seedLearnableWeek() {
        userId = databasePopulator.populateUser("adaptive-review-bell-" + UUID.randomUUID() + "@test.local");
        profilePopulator.create(userId);
        GoalEntity goal = goalPopulator.createGoal(userId, "cut", "active");
        goal.setStartDate(weekStart.minusWeeks(4)); // the ExpenditureLearningServiceIT fixture's own gap
        goal.setTargetDate(weekStart.plusWeeks(15));
        goalRepository.saveAndFlush(goal);
        goalEngineService.evaluate(userId, goal.getId());

        LocalDate first = weekEnd.minusDays(HISTORY_DAYS - 1L);
        BigDecimal weight = new BigDecimal("84.20");
        for (int i = 0; i < HISTORY_DAYS; i++) {
            LocalDate d = first.plusDays(i);
            mealPopulator.createMealWithItems(userId, d, "lunch",
                List.of(new MealPopulator.Line("Bell day", DAILY_KCAL, "150", "200", "70", (short) 1)));
            weightLogPopulator.createWeightLog(userId, d, weight.setScale(2, RoundingMode.HALF_UP));
            weight = weight.subtract(new BigDecimal("0.05"));
        }
    }
}
