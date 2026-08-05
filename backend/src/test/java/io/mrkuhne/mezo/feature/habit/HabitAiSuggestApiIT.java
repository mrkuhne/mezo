package io.mrkuhne.mezo.feature.habit;

import io.mrkuhne.mezo.api.dto.HabitSuggestRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * AI habit suggester (mezo-n5e9.3) — 503 path only. The companion-side smart-model adapter
 * ({@code HabitSuggestLlmAdapter}) is Task 2's work and does not exist yet in this task, so
 * {@code HabitAiService}'s {@code ObjectProvider<HabitSuggestPort>} is empty regardless of any
 * switch state.
 *
 * <p>Run at the default IT profile, where {@code mezo.feature.habit.enabled},
 * {@code mezo.feature.habit-ai-suggest.enabled} and {@code mezo.feature.companion.enabled} are
 * ALL {@code true} (see {@code application.yml}) — the 503 below is honestly "no adapter bean
 * exists yet", never "a switch is off". Task 2 will add a companion-off 503 variant once the
 * adapter (gated on BOTH {@code HABIT_AI_SUGGEST_SWITCH} and {@code COMPANION_SWITCH},
 * array-AND'ed exactly like {@code SlotPlanLlmAdapter}) exists to turn off.
 */
class HabitAiSuggestApiIT extends ApiIntegrationTest {

    @Test
    void testSuggest_should503_whenAdapterAbsent() {
        String err = postForBody("/api/habit/ai/suggest",
                HabitSuggestRequest.builder().build(),
                ownerAuthHeaders(), HttpStatus.SERVICE_UNAVAILABLE, String.class);
        assertHasRequestError(err, "HABIT_AI_UNAVAILABLE");
    }
}
