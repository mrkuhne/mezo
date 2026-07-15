package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.proactive.service.ChallengeOutcomeEvaluator;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ChallengePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic, LLM-free set-level outcome evaluation of accepted workout challenges over FIXED
 * past/today dates. Proves PR (weight∧reps), Depth (last set RIR), Volume (logged-set count) hit/miss,
 * the honest {@code inconclusive} when a passed day carries no logged sets, and the untouched
 * still-accepted state when today's workout is simply not logged yet.
 */
@Transactional
class ChallengeOutcomeIT extends AbstractIntegrationTest {

    private static final LocalDate PAST = LocalDate.parse("2026-07-06");
    private static final LocalDate TODAY = LocalDate.parse("2026-07-07");

    @Autowired
    private ChallengeOutcomeEvaluator evaluator;

    @Autowired
    private ChallengeRepository challengeRepository;

    @Autowired
    private ChallengePopulator challengePopulator;

    @Autowired
    private TrainPopulator trainPopulator;

    @Autowired
    private UserPopulator userPopulator;

    /** A planted template session (the challenge's {@code templateSessionId}) + its target exercise. */
    private record Plan(WorkoutSessionEntity template, UUID exerciseId) {
        UUID templateSessionId() {
            return template.getId();
        }
    }

    private Plan plantTemplate(UUID user) {
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Teszt meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
            user, meso.getId(), "H", "gym", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Chest Supported Row", 0);
        return new Plan(template, exercise.getId());
    }

    private ChallengeEntity reload(ChallengeEntity c) {
        return challengeRepository.findById(c.getId()).orElseThrow();
    }

    private ChallengeEntity depthChallenge(UUID user, Plan plan, LocalDate date, int targetRir) {
        ChallengeEntity c = challengePopulator.challenge(user, plan.templateSessionId(), date, plan.exerciseId(),
            ChallengeEntity.TYPE_DEPTH, ChallengeEntity.STATUS_ACCEPTED);
        c.setTargetRir(targetRir);
        return challengeRepository.saveAndFlush(c);
    }

    private ChallengeEntity volumeChallenge(UUID user, Plan plan, LocalDate date, int targetSets) {
        ChallengeEntity c = challengePopulator.challenge(user, plan.templateSessionId(), date, plan.exerciseId(),
            ChallengeEntity.TYPE_VOLUME, ChallengeEntity.STATUS_ACCEPTED);
        c.setTargetSets(targetSets);
        return challengeRepository.saveAndFlush(c);
    }

    @Test
    void testEvaluate_shouldHit_whenPrSetMeetsWeightAndReps() {
        UUID user = userPopulator.createUser("chl-pr-hit@test.local").getId();
        Plan plan = plantTemplate(user);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(user, plan.template(), PAST, "completed");
        // target 80kg × 8; a logged set clears both (85kg × 10).
        ChallengeEntity c = challengePopulator.challengePr(
            user, plan.templateSessionId(), PAST, plan.exerciseId(), ChallengeEntity.STATUS_ACCEPTED, "80.00", 8);
        trainPopulator.createLoggedSet(user, plan.exerciseId(), instance.getId(), 0, "70.00", 12, 2);
        trainPopulator.createLoggedSet(user, plan.exerciseId(), instance.getId(), 1, "85.00", 10, 1);

        boolean transitioned = evaluator.evaluate(c, TODAY);

        assertThat(transitioned).isTrue();
        ChallengeEntity r = reload(c);
        assertThat(r.getStatus()).isEqualTo(ChallengeEntity.STATUS_HIT);
        assertThat(r.getOutcomeGood()).isTrue();
        assertThat(r.getOutcome()).startsWith("Sikerült");
    }

    @Test
    void testEvaluate_shouldMiss_whenNoPrSetMeetsTarget() {
        UUID user = userPopulator.createUser("chl-pr-miss@test.local").getId();
        Plan plan = plantTemplate(user);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(user, plan.template(), PAST, "completed");
        // target 100kg × 8; best logged set is only 85kg — nothing clears the weight.
        ChallengeEntity c = challengePopulator.challengePr(
            user, plan.templateSessionId(), PAST, plan.exerciseId(), ChallengeEntity.STATUS_ACCEPTED, "100.00", 8);
        trainPopulator.createLoggedSet(user, plan.exerciseId(), instance.getId(), 0, "85.00", 10, 1);

        boolean transitioned = evaluator.evaluate(c, TODAY);

        assertThat(transitioned).isTrue();
        ChallengeEntity r = reload(c);
        assertThat(r.getStatus()).isEqualTo(ChallengeEntity.STATUS_MISS);
        assertThat(r.getOutcomeGood()).isFalse();
        assertThat(r.getOutcome()).startsWith("Nem sikerült");
    }

