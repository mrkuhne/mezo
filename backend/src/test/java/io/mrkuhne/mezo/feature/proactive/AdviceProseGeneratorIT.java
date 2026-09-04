package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCandidate;
import io.mrkuhne.mezo.feature.proactive.service.AdviceProseGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S4 (bd mezo-d58h.4, spec §5): ONE CompanionLlm call over the facts, and a template fallback that
 * means the card is NEVER dropped — not on an exception, not on a blank answer, not on an
 * invented number.
 */
@ActiveProfiles("companion-fake")
class AdviceProseGeneratorIT extends AbstractIntegrationTest {

    private static final String FALLBACK = "Ma este told előre a villanyoltást fél órával.";

    @Autowired private AdviceProseGenerator adviceProseGenerator;
    @Autowired private UserPopulator userPopulator;

    private AdviceCandidate candidate(String fact) {
        return AdviceCandidate.fromFlag("sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel",
            List.of(fact), List.of(FALLBACK), FALLBACK);
    }

    @Test
    void testWrite_shouldReturnTheModelProse_whenTheCallSucceeds() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner, candidate("Alvásadósság: 1,6 óra/éjszaka"));

        assertThat(prose).isEqualTo(FakeCompanionLlm.ADVICE_DEFAULT_ANSWER);
    }

    /** The marker is duplicated as a LITERAL in FakeCompanionLlm (a companion→proactive import
     *  would be a new package cycle) — this pins the two halves together. */
    @Test
    void testMarkerMirror_shouldMatchTheRealConstant() {
        assertThat(FakeCompanionLlm.ADVICE_MARKER_MIRROR).isEqualTo(AdviceProseGenerator.ADVICE_MARKER);
    }

    @Test
    void testWrite_shouldFallBackToTheTemplate_whenTheCallThrows() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner, candidate(FakeCompanionLlm.FAIL_COMPLETE));

        assertThat(prose).isEqualTo(FALLBACK);
    }

    @Test
    void testWrite_shouldFallBackToTheTemplate_whenTheAnswerIsBlank() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner, candidate(FakeCompanionLlm.EMPTY_ANSWER));

        assertThat(prose).isEqualTo(FALLBACK);
    }

    /** The invent sentinel is DIGIT-FREE on purpose: the fake answers with a number that appears
     *  nowhere in the facts/suggestions, so ProseNumberGuard really sees an ungrounded numeral. A
     *  sentinel that carried the number itself would smuggle it into the grounding text and the
     *  guard would (correctly) accept the answer — the test would then prove nothing. */
    @Test
    void testWrite_shouldFallBackToTheTemplate_whenTheModelInventsANumber() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner,
            candidate(FakeCompanionLlm.ADVICE_INVENT_SENTINEL));

        assertThat(prose).isEqualTo(FALLBACK);
    }
}
