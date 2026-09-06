package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-iizd.10: with the companion feature switch off, {@code MetricSignalSource} does not
 * exist — every {@code metric}-typed trigger signal is "asleep" (no serving {@code SignalSource}
 * bean), and {@link LifeGoalCompanionAdapter#summary} must exclude the plan rather than guess.
 * Separate class because the switch is a fixed per-context property (see the
 * {@code CharacterApiCompanionOffIT} precedent).
 */
@Transactional
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class LifeGoalCompanionAdapterCompanionOffIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalSource adapter;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private LifeGoalRepository goalRepository;

    @Test
    void testSummary_shouldExcludePlan_whenItsSignalSourceIsSleeping() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        goal.setIfThenPlans(List.of(new IfThenPlanJson(
            "ha az energiám 4 alatt van", "akkor 10 perc séta",
            new PlanTriggerJson("checkin_energy_lte", "4", null))));
        goalRepository.saveAndFlush(goal);
        // Energia 3 ≤ 4 → élne, HA lenne kiszolgáló SignalSource bean a metrikára.
        checkInPopulator.createCheckIn(owner, today, "06:30", 3, 5, null);

        LifeGoalSource.Summary summary = adapter.summary(owner, today);

        // A companion switch off ⇒ nincs MetricSignalSource bean ⇒ a jel ALSZIK — a tervet
        // nem tippeljük ki (a trigger-service precedense).
        assertThat(summary.livePlans()).isEmpty();
    }
}
