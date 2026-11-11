package io.mrkuhne.mezo.feature.companion.llm;

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
import java.util.List;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.OpenAiEmbeddingOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * mezo-lb2yb: {@link EmbeddingPort} over OpenAI ({@code text-embedding-3-small} in production),
 * requested at {@link EmbeddingPort#DIMENSIONS} so it fits the existing {@code vector(768)} schema
 * and is L2-normalised client-side like the Gemini twin. Production moved here when the Gemini
 * prepay credits ran dry (HTTP 402 on every call from 2026-10-21); the key is the one chat already
 * uses ({@code spring.ai.openai.api-key}). The OpenAI starter's own embedding autoconfiguration
 * stays pinned off ({@code spring.ai.model.embedding: none}) — this adapter builds its model
 * itself, so no second {@code EmbeddingModel} bean appears in the context.
 *
 * <p>OpenAI has no document/query task types: both calls embed the same way, only the audit row's
 * {@link CallKind} differs. Embeddings are priced per character in this app's pricing table, so the
 * billable count is the input length (OpenAI bills tokens; the price row converts at ~4 chars/token).
 */
@Component
@Profile("!companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@ConditionalOnProperty(name = "mezo.companion.embedding.provider", havingValue = "openai")
public class OpenAiEmbeddingAdapter implements EmbeddingPort {

    private final CompanionProperties companionProperties;
    private final LlmCallRecorder llmCallRecorder;
    private final LlmCallContextHolder llmCallContextHolder;
    private final OpenAiEmbeddingModel model;

    @org.springframework.beans.factory.annotation.Autowired
    public OpenAiEmbeddingAdapter(CompanionProperties companionProperties, LlmCallRecorder llmCallRecorder,
                                  LlmCallContextHolder llmCallContextHolder,
                                  @Value("${spring.ai.openai.api-key}") String apiKey) {
        this(companionProperties, llmCallRecorder, llmCallContextHolder, apiKey, null);
    }

    /** {@code baseUrl} null = the provider's default endpoint; a test points it at a local server. */
    OpenAiEmbeddingAdapter(CompanionProperties companionProperties, LlmCallRecorder llmCallRecorder,
                           LlmCallContextHolder llmCallContextHolder, String apiKey, String baseUrl) {
        this.companionProperties = companionProperties;
        this.llmCallRecorder = llmCallRecorder;
        this.llmCallContextHolder = llmCallContextHolder;
        OpenAiEmbeddingOptions.Builder options = OpenAiEmbeddingOptions.builder()
                .dimensions(DIMENSIONS);
        options.apiKey(apiKey).model(companionProperties.embedding().model()).maxRetries(1);
        if (baseUrl != null) {
            options.baseUrl(baseUrl);
        }
        this.model = OpenAiEmbeddingModel.builder().options(options.build()).build();
    }

    @Override
    public List<float[]> embedDocuments(List<String> texts) {
        return embed(texts, CallKind.EMBED_DOC);
    }

    @Override
    public float[] embedQuery(String text) {
        return embed(List.of(text), CallKind.EMBED_QUERY).getFirst();
    }

    private List<float[]> embed(List<String> texts, CallKind kind) {
        if (texts.isEmpty()) {
            return List.of(); // nothing left the process — no audit row for a call that never happened
        }
        long startedAt = System.nanoTime();
        LlmCallContext context = llmCallContextHolder.get();
        try {
            List<float[]> vectors = toVectors(callEmbed(texts), texts.size());
            llmCallRecorder.record(baseRecord(kind, elapsedMillis(startedAt), context)
                    .status(CallStatus.SUCCESS)
                    .embed(new EmbedUsage(texts.size(), DIMENSIONS, billableChars(texts)))
                    .build());
            return vectors;
        } catch (RuntimeException ex) {
            llmCallRecorder.record(baseRecord(kind, elapsedMillis(startedAt), context)
                    .status(CallStatus.ERROR)
                    .errorClass(ex.getClass().getSimpleName())
                    .errorCode(EmbeddingFailure.code(ex))
                    .responseText(EmbeddingFailure.detail(ex))
                    .embed(new EmbedUsage(texts.size(), DIMENSIONS, null))
                    .build());
            throw ex;
        }
    }

    /** The single provider hop — zero logic, the seam a test stands in for the network at. */
    EmbeddingResponse callEmbed(List<String> texts) {
        return model.call(new EmbeddingRequest(texts, null));
    }

    private LlmCallRecord.LlmCallRecordBuilder baseRecord(CallKind kind, long latencyMs, LlmCallContext context) {
        String requested = companionProperties.embedding().model();
        return LlmCallRecord.builder()
                .callKind(kind)
                .requestedModel(requested)
                .servedModel(requested)
                .latencyMs(latencyMs)
                .context(context);
    }

    private static int billableChars(List<String> texts) {
        return texts.stream().mapToInt(text -> text == null ? 0 : text.length()).sum();
    }

    private static List<float[]> toVectors(EmbeddingResponse response, int expectedCount) {
        List<Embedding> results = response == null ? List.of() : response.getResults();
        if (results.size() != expectedCount) {
            throw invalid();
        }
        float[][] ordered = new float[expectedCount][];
        for (int i = 0; i < results.size(); i++) {
            Embedding embedding = results.get(i);
            int index = embedding.getIndex() == null ? i : embedding.getIndex();
            float[] output = embedding.getOutput();
            if (index < 0 || index >= expectedCount || ordered[index] != null
                    || output == null || output.length != DIMENSIONS) {
                throw invalid();
            }
            ordered[index] = normalize(output);
        }
        return List.of(ordered);
    }

    private static SystemRuntimeErrorException invalid() {
        return new SystemRuntimeErrorException(SystemMessage.error("COMPANION_EMBEDDING_INVALID_RESPONSE").build());
    }

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

    private static long elapsedMillis(long startedNanos) {
        return Math.max(0L, (System.nanoTime() - startedNanos) / 1_000_000L);
    }
}
