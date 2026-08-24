package io.mrkuhne.mezo.feature.companion.graph;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.Map;
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

    @Test
    void testCandidateSurface_shouldReturn404_whenSwitchedOff() {
        // W2.3 (mezo-b3pp.8): the confirm inbox is gated the same as the rest of the graph surface.
        getForBody("/api/companion/graph/node/candidate", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
        postForBody("/api/companion/graph/node/" + UUID.randomUUID() + "/decision",
            Map.of("decision", "accept"), ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
