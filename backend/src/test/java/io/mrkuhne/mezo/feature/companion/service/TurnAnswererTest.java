package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import java.util.List;
import org.junit.jupiter.api.Test;

class TurnAnswererTest {

    private static final List<ToolCallAudit.ToolOutcome> OUTCOMES = List.of(
        new ToolCallAudit.ToolOutcome("get_fuel_log", "{\"range\":\"day\"}", "2026-09-17: 1800 kcal"));

    private final RecordingLlm llm = new RecordingLlm();
    private final TurnAnswerer answerer = new TurnAnswerer(llm,
        CompanionPropertiesFixtures.withExecutor(4, 15_000L));

    /** Records the prompts; answers a constant. */
    private static final class RecordingLlm implements CompanionLlm {
        String lastSystem; String lastVolatile; String lastUser;
        @Override public String completeSmart(String s, String v, List<Turn> h, String u) {
            lastSystem = s; lastVolatile = v; lastUser = u; return "válasz";
        }
        @Override public String complete(String s, List<Turn> h, String u,
                List<org.springframework.ai.tool.ToolCallback> t, java.util.Map<String, Object> c) {
            throw new UnsupportedOperationException();
        }
        @Override public reactor.core.publisher.Flux<String> stream(String s, List<Turn> h, String u,
                List<org.springframework.ai.tool.ToolCallback> t, java.util.Map<String, Object> c) {
            throw new UnsupportedOperationException();
        }
        @Override public String complete(String s, String u, List<InlineImage> i) { throw new UnsupportedOperationException(); }
        @Override public String complete(String s, String u, InlineAudio a) { throw new UnsupportedOperationException(); }
    }

    @Test
    void testBuildVolatile_shouldCarryDigestAndOffer_whenAnalysisWithReplanAllowed() {
        String v = answerer.buildVolatile("\n\nMa: 2026-09-17\n", OUTCOMES, TurnGear.ANALYSIS, true);

        assertThat(v).contains("Ma: 2026-09-17");
        assertThat(v).contains(ToolOutcomeDigest.HEADER).contains("1800 kcal");
        assertThat(v).contains("[Adathiány]").contains(TurnAnswerer.DATA_GAP_MARKER);
    }

    @Test
    void testBuildVolatile_shouldOmitOffer_whenLookupGear() {
        String v = answerer.buildVolatile("ctx", OUTCOMES, TurnGear.LOOKUP, true);

        assertThat(v).doesNotContain("[Adathiány]");
    }

    @Test
    void testBuildVolatile_shouldRenderNoneDigest_whenNoOutcomes() {
        String v = answerer.buildVolatile("ctx", List.of(), TurnGear.LOOKUP, false);

        assertThat(v).contains(ToolOutcomeDigest.NONE);
    }

    @Test
    void testBuildReplanVolatile_shouldCarryPotlasAndNoOffer_whenLapTwo() {
        String v = answerer.buildReplanVolatile("ctx", OUTCOMES);

        assertThat(v).contains("[PÓTLÁS]").doesNotContain("[Adathiány]");
    }

    @Test
    void testDataGapReason_shouldParseMarker_whenAnswerIsMarkerOnly() {
        assertThat(TurnAnswerer.dataGapReason("  [TOVÁBBI-ADAT: alvásnapló kedd óta]  "))
            .contains("alvásnapló kedd óta");
        assertThat(TurnAnswerer.dataGapReason("Rendes válasz [TOVÁBBI-ADAT: x]")).isEmpty();
        assertThat(TurnAnswerer.dataGapReason(null)).isEmpty();
    }

    @Test
    void testAnswer_shouldDelegateToCompleteSmart_whenCalled() {
        String out = answerer.answer("HANG", "VOLATILIS", List.of(), "kérdés");

        assertThat(out).isEqualTo("válasz");
        assertThat(llm.lastSystem).isEqualTo("HANG");
        assertThat(llm.lastVolatile).isEqualTo("VOLATILIS");
    }
}
