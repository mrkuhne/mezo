package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.CompanionLlm.Role;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The verdict check against the scripted fake — violation mapping + the fail-open guarantee. */
@ActiveProfiles("companion-fake")
class TurnVerdictCheckIT extends AbstractIntegrationTest {

    @Autowired private TurnVerdictCheck verdictCheck;

    @Test
    void testCheck_shouldReturnNoViolations_whenAnswerIsClean() {
        assertThat(verdictCheck.check("PROMPT", List.of(), "kérdés", "tiszta válasz", List.of())).isEmpty();
    }

    @Test
    void testCheck_shouldReturnViolation_whenFakeScriptsRedundancy() {
        List<AdvisorViolation> violations =
                verdictCheck.check("PROMPT", List.of(), "kérdés", "válasz [fake-violate]", List.of());
        assertThat(violations).extracting(AdvisorViolation::check).containsExactly("redundancy");
    }

    @Test
    void testCheck_shouldFailOpen_whenVerdictIsNotJson() {
        assertThat(verdictCheck.check("PROMPT", List.of(), "kérdés", "válasz [fake-verdict-broken]", List.of()))
                .isEmpty();
    }

    @Test
    void testCheck_shouldRenderHistoryIntoJudgePayload_whenPriorTurnsExist() {
        // The sentinel lives ONLY inside a history Turn's content — it can reach the judge's
        // payload exclusively through ChatHistory.render(history) inside check(...). A violation
        // here proves the fake actually SAW the rendered history, not just the checked answer or
        // userMessage; if that render call is ever dropped (mezo-q71s regression), the sentinel
        // never reaches the payload and this assertion fails.
        List<Turn> history = List.of(new Turn(Role.USER, FakeCompanionLlm.HISTORY_SEEN_SENTINEL));

        List<AdvisorViolation> violations =
                verdictCheck.check("PROMPT", history, "kérdés", "tiszta válasz", List.of());

        assertThat(violations).extracting(AdvisorViolation::check).containsExactly("redundancy");
    }
}
