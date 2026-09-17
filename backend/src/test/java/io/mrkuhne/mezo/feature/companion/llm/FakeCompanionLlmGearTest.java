package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.GearClassifier;
import io.mrkuhne.mezo.feature.companion.service.TurnGear;
import java.util.List;
import org.junit.jupiter.api.Test;

class FakeCompanionLlmGearTest {

    private final FakeCompanionLlm fake = new FakeCompanionLlm();

    @Test
    void testComplete_shouldAnswerWithAGearWord_whenGivenTheClassifierPrompt() {
        String answer = fake.complete(GearClassifier.PROMPT, "Mennyit aludtam kedden?");

        assertThat(answer).isIn(TurnGear.CHAT.name(), TurnGear.LOOKUP.name(), TurnGear.ANALYSIS.name());
    }

    @Test
    void testCompleteSmart_shouldMarkTheToolFreeBranch_whenTheChatGearRuns() {
        String answer = fake.completeSmart("HANG", "KONTEXTUS", List.of(), "Szia!");

        assertThat(answer).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
        assertThat(answer).contains("Szia!");
    }
}
