package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.google.genai.types.GenerateContentResponseUsageMetadata;
import io.mrkuhne.mezo.feature.companion.llm.GeminiUsageExtractor.UsageInfo;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

/**
 * The provider-metadata mapper is the ONLY place that knows Gemini's wire shape (mezo-2zyu), so it
 * is also the only place that can fake a token count by accident. These cases pin the two halves of
 * that promise: the full breakdown IS read when the provider sends it, and nothing is invented when
 * it does not — Spring AI's {@code EmptyUsage}/blank-model defaults must surface as null, never 0.
 */
class GeminiUsageExtractorTest {

    private final GeminiUsageExtractor extractor = new GeminiUsageExtractor();

    @Test
    void testExtract_shouldReadServedModelAndTokenBreakdown_whenNativeUsagePresent() {
        ChatResponse response = response(ChatResponseMetadata.builder()
            .model("gemini-2.5-flash")
            .usage(new DefaultUsage(10_000, 1_000, 11_500, googleUsage(500, 0)))
            .build());

        UsageInfo info = extractor.extract(response);

        assertThat(info.servedModel()).isEqualTo("gemini-2.5-flash");
        assertThat(info.tokens().prompt()).isEqualTo(10_000);
        assertThat(info.tokens().candidates()).isEqualTo(1_000);
        assertThat(info.tokens().thoughts()).isEqualTo(500);
        assertThat(info.tokens().cached()).isZero();
        assertThat(info.tokens().total()).isEqualTo(11_500);
    }

    @Test
    void testExtract_shouldLeaveThoughtsAndCachedNull_whenNativeUsageIsNotGemini() {
        ChatResponse response = response(ChatResponseMetadata.builder()
            .model("gemini-2.5-flash")
            .usage(new DefaultUsage(7, 3, 10))
            .build());

        UsageInfo info = extractor.extract(response);

        assertThat(info.tokens().prompt()).isEqualTo(7);
        assertThat(info.tokens().candidates()).isEqualTo(3);
        assertThat(info.tokens().thoughts()).isNull();
        assertThat(info.tokens().cached()).isNull();
    }

    @Test
    void testExtract_shouldReadServiceTier_whenMetadataCarriesTheKey() {
        ChatResponse response = response(ChatResponseMetadata.builder()
            .model("gemini-2.5-flash")
            .keyValue("serviceTier", "standard")
            .usage(new DefaultUsage(1, 1, 2))
            .build());

        assertThat(extractor.extract(response).serviceTier()).isEqualTo("standard");
    }

    @Test
    void testExtract_shouldReportNoTokens_whenProviderSentNoUsageBlock() {
        ChatResponse response = response(ChatResponseMetadata.builder().model("gemini-2.5-flash").build());

        UsageInfo info = extractor.extract(response);

        assertThat(info.servedModel()).isEqualTo("gemini-2.5-flash");
        assertThat(info.tokens()).isNull();
        assertThat(info.serviceTier()).isNull();
    }

    @Test
    void testExtract_shouldReportNothing_whenResponseIsAbsent() {
        UsageInfo info = extractor.extract(null);

        assertThat(info.servedModel()).isNull();
        assertThat(info.serviceTier()).isNull();
        assertThat(info.tokens()).isNull();
    }

    @Test
    void testExtract_shouldReportServedModelNull_whenMetadataModelIsBlank() {
        ChatResponse response = response(ChatResponseMetadata.builder().build());

        assertThat(extractor.extract(response).servedModel()).isNull();
    }

    private static ChatResponse response(ChatResponseMetadata metadata) {
        return ChatResponse.builder()
            .generations(List.of(new Generation(new AssistantMessage("hello"))))
            .metadata(metadata)
            .build();
    }

    private static GenerateContentResponseUsageMetadata googleUsage(Integer thoughts, Integer cached) {
        return GenerateContentResponseUsageMetadata.builder()
            .promptTokenCount(10_000)
            .candidatesTokenCount(1_000)
            .thoughtsTokenCount(thoughts)
            .cachedContentTokenCount(cached)
            .build();
    }
}
