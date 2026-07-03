package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.GeminiCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Without the {@code companion-fake} profile the real Gemini adapter is the active
 * CompanionLlm bean and constructs cleanly over the autoconfigured ChatModel — even with
 * the dummy API key (network is only touched on an actual call, which this test never makes).
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=true")
class CompanionRealWiringIT extends AbstractIntegrationTest {

    @Autowired private CompanionLlm companionLlm;

    @Test
    void testWiring_shouldPickGeminiAdapter_whenFakeProfileAbsent() {
        assertThat(companionLlm).isInstanceOf(GeminiCompanionLlm.class);
    }
}
