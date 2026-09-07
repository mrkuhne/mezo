package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import reactor.core.publisher.Flux;

/**
 * Reflexió S4 (mezo-eq85.4) Step 6, end to end: what the night decided reaches the MORNING
 * message's prompt as an {@code ÉSZREVÉTEL} block. The assertion is made at the {@link CompanionLlm}
 * port, on the payload the generator actually hands over — the same {@code @Primary} capturing
 * double {@code LlmCallContextTaggingIT} uses, because {@code FakeCompanionLlm} answers but records
 * nothing.
 *
 * <p>The digest itself (its window, its three sentences) is pinned by
 * {@code ReflectionDigestServiceIT}; this class only proves the WIRING — and that a morning message
 * still ships when there is nothing to report.
 */
@ActiveProfiles("companion-fake")
@Import(ReflectionDigestMorningIT.CapturingLlmConfiguration.class)
class ReflectionDigestMorningIT extends AbstractIntegrationTest {

    private static final TestPlanEnvelope PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    private static final String MORNING_ANSWER =
            "{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Ma is megy ez.\"],\"refIndexes\":[]}";

    /** Records the user message of every completion, so the prompt can be asserted directly. */
    static class CapturingCompanionLlm implements CompanionLlm {

        private String captured;

        String captured() {
            return captured;
        }

        void reset() {
            this.captured = null;
        }

        @Override
        public String complete(String systemPrompt, List<Turn> history, String userMessage,
                               List<ToolCallback> tools, Map<String, Object> toolContext) {
            captured = userMessage;
            return MORNING_ANSWER;
        }

        @Override
        public Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                                   List<ToolCallback> tools, Map<String, Object> toolContext) {
            captured = userMessage;
            return Flux.just(MORNING_ANSWER);
        }

        @Override
        public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
            captured = userMessage;
            return MORNING_ANSWER;
        }

        @Override
        public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
            captured = userMessage;
            return MORNING_ANSWER;
        }
    }

    @TestConfiguration
    static class CapturingLlmConfiguration {

        @Bean
        @Primary
        CapturingCompanionLlm capturingCompanionLlm() {
            return new CapturingCompanionLlm();
        }
    }

    @Autowired private CapturingCompanionLlm capturingCompanionLlm;
    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private UserPopulator userPopulator;

    @BeforeEach
    void resetCapture() {
        capturingCompanionLlm.reset();
    }

    @Test
    void testGenerateMorning_shouldCarryTheDigest_whenLastNightConfirmedAHypothesis() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, today.minusDays(1), "Tegnapi nap összefoglaló.");
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_CONFIRMED,
                lastNight(today));

        assertThat(companionMessageGenerator.generateMorning(owner, today)).isNotNull();

        assertThat(capturingCompanionLlm.captured())
                .contains("ÉSZREVÉTEL")
                .contains("Ma éjjel megerősítettem: „" + row.getTitle() + "”")
                .contains("[Pattern] " + row.getTitle());
    }

    /** Nothing decided ⇒ no block, and above all a morning message that still ships. */
    @Test
    void testGenerateMorning_shouldOmitTheBlock_whenTheNightDecidedNothing() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, today.minusDays(1), "Tegnapi nap összefoglaló.");

        assertThat(companionMessageGenerator.generateMorning(owner, today)).isNotNull();
        assertThat(capturingCompanionLlm.captured()).doesNotContain("ÉSZREVÉTEL");
    }

    private static Instant lastNight(LocalDate date) {
        return date.minusDays(1).atTime(LocalTime.of(23, 0))
                .atZone(ZoneId.systemDefault()).toInstant();
    }
}
