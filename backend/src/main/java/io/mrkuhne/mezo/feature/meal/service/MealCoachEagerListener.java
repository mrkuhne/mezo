package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Eager meal coach (owner, 2026-09-26: "mindig kérjük le"): every saved meal gets its verdict —
 * summary, improve rows, dimension notes AND the „Legközelebb így lesz laposabb" glucose tips — in
 * ONE cheap-tier call right after commit, instead of lazily on the first score-sheet open. The
 * glucose box and the score sheet then open with the prose already there.
 *
 * <p>Async and after commit, so logging a meal never waits on (or fails because of) the LLM. The
 * coach's own contract still holds: any failure persists nothing and the next sheet open retries
 * lazily. {@link MealCoachService#generateForMeal} skips a meal that already has a verdict, so a
 * re-fire is harmless.
 *
 * <p>Separately switchable ({@code mezo.feature.meal-coach.eager}) — the test profile turns it off
 * so ITs that log meals do not race an async LLM write against their own assertions.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.MEAL_COACH_SWITCH, MealCoachEagerListener.EAGER_SWITCH},
    havingValue = "true")
public class MealCoachEagerListener {

    static final String EAGER_SWITCH = "mezo.feature.meal-coach.eager";

    private final MealCoachService coach;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMealSaved(MealSavedEvent event) {
        try {
            coach.generateForMeal(event.userId(), event.mealId());
        } catch (RuntimeException e) {
            // e.g. the meal was deleted in between (404) — the lazy path covers anything left over.
            log.debug("Eager meal coach skipped for {}: {}", event.mealId(), e.getMessage());
        }
    }
}
