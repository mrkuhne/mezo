package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

/**
 * Under the {@code companion-fake} profile the fake is the active {@link EmbeddingPort} bean:
 * deterministic per text, unit-length, sentinel-scriptable — the geometry V2.2/V2.3 ITs build on.
 */
@ActiveProfiles("companion-fake")
class FakeEmbeddingAdapterIT extends AbstractIntegrationTest {

    @Autowired private EmbeddingPort embeddingPort;

    @Test
    void testWiring_shouldPickFakeAdapter_whenFakeProfileActive() {
        assertThat(embeddingPort).isInstanceOf(FakeEmbeddingAdapter.class);
    }

    @Test
    void testEmbedQuery_shouldReturnSameUnitVector_whenSameText() {
        float[] first = embeddingPort.embedQuery("kemény leg-day, rossz alvás");
        float[] second = embeddingPort.embedQuery("kemény leg-day, rossz alvás");

        assertThat(first).hasSize(EmbeddingPort.DIMENSIONS).containsExactly(second, within(0f));
        assertThat(norm(first)).isCloseTo(1.0, within(1e-5));
    }

    @Test
    void testEmbedDocuments_shouldReturnDistinctVectors_whenDistinctTexts() {
        List<float[]> vectors = embeddingPort.embedDocuments(List.of("futás reggel", "esti úszás"));

        assertThat(vectors).hasSize(2);
        assertThat(dot(vectors.get(0), vectors.get(1))).isLessThan(0.5);
    }

    @Test
    void testEmbedQuery_shouldUseScriptedDims_whenSentinelPresent() {
        float[] vector = embeddingPort.embedQuery("bármi [fake-embed:0.6 0.8] szöveg");

        assertThat(vector[0]).isCloseTo(0.6f, within(1e-6f));
        assertThat(vector[1]).isCloseTo(0.8f, within(1e-6f));
        assertThat(norm(vector)).isCloseTo(1.0, within(1e-6));
    }

    @Test
    void testEmbedDocuments_shouldReturnEmpty_whenNoTexts() {
        assertThat(embeddingPort.embedDocuments(List.of())).isEmpty();
    }

    private static double norm(float[] vector) {
        return Math.sqrt(dot(vector, vector));
    }

    private static double dot(float[] a, float[] b) {
        double sum = 0;
        for (int i = 0; i < a.length; i++) {
            sum += (double) a[i] * b[i];
        }
        return sum;
    }
}
