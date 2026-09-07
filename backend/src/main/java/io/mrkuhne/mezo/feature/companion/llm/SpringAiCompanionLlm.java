package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.ChatHistory;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Role;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.llm.LlmUsageExtractor.UsageInfo;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.content.Media;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.util.MimeTypeUtils;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/**
 * Everything a Spring AI {@link CompanionLlm} adapter does that is NOT provider-specific
 * (mezo-ozri.2): the two tier-bound {@link ChatClient}s, the tool-loop round tally, and the audit
 * record emitted on every terminal — success, failure, and a mid-stream cancel. Tools ride the
 * ChatClient request spec; Spring AI runs the tool-execution loop internally (V0.5).
 *
 * <p>A subclass supplies three things and nothing else: the provider's {@link ChatModel}, the
 * provider's {@link LlmUsageExtractor}, and {@link #optionsFor} — the hook that turns one RESOLVED
 * model id into that provider's options. Anything a provider must do DIFFERENTLY —
 * {@code OpenAiCompanionLlm} routing audio and vision back to Gemini, for instance — is an override
 * of the matching {@code complete} overload.
 *
 * <p><b>The model is per CALL, not per boot (mezo-ozri.4).</b> Until {@link LlmModelRouter} existed
 * this class built one ChatClient per tier with the tier's model baked into its defaults; now there
 * is ONE client and every request states its own options, so moving a feature to another model is a
 * YAML edit. The resolved id is what the audit row records, or every cost report would name the
 * tier default instead of what was actually asked for.
 *
 * <p><b>Audit logging (mezo-2zyu).</b> Every call path here is the LAST place that still sees the
 * provider's raw metadata, so every path reports one {@link LlmCallRecord} — SUCCESS with the token
 * breakdown, or ERROR with the exception's identity, always rethrowing unchanged. The adapter never
 * checks whether logging is on: with the switch off the injected {@link LlmCallRecorder} is the
 * no-op, so the audit trail can never fail (or slow) a user's call.
 */
public abstract class SpringAiCompanionLlm implements CompanionLlm {

    private final ChatClient chatClient;
    /** Resolves WHICH model serves each call; also read by {@link #optionsFor} for the effort. */
    protected final LlmModelRouter llmModelRouter;
    private final LlmProvider provider;
    private final LlmCallRecorder llmCallRecorder;
    private final LlmCallContextHolder llmCallContextHolder;
    private final LlmUsageExtractor llmUsageExtractor;

    /**
     * @param chatModel         the provider's ChatModel. Subclasses MUST inject it with a
     *                          {@code @Qualifier} (mezo-ozri.1): each Spring AI starter contributes
     *                          its own, so an unqualified injection point turns every context
     *                          ambiguous. Guarded by {@code ChatModelQualifierIT}.
     * @param llmUsageExtractor the provider's usage extractor — qualified for the same reason, the
     *                          port has one implementation per provider.
     * @param llmModelRouter    resolves the model id of each call from config (mezo-ozri.4).
     * @param provider          which provider's config block the router reads for this adapter — a
     *                          Gemini call may never resolve an OpenAI model id (spec §A1).
     */
    protected SpringAiCompanionLlm(ChatModel chatModel, LlmUsageExtractor llmUsageExtractor,
                                   LlmModelRouter llmModelRouter, LlmProvider provider,
                                   LlmCallRecorder llmCallRecorder,
                                   LlmCallContextHolder llmCallContextHolder) {
        this.llmCallRecorder = llmCallRecorder;
        this.llmCallContextHolder = llmCallContextHolder;
        this.llmUsageExtractor = llmUsageExtractor;
        this.llmModelRouter = llmModelRouter;
        this.provider = provider;
        // mezo-58ig: the per-round usage observer — stateless; the per-call state is the
        // LlmRoundUsage tally each call plants in the request context.
        this.chatClient = ChatClient.builder(chatModel)
            .defaultAdvisors(new LlmRoundUsageAdvisor(llmUsageExtractor))
            .build();
    }

