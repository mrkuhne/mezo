package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class ToolCatalogueIT extends AbstractIntegrationTest {

    @Autowired
    private ToolCatalogue catalogue;

    @Test
    void testRender_shouldListEveryRegisteredTool_whenRenderedFromTheLiveRegistry() {
        String text = catalogue.render();

        // One line per registered tool — the registry IT pins the full set of 18; spot-check
        // representatives from different toolsets plus the header.
        assertThat(text).startsWith("[Eszköz-katalógus]");
        assertThat(text).contains("- get_fuel_log:").contains("- get_recovery:")
            .contains("- get_training_log:").contains("- get_life_goals:")
            .contains("- find_similar_past_days:").contains("- compare_periods:");
    }

    @Test
    void testRender_shouldCarryParamNames_whenTheSchemaHasProperties() {
        String text = catalogue.render();

        // get_recovery's schema is pinned to expose date/from/to (CompanionToolRegistryIT).
        assertThat(text).contains("date").contains("from").contains("to");
        // The framework-internal context param must never leak into the model-facing catalogue.
        assertThat(text).doesNotContain("toolContext");
    }
}
