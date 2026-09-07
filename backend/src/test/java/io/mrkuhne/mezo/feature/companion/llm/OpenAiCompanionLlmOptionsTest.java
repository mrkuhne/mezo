package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.ai.openai.OpenAiChatOptions;

/**
 * mezo-ozri.2, spec §8.6: without streaming usage every streamed row is persisted with NULL tokens
 * and NULL cost — silently, because nothing fails. The 2.0.1 property is
 * {@code spring.ai.openai.chat.stream-options.include-usage} (not the "stream-usage" the bd note
 * names); rather than depend on that — or on option-merge order between the ChatClient's defaults
 * and the model's — the adapter states it in its OWN default options, and this test is what keeps
 * it stated.
 */
class OpenAiCompanionLlmOptionsTest {

    @Test
    void testOptions_shouldRequestStreamingUsage_always() {
        OpenAiChatOptions options = OpenAiCompanionLlm.options("gpt-5.6-luna");

        assertThat(options.getStreamOptions()).isNotNull();
        assertThat(options.getStreamOptions().includeUsage()).isTrue();
    }

    @Test
    void testOptions_shouldCarryTheRequestedModel_soTheAuditRowNamesIt() {
        assertThat(OpenAiCompanionLlm.options("gpt-5.6-terra").getModel()).isEqualTo("gpt-5.6-terra");
    }

    /** The base reads the model id back off the options — a lossy mutate() would blank the tier. */
    @Test
    void testOptions_shouldSurviveMutateRoundTrip_becauseTheBaseRebuildsThemForTheChatClient() {
        OpenAiChatOptions roundTripped = OpenAiCompanionLlm.options("gpt-5.6-luna").mutate().build();

        assertThat(roundTripped.getModel()).isEqualTo("gpt-5.6-luna");
        assertThat(roundTripped.getStreamOptions().includeUsage()).isTrue();
    }
}
