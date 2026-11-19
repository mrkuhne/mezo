package io.mrkuhne.mezo.feature.pantry.event;

import java.util.UUID;

/**
 * A food's NUMBERS changed on the shared definition (mezo-r36n9.63): energy, a macro, one of the four
 * nutrition-quality facts, or the basis they refer to. Published by {@code PantryService#updateItem}
 * only when one of those really changed — a rename, a price or a stock edit says nothing here.
 *
 * <p>It exists so the pantry never has to know who froze those numbers: recipes keep a snapshot per
 * ingredient line, and {@code feature/recipe} listens to refresh the EDITOR's own recipes (pantry must
 * not import recipe). Logged meals are history and nobody refreshes them.
 *
 * @param catalogId the definition that changed
 * @param userId    the user who changed it — only that user's recipes follow
 */
public record PantryFactsChangedEvent(UUID catalogId, UUID userId) {
}
