package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
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
 * invented number, and since mezo-m4m0 not on formal address either.
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

    /** mezo-m4m0: the register rule must be IN the prompt, and it must sit in the instruction
     *  body — the marker PREFIX is what {@code FakeCompanionLlm} dispatches on, so a rule
     *  prepended in front of it would unhook every fake-backed advice test at once (and, in
     *  production, every {@code proactive_advice} LLM log row's prompt identity). */
    @Test
    void testPrompt_shouldCarryTheInformalRegisterRule_behindAnUnchangedMarkerPrefix() {
        assertThat(AdviceProseGenerator.ADVICE_PROMPT)
            .startsWith(AdviceProseGenerator.ADVICE_MARKER + "\n")
            .contains(PromptPersona.VOICE_HU);
    }

    /** The 2026-09-08 production shape (mezo-m4m0): formal address, in a card sitting directly
     *  above its own informal template sentence. The template is always hand-written informal,
     *  so falling back to it downgrades the wording and keeps the card. */
    @Test
    void testWrite_shouldFallBackToTheTemplate_whenTheModelUsesFormalAddress() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner, candidate(
            "[fake-advice:Önnél jelentős alváshiány halmozódott fel, ezért ma feküdjön le korábban.]"));

        assertThat(prose).isEqualTo(FALLBACK);
    }

    /** The polite pronoun is conventionally capitalised, but nothing forces a model to obey the
     *  convention — a lowercase „önnek" is exactly as formal, so the suffixed forms are matched
     *  case-insensitively. */
    @Test
    void testWrite_shouldFallBackToTheTemplate_whenTheFormalPronounIsLowercase() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner, candidate(
            "[fake-advice:Ha önnek nehéz az elalvás, tolja előre a villanyoltást.]"));

        assertThat(prose).isEqualTo(FALLBACK);
    }

    @Test
    void testWrite_shouldKeepTheProse_whenItAddressesTheUserInformally() {
        UUID owner = userPopulator.createUser().getId();
        String informal = "Az elmúlt éjszakák rövidebbek voltak a szokásosnál, "
            + "ezért ma este told előre a villanyoltást.";

        String prose = adviceProseGenerator.write(owner, candidate("[fake-advice:" + informal + "]"));

        assertThat(prose).isEqualTo(informal);
    }

    /**
     * The false positives the guard MUST NOT trip on. „ön" is a productive Hungarian prefix and
     * also hides inside unrelated stems, so a naive {@code contains("ön")} — or a {@code \b}-based
     * regex, since Java's {@code \b} is ASCII-only and finds a boundary in the middle of
     * „köszönöm" — would downgrade perfectly good informal prose to the template. Also covered:
     * „önként" (= voluntarily, NOT a pronoun form) and the lowercase verb „önt" (= pours), which
     * is why the guard requires the capital on the bare pronoun.
     */
    @Test
    void testWrite_shouldKeepTheProse_whenAWordMerelyContainsTheFormalMarker() {
        UUID owner = userPopulator.createUser().getId();
        List<String> innocents = List.of(
            "Köszönöm, hogy megosztottad — külön figyelj ma a lefekvésre.",
            "Az önbizalmad nő, ha önmagad ellen nem fordulsz.",
            "Ösztönözd magad egy korábbi villanyoltással, az önismeret itt segít.",
            "Önként vállaltad, ne érezd tehernek.",
            "A kancsóból önt magának egy pohár vizet a család, csatlakozz te is.",
            "Vajon holnap könnyebb lesz? Hagyd, hogy a tested pihenjen és aludjon eleget.");

        for (String innocent : innocents) {
            assertThat(adviceProseGenerator.write(owner, candidate("[fake-advice:" + innocent + "]")))
                .as("must not be downgraded to the template: %s", innocent)
                .isEqualTo(innocent);
        }
    }
}
