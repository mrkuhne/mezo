package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.TurnPlanner;
import java.util.List;
import org.junit.jupiter.api.Test;

class FakeCompanionLlmPlanTest {

    private final FakeCompanionLlm fake = new FakeCompanionLlm();

    @Test
    void testCompleteSmart_shouldReturnScriptedPlan_whenMessageCarriesTheSentinel() {
        String scripted = "{\"needsData\":true,\"steps\":[{\"tool\":\"get_pantry\",\"args\":{},\"why\":\"kamra\"}]}";

        String answer = fake.completeSmart(TurnPlanner.PROMPT_MARKER + " katalógus...", "",
            List.of(), "Mi van a kamrában? [fake-plan:" + scripted + "]");

        assertThat(answer).isEqualTo(scripted);
    }

    @Test
    void testCompleteSmart_shouldReturnNoDataPlan_whenNoSentinelIsScripted() {
        String answer = fake.completeSmart(TurnPlanner.PROMPT_MARKER + " katalógus...", "",
            List.of(), "Szia!");

        assertThat(answer).isEqualTo("{\"needsData\":false,\"steps\":[]}");
    }

    @Test
    void testCompleteSmart_shouldKeepTheGearEcho_whenThePromptIsNotAPlannerPrompt() {
        String answer = fake.completeSmart("HANG", "KONTEXTUS", List.of(), "Szia!");

        assertThat(answer).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }
}
