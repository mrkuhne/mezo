package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.google.genai.types.GenerateContentResponseUsageMetadata;
import io.mrkuhne.mezo.feature.companion.llm.GeminiUsageExtractor.UsageInfo;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatGenerationMetadata;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.google.genai.metadata.GoogleGenAiUsage;

/**
 * The provider-metadata mapper is the ONLY place that knows Gemini's wire shape (mezo-2zyu), so it
 * is also the only place that can fake a token count by accident. These cases pin the two halves of
 * that promise: the full breakdown IS read on every shape the adapter can produce (typed
 * {@link GoogleGenAiUsage}, raw native payload), and nothing is invented when the provider reported
 * nothing — whether that arrives as Spring AI's generic {@code EmptyUsage}/blank model or as the real
 * adapter's all-zero {@code GoogleGenAiUsage}.
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

    /**
     * The shape the REAL Google adapter returns on a single-round call: the thinking/cached counts
     * come off {@link GoogleGenAiUsage}'s typed getters, not the native payload. A cached count of 0
     * is a fact ("nothing was cached"), so it must survive as 0 — only a wholly absent usage block
     * may become null.
     */
    @Test
    void testExtract_shouldReadThoughtsAndCached_whenUsageIsTheTypedGoogleUsage() {
        ChatResponse response = response(ChatResponseMetadata.builder()
            .model("gemini-2.5-flash")
            .usage(GoogleGenAiUsage.from(googleUsage(500, 0)))
            .build());

        UsageInfo info = extractor.extract(response);

        assertThat(info.tokens().prompt()).isEqualTo(10_000);
        assertThat(info.tokens().candidates()).isEqualTo(1_000);
        assertThat(info.tokens().thoughts()).isEqualTo(500);
        assertThat(info.tokens().cached()).isZero();
        assertThat(info.tokens().total()).isEqualTo(11_500);
    }

    /**
     * bd mezo-58ig: after a tool round Spring AI replaces the provider usage with its own cumulative
     * {@code DefaultUsage} ({@code nativeUsage = null}), so thoughts/cached are genuinely unknowable
     * here. Unknown must read as null — never as a fabricated 0 that would price as "no thinking".
     */
    @Test
    void testExtract_shouldLeaveThoughtsAndCachedNull_whenCumulativeToolRoundUsageDroppedTheNativePayload() {
        ChatResponse response = response(ChatResponseMetadata.builder()
            .model("gemini-2.5-flash")
            .usage(new DefaultUsage(1_200, 300, 1_500))
            .build());

        UsageInfo info = extractor.extract(response);

        assertThat(info.tokens().prompt()).isEqualTo(1_200);
        assertThat(info.tokens().candidates()).isEqualTo(300);
        assertThat(info.tokens().total()).isEqualTo(1_500);
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

    /**
     * The real adapter never yields the generic {@code EmptyUsage}: an omitted usage block becomes
     * {@code GoogleGenAiUsage.from(null)}, which is a fully-populated 0/0/0. Recording that verbatim
     * would write cost_usd = 0.00 — a free call and an unmeasured call would look identical.
     */
    @Test
    void testExtract_shouldReportNoTokens_whenTheRealAdapterReportsAllZeroes() {
        ChatResponse response = response(ChatResponseMetadata.builder()
            .model("gemini-2.5-flash")
            .usage(GoogleGenAiUsage.from(null))
            .build());

        UsageInfo info = extractor.extract(response);

        assertThat(info.servedModel()).isEqualTo("gemini-2.5-flash");
        assertThat(info.tokens()).isNull();
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

    /**
     * mezo-8z79: MAX_TOKENS on a candidate with NO text is the exact shape of the 2026-08-23 empty
     * -answer incident — the one signal that separates "the model chose to stop" from "the model
     * was cut off mid-thinking". It rides the per-generation metadata, not the response metadata.
     */
    @Test
    void testFinishReason_shouldReadTheFinalGenerationsReason_whenReported() {
        ChatResponse response = ChatResponse.builder()
            .generations(List.of(new Generation(new AssistantMessage(""),
                ChatGenerationMetadata.builder().finishReason("MAX_TOKENS").build())))
            .metadata(ChatResponseMetadata.builder().model("gemini-2.5-flash").build())
            .build();

        assertThat(extractor.finishReason(response)).isEqualTo("MAX_TOKENS");
    }

    @Test
    void testFinishReason_shouldBeNull_whenResponseOrReasonAbsent() {
        assertThat(extractor.finishReason(null)).isNull();
        // A generation with no reason reported must read as null, never as an empty string.
        assertThat(extractor.finishReason(response(ChatResponseMetadata.builder().build()))).isNull();
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
            .totalTokenCount(11_500)
            .thoughtsTokenCount(thoughts)
            .cachedContentTokenCount(cached)
            .build();
    }
}
