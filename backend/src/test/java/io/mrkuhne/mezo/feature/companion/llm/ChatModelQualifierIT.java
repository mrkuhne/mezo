package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

/**
 * The seam that lets a SECOND provider into the build (mezo-ozri.1 spec §8.1, realised in
 * mezo-ozri.2). Spring AI's starters each contribute their own {@code ChatModel}, and S2 adds a
 * second {@link LlmUsageExtractor} beside {@code GoogleGenAiUsageExtractor}; an unqualified
 * injection point makes EVERY context ambiguous the moment either second bean lands — including the
 * ~178 fake-profile ones. Both qualifiers are asserted here against the REAL beans, so neither can
 * be dropped unnoticed.
 */
class ChatModelQualifierIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private GeminiCompanionLlm geminiCompanionLlm;

    @Test
    void testContext_shouldHoldBothProviderChatModels_whenBothStartersAreOnTheClasspath() {
        assertThat(context.getBeansOfType(ChatModel.class)).hasSizeGreaterThanOrEqualTo(2);
        assertThat(context.getBean("googleGenAiChatModel")).isInstanceOf(GoogleGenAiChatModel.class);
        assertThat(context.getBean("openAiChatModel")).isInstanceOf(OpenAiChatModel.class);
    }

    @Test
    void testContext_shouldHoldBothUsageExtractors_whenBothProvidersAreOnTheClasspath() {
        assertThat(context.getBeansOfType(LlmUsageExtractor.class))
            .containsKeys("googleGenAiUsageExtractor", "openAiUsageExtractor");
    }

    @Test
    void testContext_shouldWireTheGoogleChatModel_whenASecondChatModelBeanExists() {
        assertThat(geminiCompanionLlm).isNotNull();
    }
}