    @Test
    void testEvaluate_shouldHit_whenDepthLastSetRirWithinTarget() {
        UUID user = userPopulator.createUser("chl-depth-hit@test.local").getId();
        Plan plan = plantTemplate(user);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(user, plan.template(), PAST, "completed");
        // target RIR ≤ 2 on the LAST set; earlier set is far from failure (RIR 4), last set RIR 1 → hit.
        ChallengeEntity c = depthChallenge(user, plan, PAST, 2);
        trainPopulator.createLoggedSet(user, plan.exerciseId(), instance.getId(), 0, "80.00", 8, 4);
        trainPopulator.createLoggedSet(user, plan.exerciseId(), instance.getId(), 1, "80.00", 8, 1);

        boolean transitioned = evaluator.evaluate(c, TODAY);

        assertThat(transitioned).isTrue();
        ChallengeEntity r = reload(c);
        assertThat(r.getStatus()).isEqualTo(ChallengeEntity.STATUS_HIT);
        assertThat(r.getOutcomeGood()).isTrue();
    }

    @Test
    void testEvaluate_shouldHitAndMiss_whenVolumeCountAtOrBelowTarget() {
        UUID user = userPopulator.createUser("chl-vol@test.local").getId();

        // HIT: target 3 sets, 3 logged.
        Plan hitPlan = plantTemplate(user);
        WorkoutSessionEntity hitInstance =
            trainPopulator.createWorkoutInstance(user, hitPlan.template(), PAST, "completed");
        ChallengeEntity hit = volumeChallenge(user, hitPlan, PAST, 3);
        trainPopulator.createLoggedSet(user, hitPlan.exerciseId(), hitInstance.getId(), 0, "80.00", 8, 2);
        trainPopulator.createLoggedSet(user, hitPlan.exerciseId(), hitInstance.getId(), 1, "80.00", 8, 2);
        trainPopulator.createLoggedSet(user, hitPlan.exerciseId(), hitInstance.getId(), 2, "80.00", 8, 2);

        assertThat(evaluator.evaluate(hit, TODAY)).isTrue();
        ChallengeEntity hr = reload(hit);
        assertThat(hr.getStatus()).isEqualTo(ChallengeEntity.STATUS_HIT);
        assertThat(hr.getOutcomeGood()).isTrue();

        // MISS: target 4 sets, only 2 logged.
        Plan missPlan = plantTemplate(user);
        WorkoutSessionEntity missInstance =
            trainPopulator.createWorkoutInstance(user, missPlan.template(), PAST, "completed");
        ChallengeEntity miss = volumeChallenge(user, missPlan, PAST, 4);
        trainPopulator.createLoggedSet(user, missPlan.exerciseId(), missInstance.getId(), 0, "80.00", 8, 2);
        trainPopulator.createLoggedSet(user, missPlan.exerciseId(), missInstance.getId(), 1, "80.00", 8, 2);

        assertThat(evaluator.evaluate(miss, TODAY)).isTrue();
        ChallengeEntity mr = reload(miss);
        assertThat(mr.getStatus()).isEqualTo(ChallengeEntity.STATUS_MISS);
        assertThat(mr.getOutcomeGood()).isFalse();
    }

    @Test
    void testEvaluate_shouldBeInconclusive_whenPastDayHasNoLoggedSets() {
        UUID user = userPopulator.createUser("chl-inconc@test.local").getId();
        Plan plan = plantTemplate(user);
        // No instance at all — the user never trained that (now past) day.
        ChallengeEntity c = challengePopulator.challengePr(
            user, plan.templateSessionId(), PAST, plan.exerciseId(), ChallengeEntity.STATUS_ACCEPTED, "80.00", 8);

        boolean transitioned = evaluator.evaluate(c, TODAY);

        assertThat(transitioned).isTrue();
        ChallengeEntity r = reload(c);
        assertThat(r.getStatus()).isEqualTo(ChallengeEntity.STATUS_INCONCLUSIVE);
        assertThat(r.getOutcomeGood()).isNull();
        assertThat(r.getOutcome()).contains("Nem értékelhető");
    }

