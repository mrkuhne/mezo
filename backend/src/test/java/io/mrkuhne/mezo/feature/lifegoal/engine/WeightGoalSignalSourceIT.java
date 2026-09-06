package io.mrkuhne.mezo.feature.lifegoal.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class WeightGoalSignalSourceIT extends AbstractIntegrationTest {

    @Autowired private WeightGoalSignalSource source;
    @Autowired private GoalRepository goalRepository;
    @Autowired private WeightLogRepository weightLogRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;

    private final LocalDate today = LocalDate.now();

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private GoalEntity activeGoal(UUID userId) {
        GoalEntity g = new GoalEntity();
        g.setCreatedBy(userId);
        g.setTitle("Nyári cut");
        g.setTrajectory("cut");
        g.setGuards(List.of("strength", "muscle"));
        g.setStatus("active");
        g.setStartDate(today.minusDays(20));
        g.setTargetDate(today.plusDays(50));
        g.setStartWeightKg(new BigDecimal("92.00"));
        g.setTargetWeightKg(new BigDecimal("85.00"));
        g.setRateTargetPctPerWeek(new BigDecimal("0.70"));
        return goalRepository.saveAndFlush(g);
    }

    private void weighIn(UUID userId, LocalDate on, double kg) {
        WeightLogEntity e = new WeightLogEntity();
        e.setCreatedBy(userId);
        e.setDate(on);
        e.setWeightKg(BigDecimal.valueOf(kg));
        weightLogRepository.saveAndFlush(e);
    }

    @Test
    void window_carries_trend_values_and_expected_targets() {
        UUID userId = ownerId();
        activeGoal(userId);
        // 15 days, weight sliding from 92.0 down to 91.0
        for (int i = 14; i >= 0; i--) {
            double kg = 92.0 - (14 - i) * (1.0 / 14.0);
            weighIn(userId, today.minusDays(i), kg);
        }

        PillarSourceJson src = new PillarSourceJson("weight_goal", null, null, null, null, null);
        SignalWindow w = source.window(userId, src, today.minusDays(6), today);

        assertThat(w.values()).isNotEmpty();
        assertThat(w.targets().get(today)).isNotNull();
        // expected(today) = 92 + (85-92) * 20/70 = 90.0
        assertThat(w.targets().get(today).doubleValue()).isCloseTo(90.0, within(0.05));
    }

    @Test
    void no_active_goal_yields_empty_window() {
        UUID userId = ownerId();
        weighIn(userId, today, 80.0);

        PillarSourceJson src = new PillarSourceJson("weight_goal", null, null, null, null, null);
        SignalWindow w = source.window(userId, src, today.minusDays(6), today);

        assertThat(w.values()).isEmpty();
    }

    @Test
    void testWindow_shouldReturnEmptyWindow_whenActiveGoalHasNoTargetWeight() {
        UUID userId = ownerId();
        GoalEntity g = new GoalEntity();
        g.setCreatedBy(userId);
        g.setTitle("Csak kitartás");
        g.setTrajectory("maintain");
        g.setGuards(List.of("strength", "muscle"));
        g.setStatus("active");
        g.setStartDate(today.minusDays(20));
        g.setTargetDate(today.plusDays(50));
        g.setStartWeightKg(new BigDecimal("92.00"));
        g.setTargetWeightKg(null); // no numeric target -> honest absence, not a computed pace line
        g.setRateTargetPctPerWeek(new BigDecimal("0.70"));
        goalRepository.saveAndFlush(g);
        weighIn(userId, today, 90.0);

        PillarSourceJson src = new PillarSourceJson("weight_goal", null, null, null, null, null);
        SignalWindow w = source.window(userId, src, today.minusDays(6), today);

        assertThat(w.values()).isEmpty();
        assertThat(w.targets()).isEmpty();
    }

    @Test
    void testWindow_shouldReturnEmptyWindow_whenActiveGoalHasNoWeighIns() {
        UUID userId = ownerId();
        activeGoal(userId); // target set, but no WeightLogEntity rows at all -> EWMA series is empty

        PillarSourceJson src = new PillarSourceJson("weight_goal", null, null, null, null, null);
        SignalWindow w = source.window(userId, src, today.minusDays(6), today);

        assertThat(w.values()).isEmpty();
        assertThat(w.targets()).isEmpty();
    }
}
