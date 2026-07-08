package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.HypertrophyProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

class HypertrophyPropertiesIT extends AbstractIntegrationTest {

    @Autowired HypertrophyProperties props;
    @Autowired ApplicationContext ctx;

    @Test
    void testProperties_shouldBind_whenApplicationYmlLoaded() {
        assertThat(props.plateStep()).isEqualByComparingTo(BigDecimal.valueOf(2.5));
        assertThat(props.increment().get("compound")).isEqualByComparingTo(BigDecimal.valueOf(5.0));
        assertThat(props.warmupRamp()).hasSize(2);
        assertThat(props.warmupRamp().get(0).pct()).isEqualTo(0.50);
        assertThat(props.defaultWarmupSets()).isEqualTo(2);
    }

    @Test
    void testGate_shouldBePresent_whenSwitchEnabled() {
        // default test profile has the switch on (application.yml)
        Assertions.assertThat(ctx.getBeansOfType(HypertrophyDriveGate.class)).isNotEmpty();
    }
}
