package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;

/**
 * One logged meal as the planner sees it. {@code at} is the LOCAL wall-clock time in the owner's
 * zone (what places it in a window); {@code loggedAt} is the instant (what orders the history).
 * {@code kcal} is nullable because a row may carry no energy and the plan never fabricates one.
 */
public record LoggedMeal(UUID id, String slot, String title, Integer kcal, Instant loggedAt, LocalTime at) {
}
