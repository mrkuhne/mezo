package io.mrkuhne.mezo.feature.progression.controller;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the progression switch OFF, the @ConditionalOnProperty controller bean is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.progression.enabled=false")
class ProgressionProfileSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testGetProfile_shouldReturn404_whenProgressionSwitchOff() {
        getForBody("/api/progression/profile", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
