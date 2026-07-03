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
    void testFactsConfig_shouldBindTopNFromYaml_whenContextStarts() {
        assertThat(properties.facts().topN()).isEqualTo(10);
    }

    @Test
    void testExtractionConfig_shouldBindFromYaml_whenContextStarts() {
        assertThat(properties.extraction().enabled()).isTrue();
        assertThat(properties.extraction().maxCandidatesPerTurn()).isEqualTo(3);
    }

    @Test
    void testAdvisorsConfig_shouldBindFromYaml_whenContextStarts() {
        assertThat(properties.advisors().enabled()).isTrue();
        assertThat(properties.advisors().maxRetries()).isEqualTo(1);
        assertThat(properties.advisors().rxTerms()).contains("retatrutid", "reta");
    }

    @Test
    void testEmbeddingConfig_shouldBindModelFromYaml_whenContextStarts() {
        assertThat(properties.embedding().model()).isEqualTo("gemini-embedding-001");
        assertThat(properties.embedding().embedChatTurns()).isTrue();
        assertThat(properties.embedding().embedMaxChars()).isEqualTo(2000);
    }

    @Test
    void testSummaryConfig_shouldBindCronAndWindowFromYaml_whenContextStarts() {
        assertThat(properties.summary().cron()).isEqualTo("0 20 2 * * *");
        assertThat(properties.summary().catchUpDays()).isEqualTo(7);
    }

    @Test
    void testRecallConfig_shouldBindRankingKnobsFromYaml_whenContextStarts() {
        assertThat(properties.recall().decayDays()).isEqualTo(90);
        assertThat(properties.recall().maxK()).isEqualTo(5);
        assertThat(properties.recall().minSimilarity()).isEqualTo(0.25);
        assertThat(properties.recall().candidatePool()).isEqualTo(20);
        assertThat(properties.recall().renderMaxChars()).isEqualTo(300);
    }

    @Test
    void testToolsConfig_shouldBindToolTunablesFromYaml_whenContextStarts() {
        assertThat(properties.tools().maxCallsPerTurn()).isEqualTo(6);
        assertThat(properties.tools().maxWindowDays()).isEqualTo(30);
        assertThat(properties.tools().maxTrendWeeks()).isEqualTo(26);
        assertThat(properties.tools().maxRefsPerTurn()).isEqualTo(10);
    }
}
