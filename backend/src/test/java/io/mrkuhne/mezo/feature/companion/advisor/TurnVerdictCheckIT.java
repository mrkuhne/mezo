package io.mrkuhne.mezo.feature.companion.advisor;

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
        assertThat(verdictCheck.check("PROMPT", "kérdés", "tiszta válasz", List.of())).isEmpty();
    }

    @Test
    void testCheck_shouldReturnViolation_whenFakeScriptsRedundancy() {
        List<AdvisorViolation> violations =
                verdictCheck.check("PROMPT", "kérdés", "válasz [fake-violate]", List.of());
        assertThat(violations).extracting(AdvisorViolation::check).containsExactly("redundancy");
    }

    @Test
    void testCheck_shouldFailOpen_whenVerdictIsNotJson() {
        assertThat(verdictCheck.check("PROMPT", "kérdés", "válasz [fake-verdict-broken]", List.of())).isEmpty();
    }
}
