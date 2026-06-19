package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.api.dto.GoalPlanAttachRequest;
import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalPlanLinkService;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Task 9 — recompute triggers. Verifies that {@link GoalEngineService#evaluate} is fired on the
 * relevant write paths (goal activate, plan attach/detach, weight-log write) so the goal's
 * {@code prescription} jsonb stays fresh, and that every trigger is guarded (no active/relevant
 * goal → the underlying write still succeeds, no crash).
 */
@Transactional
class GoalEngineRecomputeIT extends AbstractIntegrationTest {

    @Autowired private GoalService goalService;
    @Autowired private GoalPlanLinkService linkService;
    @Autowired private WeightLogService weightLogService;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testActivateGoal_shouldPopulatePrescription_whenProfilePresent() {
        UUID user = databasePopulator.populateUser("activate@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "planned");
        assertThat(goal.getPrescription()).as("prescription null before activation").isNull();

        goalService.activateGoal(user, goal.getId());
        entityManager.flush();
        entityManager.clear();

        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getPrescription()).as("recompute fires on activate").isNotNull();
        assertThat(reloaded.getTdeeBootstrap()).isNotNull();
        assertThat(reloaded.getPrescription().feasibility().verdict()).isNotBlank();
    }

    @Test
    void testActivateGoal_shouldStayGraceful_whenNoProfile() {
        UUID user = databasePopulator.populateUser("noprofile@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "planned");

        // No biometric profile: the activate must still succeed and the prescription carries the
        // "profile required" feasibility note (graceful, never throws).
        assertThatCode(() -> goalService.activateGoal(user, goal.getId())).doesNotThrowAnyException();
        entityManager.flush();
        entityManager.clear();

        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("active");
        assertThat(reloaded.getPrescription()).isNotNull();
        assertThat(reloaded.getTdeeBootstrap()).as("no bootstrap without a profile").isNull();
        assertThat(reloaded.getPrescription().feasibility().notes())
            .anyMatch(n -> n.toLowerCase().contains("profil") || n.toLowerCase().contains("profile"));
    }

    @Test
    void testAttachPlan_shouldChangeSegments_whenMesocycleAttached() {
        UUID user = databasePopulator.populateUser("attach@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");

        goalService.activateGoal(user, goal.getId()); // initial recompute (no links yet)
        entityManager.flush();
        entityManager.clear();
        List<GoalPrescriptionJson.Segment> before =
            goalRepository.findById(goal.getId()).orElseThrow().getPrescription().segments();

        // A mesocycle spans goal-weeks → splits the timeline into gym/no-gym segments; the recompute
        // on attach must re-segment the prescription.
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "RP block", "active"); // weeks = 6
        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("mesocycle").planId(meso.getId()).startWeek(1);
        linkService.attachPlan(user, goal.getId(), req);
        entityManager.flush();
        entityManager.clear();

        List<GoalPrescriptionJson.Segment> after =
            goalRepository.findById(goal.getId()).orElseThrow().getPrescription().segments();
        assertThat(after).as("attach re-evaluated the prescription").isNotEqualTo(before);
        assertThat(after).hasSizeGreaterThan(before.size());
    }

    @Test
    void testDetachPlan_shouldRecompute_whenLinkRemoved() {
        UUID user = databasePopulator.populateUser("detach@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");

        MesocycleEntity meso = trainPopulator.createMesocycle(user, "RP block", "active");
        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("mesocycle").planId(meso.getId()).startWeek(1);
        var link = linkService.attachPlan(user, goal.getId(), req);
        entityManager.flush();
        entityManager.clear();
        List<GoalPrescriptionJson.Segment> withLink =
            goalRepository.findById(goal.getId()).orElseThrow().getPrescription().segments();

        linkService.detachPlan(user, goal.getId(), link.getId());
        entityManager.flush();
        entityManager.clear();

        List<GoalPrescriptionJson.Segment> afterDetach =
            goalRepository.findById(goal.getId()).orElseThrow().getPrescription().segments();
        assertThat(afterDetach).as("detach re-evaluated the prescription").isNotEqualTo(withLink);
    }

    @Test
    void testLogWeight_shouldShiftProjectedRate_whenOwnerHasActiveGoal() {
        UUID user = databasePopulator.populateUser("weight@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");

        goalService.activateGoal(user, goal.getId()); // initial recompute, no weigh-ins yet
        entityManager.flush();
        entityManager.clear();
        BigDecimal beforeRate = goalRepository.findById(goal.getId()).orElseThrow()
            .getPrescription().segments().get(0).projectedRateKgPerWk();

        // Seed a real downward trend (>= provisional sufficiency) so the projection's reconciliation
        // swaps in the observed trailing-4w rate as the spine.
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 1), new BigDecimal("84.20"));
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 8), new BigDecimal("83.40"));
        weightLogPopulator.createWeightLog(user, LocalDate.of(2026, 6, 15), new BigDecimal("82.70"));

        // The triggering write: a fresh weigh-in must recompute the owner's active goal.
        weightLogService.log(user, new LogWeightRequest()
            .date(LocalDate.of(2026, 6, 18)).weightKg(new BigDecimal("82.10")));
        entityManager.flush();
        entityManager.clear();

        BigDecimal afterRate = goalRepository.findById(goal.getId()).orElseThrow()
            .getPrescription().segments().get(0).projectedRateKgPerWk();
        assertThat(afterRate).as("the weigh-in moved the projected rate (the spine shifted)")
            .isNotEqualByComparingTo(beforeRate);
    }

    @Test
    void testLogWeight_shouldSucceed_whenOwnerHasNoActiveGoal() {
        UUID user = databasePopulator.populateUser("no-goal@test.local");
        profilePopulator.create(user);
        // No active goal at all — the recompute trigger must skip gracefully, never break the write.
        goalPopulator.createGoal(user, "cut", "planned"); // planned, not active

        assertThatCode(() -> weightLogService.log(user, new LogWeightRequest()
            .date(LocalDate.of(2026, 6, 18)).weightKg(new BigDecimal("82.10"))))
            .doesNotThrowAnyException();
        entityManager.flush();
        entityManager.clear();

        assertThat(weightLogService.list(user)).hasSize(1);
    }
}
