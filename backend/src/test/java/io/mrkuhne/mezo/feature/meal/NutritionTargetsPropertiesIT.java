package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.meal.config.NutritionTargetsProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Verifies that the {@code mezo.nutrition.*} block in {@code application.yml} binds onto
 * {@link NutritionTargetsProperties} with the seed daily targets — see
 * docs/references/configuration_conventions.md. Pure config has no meaningful RED-before-GREEN
 * failure mode beyond "the bean does not exist / does not bind"; it goes green once the record
 * and its YAML block are in place.
 */
@SpringBootTest
class NutritionTargetsPropertiesIT {

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