    /**
     * The provider's options for ONE resolved call. Replaces both the tier options that used to be
     * constructor arguments and the old {@code toolCallOptions()} hook (mezo-ozri.4): since the
     * model is chosen per call, the options must be built per call too, and the only two things
     * that vary besides the id are the tier — which reasoning effort applies — and whether the
     * request carries function tools, which on OpenAI forces that effort to {@code none}
     * (mezo-ozri.3).
     *
     * <p>A BUILDER, because that is what the 2.0 request spec's {@code options(..)} takes.
     */
    protected abstract ChatOptions.Builder<?> optionsFor(String model, ModelTier tier, boolean carriesTools);

    /** The model this call resolves to — sent to the provider AND recorded on the audit row. */
    private String route(ModelTier tier, CallKind kind) {
        return llmModelRouter.modelFor(provider, tier, kind);
    }

    /**
     * The smart tier, overridden ON PURPOSE (spec §8.3): the {@link CompanionLlm} interface default
     * routes this straight to the cheap tier, so an adapter that inherits it sends all 19
     * smart-tier call sites to the wrong model — silently, with no error anywhere.
     */
    @Override
    public String completeSmart(String systemPrompt, String userMessage) {
        String model = route(ModelTier.SMART, CallKind.SMART);
        CallSpec spec = CallSpec.of(CallKind.SMART, model, systemPrompt, userMessage);
        LlmRoundUsage tally = new LlmRoundUsage();
        return recorded(spec, tally,
            () -> chatClient.prompt().system(systemPrompt).user(userMessage)
                .options(optionsFor(model, ModelTier.SMART, false))
                .advisors(a -> a.param(LlmRoundUsage.CONTEXT_KEY, tally))
                .call().chatResponse());
    }

    @Override
    public String complete(String systemPrompt, List<Turn> history, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        // TOOL vs CHAT is the only kind distinction observable at call time; the executed round
        // count arrives per-call via the LlmRoundUsage tally (mezo-58ig).
        CallKind kind = tools.isEmpty() ? CallKind.CHAT : CallKind.TOOL;
        String model = route(ModelTier.CHEAP, kind);
        CallSpec spec = new CallSpec(kind, model, systemPrompt, userMessage,
            ChatHistory.render(history), null, null, null, false);
        LlmRoundUsage tally = new LlmRoundUsage();
        return recorded(spec, tally,
            () -> request(systemPrompt, history, userMessage, tools, toolContext, model, tally)
                .call().chatResponse());
    }

