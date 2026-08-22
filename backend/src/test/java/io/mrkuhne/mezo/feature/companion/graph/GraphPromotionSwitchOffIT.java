package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PatternDecisionRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionListener;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * With the knowledge-graph switch OFF, no promotion bean exists (spec §6.1): the hooks are
 * silently absent, and every write-path caller (here, pattern confirm) still succeeds — it simply
 * writes no graph row. Copies the {@code GraphSwitchOffIT} idiom.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.knowledge-graph.enabled=false")
class GraphPromotionSwitchOffIT extends ApiIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private PatternPopulator patternPopulator;

    @Test
    void testGraphPromotionBeans_shouldNotExist_whenSwitchOff() {
        assertThat(context.getBeanNamesForType(GraphPromotionService.class)).isEmpty();
        assertThat(context.getBeanNamesForType(GraphPromotionListener.class)).isEmpty();
    }

    @Test
    void testConfirmPattern_shouldSucceedAndWriteNoGraphRow_whenSwitchOff() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_food", "Késői evés rontja az alvást.");

        postForBody("/api/companion/pattern/" + pattern.getId() + "/decision",
            PatternDecisionRequest.builder().decision("confirm").build(),
            ownerAuthHeaders(), HttpStatus.OK, Object.class);

        assertThat(nodeRepository.findAll()).isEmpty();
    }
}