    @Test
    void testEvaluate_shouldResolveInconclusive_whenInstanceCompletedWithNoLoggedSets() {
        UUID user = userPopulator.createUser("chl-today-done-empty@test.local").getId();
        Plan plan = plantTemplate(user);
        // Completion unlocks same-day resolution: today's instance is 'completed' but the target
        // exercise carries NO logged sets → resolve inconclusive NOW, not wait out the day.
        trainPopulator.createWorkoutInstance(user, plan.template(), TODAY, "completed");
        ChallengeEntity c = challengePopulator.challengePr(
            user, plan.templateSessionId(), TODAY, plan.exerciseId(), ChallengeEntity.STATUS_ACCEPTED, "80.00", 8);

        boolean transitioned = evaluator.evaluate(c, TODAY);

        assertThat(transitioned).isTrue();
        ChallengeEntity r = reload(c);
        assertThat(r.getStatus()).isEqualTo(ChallengeEntity.STATUS_INCONCLUSIVE);
        assertThat(r.getOutcomeGood()).isNull();
        assertThat(r.getOutcome()).contains("Nem értékelhető");
    }

    @Test
    void testEvaluate_shouldStayAccepted_whenTodaysWorkoutNotLoggedYet() {
        UUID user = userPopulator.createUser("chl-today@test.local").getId();
        Plan plan = plantTemplate(user);
        // Instance exists for today but carries no logged sets yet.
        trainPopulator.createWorkoutInstance(user, plan.template(), TODAY, "planned");
        ChallengeEntity c = challengePopulator.challengePr(
            user, plan.templateSessionId(), TODAY, plan.exerciseId(), ChallengeEntity.STATUS_ACCEPTED, "80.00", 8);

        boolean transitioned = evaluator.evaluate(c, TODAY);

        assertThat(transitioned).isFalse();
        ChallengeEntity r = reload(c);
        assertThat(r.getStatus()).isEqualTo(ChallengeEntity.STATUS_ACCEPTED);
        assertThat(r.getOutcomeGood()).isNull();
    }

    @Test
    void testEvaluate_shouldStayAccepted_whenTodaysInstanceStillActiveWithPartialSets() {
        UUID user = userPopulator.createUser("chl-today-active@test.local").getId();
        Plan plan = plantTemplate(user);
        // Mid-workout: today's instance is still 'active' and carries a PARTIAL set that would MISS
        // the 80kg×8 target (60kg×5). A GET fired now must NOT resolve to a sticky miss.
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(user, plan.template(), TODAY, "active");
        ChallengeEntity c = challengePopulator.challengePr(
            user, plan.templateSessionId(), TODAY, plan.exerciseId(), ChallengeEntity.STATUS_ACCEPTED, "80.00", 8);
        trainPopulator.createLoggedSet(user, plan.exerciseId(), instance.getId(), 0, "60.00", 5, 3);

        boolean transitioned = evaluator.evaluate(c, TODAY);

        assertThat(transitioned).isFalse();
        ChallengeEntity r = reload(c);
        assertThat(r.getStatus()).isEqualTo(ChallengeEntity.STATUS_ACCEPTED);
        assertThat(r.getOutcomeGood()).isNull();
    }

    @Test
    void testEvaluate_shouldHit_whenTodaysInstanceCompletedWithHittingSet() {
        UUID user = userPopulator.createUser("chl-today-done@test.local").getId();
        Plan plan = plantTemplate(user);
        // Completion unlocks same-day resolution: today's instance is 'completed' and a set clears
        // the 80kg×8 target (85kg×10) → hit even though the workout is today.
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(user, plan.template(), TODAY, "completed");
        ChallengeEntity c = challengePopulator.challengePr(
            user, plan.templateSessionId(), TODAY, plan.exerciseId(), ChallengeEntity.STATUS_ACCEPTED, "80.00", 8);
        trainPopulator.createLoggedSet(user, plan.exerciseId(), instance.getId(), 0, "85.00", 10, 1);

        boolean transitioned = evaluator.evaluate(c, TODAY);

        assertThat(transitioned).isTrue();
        ChallengeEntity r = reload(c);
        assertThat(r.getStatus()).isEqualTo(ChallengeEntity.STATUS_HIT);
        assertThat(r.getOutcomeGood()).isTrue();
    }

    @Test
    void testEvaluateDue_shouldResolveAllAcceptedRows_whenBackstopRuns() {
        UUID user = userPopulator.createUser("chl-due@test.local").getId();
        Plan plan = plantTemplate(user);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(user, plan.template(), PAST, "completed");
        challengePopulator.challengePr(
            user, plan.templateSessionId(), PAST, plan.exerciseId(), ChallengeEntity.STATUS_ACCEPTED, "80.00", 8);
        trainPopulator.createLoggedSet(user, plan.exerciseId(), instance.getId(), 0, "85.00", 10, 1);

        int resolved = evaluator.evaluateDue(user, TODAY);

        assertThat(resolved).isEqualTo(1);
    }
}
