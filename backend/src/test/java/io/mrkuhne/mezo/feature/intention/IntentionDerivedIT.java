package io.mrkuhne.mezo.feature.intention;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.service.HabitEvaluator;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class IntentionDerivedIT extends AbstractIntegrationTest {

    @Autowired private HabitEvaluator habitEvaluator;
    @Autowired private IntentionService intentionService;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testFocusSet_shouldSatisfyHabitMetric_whenFocusExists() {
        UUID owner = userPopulator.createUser("intent-derived@test.hu").getId();
        LocalDate d = LocalDate.now();
        assertThat(habitEvaluator.satisfied("intention_focus_set", owner, d)).isFalse();
        intentionService.addFocus(owner, d, "Jelen lenni.");
        assertThat(habitEvaluator.satisfied("intention_focus_set", owner, d)).isTrue();
    }

    @Test
    void testReflected_shouldSatisfyHabitMetric_whenReflectionExists() {
        UUID owner = userPopulator.createUser("intent-reflect@test.hu").getId();
        LocalDate d = LocalDate.now();
        assertThat(habitEvaluator.satisfied("intention_reflected", owner, d)).isFalse();
        intentionService.reflect(owner, d, "yes");
        assertThat(habitEvaluator.satisfied("intention_reflected", owner, d)).isTrue();
    }
}
