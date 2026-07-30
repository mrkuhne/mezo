package io.mrkuhne.mezo.feature.companion.llm;

import com.google.genai.Client;
import com.google.genai.types.ContentEmbedding;
import com.google.genai.types.EmbedContentConfig;
import com.google.genai.types.EmbedContentMetadata;
import com.google.genai.types.EmbedContentResponse;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.service.EmbedUsage;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Real {@link EmbeddingPort} adapter over the Google Gen AI SDK {@link Client} (the bean the
 * chat starter already autoconfigures — same provider, same API key as ADR 0008). Spring AI
 * 2.0.0 ships no Gemini {@code EmbeddingModel} (the google-genai embedding autoconfiguration
 * backs off on a missing class), so this adapter calls the SDK's {@code embedContent} directly;
 * the port keeps that detail invisible to every caller.
 *
 * <p>Absent under the {@code companion-fake} profile so integration tests never construct a
 * network-bound path. Vectors are requested at {@link EmbeddingPort#DIMENSIONS} and
 * L2-normalized client-side (gemini-embedding-001 only self-normalizes at 3072 dims).
 *
 * <p><b>Audit logging (mezo-2zyu).</b> This is the last place the provider's
 * {@link EmbedContentResponse} exists, so every call that actually leaves the process reports one
 * {@link LlmCallRecord} — SUCCESS with the CHARACTER-based usage block (embeddings are billed per
 * character, not per token), or ERROR with the exception's identity, always rethrowing unchanged.
 * The adapter never checks whether logging is on: with the switch off the injected
 * {@link LlmCallRecorder} is the no-op, so the audit trail can never fail (or slow) a user's call.
 */
@Component
@Profile("!companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class GeminiEmbeddingAdapter implements EmbeddingPort {

    /** Gemini asymmetric-retrieval task types — documents and queries embed differently. */
    static final String TASK_DOCUMENT = "RETRIEVAL_DOCUMENT";
    static final String TASK_QUERY = "RETRIEVAL_QUERY";

    private final Client googleGenAiClient;
    private final CompanionProperties companionProperties;
    private final LlmCallRecorder llmCallRecorder;
    private final LlmCallContextHolder llmCallContextHolder;

    @Override
    public List<float[]> embedDocuments(List<String> texts) {
        return embed(texts, TASK_DOCUMENT);
    }

    @Override
    public float[] embedQuery(String text) {
        return embed(List.of(text), TASK_QUERY).getFirst();
    }

    private List<float[]> embed(List<String> texts, String taskType) {
        if (texts.isEmpty()) {
            // Nothing left the process — an audit row here would invent a call that never happened.
            return List.of();
        }
        CallKind kind = TASK_QUERY.equals(taskType) ? CallKind.EMBED_QUERY : CallKind.EMBED_DOC;
        EmbedContentConfig config = EmbedContentConfig.builder()
            .taskType(taskType)
            .outputDimensionality(DIMENSIONS)
            .build();

        long startedAt = System.nanoTime();
        LlmCallContext context = llmCallContextHolder.get();
        try {
            EmbedContentResponse response = callEmbedContent(texts, config);
            // Validation is INSIDE the timed block on purpose: a malformed response is a failed call
            // from the caller's side, and the log must agree with what the caller experienced.
            List<float[]> vectors = toVectors(response, texts.size());
            llmCallRecorder.record(
                successRecord(kind, texts.size(), response, elapsedMillis(startedAt), context));
            return vectors;
        } catch (RuntimeException ex) {
            llmCallRecorder.record(
                failureRecord(kind, texts.size(), ex, elapsedMillis(startedAt), context));
            throw ex;
        }
    }

    /**
     * The single provider hop, isolated from the audit + validation logic wrapped around it. The
     * SDK's {@code Client.models} is a {@code public final} field on a {@code final} class, so this
     * method is also the only seam a test can stand in for the network at.
     */
    EmbedContentResponse callEmbedContent(List<String> texts, EmbedContentConfig config) {
        return googleGenAiClient.models.embedContent(embedModel(), texts, config);
    }

    /** Pure mapping: what the provider reported → the audit record. */
    LlmCallRecord successRecord(CallKind kind, int inputCount, EmbedContentResponse response,
                                long latencyMs, LlmCallContext context) {
        return baseRecord(kind, latencyMs, context)
            .status(CallStatus.SUCCESS)
            .embed(new EmbedUsage(inputCount, DIMENSIONS, billableChars(response)))
            .build();
    }

    /**
     * The failed twin. Batch size and vector width are REQUEST facts — known even when the provider
     * never answered; only the billable char count is genuinely unknown, so it stays null (and the
     * writer's embedding cost with it).
     */
    LlmCallRecord failureRecord(CallKind kind, int inputCount, Throwable failure,
                                long latencyMs, LlmCallContext context) {
        return baseRecord(kind, latencyMs, context)
            .status(CallStatus.ERROR)
            .errorClass(failure.getClass().getSimpleName())
            .errorCode(errorCodeOf(failure))
            .embed(new EmbedUsage(inputCount, DIMENSIONS, null))
            .build();
    }

    private LlmCallRecord.LlmCallRecordBuilder baseRecord(CallKind kind, long latencyMs, LlmCallContext context) {
        return LlmCallRecord.builder()
            .callKind(kind)
            .requestedModel(embedModel())
            // embedContent echoes no served model — the requested one IS what ran
            .servedModel(embedModel())
            .latencyMs(latencyMs)
            .context(context);
    }

    private String embedModel() {
        return companionProperties.embedding().model();
    }

    /** The cost basis, straight from the provider — absent when it reported none, never a fake 0. */
    private static Integer billableChars(EmbedContentResponse response) {
        return response == null
            ? null
            : response.metadata().flatMap(EmbedContentMetadata::billableCharacterCount).orElse(null);
    }

    /** An app-level failure carries its SystemMessage code; a provider/transport failure has none. */
    private static String errorCodeOf(Throwable failure) {
        if (failure instanceof SystemRuntimeErrorException system && !system.getMessages().isEmpty()) {
            SystemMessage first = system.getMessages().get(0);
            return first != null ? first.getCode() : null;
        }
        return null;
    }

    private static List<float[]> toVectors(EmbedContentResponse response, int expectedCount) {
        List<ContentEmbedding> embeddings = response.embeddings().orElse(List.of());
        if (embeddings.size() != expectedCount) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("COMPANION_EMBEDDING_INVALID_RESPONSE").build());
        }
        return embeddings.stream()
            .map(e -> normalize(toFloatArray(e.values()
                .orElseThrow(() -> new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_EMBEDDING_INVALID_RESPONSE").build())))))
            .toList();
    }

    private static float[] toFloatArray(List<Float> values) {
        float[] vector = new float[values.size()];
        for (int i = 0; i < vector.length; i++) {
            vector[i] = values.get(i);
        }
        return vector;
    }

    /** L2-normalization — cosine geometry expects unit vectors below 3072 dims (spec §7). */
    private static float[] normalize(float[] vector) {
        double sumOfSquares = 0;
        for (float v : vector) {
            sumOfSquares += (double) v * v;
        }
        double norm = Math.sqrt(sumOfSquares);
        if (norm == 0) {
            return vector;
        }
        float[] unit = new float[vector.length];
        for (int i = 0; i < vector.length; i++) {
            unit[i] = (float) (vector[i] / norm);
        }
        return unit;
    }

    private static long elapsedMillis(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000L;
    }
}
