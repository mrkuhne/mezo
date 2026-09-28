package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CompanionPropertiesIT extends AbstractIntegrationTest {

    @Autowired private CompanionProperties properties;
    @Autowired private Validator validator;

    @Test
    void testLlmConfig_shouldBindModelTiersFromYaml_whenContextStarts() {
        assertThat(properties.llm().gemini().chatModel()).isEqualTo("gemini-2.5-flash");
        assertThat(properties.llm().gemini().smartModel()).isEqualTo("gemini-2.5-pro");
        assertThat(properties.llm().openai().chatModel()).isEqualTo("gpt-5.6-luna");
        assertThat(properties.llm().openai().smartModel()).isEqualTo("gpt-5.6-terra");
    }

    /** mezo-ozri.2: the shipped default stays Gemini — flipping providers is a YAML edit, not a deploy. */
    @Test
    void testLlmConfig_shouldDefaultToTheGeminiProvider_whenContextStarts() {
        assertThat(properties.llm().provider()).isEqualTo(LlmProvider.GEMINI);
    }

    /**
     * mezo-ozri.2 (spec §A1): no GPT-5.6 model has an audio endpoint at all, and the vision A/B is
     * unmeasured — so both kinds stay on Gemini even once OpenAI answers the chat turns.
     */
    @Test
    void testLlmConfig_shouldPinAudioAndVisionToGemini_whenContextStarts() {
        assertThat(properties.llm().perCallKind())
            .containsEntry(CallKind.TRANSCRIBE, LlmProvider.GEMINI)
            .containsEntry(CallKind.VISION, LlmProvider.GEMINI);
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
    void testFactsConfig_shouldBindPromptCapFromYaml_whenContextStarts() {
        assertThat(properties.facts().promptCap()).isEqualTo(200);
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
        // mezo-rj214.7 / mezo-q0p5a: a typo'd YAML key would silently never bind, and the check
        // would never fire — assert it actually loads the configured claim terms.
        assertThat(properties.advisors().actionClaimTerms()).contains("felírtam", "naplóztam");
    }

    @Test
    void testEmbeddingConfig_shouldBindModelFromYaml_whenContextStarts() {
        assertThat(properties.embedding().model()).isEqualTo("gemini-embedding-001");
        assertThat(properties.embedding().embedChatTurns()).isTrue();
        assertThat(properties.embedding().embedMaxChars()).isEqualTo(2000);
        assertThat(properties.embedding().embedNotes()).isTrue();
        assertThat(properties.embedding().noteMinChars()).isEqualTo(1);
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
        assertThat(properties.patterns().pairs()).hasSize(45); // V3.4 katalógus (8 v1 + 21 új) + 16 check-in 2.0 (mezo-ck2 15 + follow-up B: +day-score, meal-score→nova4)
        assertThat(properties.patterns().pairs())
                .allSatisfy(p -> assertThat(p.mechanism()).isNotBlank()); // mezo-18bx: miért figyeljük
        assertThat(properties.patterns().pairs().getFirst().key())
                .isEqualTo("sleep-quality~next-day-training-rpe");
        assertThat(properties.patterns().pairs().getFirst().metricA())
                .isEqualTo(io.mrkuhne.mezo.feature.companion.service.MetricKey.SLEEP_QUALITY);
        assertThat(properties.patterns().pairs().getFirst().lagDays()).isEqualTo(1);
    }

    /**
     * Check-in 2.0 (mezo-ck2): every pair's two metrics resolve to a correlatable {@code MetricKey}
     * (a misspelt wire key would bind to null or fail the context), keys stay unique, and the new
     * check-in pairs are wired to the series they name.
     */
    @Test
    void testPatternsConfig_shouldResolveEveryPairMetric_whenCatalogLoads() {
        var pairs = properties.patterns().pairs();
        assertThat(pairs).allSatisfy(p -> {
            assertThat(p.metricA()).as(p.key()).isNotNull();
            assertThat(p.metricB()).as(p.key()).isNotNull();
            assertThat(p.metricA().correlatable()).as(p.key()).isTrue();
            assertThat(p.metricB().correlatable()).as(p.key()).isTrue();
        });
        assertThat(pairs).extracting(CompanionProperties.PatternPair::key).doesNotHaveDuplicates();

        java.util.Map<String, CompanionProperties.PatternPair> byKey = pairs.stream()
                .collect(java.util.stream.Collectors.toMap(CompanionProperties.PatternPair::key, p -> p));
        assertThat(byKey.get("sleep-duration~checkin-rested").metricB())
                .isEqualTo(MetricKey.CHECKIN_RESTED);
        // sleep_log.date is the wake-up morning: lag 0 = the day after the night (follow-up B).
        assertThat(byKey.get("sleep-duration~checkin-craving").lagDays()).isEqualTo(0);
        assertThat(byKey).doesNotContainKeys("sleep-duration~next-day-checkin-craving", "meal-score~checkin-digestion");
        assertThat(byKey.get("gym-workload~next-day-checkin-soreness").metricB())
                .isEqualTo(MetricKey.CHECKIN_SORENESS);
        assertThat(byKey.get("gym-workload~next-day-checkin-soreness").lagDays()).isEqualTo(1);
        assertThat(byKey.get("checkin-mood~checkin-day").metricA()).isEqualTo(MetricKey.CHECKIN_MOOD);
        assertThat(byKey.get("checkin-mood~checkin-day").metricB()).isEqualTo(MetricKey.CHECKIN_DAY);
        assertThat(byKey.get("social-mentions~checkin-connection").metricB())
                .isEqualTo(MetricKey.CHECKIN_CONNECTION);
        assertThat(byKey.get("nova4-kcal~checkin-digestion").metricA()).isEqualTo(MetricKey.NOVA4_KCAL_PCT);
        assertThat(byKey.get("nova4-kcal~checkin-digestion").metricB()).isEqualTo(MetricKey.CHECKIN_DIGESTION);
        assertThat(byKey.get("day-score~checkin-day").metricA()).isEqualTo(MetricKey.DAY_SCORE);
        assertThat(byKey.get("day-score~checkin-day").metricB()).isEqualTo(MetricKey.CHECKIN_DAY);
        assertThat(byKey.get("day-score~checkin-day").lagDays()).isEqualTo(0);
        assertThat(byKey).containsKeys("sleep-quality~checkin-rested", "checkin-stress~checkin-craving",
                "daily-protein~checkin-hunger", "meal-score~checkin-craving",
                "training-monotony~checkin-motivation", "sleep-quality~checkin-motivation",
                "social-mentions~checkin-mood", "habits-done~checkin-mood", "daily-xp~checkin-mood");
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
        // S2 (mezo-eq85.2): cron + max-per-run moved to mezo.companion.reflection — only the two
        // critique thresholds (what SURVIVES, not when it runs) stay on the hypotheses block
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
