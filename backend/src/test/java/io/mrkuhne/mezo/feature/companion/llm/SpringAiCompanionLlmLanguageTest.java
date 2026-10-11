package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.service.UserLanguage;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import reactor.core.publisher.Flux;

/**
 * The output-language directive at the adapter (mezo-n4wf5.11): every entry point that sends a
 * system prompt appends it exactly once for an English account, none for Hungarian or no actor, and
 * the audit row carries the prompt that was sent.
 */
class SpringAiCompanionLlmLanguageTest {

    private static final UUID EN_USER = UUID.fromString("00000000-0000-0000-0000-0000000000e1");
    private static final String SYS = "RENDSZER";
    private static final String CTX = "KONTEXTUS";
    private static final String EN = OutputLanguageDirective.EN;

    private final List<Prompt> prompts = new ArrayList<>();
    private final List<LlmCallRecord> records = new ArrayList<>();
    private final LlmCallContextHolder contextHolder = new LlmCallContextHolder();

    @Test
    void testComplete_shouldAppendDirectiveToSystemPromptOnce_whenActorIsEnglish() {
        english(() -> adapter().complete(SYS, List.of(), "kérdés", List.of(), Map.of()));

        assertThat(systemTexts()).containsExactly(SYS + EN);
        assertThat(records.get(0).systemPrompt()).isEqualTo(SYS + EN);
    }

    @Test
    void testComplete_shouldAppendDirectiveAfterTheJoinedText_whenTurnContextIsGiven() {
        english(() -> adapter().complete(SYS, CTX, List.of(), "kérdés", List.of(), Map.of()));

        assertThat(systemTexts()).containsExactly(SYS, CTX + EN);
        assertThat(records.get(0).systemPrompt()).isEqualTo(SYS + CTX + EN);
    }

    @Test
    void testComplete_shouldSendPromptUnchanged_whenThereIsNoActingUser() {
        adapter().complete(SYS, CTX, List.of(), "kérdés", List.of(), Map.of());

        assertThat(systemTexts()).containsExactly(SYS, CTX);
        assertThat(records.get(0).systemPrompt()).isEqualTo(SYS + CTX);
    }

    @Test
    void testCompleteSmart_shouldAppendDirectiveOnce_whenActorIsEnglish() {
        english(() -> adapter().completeSmart(SYS, "szia"));
        english(() -> adapter().completeSmart(SYS, CTX, List.of(), "szia"));

        assertThat(systemTexts()).containsExactly(SYS + EN, SYS, CTX + EN);
        assertThat(records).extracting(LlmCallRecord::systemPrompt).containsExactly(SYS + EN, SYS + CTX + EN);
    }

    @Test
    void testStream_shouldResolveLanguageOnSubmittingThread_whenSubscribedElsewhere() {
        Flux<String> stream = english(() -> adapter().stream(SYS, List.of(), "kérdés", List.of(), Map.of()));
        Flux<String> smart = english(() -> adapter().streamSmart(SYS, CTX, List.of(), "kérdés"));

        stream.collectList().block();
        smart.collectList().block();

        assertThat(systemTexts()).containsExactly(SYS + EN, SYS, CTX + EN);
        assertThat(records).extracting(LlmCallRecord::systemPrompt).containsExactly(SYS + EN, SYS + CTX + EN);
    }

    @Test
    void testComplete_shouldAppendDirectiveOnce_whenImagesAreSent() {
        english(() -> adapter().complete(SYS, "mi ez?",
            List.of(new CompanionLlm.InlineImage(new byte[] {1, 2}, "image/png"))));

        assertThat(systemTexts()).containsExactly(SYS + EN);
        assertThat(records.get(0).callKind()).isEqualTo(CallKind.VISION);
        assertThat(records.get(0).systemPrompt()).isEqualTo(SYS + EN);
    }

    @Test
    void testComplete_shouldNeverAppendDirective_whenAudioIsTranscribed() {
        english(() -> adapter().complete(SYS, "", new CompanionLlm.InlineAudio(new byte[] {1, 2}, "audio/webm")));

        assertThat(systemTexts()).containsExactly(SYS);
        assertThat(records.get(0).systemPrompt()).isEqualTo(SYS);
    }

    @Test
    void testComplete_shouldCarryTheDirective_whenStructuredOutputIsRequestedInEnglish() {
        String structured = "Válaszolj JSON-nal: {\"name\":..., \"kind\":\"MEAL|SNACK\"}";

        english(() -> adapter().complete(structured, "kérdés", List.of(), Map.of()));

        String sent = systemTexts().get(0);
        assertThat(sent).startsWith(structured);
        assertThat(sent).contains("Keep JSON keys, enum values, tool names, ids");
    }

    @Test
    void testComplete_shouldAddNothing_whenSlugIsExempt() {
        english(() -> contextHolder.runWith(new LlmCallContext("companion_recall", "query_rewrite", null, null),
            () -> adapter().complete(SYS, List.of(), "kérdés", List.of(), Map.of())));

        assertThat(systemTexts()).containsExactly(SYS);
    }

    // ── fixtures ────────────────────────────────────────────────────────────────

    private <T> T english(Supplier<T> body) {
        Object[] out = new Object[1];
        LlmActorContext.runAs(EN_USER, () -> out[0] = body.get());
        @SuppressWarnings("unchecked")
        T result = (T) out[0];
        return result;
    }

    private List<String> systemTexts() {
        return prompts.stream()
            .flatMap(p -> p.getInstructions().stream())
            .filter(m -> m.getMessageType() == MessageType.SYSTEM)
            .map(Message::getText)
            .toList();
    }

    private GeminiCompanionLlm adapter() {
        ChatModel model = new ChatModel() {
            @Override
            public ChatResponse call(Prompt prompt) {
                prompts.add(prompt);
                return new ChatResponse(List.of(new Generation(new AssistantMessage("ok"))));
            }

            @Override
            public Flux<ChatResponse> stream(Prompt prompt) {
                return Flux.just(call(prompt));
            }
        };
        UserLanguage language = new UserLanguage(null) {
            @Override
            public String of(UUID userId) {
                return EN_USER.equals(userId) ? "en" : DEFAULT;
            }
        };
        CompanionProperties.Llm.Tier tier = new CompanionProperties.Llm.Tier("flash", "pro", null, Map.of(),
            Map.of(), new CompanionProperties.Llm.Tier.ReasoningEffort(null, null));
        return new GeminiCompanionLlm(model, new LlmModelRouter(tier, tier, contextHolder), records::add,
            contextHolder, new GoogleGenAiUsageExtractor(), language);
    }
}
