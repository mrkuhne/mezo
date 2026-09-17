package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.eval.EvalApiKeyCondition;
import io.mrkuhne.mezo.feature.companion.eval.EvalTarget;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.ObjectMapper;

/** Opt-in real-model comparison on synthetic users only. Scores require a separate blind review. */
@Tag("eval")
@ExtendWith(EvalApiKeyCondition.class)
@Timeout(value = 20, unit = TimeUnit.MINUTES)
@TestPropertySource(properties = {
        "mezo.companion.conversation.enabled=true",
        "mezo.companion.advisors.enabled=false"
})
class ConversationQualityEvalIT extends AbstractIntegrationTest {
    private static final EvalTarget TARGET = EvalTarget.fromSystemProperties();
    @DynamicPropertySource
    static void model(DynamicPropertyRegistry registry) {
        registry.add("mezo.companion.llm.provider", TARGET::providerKey);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".smart-model", TARGET::model);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".chat-model", TARGET::model);
    }
    @Autowired private ChatService chat;
    @Autowired private CompanionLlm llm;
    @Autowired private PromptPersona persona;
    @Autowired private LlmCallContextHolder calls;
    @Autowired private DatabasePopulator users;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private SleepLogPopulator sleeps;
    @Autowired private ObjectMapper json;

    record Case(String id, List<String> turns, String rubric) {}
    record Result(String caseId, String arm, int turn, String question, String answer,
                  List<String> tools, long millis, String error) {}

    @Test
    void testConversation_shouldCaptureThreeArmComparison_whenRealProviderIsRequested() throws Exception {
        List<Case> cases;
        try (var input = getClass().getResourceAsStream("/companion/conversation-quality-cases.json")) {
            cases = List.of(json.readValue(input, Case[].class));
        }
        var user = users.populateUser("synthetic-conversation-eval@test.local");
        sleeps.createSleepLog(user, LocalDate.now().minusDays(1), new BigDecimal("6.5"), 3);
        var target = Path.of("target/eval/conversation-quality-" + TARGET.model() + ".json");
        Files.createDirectories(target.getParent());
        List<Result> results = new ArrayList<>();
        for (var testCase : cases) {
            for (String arm : List.of("minimal-prompt", "legacy-prompt", "conversation-first")) {
                var conversation = conversations.conversation(user);
                List<CompanionLlm.Turn> history = new ArrayList<>();
                for (int index = 0; index < testCase.turns().size(); index++) {
                    String question = testCase.turns().get(index);
                    long start = System.currentTimeMillis();
                    String answer = "";
                    List<String> used = List.of();
                    String error = "";
                    try {
                        if (arm.equals("conversation-first")) {
                            // gear-audited: corpus intentionally crosses topics and pronoun-only follow-ups.
                            var reply = LlmActorContext.runAsCaptured(user, () -> chat.sendMessage(user, conversation.getId(),
                                    SendMessageRequest.builder().content(question).build()));
                            answer = reply.getContent();
                            used = reply.getTools().stream().map(t -> t.getName()).toList();
                        } else {
                            String system = arm.equals("minimal-prompt")
                                    ? "Beszélgess természetesen magyarul, segíts a felhasználó kérésében."
                                    : persona.render(user, ChatService.SYSTEM_PROMPT);
                            // Same synthetic evidence for the two prompt-only controls; neither runs tools.
                            String context = "Ma: " + LocalDate.now() + ". A felhasználó tegnap 6,5 órát aludt.";
                            answer = LlmActorContext.runAsCaptured(user, () -> calls.runWith(
                                    new LlmCallContext("companion_eval", arm, "conversation", conversation.getId()),
                                    () -> llm.completeSmart(system, context, history, question)));
                        }
                    } catch (RuntimeException e) {
                        error = e.getClass().getSimpleName();
                    }
                    results.add(new Result(testCase.id(), arm, index, question, answer, used,
                            System.currentTimeMillis() - start, error));
                    history.add(new CompanionLlm.Turn(CompanionLlm.Role.USER, question));
                    history.add(new CompanionLlm.Turn(CompanionLlm.Role.ASSISTANT, answer));
                    Files.writeString(target, json.writerWithDefaultPrettyPrinter().writeValueAsString(results));
                }
            }
        }
        assertThat(results).allSatisfy(result -> {
            assertThat(result.error()).as(result.caseId() + "/" + result.arm()).isEmpty();
            assertThat(result.answer()).isNotBlank();
        });
    }
}
