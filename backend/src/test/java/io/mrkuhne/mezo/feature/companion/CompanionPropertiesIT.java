package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CompanionPropertiesIT extends AbstractIntegrationTest {

    @Autowired private CompanionProperties properties;

    @Test
    void testLlmConfig_shouldBindModelTiersFromYaml_whenContextStarts() {
        assertThat(properties.llm().chatModel()).isEqualTo("gemini-2.5-flash");
        assertThat(properties.llm().smartModel()).isEqualTo("gemini-2.5-pro");
    }

    @Test
    void testChatConfig_shouldBindWindowAndTitleFromYaml_whenContextStarts() {
        assertThat(properties.chat().historyWindow()).isEqualTo(20);
        assertThat(properties.chat().titleMaxChars()).isEqualTo(80);
    }

    @Test
    void testSnapshotConfig_shouldBindWindowsFromYaml_whenContextStarts() {
        assertThat(properties.snapshot().digestDays()).isEqualTo(7);
        assertThat(properties.snapshot().checkinNoteMaxChars()).isEqualTo(200);
    }

    @Test
    void testToolsConfig_shouldBindToolTunablesFromYaml_whenContextStarts() {
        assertThat(properties.tools().maxCallsPerTurn()).isEqualTo(6);
        assertThat(properties.tools().maxWindowDays()).isEqualTo(30);
        assertThat(properties.tools().maxTrendWeeks()).isEqualTo(26);
        assertThat(properties.tools().maxRefsPerTurn()).isEqualTo(10);
    }
}
