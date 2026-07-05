package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Verifies that the {@code mezo.nutrition.*} block in {@code application.yml} binds onto
 * {@link NutritionTargetsProperties} with the seed daily targets — see
 * docs/references/configuration_conventions.md. Pure config has no meaningful RED-before-GREEN
 * failure mode beyond "the bean does not exist / does not bind"; it goes green once the record
 * and its YAML block are in place. Extends the shared base (never raw {@code @SpringBootTest})
 * so it rides the one Testcontainers-wired context.
 */
class NutritionTargetsPropertiesIT extends AbstractIntegrationTest {

    @Autowired
    private NutritionTargetsProperties props;

    @Test
    void testDefaults_shouldBindSeedTargets_whenContextLoads() {
        assertThat(props.kcal()).isEqualTo(3100);
        assertThat(props.p()).isEqualTo(220);
        assertThat(props.c()).isEqualTo(380);
        assertThat(props.f()).isEqualTo(95);
        assertThat(props.water()).isEqualTo(4000);
    }
}
