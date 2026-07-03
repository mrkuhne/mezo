package io.mrkuhne.mezo.feature.companion.llm;

import com.google.genai.Client;
import com.google.genai.types.ContentEmbedding;
import com.google.genai.types.EmbedContentConfig;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
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
            return List.of();
        }
        EmbedContentConfig config = EmbedContentConfig.builder()
            .taskType(taskType)
            .outputDimensionality(DIMENSIONS)
            .build();
        List<ContentEmbedding> embeddings = googleGenAiClient.models
            .embedContent(companionProperties.embedding().model(), texts, config)
            .embeddings()
            .orElse(List.of());
        if (embeddings.size() != texts.size()) {
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
}
