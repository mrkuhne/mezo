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

        assertThat(props.neat().desk()).isEqualTo(1.20);
        assertThat(props.neat().mixed()).isEqualTo(1.35);
        assertThat(props.neat().physical()).isEqualTo(1.50);

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
    }

    @Test
    void testDietSplitTunables_shouldBindFromYml() {
        assertThat(props.diet().fatShareBalanced()).isEqualTo(0.275);
        assertThat(props.diet().fatShareLowFat()).isEqualTo(0.20);
        assertThat(props.diet().fatShareLowCarb()).isEqualTo(0.40);
        assertThat(props.diet().fatShareHighCarb()).isEqualTo(0.22);
        assertThat(props.diet().fatFloorGPerKg()).isEqualTo(0.5);
        // preset resolution helper: custom uses the tenths-of-percent field, presets use config
        assertThat(props.diet().fatShareFor("balanced", null)).isEqualTo(0.275);
        assertThat(props.diet().fatShareFor("custom", 300)).isEqualTo(0.30);
        assertThat(props.diet().fatShareFor("unknown", null)).isEqualTo(0.275); // safe default
    }
}
