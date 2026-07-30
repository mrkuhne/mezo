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
import org.springframework.ai.chat.prompt.Prompt;
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

    @Test
    void testComplete_shouldRecordToolKind_whenToolsAreRegistered() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));

        llm.complete("sys", "hi", List.of(noOpTool()), Map.of("k", "v"));

        assertThat(recorder.last().callKind()).isEqualTo(CallKind.TOOL);
        assertThat(recorder.last().toolRounds()).isNull();
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
            null, null, null, null, null, null, null, null, null, null, null);
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
    }
}
