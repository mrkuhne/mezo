package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.proactive.config.ContextualFeedProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ContextualFeedPropertiesIT extends AbstractIntegrationTest {
    @Autowired private ContextualFeedProperties properties;
    @Autowired private Validator validator;

    @Test
    void testProperties_shouldBindDefaults_whenContextStarts() {
        assertThat(properties.historyDays()).isEqualTo(14);
        assertThat(properties.historyMaxMessages()).isEqualTo(12);
        assertThat(properties.sameKindReserved()).isEqualTo(6);
        assertThat(properties.historyMaxChars()).isEqualTo(8000);
        assertThat(properties.maxToolCalls()).isEqualTo(6);
        assertThat(validator.validate(properties)).isEmpty();
    }

    @Test
    void testProperties_shouldRejectInvalidLimits_whenReservationExceedsTotal() {
        var invalid = new ContextualFeedProperties(14, 2, 6, 8000, 800, 28, 7, 6, 12);
        assertThat(validator.validate(invalid)).isNotEmpty();
    }
}
