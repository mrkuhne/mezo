package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.config.QuestionProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Round 2 S5 (bd mezo-d58h.7.5): the shipped defaults bind, and match the spec's numbers. */
class QuestionPropertiesIT extends AbstractIntegrationTest {

    @Autowired private QuestionProperties properties;

    @Test
    void testDefaults_shouldMatchTheSpec() {
        assertThat(properties.featureAbandonment().idleDays()).isEqualTo(30);
        assertThat(properties.featureAbandonment().minPriorRows()).isEqualTo(10);
        assertThat(properties.flatFeedback().windowWorkouts()).isEqualTo(8);
        assertThat(properties.flatFeedback().maxFeedbackRows()).isGreaterThanOrEqualTo(50);
    }
}
