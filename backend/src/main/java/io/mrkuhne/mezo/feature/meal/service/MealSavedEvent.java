package io.mrkuhne.mezo.feature.meal.service;

import java.util.UUID;

/**
 * A meal was created or edited and freshly scored (owner, 2026-09-26). The score envelope's prose
 * sockets are empty at this point — {@link MealCoachEagerListener} fills them after commit, so the
 * verdict and the glucose tips are ready before the user opens the meal.
 */
public record MealSavedEvent(UUID userId, UUID mealId) {
}
