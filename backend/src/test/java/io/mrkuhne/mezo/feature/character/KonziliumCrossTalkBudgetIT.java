package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.character.service.CharacterCouncilBudget;
import io.mrkuhne.mezo.feature.character.service.CharacterCouncilEvidenceTools;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.KonziliumCrossTalkRound;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallQuota;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-o8tcu: the Szkeptikus call hit CHARACTER_COUNCIL_QUOTA_EXHAUSTED 17× in production because
 * cross-talk kept only 2 calls in reserve while its evidence reads (each one charged to the same
 * per-cycle cap) ate that reserve. After cross-talk, the verdict phase — skeptic + integrator,
 * each free to use every evidence read still left — must always fit in the cycle.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.character.council-budget.cycle-calls=14",
        "mezo.character.council-debate.max-calls=6",
        "mezo.character.council-debate.max-tool-calls=8"})
class KonziliumCrossTalkBudgetIT extends AbstractIntegrationTest {

    @Autowired private CharacterCouncilBudget budget;
    @Autowired private KonziliumCrossTalkRound crossTalkRound;
    @Autowired private CharacterCouncilEvidenceTools evidenceTools;
    @Autowired private LlmCallContextHolder calls;
    @Autowired private DatabasePopulator users;

    private static ClaimProposal proposal(String expert, String dimension, String text) {
        return new ClaimProposal(expert, "NEW", dimension, null, text, new BigDecimal("0.50"), false, "Indoklás.");
    }

    @Test
    void crossTalk_alwaysLeavesRoomForTheVerdictPhase_includingItsEvidenceReads() {
        UUID owner = users.populateUser("crosstalk-reserve@test.local");

        assertThatCode(() -> budget.run(owner, false, () -> {
            // observe + propose already spent, as in the nightly/daily cycle
            calls.runWith(new LlmCallContext("character", "observe", null, null), () -> "[]");
            calls.runWith(new LlmCallContext("character", "propose", null, null), () -> "[]");
            CharacterCouncilEvidenceTools.Session session = evidenceTools.open(owner);

            crossTalkRound.runForPeriod(owner, "Megfigyelési időszak: teszt", List.of(
                    proposal("szomnologus", "recovery", "Romlik az alvás."),
                    proposal("pszichologus", "recovery", "Feszült hét áll mögötted."),
                    proposal("taplalkozo", "nutrition", "Kevés a fehérje."),
                    proposal("doki", "nutrition", "Ingadozik a súly."),
                    proposal("drill", "discipline", "Kimarad a napló."),
                    proposal("antropologus", "discipline", "Hétvégén szétesik a rend.")), session);

            int remainingReads = 8 - session.audit().callCount();
            // skeptic + integrator, plus every evidence read they could still make
            for (int i = 0; i < 2 + remainingReads; i++) {
                LlmCallQuota.charge(false);
            }
            return null;
        })).doesNotThrowAnyException();
        assertThat(LlmCallQuota.capture()).isNull();
    }
}
