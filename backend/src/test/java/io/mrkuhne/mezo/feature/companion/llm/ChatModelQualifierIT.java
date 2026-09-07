package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

/**
 * The seam that lets a SECOND provider into the build (mezo-ozri.1, spec §8.1). Spring AI's
 * starters each contribute their own {@code ChatModel} bean, and S2 will add a second
 * {@code LlmUsageExtractor} {@code @Component} alongside {@code GoogleGenAiUsageExtractor}; an
 * unqualified injection point makes every context ambiguous the moment either second bean lands —
 * including the ~178 fake-profile ones. This IT plants a second {@code ChatModel} bean AND a second
 * {@code LlmUsageExtractor} bean NOW, so both qualifiers are proven before the OpenAI starter
 * exists, and neither can be dropped unnoticed.
 */
@Import(ChatModelQualifierIT.SecondChatModelConfiguration.class)
class ChatModelQualifierIT extends AbstractIntegrationTest {

    @TestConfiguration
    static class SecondChatModelConfiguration {

        /** Stands in for S2's OpenAI ChatModel: never called, only present. */
        @Bean
        ChatModel secondaryChatModel() {
            return (Prompt prompt) -> new ChatResponse(java.util.List.of());
        }

        /** Stands in for S2's OpenAiUsageExtractor: never called, only present. */
        @Bean
        LlmUsageExtractor secondaryUsageExtractor() {
            return new LlmUsageExtractor() {
                @Override
                public UsageInfo extract(ChatResponse response) {
                    return UsageInfo.NOTHING;
                }

                @Override
                public String finishReason(ChatResponse response) {
                    return null;
                }
            };
        }
    }

    @Autowired private GeminiCompanionLlm geminiCompanionLlm;

    @Test
    void testContext_shouldWireTheGoogleChatModel_whenASecondChatModelBeanExists() {
        assertThat(geminiCompanionLlm).isNotNull();
    }
}
