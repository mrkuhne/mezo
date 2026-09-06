package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.rule.EnergyDipMealTimingRule;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Round 2 S6 (mezo-d58h.7.7): companion switch off ⇒ no energy-dip rule bean, so the whole
 *  detection is genuinely absent rather than silently evaluating. */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class EnergyDipMealTimingRuleSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoRuleBean_whenCompanionSwitchOff() {
        assertThat(context.getBeanProvider(EnergyDipMealTimingRule.class).getIfAvailable()).isNull();
    }
}
