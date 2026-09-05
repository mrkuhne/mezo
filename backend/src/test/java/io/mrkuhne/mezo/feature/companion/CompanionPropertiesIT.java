package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CompanionPropertiesIT extends AbstractIntegrationTest {

    @Autowired private CompanionProperties properties;
    @Autowired private Validator validator;

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
        assertThat(properties.snapshot().peopleMaxPersons()).isEqualTo(12);
        assertThat(properties.snapshot().lifegoalMaxGoals()).isEqualTo(3);
    }

    @Test
    void testFactsConfig_shouldBindTopNFromYaml_whenContextStarts() {
        assertThat(properties.facts().topN()).isEqualTo(10);
        assertThat(properties.facts().patternAckDays()).isEqualTo(3);
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
        assertThat(properties.embedding().embedNotes()).isTrue();
        assertThat(properties.embedding().noteMinChars()).isEqualTo(80);
        assertThat(properties.embedding().noteBatchSize()).isEqualTo(200);
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
    void testPatternsConfig_shouldBindCatalogFromYaml_whenContextStarts() {
        assertThat(properties.patterns().cron()).isEqualTo("0 40 2 * * *");
        assertThat(properties.patterns().lookbackDays()).isEqualTo(60);
        assertThat(properties.patterns().minN()).isEqualTo(8);
        assertThat(properties.patterns().minGroupN()).isEqualTo(3);
        assertThat(properties.patterns().reinforceCooldownDays()).isEqualTo(7);
        assertThat(properties.patterns().loadGymKgPerMin()).isEqualTo(100); // V3.4 derivált terhelés-skála
        assertThat(properties.patterns().pairs()).hasSize(29); // V3.4 katalógus (8 v1 + 21 új)
        assertThat(properties.patterns().pairs())
                .allSatisfy(p -> assertThat(p.mechanism()).isNotBlank()); // mezo-18bx: miért figyeljük
        assertThat(properties.patterns().pairs().getFirst().key())
                .isEqualTo("sleep-quality~next-day-training-rpe");
        assertThat(properties.patterns().pairs().getFirst().metricA())
                .isEqualTo(io.mrkuhne.mezo.feature.companion.service.MetricKey.SLEEP_QUALITY);
        assertThat(properties.patterns().pairs().getFirst().lagDays()).isEqualTo(1);
    }

    @Test
    void testPatternsConfig_shouldRejectGroupMinimumBelowThree_whenValidated() {
        CompanionProperties.Patterns configured = properties.patterns();
        CompanionProperties.Patterns invalid = new CompanionProperties.Patterns(
                configured.cron(), configured.lookbackDays(), configured.minN(), 2,
                configured.reinforceCooldownDays(), configured.loadGymKgPerMin(), configured.pairs());

        assertThat(validator.validate(invalid))
                .anySatisfy(violation ->
                        assertThat(violation.getPropertyPath().toString()).isEqualTo("minGroupN"));
    }

    @Test
    void testHypothesesConfig_shouldBindLoopKnobsFromYaml_whenContextStarts() {
        assertThat(properties.hypotheses().cron()).isEqualTo("0 0 3 * * SUN");
        assertThat(properties.hypotheses().maxPerRun()).isEqualTo(3);
        assertThat(properties.hypotheses().keepThreshold()).isEqualTo(0.75);
        assertThat(properties.hypotheses().reviseThreshold()).isEqualTo(0.50);
    }

    @Test
    void testToolsConfig_shouldBindToolTunablesFromYaml_whenContextStarts() {
        assertThat(properties.tools().maxCallsPerTurn()).isEqualTo(15);
        assertThat(properties.tools().maxWindowDays()).isEqualTo(30);
        assertThat(properties.tools().maxTrendWeeks()).isEqualTo(26);
        assertThat(properties.tools().maxRefsPerTurn()).isEqualTo(10);
    }

    @Test
    void testAmbientRecallConfig_shouldBindPerGroupFloorsAndDecayFromYaml_whenContextStarts() {
        CompanionProperties.AmbientRecall ambient = properties.ambientRecall();
        assertThat(ambient.enabled()).isTrue();
        assertThat(ambient.weeklyShadowDays()).isEqualTo(30);
        assertThat(ambient.maxTokens()).isEqualTo(1200);
        assertThat(ambient.dailySummary()).isEqualTo(new CompanionProperties.AmbientRecall.Group(2, 0.55, 90));
        assertThat(ambient.periodSummary()).isEqualTo(new CompanionProperties.AmbientRecall.Group(2, 0.55, 180));
        // W3.3 (mezo-b3pp.14): lived-with 2026-08-22 — the journal family wants a higher floor
        assertThat(ambient.journal()).isEqualTo(new CompanionProperties.AmbientRecall.Group(2, 0.60, 90));
        assertThat(ambient.chatTurn()).isEqualTo(new CompanionProperties.AmbientRecall.Group(1, 0.55, 90));
        assertThat(ambient.other()).isEqualTo(new CompanionProperties.AmbientRecall.Group(1, 0.55, 90));
    }

    @Test
    void testGraphConfig_shouldBindTraversalAndMaintenanceKnobsFromYaml_whenContextStarts() {
        assertThat(properties.graph().maxHops()).isEqualTo(2);
        assertThat(properties.graph().topK()).isEqualTo(8);
        assertThat(properties.graph().decayFactor()).isEqualTo(0.99);
        assertThat(properties.graph().pruneFloor()).isEqualTo(0.05);
        assertThat(properties.graph().renderMaxTokens()).isEqualTo(800);
    }
}
