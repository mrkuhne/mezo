package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ToolOutcomeDigest;
import io.mrkuhne.mezo.feature.companion.service.TurnAnswerer;
import java.util.List;
import org.junit.jupiter.api.Test;

class FakeCompanionLlmAnswerTest {

    private final FakeCompanionLlm fake = new FakeCompanionLlm();
    private static final String OUTCOMES_CTX = "\n\nMa: 2026-09-17\n\nESZKÖZHÍVÁSOK ÉS A KIMENETÜK:\n- get_pantry {} -> Kamra: nincs adat\n";
    private static final String OUTCOMES_WITH_OFFER = OUTCOMES_CTX + "\n[Adathiány] Ha a fenti eszköz-eredmények nem elegendők…\n";

    /**
     * Minor finding 5 — compile-time literal pins. {@code FakeCompanionLlm}'s
     * {@code ANSWERER_DIGEST_PREFIX} ("ESZKÖZHÍVÁSOK") is private, so it cannot be referenced
     * directly here; instead this pins the two PUBLIC {@link ToolOutcomeDigest} constants the fake
     * mirrors it against — {@code NONE} and {@code HEADER} both start with the same literal the
     * fake keys its answerer-branch dispatch on. If either digest constant is ever reworded without
     * updating the fake's private mirror, this fails loudly instead of the drift going unnoticed.
     */
    @Test
    void testAnswererDigestPrefix_shouldBeAPrefixOfBothToolOutcomeDigestConstants() {
        String prefix = "ESZKÖZHÍVÁSOK";

        assertThat(ToolOutcomeDigest.NONE).startsWith(prefix);
        assertThat(ToolOutcomeDigest.HEADER).startsWith(prefix);
    }

    @Test
    void testCompleteSmart_shouldEchoWithAnswerSentinel_whenVolatileHalfCarriesOutcomes() {
        String answer = fake.completeSmart("HANG", OUTCOMES_CTX, List.of(), "Mit ettem ma?");

        assertThat(answer).startsWith(FakeCompanionLlm.ANSWER_SENTINEL + " " + FakeCompanionLlm.PREFIX);
        assertThat(answer).contains("ESZKÖZHÍVÁSOK").contains("user=[Mit ettem ma?]");
        assertThat(answer).doesNotContain(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }

    @Test
    void testCompleteSmart_shouldReturnDataGapMarker_whenScriptedAndOfferPresent() {
        String answer = fake.completeSmart("HANG", OUTCOMES_WITH_OFFER, List.of(),
            "Miért fáradt vagyok mostanában? [fake-datagap:alvásnapló]");

        assertThat(answer).isEqualTo("[TOVÁBBI-ADAT: alvásnapló]");
        // Minor finding 5: the fake's scripted data-gap reply must itself start with the real
        // TurnAnswerer.DATA_GAP_MARKER literal, not a hand-copied string that could drift from it.
        assertThat(answer).startsWith(TurnAnswerer.DATA_GAP_MARKER);
    }

    @Test
    void testCompleteSmart_shouldAnswer_whenScriptedButNoOffer() {
        // LOOKUP lap (never offered) and ANALYSIS lap 2 ([PÓTLÁS] instead of the offer) both
        // look like this: outcomes present, no [Adathiány] block -> the sentinel is inert.
        String answer = fake.completeSmart("HANG", OUTCOMES_CTX + "\n[PÓTLÁS] a kért adatok fent vannak\n",
            List.of(), "Miért fáradt vagyok mostanában? [fake-datagap:alvásnapló]");

        assertThat(answer).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
    }

    @Test
    void testCompleteSmart_shouldKeepChatGearEcho_whenNoOutcomesBlock() {
        String answer = fake.completeSmart("HANG", "\n\nMa: 2026-09-17\n", List.of(), "Szia!");

        assertThat(answer).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }
}
