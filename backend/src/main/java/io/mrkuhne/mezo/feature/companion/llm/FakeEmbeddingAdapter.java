package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Random;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deterministic in-process {@link EmbeddingPort} for integration tests (spec §6: profile-gated
 * fake bean, not a Mockito mock — the network is never touched in tests). Same text always maps
 * to the same unit vector; distinct texts map to near-orthogonal ones (768-dim seeded-random
 * vectors), which is exactly the geometry retrieval tests need.
 *
 * <p>Scripted vectors: a {@code [fake-embed:0.6 0.8]} sentinel anywhere in the text sets the
 * leading dimensions explicitly (rest zero, then normalized), so ITs can stage exact cosine
 * relationships through the port instead of hand-seeding rows. A {@code [fake-embed-fail]}
 * sentinel makes the port throw instead (failure-path ITs).
 */
@Component
@Profile("companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FakeEmbeddingAdapter implements EmbeddingPort {

    private final AtomicInteger queryCallCount = new AtomicInteger();

    public int queryCallCount() {
        return queryCallCount.get();
    }

    /** Scripted vector: {@code [fake-embed:0.6 0.8]} → [0.6, 0.8, 0, …] normalized. */
    public static final Pattern EMBED_SENTINEL =
            Pattern.compile("\\[fake-embed:([-0-9. ]+)]");

    /**
     * Failure sentinel (W3.1): a text containing it makes the port throw the same
     * {@code SystemRuntimeErrorException} the real adapter raises on a malformed provider response —
     * ITs stage "the embed hop is down" without Mockito. Distinct from the fake LLM's
     * {@code [fake-fail]} (which fails the TURN, not the embed).
     */
    public static final String FAIL_EMBED = "[fake-embed-fail]";

    /**
     * ANN failure sentinel (W3.1): the returned vector is deliberately 3-dimensional instead of
     * {@link EmbeddingPort#DIMENSIONS}, so the embed hop SUCCEEDS and the ANN query then fails at
     * the database ("different vector dimensions") — the staged DB-level half of the failure path.
     */
    public static final String FAIL_ANN = "[fake-embed-shortvec]";

    @Override
    public List<float[]> embedDocuments(List<String> texts) {
        return texts.stream().map(this::vectorFor).toList();
    }

    @Override
    public float[] embedQuery(String text) {
        queryCallCount.incrementAndGet();
        return vectorFor(text);
    }

    private float[] vectorFor(String text) {
        if (text.contains(FAIL_EMBED)) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_EMBEDDING_INVALID_RESPONSE").build());
        }
        if (text.contains(FAIL_ANN)) {
            return normalize(new float[] {1f, 0f, 0f});
        }
        Matcher m = EMBED_SENTINEL.matcher(text);
        if (m.find()) {
            return normalize(scripted(m.group(1)));
        }
        // Seeded by content — deterministic per text, near-orthogonal across texts.
        Random random = new Random(text.hashCode());
        float[] vector = new float[DIMENSIONS];
        for (int i = 0; i < DIMENSIONS; i++) {
            vector[i] = (float) random.nextGaussian();
        }
        return normalize(vector);
    }

    private static float[] scripted(String dims) {
        String[] parts = dims.trim().split("\\s+");
        float[] vector = new float[DIMENSIONS];
        for (int i = 0; i < parts.length && i < DIMENSIONS; i++) {
            vector[i] = Float.parseFloat(parts[i]);
        }
        return vector;
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
}
