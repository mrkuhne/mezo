package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalPrescriptionCalculator;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService.DraftSlot;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Boop B6 Évad (mezo-r36n9.16): the calculator's draft-energy overload projects what a different weekly slot set
 * WOULD prescribe — same pipeline, only the weekly EAT replaced — and persists nothing.
 */
@Transactional
class GoalPrescriptionDraftIT extends AbstractIntegrationTest {

    @Autowired private GoalPrescriptionCalculator calculator;
    @Autowired private GoalEngineService engine;
    @Autowired private GoalRepository goalRepository;
    @Autowired private WeeklyScheduledActivityService weeklyActivity;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void draftWithMoreSessionsRaisesSegmentKcal() {
        UUID user = databasePopulator.populateUser("goal-draft@test.local");
        profilePopulator.create(user);
        LocalDate today = LocalDate.now();
        weightLogPopulator.createWeightLog(user, today.minusDays(1), new BigDecimal("84.0"));
        GoalEntity goal = goalPopulator.createGoalFull(user, today.minusWeeks(1), today.plusWeeks(7), null, null, null, null);
        for (int d : new int[] {0, 1, 3, 4}) {
            trainPopulator.createGymSlot(user, d, "17:30");
        }
        engine.evaluate(user, goal.getId());
        goalRepository.flush();
        GoalPrescriptionJson stored = goalRepository.findById(goal.getId()).orElseThrow().getPrescription();

        List<DraftSlot> four = List.of(new DraftSlot("gym", 0), new DraftSlot("gym", 0),
            new DraftSlot("gym", 0), new DraftSlot("gym", 0));
        List<DraftSlot> five = new ArrayList<>(four);
        five.add(new DraftSlot("gym", 0));

        GoalPrescriptionCalculator.Calculation now =
            calculator.calculate(user, goal, null, rest -> weeklyActivity.draftWeeklyEatKcalPerDay(four, rest));
        GoalPrescriptionCalculator.Calculation more =
            calculator.calculate(user, goal, null, rest -> weeklyActivity.draftWeeklyEatKcalPerDay(five, rest));

        int week = 2;
        assertThat(GoalPrescriptionJson.currentSegment(more.prescription(), week).kcal())
            .isGreaterThan(GoalPrescriptionJson.currentSegment(now.prescription(), week).kcal());
        // The same slots as the repository → the same segment the persisted evaluation stored.
        assertThat(GoalPrescriptionJson.currentSegment(now.prescription(), week).kcal())
            .isEqualTo(GoalPrescriptionJson.currentSegment(stored, week).kcal());
        // Nothing persisted: the stored prescription is unchanged after both draft calls.
        goalRepository.flush();
        assertThat(goalRepository.findById(goal.getId()).orElseThrow().getPrescription()).isEqualTo(stored);
    }
}
