package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.google.genai.types.GenerateContentResponseUsageMetadata;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.google.genai.metadata.GoogleGenAiUsage;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import reactor.core.publisher.Flux;

/**
 * The adapter's audit contract (mezo-2zyu), proven WITHOUT a network or a Spring context: a stubbed
 * {@link ChatModel} hands the real {@code ChatClient} a canned {@link ChatResponse}, so what is
 * asserted is our own observation code, not Gemini's.
 *
 * <p>The three promises under test: the caller's return value is unchanged by the logging, every
 * call path lands exactly one record with the right {@link CallKind}/model/usage, and a failing
 * provider produces an ERROR record AND still rethrows.
 */
class GeminiCompanionLlmRecordingTest {

    private static final String CHAT_MODEL = "gemini-2.5-flash";
    private static final String SMART_MODEL = "gemini-2.5-pro";

    private final CapturingRecorder recorder = new CapturingRecorder();
    private final LlmCallContextHolder contextHolder = new LlmCallContextHolder();

    @Test
    void testComplete_shouldRecordSuccessWithMetadata_whenCalled() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        String out = llm.complete("sys", "hi");

        assertThat(out).isEqualTo("hello");
        LlmCallRecord record = recorder.last();
        assertThat(record.status()).isEqualTo(CallStatus.SUCCESS);
        assertThat(record.callKind()).isEqualTo(CallKind.CHAT);
        assertThat(record.requestedModel()).isEqualTo(CHAT_MODEL);
        assertThat(record.servedModel()).isEqualTo(CHAT_MODEL);
        assertThat(record.tokens().prompt()).isEqualTo(10_000);
        assertThat(record.tokens().candidates()).isEqualTo(1_000);
        assertThat(record.tokens().thoughts()).isEqualTo(500);
        assertThat(record.streamed()).isFalse();
        assertThat(record.systemPrompt()).isEqualTo("sys");
        assertThat(record.userMessage()).isEqualTo("hi");
        assertThat(record.responseText()).isEqualTo("hello");
        assertThat(record.context()).isEqualTo(LlmCallContext.UNKNOWN);
    }

    @Test
    void testComplete_shouldRecordErrorAndRethrow_whenModelThrows() {
        GeminiCompanionLlm llm = adapter(throwingChatModel(
            new SystemRuntimeErrorException(SystemMessage.error("LLM_CALL_FAILED").build())));

        assertThatThrownBy(() -> llm.complete("sys", "hi"))
            .isInstanceOf(SystemRuntimeErrorException.class);

        LlmCallRecord record = recorder.last();
        assertThat(record.status()).isEqualTo(CallStatus.ERROR);
        assertThat(record.callKind()).isEqualTo(CallKind.CHAT);
        assertThat(record.errorClass()).isEqualTo("SystemRuntimeErrorException");
        assertThat(record.errorCode()).isEqualTo("LLM_CALL_FAILED");
        assertThat(record.tokens()).isNull();
        assertThat(record.systemPrompt()).isEqualTo("sys");
    }

    /**
     * mezo-q71s: the audit's {@code conversation_history} column must carry the RENDERED prior
     * turns — the only way the fidelity that used to live inside the system prompt survives now
     * that the history rides the port as real prior messages. {@code systemPrompt} keeps its exact
     * pre-change meaning: precisely what the model received as system prompt, nothing appended.
     */
    @Test
    void testComplete_shouldRecordConversationHistorySeparateFromSystemPrompt_whenPriorTurnsExist() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));
        List<CompanionLlm.Turn> history = List.of(
            new CompanionLlm.Turn(CompanionLlm.Role.USER, "korábbi kérdés"),
            new CompanionLlm.Turn(CompanionLlm.Role.ASSISTANT, "korábbi válasz"));

        llm.complete("sys", history, "és most?", List.of(), Map.of());

        LlmCallRecord record = recorder.last();
        assertThat(record.conversationHistory()).contains("Felhasználó: korábbi kérdés");
        assertThat(record.conversationHistory()).contains("Mezo: korábbi válasz");
        assertThat(record.systemPrompt()).isEqualTo("sys");
        assertThat(record.systemPrompt()).doesNotContain("Felhasználó: korábbi kérdés");
    }

    /** History-less chat calls render to {@code ""} (mezo-q71s), never null — {@link
     *  io.mrkuhne.mezo.feature.companion.ChatHistory#render} guarantees it for an empty list. */
    @Test
    void testComplete_shouldRecordEmptyConversationHistory_whenNoPriorTurns() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.complete("sys", "hi");

        assertThat(recorder.last().conversationHistory()).isEmpty();
    }

    @Test
    void testStream_shouldRecordConversationHistorySeparateFromSystemPrompt_whenPriorTurnsExist() {
        GeminiCompanionLlm llm = adapter(streamingChatModel(chunk("hello", usageMetadata())));
        List<CompanionLlm.Turn> history = List.of(
            new CompanionLlm.Turn(CompanionLlm.Role.USER, "korábbi kérdés"));

        llm.stream("sys", history, "és most?", List.of(), Map.of()).collectList().block();

        LlmCallRecord record = recorder.last();
        assertThat(record.conversationHistory()).contains("Felhasználó: korábbi kérdés");
        assertThat(record.systemPrompt()).doesNotContain("Felhasználó: korábbi kérdés");
    }

    /** Non-chat paths have no conversation — the column must stay null, not empty (mezo-q71s). */
    @Test
    void testCompleteSmart_shouldLeaveConversationHistoryNull_whenCalled() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.completeSmart("sys", "hi");

        assertThat(recorder.last().conversationHistory()).isNull();
    }

    /** Vision calls have no conversation — the column must stay null (mezo-q71s). */
    @Test
    void testComplete_shouldLeaveConversationHistoryNull_whenVisionCall() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.complete("sys", "what is this", List.of(
            new CompanionLlm.InlineImage(new byte[] {1, 2, 3}, "image/jpeg")));

        assertThat(recorder.last().conversationHistory()).isNull();
    }

    /** Audio (transcription) calls have no conversation — the column must stay null (mezo-q71s). */
    @Test
    void testComplete_shouldLeaveConversationHistoryNull_whenAudioCall() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.complete("sys", "hi", new CompanionLlm.InlineAudio(new byte[] {1, 2, 3}, "audio/webm"));

        assertThat(recorder.last().conversationHistory()).isNull();
    }

    @Test
    void testComplete_shouldRecordToolKind_whenToolsAreRegistered() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.complete("sys", "hi", List.of(noOpTool()), Map.of("k", "v"));

        assertThat(recorder.last().callKind()).isEqualTo(CallKind.TOOL);
        // One model round observed, no tool round executed — 0 is now KNOWN, not unknown (mezo-58ig).
        assertThat(recorder.last().toolRounds()).isZero();
    }

    @Test
    void testComplete_shouldRecordImageMarkersOnly_whenVisionCall() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.complete("sys", "what is this", List.of(
            new CompanionLlm.InlineImage(new byte[] {1, 2, 3}, "image/jpeg"),
            new CompanionLlm.InlineImage(new byte[] {4, 5}, "image/png")));

        LlmCallRecord record = recorder.last();
        assertThat(record.callKind()).isEqualTo(CallKind.VISION);
        assertThat(record.imageCount()).isEqualTo(2);
        assertThat(record.imageBytesTotal()).isEqualTo(5L);
        assertThat(record.imageMime()).isEqualTo("image/jpeg");
        assertThat(record.userMessage()).isEqualTo("what is this");
    }

    @Test
    void testCompleteSmart_shouldRecordSmartKindWithSmartModel_whenCalled() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.completeSmart("sys", "hi");

        assertThat(recorder.last().callKind()).isEqualTo(CallKind.SMART);
        assertThat(recorder.last().requestedModel()).isEqualTo(SMART_MODEL);
    }

    @Test
    void testStream_shouldRecordStreamedSuccessWithLastChunkUsage_whenCompleted() {
        GeminiCompanionLlm llm = adapter(streamingChatModel(
            chunk("he", null), chunk("llo", usageMetadata())));

        List<String> chunks = llm.stream("sys", "hi").collectList().block();

        assertThat(String.join("", chunks)).isEqualTo("hello");
        LlmCallRecord record = recorder.last();
        assertThat(record.status()).isEqualTo(CallStatus.SUCCESS);
        assertThat(record.callKind()).isEqualTo(CallKind.CHAT_STREAM);
        assertThat(record.streamed()).isTrue();
        assertThat(record.tokens().prompt()).isEqualTo(10_000);
        assertThat(record.responseText()).isEqualTo("hello");
    }

    /**
     * Gemini closes a stream with a usage-only chunk that carries no text; ChatClient's own
     * {@code stream().content()} drops null/empty chunks, so wrapping it must not start emitting
     * blank SSE frames.
     */
    @Test
    void testStream_shouldDropEmptyChunks_whenTheLastChunkIsUsageOnly() {
        GeminiCompanionLlm llm = adapter(streamingChatModel(
            chunk("hello", null), chunk("", usageMetadata())));

        List<String> chunks = llm.stream("sys", "hi").collectList().block();

        assertThat(chunks).containsExactly("hello");
        assertThat(recorder.last().tokens().prompt()).isEqualTo(10_000);
        assertThat(recorder.last().responseText()).isEqualTo("hello");
    }

    @Test
    void testStream_shouldRecordErrorAndPropagate_whenProviderFails() {
        GeminiCompanionLlm llm = adapter(new ChatModel() {
            @Override
            public ChatResponse call(Prompt prompt) {
                throw new IllegalStateException("not used");
            }

            @Override
            public Flux<ChatResponse> stream(Prompt prompt) {
                return Flux.error(new IllegalStateException("provider blew up mid-stream"));
            }
        });

        assertThatThrownBy(() -> llm.stream("sys", "hi").collectList().block())
            .isInstanceOf(IllegalStateException.class);

        LlmCallRecord record = recorder.last();
        assertThat(record.status()).isEqualTo(CallStatus.ERROR);
        assertThat(record.callKind()).isEqualTo(CallKind.CHAT_STREAM);
        assertThat(record.streamed()).isTrue();
        assertThat(record.errorClass()).isEqualTo("IllegalStateException");
        assertThat(record.errorCode()).isNull();
    }

    /**
     * mezo-58ig: on a tool-round turn Spring AI's final response no longer carries the Google-native
     * usage, so thoughts/cached recorded as null. The per-round accumulator must instead sum each
     * round's own native counters (each round is a separately billed provider call — summing prompt
     * across rounds is exactly what the provider bills) and count the rounds.
     */
    @Test
    void testComplete_shouldSumPerRoundUsageAndCountRounds_whenToolRoundsRun() {
        GeminiCompanionLlm llm = adapter(sequencedChatModel(
            toolCallRound(usage(1_000, 50, 100, 10, 1_150)),
            answerRound("done", usage(1_200, 80, 200, 20, 1_480))));

        String out = llm.complete("sys", "hi", List.of(noOpTool()), Map.of("k", "v"));

        assertThat(out).isEqualTo("done");
        LlmCallRecord record = recorder.last();
        assertThat(record.status()).isEqualTo(CallStatus.SUCCESS);
        assertThat(record.tokens().prompt()).isEqualTo(2_200);
        assertThat(record.tokens().candidates()).isEqualTo(130);
        assertThat(record.tokens().thoughts()).isEqualTo(300);
        assertThat(record.tokens().cached()).isEqualTo(30);
        assertThat(record.tokens().total()).isEqualTo(2_630);
        assertThat(record.toolRounds()).isEqualTo(1);
    }

    /**
     * mezo-1rz9: an SSE client disconnect cancels the Flux — neither doOnComplete nor doOnError
     * fires, so the turn used to vanish from the audit log although the provider billed the tokens
     * generated so far. A cancel must land a CANCELLED record carrying the partial answer.
     */
    @Test
    void testStream_shouldRecordCancelledWithPartialAnswer_whenClientDisconnects() {
        GeminiCompanionLlm llm = adapter(hangingStreamingChatModel(chunk("part", null)));

        List<String> chunks = llm.stream("sys", "hi").take(1).collectList().block();

        assertThat(chunks).containsExactly("part");
        assertThat(recorder.count()).isEqualTo(1);
        LlmCallRecord record = recorder.last();
        assertThat(record.status()).isEqualTo(CallStatus.CANCELLED);
        assertThat(record.callKind()).isEqualTo(CallKind.CHAT_STREAM);
        assertThat(record.streamed()).isTrue();
        assertThat(record.responseText()).isEqualTo("part");
        assertThat(record.tokens()).isNull(); // the usage-only final chunk never arrived — unknown, not 0
        assertThat(record.errorClass()).isNull();
    }

    /** A completed stream must record exactly once (SUCCESS) — the cancel hook must not double-log. */
    @Test
    void testStream_shouldRecordExactlyOneSuccess_whenStreamCompletesNormally() {
        GeminiCompanionLlm llm = adapter(streamingChatModel(
            chunk("he", null), chunk("llo", usageMetadata())));

        llm.stream("sys", "hi").collectList().block();

        assertThat(recorder.count()).isEqualTo(1);
        assertThat(recorder.last().status()).isEqualTo(CallStatus.SUCCESS);
    }

    @Test
    void testComplete_shouldCarryTheAmbientContext_whenACallSiteBoundOne() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));
        UUID mealId = UUID.randomUUID();

        contextHolder.runWith(new LlmCallContext("fuel_meal_ai", "draft", "meal", mealId),
            () -> llm.complete("sys", "hi"));

        assertThat(recorder.last().context())
            .isEqualTo(new LlmCallContext("fuel_meal_ai", "draft", "meal", mealId));
    }

    // ── fixtures ────────────────────────────────────────────────────────────────

    private GeminiCompanionLlm adapter(ChatModel chatModel) {
        return new GeminiCompanionLlm(
            chatModel, companionProperties(), recorder, contextHolder, new GeminiUsageExtractor());
    }

    private static CompanionProperties companionProperties() {
        return new CompanionProperties(
            new CompanionProperties.Llm(CHAT_MODEL, SMART_MODEL),
            null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
    }

    private static ChatModel chatModel(ChatResponse canned) {
        return new ChatModel() {
            @Override
            public ChatResponse call(Prompt prompt) {
                return canned;
            }
        };
    }

    private static ChatModel throwingChatModel(RuntimeException failure) {
        return new ChatModel() {
            @Override
            public ChatResponse call(Prompt prompt) {
                throw failure;
            }
        };
    }

    /**
     * Round N of a tool loop answers with response N — the shape ToolCallingAdvisor drives.
     *
     * <p>{@code getOptions()} must return a {@link ToolCallingChatOptions} like the real
     * {@code GoogleGenAiChatModel} does: the ChatClient builds each request's options by mutating
     * the MODEL's own options, and both the tool-callback attachment and ToolCallingAdvisor's loop
     * are gated on that options type — with a plain ChatOptions the tools are silently dropped.
     */
    private static ChatModel sequencedChatModel(ChatResponse... rounds) {
        java.util.concurrent.atomic.AtomicInteger next = new java.util.concurrent.atomic.AtomicInteger();
        return new ChatModel() {
            @Override
            public ChatResponse call(Prompt prompt) {
                return rounds[Math.min(next.getAndIncrement(), rounds.length - 1)];
            }

            @Override
            public ChatOptions getOptions() {
                return ToolCallingChatOptions.builder().model(CHAT_MODEL).build();
            }
        };
    }

    /** A text-answer round with the FAITHFUL usage shape (GoogleGenAiUsage — portable == native). */
    private static ChatResponse answerRound(String text, GenerateContentResponseUsageMetadata usage) {
        return ChatResponse.builder()
            .generations(List.of(new Generation(new AssistantMessage(text))))
            .metadata(ChatResponseMetadata.builder().model(CHAT_MODEL)
                .usage(GoogleGenAiUsage.from(usage)).build())
            .build();
    }

    /** A round whose answer is a tool CALL (no text) — forces the tool-execution loop to recurse. */
    private static ChatResponse toolCallRound(GenerateContentResponseUsageMetadata usage) {
        AssistantMessage toolCall = AssistantMessage.builder()
            .content("")
            .toolCalls(List.of(new AssistantMessage.ToolCall("tc-1", "function", "noop", "{}")))
            .build();
        return ChatResponse.builder()
            .generations(List.of(new Generation(toolCall)))
            .metadata(ChatResponseMetadata.builder().model(CHAT_MODEL)
                .usage(GoogleGenAiUsage.from(usage)).build())
            .build();
    }

    /** Emits the given chunks and then hangs — cancellation is the only way out. */
    private static ChatModel hangingStreamingChatModel(ChatResponse... chunks) {
        return new ChatModel() {
            @Override
            public ChatResponse call(Prompt prompt) {
                throw new IllegalStateException("not used");
            }

            @Override
            public Flux<ChatResponse> stream(Prompt prompt) {
                return Flux.concat(Flux.just(chunks), Flux.never());
            }
        };
    }

    private static GenerateContentResponseUsageMetadata usage(
            int prompt, int candidates, int thoughts, int cached, int total) {
        return GenerateContentResponseUsageMetadata.builder()
            .promptTokenCount(prompt)
            .candidatesTokenCount(candidates)
            .thoughtsTokenCount(thoughts)
            .cachedContentTokenCount(cached)
            .totalTokenCount(total)
            .build();
    }

    private static ChatModel streamingChatModel(ChatResponse... chunks) {
        return new ChatModel() {
            @Override
            public ChatResponse call(Prompt prompt) {
                throw new IllegalStateException("not used");
            }

            @Override
            public Flux<ChatResponse> stream(Prompt prompt) {
                return Flux.just(chunks);
            }
        };
    }

    private static ChatResponse cannedResponse(String text) {
        return chunk(text, usageMetadata());
    }

    private static ChatResponse chunk(String text, GenerateContentResponseUsageMetadata usage) {
        ChatResponseMetadata.Builder metadata = ChatResponseMetadata.builder().model(CHAT_MODEL);
        if (usage != null) {
            metadata.usage(new DefaultUsage(10_000, 1_000, 11_500, usage));
        }
        return ChatResponse.builder()
            .generations(List.of(new Generation(new AssistantMessage(text))))
            .metadata(metadata.build())
            .build();
    }

    private static GenerateContentResponseUsageMetadata usageMetadata() {
        return GenerateContentResponseUsageMetadata.builder()
            .promptTokenCount(10_000)
            .candidatesTokenCount(1_000)
            .thoughtsTokenCount(500)
            .cachedContentTokenCount(0)
            .build();
    }

    private static ToolCallback noOpTool() {
        return new ToolCallback() {
            @Override
            public ToolDefinition getToolDefinition() {
                return ToolDefinition.builder()
                    .name("noop").description("noop").inputSchema("{\"type\":\"object\"}").build();
            }

            @Override
            public String call(String toolInput) {
                return "{}";
            }
        };
    }

    private static final class CapturingRecorder implements LlmCallRecorder {

        private final List<LlmCallRecord> records = new CopyOnWriteArrayList<>();

        @Override
        public void record(LlmCallRecord record) {
            records.add(record);
        }

        LlmCallRecord last() {
            assertThat(records).isNotEmpty();
            return records.get(records.size() - 1);
        }

        int count() {
            return records.size();
        }
    }
}
