package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Tool-SELECTION measurement harness (mezo-xixu, design spec §7 point 4) — NOT a pass/fail gate.
 * {@code FakeCompanionLlm} only replays scripted {@code [fake-tool:X]} sentinels, so it cannot
 * measure selection; this IT runs the REAL {@code GeminiCompanionLlm} (cheap tier,
 * gemini-2.5-flash) over a representative Hungarian case set and reports selection-accuracy —
 * the Tool-RAG escape hatch (spec §7 point 5) triggers below ~85%.
 *
 * <p>Opt-in twice over: {@code @Tag("eval")} is excluded from the default {@code ./mvnw test}
 * run (the surefire {@code excludedGroups} in {@code pom.xml}, bound to the overridable
 * {@code mezo.excludedTestGroups} property so a literal POM value can't block the CLI override),
 * and {@code @EnabledIfEnvironmentVariable} additionally self-skips wherever {@code GEMINI_API_KEY}
 * is absent (CI has no key on the critical path). Run explicitly:
 * {@code ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups=}.
 *
 * <p>The advisor chain (V1.3 clinical guard + LLM verdict) is switched off here — it would add an
 * unrelated cheap-tier call (and possible retries) to every case, which is cost/noise for a
 * harness measuring tool selection specifically, not answer quality. The companion-fake profile
 * is deliberately NOT active: {@code GeminiCompanionLlm} must be the live {@code CompanionLlm}
 * bean for the measurement to mean anything.
 */
@Slf4j
@Tag("eval")
@EnabledIfEnvironmentVariable(named = "GEMINI_API_KEY", matches = ".+")
@Timeout(value = 15, unit = TimeUnit.MINUTES)
@Transactional
@TestPropertySource(properties = {
        "mezo.feature.companion.enabled=true",
        "mezo.companion.advisors.enabled=false"
})
class ToolSelectionEvalIT extends AbstractIntegrationTest {

    private static final String CASES_RESOURCE = "companion/tool-selection-cases.json";

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private ObjectMapper objectMapper;

    /** One eval case: a HU question and the tool name(s) that legitimately answer it. */
    record Case(String id, String question, List<String> expectedTools, String note) {}

    @Test
    void testToolSelection_shouldMeasureAccuracyAcrossCaseSet_whenRealGeminiSelectsTools() throws Exception {
        List<Case> cases = loadCases();
        assertThat(cases).isNotEmpty();
        UUID userId = databasePopulator.populateUser("tool-selection-eval@test.local");

        int processed = 0;
        int hits = 0;
        List<String> misses = new ArrayList<>();
        for (Case testCase : cases) {
            List<String> actual = runCase(userId, testCase);
            processed++;
            boolean hit = actual.stream().anyMatch(testCase.expectedTools()::contains);
            if (hit) {
                hits++;
            } else {
                misses.add("[%s] \"%s\" — expected %s, got %s".formatted(
                        testCase.id(), testCase.question(), testCase.expectedTools(), actual));
            }
        }

        double accuracy = (double) hits / cases.size();
        log.info("Tool-selection eval: {}/{} hits ({}%)", hits, cases.size(), Math.round(accuracy * 1000) / 10.0);
        if (misses.isEmpty()) {
            log.info("Tool-selection eval: zero misses.");
        } else {
            log.info("Tool-selection eval misses ({}):\n{}", misses.size(), String.join("\n", misses));
        }

        // This is a REPORT, not a gate — the Tool-RAG escape hatch decision is made by a human
        // reading the accuracy number above, not by this assertion. We only assert the harness
        // actually ran every case and produced a well-formed number.
        assertThat(processed).isEqualTo(cases.size());
        assertThat(accuracy).isBetween(0.0, 1.0);
    }

    /** Fresh conversation per case (no shared history) — isolates each question's tool selection. */
    private List<String> runCase(UUID userId, Case testCase) {
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        try {
            MessageResponse response = chatService.sendMessage(userId, conversation.getId(),
                    SendMessageRequest.builder().content(testCase.question()).build());
            AiMessageEntity assistant = messageRepository.findById(response.getId()).orElseThrow();
            return assistant.getToolCalls() == null
                    ? List.of()
                    : assistant.getToolCalls().calls().stream().map(ToolCallsEnvelope.ToolCall::name).distinct().toList();
        } catch (Exception e) {
            log.warn("Tool-selection eval case {} failed — counted as a miss", testCase.id(), e);
            return List.of("ERROR:" + e.getClass().getSimpleName());
        }
    }

    private List<Case> loadCases() throws Exception {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(CASES_RESOURCE)) {
            assertThat(in).as("classpath resource %s", CASES_RESOURCE).isNotNull();
            return objectMapper.readValue(in, new TypeReference<List<Case>>() {});
        }
    }
}
