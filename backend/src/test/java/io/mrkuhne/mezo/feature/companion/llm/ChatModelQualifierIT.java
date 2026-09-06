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
 * starters each contribute their own {@code ChatModel} bean; an unqualified injection point makes
 * every context ambiguous the moment the second starter lands — including the ~178 fake-profile
 * ones. This IT plants a second {@code ChatModel} bean NOW, so the qualifier is proven before the
 * OpenAI starter exists, and can never be dropped unnoticed.
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
    }

    @Autowired private GeminiCompanionLlm geminiCompanionLlm;

    @Test
    void testContext_shouldWireTheGoogleChatModel_whenASecondChatModelBeanExists() {
        assertThat(geminiCompanionLlm).isNotNull();
    }
}
