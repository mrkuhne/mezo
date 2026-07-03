package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * V0.1 smoke IT (mezo-fnnq.1): the CompanionLlm port streams end to end through the
 * profile-gated deterministic fake — no network, no live LLM (spec §6).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.companion.enabled=true")
class CompanionLlmFakeIT extends AbstractIntegrationTest {

    @Autowired private CompanionLlm companionLlm;

    @Test
    void testWiring_shouldPickFakeAdapter_whenFakeProfileActive() {
        assertThat(companionLlm).isInstanceOf(FakeCompanionLlm.class);
    }

    @Test
    void testComplete_shouldEchoBothPromptHalves_whenCalled() {
        String result = companionLlm.complete("rendszer-prompt", "szia mezo");

        assertThat(result)
            .startsWith(FakeCompanionLlm.PREFIX)
            .contains("system=[rendszer-prompt]")
            .contains("user=[szia mezo]");
    }

    @Test
    void testStream_shouldEmitDeterministicChunksInOrder_whenCalled() {
        List<String> chunks = companionLlm.stream("rendszer-prompt", "szia mezo")
            .collectList()
            .block();

        assertThat(chunks).containsExactly(
            FakeCompanionLlm.PREFIX,
            " system=[rendszer-prompt]",
            " user=[szia mezo]");
    }
}
