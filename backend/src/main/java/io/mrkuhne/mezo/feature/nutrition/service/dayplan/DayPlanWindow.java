package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * One window of the finished day plan: when it is open, what fits in it, where it stands and what
 * Boop offers for it. Times are local wall-clock in the owner's zone.
 *
 * <p>{@code budget} is {@code null} on a kímélő (GUIDANCE) day — "not judged", not zero.
 * {@code suggestion} is present only on an OPEN window: a done window has already been answered
 * and a skipped one is nobody's business to re-open.
 */
public record DayPlanWindow(
        SlotKey slot,
        WindowKind kind,
        String label,
        LocalTime from,
        LocalTime to,
        Macros4 budget,
        WindowState state,
        List<UUID> loggedMealIds,
        Suggestion suggestion) {
}
