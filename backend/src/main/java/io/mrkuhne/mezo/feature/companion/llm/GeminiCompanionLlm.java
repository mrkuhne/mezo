package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.llm.GeminiUsageExtractor.UsageInfo;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.content.Media;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/**
 * Real {@link CompanionLlm} adapter over the autoconfigured Gemini {@link ChatModel}
 * (spring-ai-starter-model-google-genai, ADR 0008). Absent under the {@code companion-fake}
 * profile so integration tests never construct a network-bound client path. Tools ride the
 * ChatClient request spec; Spring AI runs the tool-execution loop internally (V0.5).
 *
 * <p><b>Audit logging (mezo-2zyu).</b> Every call path here is the LAST place that still sees the
 * provider's raw metadata, so every path reports one {@link LlmCallRecord} — SUCCESS with the token
 * breakdown, or ERROR with the exception's identity, always rethrowing unchanged. The adapter never
 * checks whether logging is on: with the switch off the injected {@link LlmCallRecorder} is the
 * no-op, so the audit trail can never fail (or slow) a user's call.
 */
@Component
@Profile("!companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class GeminiCompanionLlm implements CompanionLlm {

    private final ChatClient chatClient;
    private final ChatClient smartChatClient;
    private final CompanionProperties companionProperties;
    private final LlmCallRecorder llmCallRecorder;
    private final LlmCallContextHolder llmCallContextHolder;
    private final GeminiUsageExtractor geminiUsageExtractor;

    public GeminiCompanionLlm(ChatModel chatModel, CompanionProperties companionProperties,
                              LlmCallRecorder llmCallRecorder, LlmCallContextHolder llmCallContextHolder,
                              GeminiUsageExtractor geminiUsageExtractor) {
        this.companionProperties = companionProperties;
        this.llmCallRecorder = llmCallRecorder;
        this.llmCallContextHolder = llmCallContextHolder;
        this.geminiUsageExtractor = geminiUsageExtractor;
        this.chatClient = ChatClient.builder(chatModel)
            .defaultOptions(ChatOptions.builder()
                .model(companionProperties.llm().chatModel()))
            .build();
        // V3.2: the smart tier (llm.smart-model) — weekly pipelines only, never chat turns
        this.smartChatClient = ChatClient.builder(chatModel)
            .defaultOptions(ChatOptions.builder()
                .model(companionProperties.llm().smartModel()))
            .build();
    }

    @Override
    public String completeSmart(String systemPrompt, String userMessage) {
        CallSpec spec = CallSpec.of(CallKind.SMART, smartModel(), systemPrompt, userMessage);
        return recorded(spec,
            () -> smartChatClient.prompt().system(systemPrompt).user(userMessage).call().chatResponse());
    }

    @Override
    public String complete(String systemPrompt, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        // TOOL vs CHAT is the only kind distinction observable here: how many rounds Spring AI's
        // internal tool loop ran is not exposed, so tool_rounds stays honestly null.
        CallKind kind = tools.isEmpty() ? CallKind.CHAT : CallKind.TOOL;
        CallSpec spec = CallSpec.of(kind, chatModel(), systemPrompt, userMessage);
        return recorded(spec,
            () -> request(systemPrompt, userMessage, tools, toolContext).call().chatResponse());
    }

    @Override
    public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
        // Image MARKERS only — the bytes are ephemeral by contract and must never reach the log.
        CallSpec spec = new CallSpec(CallKind.VISION, chatModel(), systemPrompt, userMessage,
            images.size(), totalBytes(images), firstMimeType(images), false);
        return recorded(spec, () -> chatClient.prompt()
            .system(systemPrompt)
            .user(u -> {
                u.text(userMessage == null || userMessage.isBlank() ? "(no text)" : userMessage);
                for (InlineImage img : images) {
                    u.media(Media.builder()
                        .mimeType(MimeTypeUtils.parseMimeType(img.mimeType()))
                        .data(new ByteArrayResource(img.bytes()))
                        .build());
                }
            })
            .call()
            .chatResponse());
    }

    /**
     * The streamed twin of {@link #recorded}: the outcome is only known when the Flux terminates, so
     * the record is emitted from the terminal signals instead of a try/catch.
     *
     * <p>The context is read HERE (the caller's thread still owns it); everything per-subscription
     * lives inside the {@code defer} so a re-subscribed stream is timed and recorded on its own.
     * Gemini attaches the usage block to the LAST chunk only — hence the running reference; if the
     * stream ends without one, the token columns stay null rather than fabricated.
     */
    @Override
    public Flux<String> stream(String systemPrompt, String userMessage,
                               List<ToolCallback> tools, Map<String, Object> toolContext) {
        CallSpec spec = new CallSpec(
            CallKind.CHAT_STREAM, chatModel(), systemPrompt, userMessage, null, null, null, true);
        LlmCallContext context = llmCallContextHolder.get();

        return Flux.defer(() -> {
            long startedAt = System.nanoTime();
            AtomicReference<ChatResponse> lastChunk = new AtomicReference<>();
            StringBuilder answer = new StringBuilder();
            return request(systemPrompt, userMessage, tools, toolContext).stream().chatResponse()
                .doOnNext(response -> {
                    lastChunk.set(response);
                    String text = textOf(response);
                    if (text != null) {
                        answer.append(text);
                    }
                })
                .doOnError(ex -> llmCallRecorder.record(
                    failureRecord(spec, ex, startedAt, context)))
                .doOnComplete(() -> llmCallRecorder.record(
                    successRecord(spec, lastChunk.get(), answer.toString(), startedAt, context)));
        }).handle((response, sink) -> {
            // Same emission shape as ChatClient's own stream().content(): null AND empty chunks are
            // dropped (Gemini's final usage-only chunk carries no text) — the SSE contract is unchanged.
            String text = textOf(response);
            if (StringUtils.hasLength(text)) {
                sink.next(text);
            }
        });
    }

    /** Times one blocking call, reports it either way, and hands the caller exactly what it had before. */
    private String recorded(CallSpec spec, Supplier<ChatResponse> call) {
        long startedAt = System.nanoTime();
        LlmCallContext context = llmCallContextHolder.get();
        try {
            ChatResponse response = call.get();
            String text = textOf(response);
            llmCallRecorder.record(successRecord(spec, response, text, startedAt, context));
            return text;
        } catch (RuntimeException ex) {
            llmCallRecorder.record(failureRecord(spec, ex, startedAt, context));
            throw ex;
        }
    }

    private LlmCallRecord successRecord(CallSpec spec, ChatResponse response, String responseText,
                                        long startedAt, LlmCallContext context) {
        UsageInfo usage = geminiUsageExtractor.extract(response);
        return baseRecord(spec, startedAt, context)
            .status(CallStatus.SUCCESS)
            .servedModel(usage.servedModel())
            .serviceTier(usage.serviceTier())
            .tokens(usage.tokens())
            .responseText(responseText)
            .build();
    }

    private LlmCallRecord failureRecord(CallSpec spec, Throwable failure, long startedAt, LlmCallContext context) {
        return baseRecord(spec, startedAt, context)
            .status(CallStatus.ERROR)
            .errorClass(failure.getClass().getSimpleName())
            .errorCode(errorCodeOf(failure))
            .build();
    }

    private LlmCallRecord.LlmCallRecordBuilder baseRecord(CallSpec spec, long startedAt, LlmCallContext context) {
        return LlmCallRecord.builder()
            .callKind(spec.kind())
            .requestedModel(spec.requestedModel())
            .latencyMs(elapsedMillis(startedAt))
            .streamed(spec.streamed())
            .systemPrompt(spec.systemPrompt())
            .userMessage(spec.userMessage())
            .imageCount(spec.imageCount())
            .imageBytesTotal(spec.imageBytesTotal())
            .imageMime(spec.imageMime())
            .context(context);
    }

    private ChatClient.ChatClientRequestSpec request(String systemPrompt, String userMessage,
                                                     List<ToolCallback> tools, Map<String, Object> toolContext) {
        ChatClient.ChatClientRequestSpec spec = chatClient.prompt().system(systemPrompt).user(userMessage);
        if (!tools.isEmpty()) {
            // tools(Object...) is the unified 2.0 registration API (toolCallbacks(..) is deprecated)
            spec = spec.tools((Object[]) tools.toArray(ToolCallback[]::new)).toolContext(toolContext);
        }
        return spec;
    }

    private String chatModel() {
        return companionProperties.llm().chatModel();
    }

    private String smartModel() {
        return companionProperties.llm().smartModel();
    }

    /** An app-level failure carries its SystemMessage code; a provider/transport failure has none. */
    private static String errorCodeOf(Throwable failure) {
        if (failure instanceof SystemRuntimeErrorException system && !system.getMessages().isEmpty()) {
            SystemMessage first = system.getMessages().get(0);
            return first != null ? first.getCode() : null;
        }
        return null;
    }

    private static String textOf(ChatResponse response) {
        if (response == null) {
            return null;
        }
        Generation generation = response.getResult();
        return generation == null || generation.getOutput() == null ? null : generation.getOutput().getText();
    }

    private static long elapsedMillis(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000L;
    }

    private static long totalBytes(List<InlineImage> images) {
        return images.stream().mapToLong(img -> img.bytes() == null ? 0L : img.bytes().length).sum();
    }

    private static String firstMimeType(List<InlineImage> images) {
        return images.isEmpty() ? null : images.get(0).mimeType();
    }

    /**
     * Everything about a call that is known BEFORE it runs — kept as one value so each path states
     * its identity once and the record builders stay uniform across success, failure and stream.
     */
    private record CallSpec(CallKind kind, String requestedModel, String systemPrompt, String userMessage,
                            Integer imageCount, Long imageBytesTotal, String imageMime, boolean streamed) {

        static CallSpec of(CallKind kind, String requestedModel, String systemPrompt, String userMessage) {
            return new CallSpec(kind, requestedModel, systemPrompt, userMessage, null, null, null, false);
        }
    }
}
