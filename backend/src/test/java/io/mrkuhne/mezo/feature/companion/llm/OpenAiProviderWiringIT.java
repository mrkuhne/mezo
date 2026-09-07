package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * The provider switch, proven end to end (mezo-ozri.2). No network is touched: the context is only
 * built, never called — the dummy {@code OPENAI_API_KEY} default is what makes that possible.
 */
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.companion.llm.provider=openai"
})
class OpenAiProviderWiringIT extends AbstractIntegrationTest {

    @Autowired private CompanionLlm companionLlm;
    @Autowired private GeminiCompanionLlm geminiCompanionLlm;

    @Test
    void testWiring_shouldPickTheOpenAiAdapter_whenProviderIsOpenai() {
        assertThat(companionLlm).isInstanceOf(OpenAiCompanionLlm.class);
    }

    @Test
    void testWiring_shouldKeepTheGeminiAdapter_whenProviderIsOpenai() {
        // The fallback AND the only audio route — it must survive the switch, not be replaced by it.
        assertThat(geminiCompanionLlm).isNotNull();
    }

    /**
     * Spec §8.3: the {@link CompanionLlm} interface DEFAULTS completeSmart to the cheap tier, so an
     * adapter that forgets to override it sends all 19 smart-tier call sites to the wrong model with
     * no error anywhere. Asserted structurally because the failure mode is silence.
     */
    @Test
    void testAdapter_shouldOverrideCompleteSmart_soTheSmartTierIsNotSilentlyLost() throws Exception {
        Method declared = OpenAiCompanionLlm.class.getMethod("completeSmart", String.class, String.class);

        assertThat(declared.getDeclaringClass()).isNotEqualTo(CompanionLlm.class);
    }
}