    @Override
    public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
        // Image MARKERS only — the bytes are ephemeral by contract and must never reach the log.
        String model = route(ModelTier.CHEAP, CallKind.VISION);
        CallSpec spec = new CallSpec(CallKind.VISION, model, systemPrompt, userMessage, null,
            images.size(), totalBytes(images), firstMimeType(images), false);
        LlmRoundUsage tally = new LlmRoundUsage();
        return recorded(spec, tally, () -> chatClient.prompt()
            .options(optionsFor(model, ModelTier.CHEAP, false))
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
            .advisors(a -> a.param(LlmRoundUsage.CONTEXT_KEY, tally))
            .call()
            .chatResponse());
    }

    @Override
    public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
        // Audio MARKERS only — like the vision path, the bytes are ephemeral and never logged.
        // They ride the same image_* columns (count/bytes/mime), which are the generic media block.
        String model = route(ModelTier.CHEAP, CallKind.TRANSCRIBE);
        CallSpec spec = new CallSpec(CallKind.TRANSCRIBE, model, systemPrompt, userMessage, null,
            1, (long) (audio.bytes() == null ? 0 : audio.bytes().length), audio.mimeType(), false);
        LlmRoundUsage tally = new LlmRoundUsage();
        return recorded(spec, tally, () -> chatClient.prompt()
            .options(optionsFor(model, ModelTier.CHEAP, false))
            .system(systemPrompt)
            .user(u -> {
                u.text(userMessage == null || userMessage.isBlank() ? "(no text)" : userMessage);
                u.media(Media.builder()
                    .mimeType(MimeTypeUtils.parseMimeType(audio.mimeType()))
                    .data(new ByteArrayResource(audio.bytes()))
                    .build());
            })
            .advisors(a -> a.param(LlmRoundUsage.CONTEXT_KEY, tally))
            .call()
            .chatResponse());
    }

    /**
     * The streamed twin of {@link #recorded}: the outcome is only known when the Flux terminates, so
     * the record is emitted from the terminal signals instead of a try/catch.
     *
     * <p>The context is read HERE (the caller's thread still owns it); everything per-subscription
     * lives inside the {@code defer} so a re-subscribed stream is timed and recorded on its own. The
     * provider attaches the usage block to the LAST chunk only — hence the running reference; if the
     * stream ends without one, the token columns stay null rather than fabricated.
     *
     * <p>Three mutually exclusive terminals, each recording exactly once (the CAS guard): complete
     * ⇒ SUCCESS, error ⇒ ERROR, and — mezo-1rz9 — a downstream cancel (the SSE client
     * disconnected) ⇒ CANCELLED with the partial answer, because the provider billed the tokens
     * generated up to that point even though neither complete nor error will ever fire.
     */
    @Override
    public Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                               List<ToolCallback> tools, Map<String, Object> toolContext) {
        // Both the context and the routing decision are read HERE, on the caller's thread: a
        // re-subscription runs the defer elsewhere, where the feature slug is no longer bound.
        String model = route(ModelTier.CHEAP, CallKind.CHAT_STREAM);
        CallSpec spec = new CallSpec(CallKind.CHAT_STREAM, model, systemPrompt, userMessage,
            ChatHistory.render(history), null, null, null, true);
        LlmCallContext context = llmCallContextHolder.get();

        return Flux.defer(() -> {
            long startedAt = System.nanoTime();
            AtomicReference<ChatResponse> lastChunk = new AtomicReference<>();
            AtomicBoolean recordedOnce = new AtomicBoolean(false);
            LlmRoundUsage tally = new LlmRoundUsage();
            StringBuilder answer = new StringBuilder();
            return request(systemPrompt, history, userMessage, tools, toolContext, model, tally)
                .stream().chatResponse()
                .doOnNext(response -> {
                    lastChunk.set(response);
                    String text = textOf(response);
                    if (text != null) {
                        answer.append(text);
                    }
                })
                .doOnError(ex -> {
                    if (recordedOnce.compareAndSet(false, true)) {
                        llmCallRecorder.record(failureRecord(spec, ex, startedAt, context));
                    }
                })
                .doOnComplete(() -> {
                    if (recordedOnce.compareAndSet(false, true)) {
                        llmCallRecorder.record(
                            successRecord(spec, lastChunk.get(), answer.toString(), startedAt, context, tally));
                    }
                })
                .doOnCancel(() -> {
                    if (recordedOnce.compareAndSet(false, true)) {
                        llmCallRecorder.record(
                            cancelRecord(spec, lastChunk.get(), answer.toString(), startedAt, context, tally));
                    }
                });
        }).handle((response, sink) -> {
            // Same emission shape as ChatClient's own stream().content(): null AND empty chunks are
            // dropped (the final usage-only chunk carries no text) — the SSE contract is unchanged.
            String text = textOf(response);
            if (StringUtils.hasLength(text)) {
                sink.next(text);
            }
        });
    }

    /** Times one blocking call, reports it either way, and hands the caller exactly what it had before. */
    private String recorded(CallSpec spec, LlmRoundUsage tally, Supplier<ChatResponse> call) {
        long startedAt = System.nanoTime();
        LlmCallContext context = llmCallContextHolder.get();
        try {
            ChatResponse response = call.get();
            String text = textOf(response);
            llmCallRecorder.record(successRecord(spec, response, text, startedAt, context, tally));
            return text;
        } catch (RuntimeException ex) {
            llmCallRecorder.record(failureRecord(spec, ex, startedAt, context));
            throw ex;
        }
    }

    private LlmCallRecord successRecord(CallSpec spec, ChatResponse response, String responseText,
                                        long startedAt, LlmCallContext context, LlmRoundUsage tally) {
        return usageRecord(spec, response, startedAt, context, tally)
            .status(CallStatus.SUCCESS)
            .responseText(responseText)
            .build();
    }

    /**
     * mezo-1rz9: the subscriber cancelled mid-stream. What the provider revealed up to that point IS
     * recorded — the partial answer and any usage the tally caught from completed rounds — because
     * those tokens were billed; what never arrived (usually the final usage chunk) stays null.
     */
    private LlmCallRecord cancelRecord(CallSpec spec, ChatResponse lastChunk, String partialAnswer,
                                       long startedAt, LlmCallContext context, LlmRoundUsage tally) {
        return usageRecord(spec, lastChunk, startedAt, context, tally)
            .status(CallStatus.CANCELLED)
            .responseText(partialAnswer.isEmpty() ? null : partialAnswer)
            .build();
    }

    /**
     * The shared usage resolution (mezo-58ig): the per-round tally WINS whenever it saw a round,
     * because Spring AI 2.0's tool loop returns the last round's response as the final one — its
     * usage covers one round, not the turn — while the tally holds every billed round's own counts
     * (on a single-round call the two are the same numbers). The observed round count also makes
     * {@code tool_rounds} recordable at last: N usage-reporting rounds ⇒ N-1 tool-execution rounds.
     */
    private LlmCallRecord.LlmCallRecordBuilder usageRecord(CallSpec spec, ChatResponse response,
                                                           long startedAt, LlmCallContext context,
                                                           LlmRoundUsage tally) {
        UsageInfo usage = llmUsageExtractor.extract(response);
        boolean tallied = tally.hasRounds();
        return baseRecord(spec, startedAt, context)
            .servedModel(usage.servedModel())
            .serviceTier(usage.serviceTier())
            // mezo-8z79: read from the SAME response the usage came from — on a streamed call that
            // is the last chunk, which is where the finish reason lives.
            .finishReason(llmUsageExtractor.finishReason(response))
            .tokens(tallied ? tally.toTokenUsage() : usage.tokens())
            .toolRounds(tallied ? tally.rounds() - 1 : null);
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
            .conversationHistory(spec.conversationHistory())
            .userMessage(spec.userMessage())
            .imageCount(spec.imageCount())
            .imageBytesTotal(spec.imageBytesTotal())
            .imageMime(spec.imageMime())
            .context(context);
    }

    private ChatClient.ChatClientRequestSpec request(String systemPrompt, List<Turn> history,
                                                     String userMessage, List<ToolCallback> tools,
                                                     Map<String, Object> toolContext, String model,
                                                     LlmRoundUsage tally) {
        ChatClient.ChatClientRequestSpec spec = chatClient.prompt()
            .options(optionsFor(model, ModelTier.CHEAP, !tools.isEmpty()))
            .system(systemPrompt)
            .messages(toMessages(history))
            .user(userMessage)
            .advisors(a -> a.param(LlmRoundUsage.CONTEXT_KEY, tally));
        if (!tools.isEmpty()) {
            // tools(Object...) is the unified 2.0 registration API (toolCallbacks(..) is deprecated)
            spec = spec.tools((Object[]) tools.toArray(ToolCallback[]::new)).toolContext(toolContext);
        }
        return spec;
    }

    /** A port provider-független Turn-jei -> spring-ai üzenetek. Üres history -> üres lista. */
    private static List<Message> toMessages(List<Turn> history) {
        return history.stream()
            .map(turn -> turn.role() == Role.USER
                ? (Message) new UserMessage(turn.content())
                : new AssistantMessage(turn.content()))
            .toList();
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
                            String conversationHistory, Integer imageCount, Long imageBytesTotal,
                            String imageMime, boolean streamed) {

        static CallSpec of(CallKind kind, String requestedModel, String systemPrompt, String userMessage) {
            return new CallSpec(kind, requestedModel, systemPrompt, userMessage, null, null, null, null, false);
        }
    }
}
