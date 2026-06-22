package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class GoalServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalService goalService;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testCreateGoal_shouldRoundTripTrajectoryAndGuards_whenPersisted() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        GoalEntity saved = goalPopulator.createGoal(user, "cut", "planned");
        entityManager.clear();
        GoalEntity reloaded = goalRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getTrajectory()).isEqualTo("cut");
        assertThat(reloaded.getGuards()).containsExactlyInAnyOrder("strength", "muscle");
        assertThat(reloaded.getCreatedBy()).isEqualTo(user);
    }

    @Test
    void testCreateGoal_shouldRejectRow_whenTrajectoryNotInCheck() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        assertThatThrownBy(() -> goalPopulator.createGoal(user, "recomp", "planned"))
            .hasMessageContaining("ck_goal_trajectory");
    }

    @Test
    void testFindByOwner_shouldExcludeOtherOwners_whenQueried() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        goalPopulator.createGoal(me, "cut", "active");
        goalPopulator.createGoal(other, "bulk", "active");
        List<GoalEntity> mine = goalRepository.findByCreatedByAndDeletedFalseOrderByStartDateDesc(me);
        assertThat(mine).hasSize(1).allMatch(g -> g.getCreatedBy().equals(me));
    }

    @Test
    void testCreateGoal_shouldDefaultStatusToPlanned_whenCreated() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        GoalResponse res = goalService.createGoal(user, upsertReq().build());
        assertThat(res.getStatus()).isEqualTo(GoalResponse.StatusEnum.PLANNED);
        assertThat(res.getTrajectory()).isEqualTo(GoalResponse.TrajectoryEnum.CUT);
        assertThat(res.getGuards())
            .containsExactlyInAnyOrder(GoalResponse.GuardsEnum.STRENGTH, GoalResponse.GuardsEnum.MUSCLE);
        assertThat(res.getId()).isNotNull();
    }

    @Test
    void testGetGoal_shouldThrow404_whenForeignOwner() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        GoalEntity foreign = goalPopulator.createGoal(other, "cut", "planned");
        assertThatThrownBy(() -> goalService.getGoal(me, foreign.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("RESOURCE_NOT_FOUND");
    }

    @Test
    void testListGoals_shouldHoistActiveFirst_whenMixedStatuses() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        goalPopulator.createGoal(user, "cut", "planned");
        goalPopulator.createGoal(user, "bulk", "active");
        goalPopulator.createGoal(user, "maintain", "archived");
        List<GoalResponse> goals = goalService.listGoals(user);
        assertThat(goals).hasSize(3);
        assertThat(goals.get(0).getStatus()).isEqualTo(GoalResponse.StatusEnum.ACTIVE);
    }

    @Test
    void testUpdateGoal_shouldNotTouchStatus_whenLifecycleOwned() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        GoalEntity active = goalPopulator.createGoal(user, "cut", "active");
        GoalResponse res =
            goalService.updateGoal(user, active.getId(), upsertReq().title("Updated").build());
        assertThat(res.getTitle()).isEqualTo("Updated");
        assertThat(res.getStatus()).isEqualTo(GoalResponse.StatusEnum.ACTIVE);
    }

    @Test
    void testDeleteGoal_shouldSoftDelete_whenOwned() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        GoalEntity g = goalPopulator.createGoal(user, "cut", "planned");
        goalService.deleteGoal(user, g.getId());
        entityManager.flush();
        entityManager.clear();
        assertThat(goalRepository.findByIdAndCreatedByAndDeletedFalse(g.getId(), user)).isEmpty();
    }

    @Test
    void testActivateGoal_shouldArchivePreviousActive_whenAnotherIsActivated() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        var first = goalPopulator.createGoal(user, "cut", "active");
        var second = goalPopulator.createGoal(user, "bulk", "planned");
        goalService.activateGoal(user, second.getId());
        entityManager.flush();
        entityManager.clear();
        assertThat(goalRepository.findById(first.getId()).orElseThrow().getStatus()).isEqualTo("archived");
        assertThat(goalRepository.findById(second.getId()).orElseThrow().getStatus()).isEqualTo("active");
    }

    @Test
    void testEngineJsonb_shouldRoundTripPrescriptionAndTdeeBootstrap_whenPersisted() {
        UUID user = databasePopulator.populateUser("goal-engine@test.local");
        GoalEntity g = goalPopulator.createGoal(user, "cut", "active");

        TdeeBootstrapJson tdee = new TdeeBootstrapJson(
            new BigDecimal("1820.0"), new BigDecimal("2821.0"), new BigDecimal("1.55"),
            "MSJ", OffsetDateTime.of(2026, 6, 19, 10, 0, 0, 0, ZoneOffset.UTC));

        GoalPrescriptionJson prescription = new GoalPrescriptionJson(
            OffsetDateTime.of(2026, 6, 19, 10, 0, 0, 0, ZoneOffset.UTC),
            "formula",
            List.of(new GoalPrescriptionJson.Segment(
                1, 4, "Indító deficit", 2300, 168, new BigDecimal("7.5"),
                List.of(3, 6), new BigDecimal("-0.55"), "Mérsékelt deficit, erő megtartva.")),
            new GoalPrescriptionJson.GuardStatus(
                new GoalPrescriptionJson.GuardStatus.Strength(
                    true, new BigDecimal("-1.20"), false, List.of("e1RM stabil")),
                new GoalPrescriptionJson.GuardStatus.Muscle(
                    true, 10, List.of("quads"), true, false, List.of("fehérje nincs még logolva"))),
            new GoalPrescriptionJson.Feasibility(
                "feasible-with-warnings", List.of("Ráta a felső sávban.")));

        g.setTdeeBootstrap(tdee);
        g.setPrescription(prescription);
        goalRepository.saveAndFlush(g);
        entityManager.clear();

        GoalEntity reloaded = goalRepository.findById(g.getId()).orElseThrow();
        assertThat(reloaded.getTdeeBootstrap()).isEqualTo(tdee);
        assertThat(reloaded.getPrescription()).isEqualTo(prescription);
        // spot-check the nested round-trip survived the jsonb serialization
        assertThat(reloaded.getPrescription().segments()).singleElement()
            .satisfies(s -> {
                assertThat(s.kcal()).isEqualTo(2300);
                assertThat(s.restDays()).containsExactly(3, 6);
            });
        assertThat(reloaded.getPrescription().guardStatus().muscle().belowMaintenanceMuscles())
            .containsExactly("quads");
    }

    @Test
    void testEngineJsonb_shouldRemainNull_whenGoalNotEvaluated() {
        UUID user = databasePopulator.populateUser("goal-unevaluated@test.local");
        GoalEntity g = goalPopulator.createGoal(user, "cut", "planned");
        entityManager.clear();
        GoalEntity reloaded = goalRepository.findById(g.getId()).orElseThrow();
        assertThat(reloaded.getTdeeBootstrap()).isNull();
        assertThat(reloaded.getPrescription()).isNull();
    }

    @Test
    void testCreateGoal_shouldDeriveRate_whenCutGoal() {
        // (84 − 78) / 84 * 100 / 17 weeks = 0.42016806… → unsigned magnitude (engine signs by trajectory).
        UUID user = databasePopulator.populateUser("goal-cut@test.local");
        GoalResponse res = goalService.createGoal(user, upsertReq()
            .trajectory("cut")
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 9, 28)) // 17 weeks
            .startWeightKg(new BigDecimal("84.00")).targetWeightKg(new BigDecimal("78.00"))
            .build());
        assertThat(res.getRateTargetPctPerWeek())
            .isCloseTo(new BigDecimal("0.42"), within(new BigDecimal("0.005")));
    }

    @Test
    void testCreateGoal_shouldDerivePositiveMagnitude_whenBulkGoal() {
        // (84 − 80) / 80 * 100 / 10 weeks = 0.50 — stored unsigned (positive).
        UUID user = databasePopulator.populateUser("goal-bulk@test.local");
        GoalResponse res = goalService.createGoal(user, upsertReq()
            .trajectory("bulk")
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 8, 10)) // 10 weeks
            .startWeightKg(new BigDecimal("80.00")).targetWeightKg(new BigDecimal("84.00"))
            .build());
        assertThat(res.getRateTargetPctPerWeek())
            .isCloseTo(new BigDecimal("0.50"), within(new BigDecimal("0.005")));
    }

    @Test
    void testCreateGoal_shouldDeriveZeroRate_whenMaintain() {
        // maintain has no targetWeightKg → rate is forced to 0.
        UUID user = databasePopulator.populateUser("goal-maintain@test.local");
        GoalResponse res = goalService.createGoal(user, upsertReq()
            .trajectory("maintain").targetWeightKg(null).build());
        assertThat(res.getRateTargetPctPerWeek()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void testUpdateGoal_shouldReDeriveRate_whenTargetWeightOrDateChanges() {
        UUID user = databasePopulator.populateUser("goal-rederive@test.local");
        GoalResponse created = goalService.createGoal(user, upsertReq()
            .trajectory("cut")
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 9, 28)) // 17 weeks
            .startWeightKg(new BigDecimal("84.00")).targetWeightKg(new BigDecimal("78.00"))
            .build());
        assertThat(created.getRateTargetPctPerWeek())
            .isCloseTo(new BigDecimal("0.42"), within(new BigDecimal("0.005")));

        // Halve the window (17 → 8 weeks, faster) and the magnitude must (re-)derive higher.
        GoalResponse updated = goalService.updateGoal(user, created.getId(), upsertReq()
            .trajectory("cut")
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 7, 27)) // 8 weeks
            .startWeightKg(new BigDecimal("84.00")).targetWeightKg(new BigDecimal("78.00"))
            .build());
        // (84 − 78) / 84 * 100 / 8 = 0.89285… → re-derived, clearly higher than the 17-week rate.
        assertThat(updated.getRateTargetPctPerWeek())
            .isCloseTo(new BigDecimal("0.89"), within(new BigDecimal("0.01")));
    }

    private static GoalUpsertRequest.GoalUpsertRequestBuilder upsertReq() {
        return GoalUpsertRequest.builder()
            .title("Nyári cut").trajectory("cut").guards(List.of("strength", "muscle"))
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 7, 27))
            .startWeightKg(new BigDecimal("84.20")).targetWeightKg(new BigDecimal("80.00"))
            .identityFrame("Erő megtartva.");
    }
}
