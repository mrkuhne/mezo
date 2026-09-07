package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.LlmUsageExtractor.UsageInfo;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatGenerationMetadata;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

/**
 * The OpenAI twin of the Google extractor's unit coverage (mezo-ozri.2). The contract under test is
 * the port's: never invent a number — anything the provider did not report stays null.
 */
class OpenAiUsageExtractorTest {

    private final OpenAiUsageExtractor extractor = new OpenAiUsageExtractor();

    @Test
    void testExtract_shouldReturnNothing_whenResponseIsNull() {
        assertThat(extractor.extract(null)).isEqualTo(UsageInfo.NOTHING);
    }

    @Test
    void testExtract_shouldReportPromptAndCompletionAndCached_whenUsageIsPresent() {
        ChatResponse response =
            responseWith(new DefaultUsage(1200, 340, 1540, null, 800L, null), "gpt-5.6-luna", "STOP");

        UsageInfo info = extractor.extract(response);

        assertThat(info.servedModel()).isEqualTo("gpt-5.6-luna");
        assertThat(info.tokens().prompt()).isEqualTo(1200);
        assertThat(info.tokens().candidates()).isEqualTo(340);
        assertThat(info.tokens().cached()).isEqualTo(800);
        assertThat(info.tokens().total()).isEqualTo(1540);
    }

    @Test
    void testExtract_shouldLeaveReasoningNull_whenNoNativeUsageIsAttached() {
        ChatResponse response =
            responseWith(new DefaultUsage(10, 5, 15, null, null, null), "gpt-5.6-luna", "STOP");

        assertThat(extractor.extract(response).tokens().thoughts()).isNull();
    }

    @Test
    void testExtract_shouldLeaveCachedNull_whenProviderReportedNoCacheRead() {
        ChatResponse response =
            responseWith(new DefaultUsage(10, 5, 15, null, null, null), "gpt-5.6-luna", "STOP");

        assertThat(extractor.extract(response).tokens().cached()).isNull();
    }

    @Test
    void testExtract_shouldReturnNothing_whenEveryCounterIsZero() {
        ChatResponse response = responseWith(new DefaultUsage(0, 0, 0, null, null, null), "gpt-5.6-luna", "STOP");

        assertThat(extractor.extract(response).tokens()).isNull();
    }

    @Test
    void testExtract_shouldNormaliseBlankModelToNull_whenProviderReportsNoModel() {
        ChatResponse response = responseWith(new DefaultUsage(10, 5, 15, null, null, null), "", "STOP");

        assertThat(extractor.extract(response).servedModel()).isNull();
    }

    @Test
    void testFinishReason_shouldReturnNull_whenBlank() {
        ChatResponse response = responseWith(new DefaultUsage(10, 5, 15, null, null, null), "gpt-5.6-luna", "  ");

        assertThat(extractor.finishReason(response)).isNull();
    }

    @Test
    void testFinishReason_shouldReturnTheFinalGenerationsReason_whenReported() {
        ChatResponse response =
            responseWith(new DefaultUsage(10, 5, 15, null, null, null), "gpt-5.6-luna", "TOOL_CALLS");

        assertThat(extractor.finishReason(response)).isEqualTo("TOOL_CALLS");
    }

    private static ChatResponse responseWith(DefaultUsage usage, String model, String finishReason) {
        ChatResponseMetadata metadata = ChatResponseMetadata.builder().model(model).usage(usage).build();
        Generation generation = new Generation(new AssistantMessage("ok"),
            ChatGenerationMetadata.builder().finishReason(finishReason).build());
        return new ChatResponse(List.of(generation), metadata);
    }
}
