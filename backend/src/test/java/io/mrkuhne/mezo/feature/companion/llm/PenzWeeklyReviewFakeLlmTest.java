package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzWeeklySectionJson;
import io.mrkuhne.mezo.feature.penz.service.PenzWeeklyReviewLlm;
import io.mrkuhne.mezo.feature.penz.service.news.NewsHolding;
import io.mrkuhne.mezo.feature.penz.service.news.WeeklyReviewAssembler;
import io.mrkuhne.mezo.feature.penz.service.news.WeeklyReviewPrompt;
import io.mrkuhne.mezo.feature.penz.service.news.WeeklyReviewSectioner;
import io.mrkuhne.mezo.feature.penz.service.news.WeeklySection;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The weekly review branch of the scripted fake (mezo-r36n9.120): its default answer is validator-clean for every
 * section the real prompt carries; the marker mirror matches the real one; the call is payload-free in the audit log.
 */
class PenzWeeklyReviewFakeLlmTest {

    private static final UUID LONG_ID = UUID.fromString("00000000-0000-0000-0000-0000000000f1");
    private static final UUID MID_ID = UUID.fromString("00000000-0000-0000-0000-0000000000f2");
    private static final List<NewsHolding> HOLDINGS = List.of(
        new NewsHolding(LONG_ID, "Mintavilág ETF", "MNTW.DE", "EUR", "etf", "long", List.of()),
        new NewsHolding(MID_ID, "Példabank Nyrt", "PLDB.BD", "HUF", "stock", "mid", List.of()));

    private static PenzDigestItemJson item(String id, UUID holding, String name, String sleeve) {
        return new PenzDigestItemJson(id, "holding", holding, name, sleeve, name + ": friss hír", 0L, "a te részeden",
            null, 1, "v", "b", "u", "n", Instant.parse("2026-11-10T05:00:00Z"),
            List.of(new PenzDigestItemJson.Source("Példa Hírek", "Kitalált cím", "https://example.com/1", null)),
            PenzDigestItemJson.NARRATED_BY_MODEL);
    }

    @Test
    void testMarkerMirror_shouldEqualTheRealMarker() {
        assertThat(FakeCompanionLlm.PENZ_WEEKLY_MARKER_MIRROR).isEqualTo(WeeklyReviewPrompt.MARKER);
    }

    @Test
    void testDefaultAnswer_shouldNarrateEverySectionWithStoriesCleanly() {
        FakeCompanionLlm fake = new FakeCompanionLlm();
        List<WeeklySection> sections = WeeklyReviewSectioner.sections(List.of(
            item("holding-1111111111", LONG_ID, "Mintavilág ETF", "long"),
            item("holding-2222222222", MID_ID, "Példabank Nyrt", "mid")), HOLDINGS, 12);

        String raw = fake.complete(WeeklyReviewPrompt.SYSTEM_PROMPT, WeeklyReviewPrompt.userMessage(sections));
        WeeklyReviewAssembler.Assembly a = WeeklyReviewAssembler.assemble(sections, HOLDINGS, raw);

        assertThat(fake.penzWeeklyCallCount()).isEqualTo(1);
        assertThat(a.rejected()).isEmpty();
        assertThat(a.sections()).extracting(PenzWeeklySectionJson::narratedBy).containsExactly("quiet", "model",
            "model");
        assertThat(a.sections().get(2).matters()).isTrue();
        assertThat(a.sections().get(2).coverageMonths()).isEqualTo(12);
    }

    @Test
    void testScriptedAnswer_shouldBeReturnedVerbatim() {
        String json = "{\"sections\":[]}";
        String sentinel = "[fake-penz-weekly:" + Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8))
            + "]";

        assertThat(new FakeCompanionLlm().complete(WeeklyReviewPrompt.SYSTEM_PROMPT, "x " + sentinel)).isEqualTo(json);
    }

    @Test
    void testAuditContext_shouldBePayloadFree() {
        assertThat(new LlmCallContext(PenzWeeklyReviewLlm.LLM_FEATURE, PenzWeeklyReviewLlm.LLM_OPERATION, null, null)
            .keepsPayload()).isFalse();
        assertThat(PenzWeeklyReviewLlm.LLM_FEATURE).isEqualTo("penz_weekly");
    }
}
