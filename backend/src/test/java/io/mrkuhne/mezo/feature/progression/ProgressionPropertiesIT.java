package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ProgressionPropertiesIT extends AbstractIntegrationTest {

    @Autowired private ProgressionProperties properties;

    @Test
    void testGymConfig_shouldBindFromYaml_whenContextStarts() {
        ProgressionProperties.Gym gym = properties.gym();
        assertThat(gym.volumeUnit()).isEqualTo(100);
        assertThat(gym.volumeXpPerUnit()).isEqualTo(10);
        assertThat(gym.e1rmXpPerKg()).isEqualTo(2);
        assertThat(gym.prBonusXp()).isEqualTo(40);
        assertThat(gym.strengthEnduranceXpPerSet()).isEqualTo(8);
        assertThat(gym.bodyweightXpPerRep()).isEqualTo(1);
        assertThat(gym.robustness().perWeekXp()).isEqualTo(25);
    }

    @Test
    void testCurveConfig_shouldStillBind_whenContextStarts() {
        assertThat(properties.curve().base()).isEqualTo(100);
        assertThat(properties.curve().exp()).isEqualTo(1.6);
    }

    @Test
    void testRunConfig_shouldBindFromYaml_whenContextStarts() {
        ProgressionProperties.Run run = properties.run();
        assertThat(run.sprintXpPerRound()).isEqualTo(25);
        assertThat(run.anaerobicXpPerRound()).isEqualTo(15);
        assertThat(run.steadyXpPerMin()).isEqualTo(4);
        assertThat(run.aerobicXpPerMin()).isEqualTo(5);
        assertThat(run.rpeXpPerPoint()).isEqualTo(6);
        assertThat(run.hrRecoveryBonusXp()).isEqualTo(30);
    }
}
