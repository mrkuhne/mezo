package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import io.mrkuhne.mezo.feature.penz.service.PenzDigestLlm;
import io.mrkuhne.mezo.feature.penz.service.news.DigestAssembler;
import io.mrkuhne.mezo.feature.penz.service.news.DigestFigures;
import io.mrkuhne.mezo.feature.penz.service.news.DigestKind;
import io.mrkuhne.mezo.feature.penz.service.news.DigestPrompt;
import io.mrkuhne.mezo.feature.penz.service.news.DigestStory;
import io.mrkuhne.mezo.feature.penz.service.news.NewsArticle;
import io.mrkuhne.mezo.feature.penz.service.news.NewsHolding;
import io.mrkuhne.mezo.feature.penz.service.news.Story;
import io.mrkuhne.mezo.feature.penz.service.news.StoryKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The digest branch of the scripted fake (mezo-r36n9.104): its default answer is validator-clean for every story the
 * real prompt carries, so a later IT runs the whole pipeline end to end; the marker mirror matches the real one; the
 * digest call is payload-free in the audit log.
 */
class PenzDigestFakeLlmTest {

    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-0000000000f1");
    private static final NewsHolding HOLDING =
        new NewsHolding(ID, "Mintavilág ETF", "MNTW.DE", "EUR", "etf", "long", List.of());

    private static List<DigestStory> stories() {
        NewsArticle a = new NewsArticle("https://example.com/1", "Példa Hírek", "Kitalált cím", null,
            Instant.parse("2026-11-20T05:00:00Z"));
        NewsArticle b = new NewsArticle("https://example.com/2", "Minta Napló", "Kitalált forint cím", null,
            Instant.parse("2026-11-20T05:00:00Z"));
        return List.of(
            new DigestStory(new Story("holding-1111111111", StoryKey.holding(ID), List.of(a), 1), HOLDING.name(),
                new DigestFigures(DigestKind.HOLDING, "long", -1_840_000L, new BigDecimal("-1.1"), null), Map.of()),
            new DigestStory(new Story("fx-2222222222", StoryKey.fx(), List.of(b), 1), null,
                new DigestFigures(DigestKind.FX, null, 720_000L, new BigDecimal("0.6"), null), Map.of()));
    }

    @Test
    void testMarkerMirror_shouldEqualTheRealMarker() {
        assertThat(FakeCompanionLlm.PENZ_DIGEST_MARKER_MIRROR).isEqualTo(DigestPrompt.MARKER);
    }

    @Test
    void testDefaultAnswer_shouldNarrateEveryStoryCleanly() {
        FakeCompanionLlm fake = new FakeCompanionLlm();
        List<DigestStory> stories = stories();

        String raw = fake.complete(DigestPrompt.SYSTEM_PROMPT, DigestPrompt.userMessage(stories));
        List<PenzDigestItemJson> items = DigestAssembler.assembleWithReport(stories, List.of(HOLDING), raw).items();

        assertThat(fake.penzDigestCallCount()).isEqualTo(1);
        assertThat(items).extracting(PenzDigestItemJson::narratedBy).containsExactly("model", "model");
        assertThat(items.get(0).verdict()).contains("−18 400 Ft");
        assertThat(items.get(1).verdict()).contains("+7 200 Ft");
    }

    @Test
    void testScriptedAnswer_shouldBeReturnedVerbatim() {
        String json = "{\"items\":[]}";
        String sentinel = "[fake-penz-digest:" + Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8))
            + "]";

        assertThat(new FakeCompanionLlm().complete(DigestPrompt.SYSTEM_PROMPT, "x " + sentinel)).isEqualTo(json);
    }

    @Test
    void testAuditContext_shouldBePayloadFree() {
        assertThat(new LlmCallContext(PenzDigestLlm.LLM_FEATURE, PenzDigestLlm.LLM_OPERATION, null, null)
            .keepsPayload()).isFalse();
        assertThat(PenzDigestLlm.LLM_FEATURE).isEqualTo("penz_digest");
    }
}
