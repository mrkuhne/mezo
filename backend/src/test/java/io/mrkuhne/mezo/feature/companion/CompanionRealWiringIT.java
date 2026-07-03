package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.GeminiCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.GeminiEmbeddingAdapter;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Without the {@code companion-fake} profile the real Gemini adapters are the active
 * CompanionLlm/EmbeddingPort beans and construct cleanly over the autoconfigured
 * ChatModel/Client — even with the dummy API key (network is only touched on an actual
 * call, which this test never makes).
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=true")
class CompanionRealWiringIT extends AbstractIntegrationTest {

    @Autowired private CompanionLlm companionLlm;
    @Autowired private EmbeddingPort embeddingPort;

    @Test
    void testWiring_shouldPickGeminiAdapter_whenFakeProfileAbsent() {
        assertThat(companionLlm).isInstanceOf(GeminiCompanionLlm.class);
    }

    @Test
    void testWiring_shouldPickGeminiEmbeddingAdapter_whenFakeProfileAbsent() {
        assertThat(embeddingPort).isInstanceOf(GeminiEmbeddingAdapter.class);
    }
}
