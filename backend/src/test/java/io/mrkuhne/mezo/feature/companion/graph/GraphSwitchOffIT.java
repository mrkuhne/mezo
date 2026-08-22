package io.mrkuhne.mezo.feature.companion.graph;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the knowledge-graph switch OFF, the @ConditionalOnProperty controller (and service) are absent -> 404. */
@TestPropertySource(properties = "mezo.feature.knowledge-graph.enabled=false")
class GraphSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testGraphSurface_shouldReturn404_whenSwitchedOff() {
        getForBody("/api/companion/graph/node", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
        postForBody("/api/companion/graph/node/" + UUID.randomUUID() + "/archive", null,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
