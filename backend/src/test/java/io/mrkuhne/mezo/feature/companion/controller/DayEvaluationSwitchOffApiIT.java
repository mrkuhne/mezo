package io.mrkuhne.mezo.feature.companion.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.DayEvaluationResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The day-review switch OFF state (configuration_conventions.md: both switch states tested;
 * the {@code SlotPlanEvaluateSwitchOffApiIT} shape). With
 * {@code mezo.feature.day-review.enabled=false} the {@code DayReviewLlmAdapter} bean does not
 * exist, so {@code DayReviewService}'s {@code ObjectProvider<DayReviewLlm>} is empty.
 *
 * <p><b>The contract this locks in (binding, constraints.md):</b> the LLM layer being off is NOT
 * an error. The endpoint still answers <b>200</b> with the full deterministic evaluation — all
 * six dimensions, their facts, the state — and an EMPTY narrative. No 503, no 5xx, no
 * half-answer. Prose is a bonus over numbers that are already complete.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.day-review.enabled=false")
class DayEvaluationSwitchOffApiIT extends ApiIntegrationTest {

    private static final LocalDate PAST_DAY = LocalDate.of(2026, 6, 15);

    @Test
    void testGetDayEvaluation_shouldServeDeterministicWithNoProse_whenDayReviewSwitchOff() {
        DayEvaluationResponse response = getForBody(
            "/api/me/day/" + PAST_DAY + "/evaluation", ownerAuthHeaders(), HttpStatus.OK,
            DayEvaluationResponse.class);

        assertThat(response.getDate()).isEqualTo(PAST_DAY);
        assertThat(response.getDimensions()).extracting("id")
            .containsExactly("nutrition", "quality", "training", "sleep", "logging", "rhythm");
        assertThat(response.getNarrative()).isEmpty();
        assertThat(response.getHighlights()).isEmpty();
        assertThat(response.getAdjustment()).isNull();
        // with no adjustment there is nothing to fold in: score and base are the same number
        assertThat(response.getScore()).isEqualTo(response.getBase());
    }
}
