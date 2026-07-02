package io.mrkuhne.mezo.feature.goal.engine;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Verifies that the {@code mezo.goal.*} block in {@code application.yml} binds onto
 * {@link GoalEngineProperties} with the grounded-research defaults — see
 * docs/references/configuration_conventions.md.
 *
 * <p>Pure config has no meaningful RED-before-GREEN failure mode; the test fails first because
 * the {@code GoalEngineProperties} bean does not exist / does not bind, then passes once the
 * record and its YAML block are in place. Extends the shared base (never raw
 * {@code @SpringBootTest}) so it rides the one Testcontainers-wired context.
 */
class GoalEnginePropertiesIT extends AbstractIntegrationTest {

    @Autowired
    private GoalEngineProperties props;

    @Test
    void testDefaults_shouldBindGroundedResearchValues_whenContextLoads() {
        assertThat(props.kcalPerKg()).isEqualTo(7700);
        assertThat(props.bootstrapUncertaintyKcal()).isEqualTo(300);
        assertThat(props.thermogenesisHaircutKcalPerDay()).isEqualTo(0);

        assertThat(props.pal().sedentary()).isEqualTo(1.2);
        assertThat(props.pal().light()).isEqualTo(1.375);
        assertThat(props.pal().moderate()).isEqualTo(1.55);
        assertThat(props.pal().very()).isEqualTo(1.725);
        assertThat(props.pal().extra()).isEqualTo(1.9);

        assertThat(props.protein().gPerKgBwDefault()).isEqualTo(2.0);
        assertThat(props.protein().gPerKgBwFloor()).isEqualTo(1.6);
        assertThat(props.protein().gPerKgBwCeil()).isEqualTo(2.2);
        assertThat(props.protein().gPerKgLbmLow()).isEqualTo(2.3);
        assertThat(props.protein().gPerKgLbmHigh()).isEqualTo(3.1);
        assertThat(props.protein().gPerKgBwCap()).isEqualTo(2.6);

        assertThat(props.rate().targetPctPerWeek()).isEqualTo(0.7);
        assertThat(props.rate().capPctPerWeek()).isEqualTo(1.0);
        assertThat(props.rate().bandLow()).isEqualTo(0.5);
        assertThat(props.rate().bandHigh()).isEqualTo(1.0);

        assertThat(props.volume().maintenanceSets()).isEqualTo(8);
        assertThat(props.volume().warnBelow()).isEqualTo(6);

        assertThat(props.strength().e1rmBreachPct()).isEqualTo(-5.0);

        assertThat(props.ewma().halfLifeDays()).isEqualTo(10);

        assertThat(props.met().hypertrophyKcal()).isEqualTo(325);
        assertThat(props.met().intervalRunKcal()).isEqualTo(500);
        assertThat(props.met().volleyballRecKcal()).isEqualTo(500);
        assertThat(props.met().volleyballCompKcal()).isEqualTo(1150);
    }
}
