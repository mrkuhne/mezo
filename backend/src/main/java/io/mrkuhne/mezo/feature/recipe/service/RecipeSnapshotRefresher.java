package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.feature.pantry.event.PantryFactsChangedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Recipe's side of „a food's numbers changed" (mezo-r36n9.63). The pantry publishes
 * {@link PantryFactsChangedEvent} and knows nothing about recipes ({@code feature/pantry} must not
 * import {@code feature/recipe}); this listener refreshes the EDITOR's own recipe line snapshots once
 * the pantry edit has committed.
 *
 * <p>After commit on purpose: a refused or rolled-back pantry edit must not move a recipe. A failure
 * here is logged and swallowed — the pantry edit is already saved, and failing the owner's save over a
 * derived refresh would be the wrong trade; the lines catch up on the recipe's next save.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RecipeSnapshotRefresher {

    private final RecipeService recipeService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(PantryFactsChangedEvent e) {
        try {
            int lines = recipeService.refreshLinesOn(e.userId(), e.catalogId());
            if (lines > 0) {
                log.info("Refreshed {} recipe line snapshot(s) of user {} after a facts change on catalog {}",
                    lines, e.userId(), e.catalogId());
            }
        } catch (RuntimeException ex) {
            log.warn("Recipe snapshot refresh failed for user {} / catalog {}", e.userId(), e.catalogId(), ex);
        }
    }
}
