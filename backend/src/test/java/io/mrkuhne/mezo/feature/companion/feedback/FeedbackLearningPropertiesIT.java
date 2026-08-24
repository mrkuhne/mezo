package io.mrkuhne.mezo.feature.companion.feedback;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.config.FeedbackLearningProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FeedbackLearningPropertiesIT extends AbstractIntegrationTest {

    @Autowired private FeedbackLearningProperties properties;

    @Test
    void testConfig_shouldBindCronAndWindowFromYaml_whenContextStarts() {
        assertThat(properties.cron()).isEqualTo("0 10 3 * * *");
        assertThat(properties.windowDays()).isEqualTo(30);
    }
}
