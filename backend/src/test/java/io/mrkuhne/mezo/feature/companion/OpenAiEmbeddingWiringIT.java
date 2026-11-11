package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.OpenAiEmbeddingAdapter;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-lb2yb: production answers the EmbeddingPort on OpenAI. With the provider switch flipped
 * (and no companion-fake profile) the OpenAI adapter is the ONE EmbeddingPort bean and constructs
 * over the dummy key without touching the network; the Gemini adapter backs off.
 */
@TestPropertySource(properties = {
        "mezo.feature.companion.enabled=true",
        "mezo.companion.embedding.provider=openai",
        "mezo.companion.embedding.model=text-embedding-3-small"})
class OpenAiEmbeddingWiringIT extends AbstractIntegrationTest {

    @Autowired private EmbeddingPort embeddingPort;

    @Test
    void wiring_picksTheOpenAiEmbeddingAdapter_whenTheProviderSaysOpenai() {
        assertThat(embeddingPort).isInstanceOf(OpenAiEmbeddingAdapter.class);
    }
}
