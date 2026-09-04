package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Task 7 — the Monday adaptive review's per-user orchestration: a divergent EWMA trend proposes a
 * smoothed {@code weekly_correction}, and the (goal_id, dedup_key) unique index means a DECIDED
 * week is never re-proposed (dedup includes dismissed/accepted rows — this IS the idempotency
 * mechanism, spec §6.6/§6.8; an undecided open row is returned as-is, still non-null).
 */
@Transactional
class AdaptiveReviewServiceIT extends AbstractIntegrationTest {

    @Autowired private AdaptiveReviewService adaptiveReviewService;
    @Autowired private GoalEngineService goalEngineService;
    @Autowired private GoalSuggestionService suggestionService;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalSuggestionRepository suggestionRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID userId;
    private UUID goalId;

    @Test
    void divergentTrendProposesAWeeklyCorrection() {
        seedActiveCutGoalWithProfile(); // rate 0.6 %BW/wk
        seedDenseWeighInsTrendingAt(new BigDecimal("-0.20")); // >=21 days, >=4/wk => FULL sufficiency, too slow

        boolean proposed = adaptiveReviewService.reviewUser(userId, LocalDate.of(2026, 8, 24));

        assertThat(proposed).isTrue();
        GoalSuggestionEntity s = suggestionRepository
            .findByGoalIdAndKindAndStatusAndDeletedFalse(goalId, "weekly_correction", "proposed").orElseThrow();
        assertThat(s.getDedupKey()).isEqualTo("weekly:2026-08-24");
        assertThat(s.getPayload().deltaKcal()).isEqualTo(-120);
        assertThat(s.getPayload().reason()).isNotBlank();
    }

    @Test
    void sameWeekIsIdempotentViaTheDedupIndex() {
        seedActiveCutGoalWithProfile();
        seedDenseWeighInsTrendingAt(new BigDecimal("-0.20"));
        LocalDate week = LocalDate.of(2026, 8, 24);

        assertThat(adaptiveReviewService.reviewUser(userId, week)).isTrue();
        GoalSuggestionEntity s = suggestionRepository
            .findByGoalIdAndKindAndStatusAndDeletedFalse(goalId, "weekly_correction", "proposed").orElseThrow();
        suggestionService.dismiss(userId, goalId, s.getId());

        // dedup includes decided rows: a dismissed week is never re-proposed => propose returns
        // null => reviewUser false, even though the trend input is unchanged.
        assertThat(adaptiveReviewService.reviewUser(userId, week)).isFalse();
    }

    /** Active cut goal, evaluated (so prescription != null), with a rate target of 0.60 %BW/wk. */
    private void seedActiveCutGoalWithProfile() {
        userId = databasePopulator.populateUser("adaptive-" + UUID.randomUUID() + "@test.local");
        profilePopulator.create(userId);
        GoalEntity goal = goalPopulator.createGoal(userId, "cut", "active");
        goal.setRateTargetPctPerWeek(new BigDecimal("0.60"));
        goalRepository.saveAndFlush(goal);
        goalId = goal.getId();
        goalEngineService.evaluate(userId, goalId); // populates prescription (generatedAt snapshot)
    }

    /** >=21-day span, >=4 logs/week density (daily logging), declining at ~{@code weeklyRateKgPerWeek}. */
    private void seedDenseWeighInsTrendingAt(BigDecimal weeklyRateKgPerWeek) {
        LocalDate start = LocalDate.of(2026, 7, 1);
        BigDecimal dailyStep = weeklyRateKgPerWeek.divide(BigDecimal.valueOf(7), 6, RoundingMode.HALF_UP);
        BigDecimal weight = new BigDecimal("84.20");
        for (int day = 0; day < 29; day++) {
            weightLogPopulator.createWeightLog(userId, start.plusDays(day), weight);
            weight = weight.add(dailyStep);
        }
    }
}
