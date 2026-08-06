package io.mrkuhne.mezo.feature.habit;

import io.mrkuhne.mezo.api.dto.HabitSuggestRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Switch-off state (house rule: both switch states tested; the {@code GamificationSwitchOffIT}
 * precedent): with {@code mezo.feature.habit-ai-suggest.enabled=false} the {@code
 * HabitSuggestLlmAdapter} bean does not exist regardless of {@code COMPANION_SWITCH}/{@code
 * HABIT_SWITCH}, so {@code HabitAiService}'s {@code ObjectProvider<HabitSuggestPort>} is empty and
 * the endpoint degrades to a clean 503 — never a 404, since the rest of {@code /api/habit} (day,
 * check, catalog, …) stays fully usable with only this sub-switch off.
 *
 * <p>Kept to this ONE assertion deliberately: {@code @TestPropertySource} forks its own cached
 * Spring context — a fresh, unseeded Testcontainers database when the suite runs in Testcontainers
 * mode (CI / {@code -Dmezo.test.use-testcontainers=true}) — so this class stays minimal to keep
 * that extra context cheap.
 */
@TestPropertySource(properties = "mezo.feature.habit-ai-suggest.enabled=false")
class HabitAiSuggestSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testSuggest_should503_whenHabitAiSuggestSwitchOff() {
        String err = postForBody("/api/habit/ai/suggest",
                HabitSuggestRequest.builder().build(),
                ownerAuthHeaders(), HttpStatus.SERVICE_UNAVAILABLE, String.class);
        assertHasRequestError(err, "HABIT_AI_UNAVAILABLE");
    }
}
