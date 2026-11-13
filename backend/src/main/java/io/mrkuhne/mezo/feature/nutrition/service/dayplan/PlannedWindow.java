package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

/**
 * One placed meal window before the day's log is folded in: its anchored time, the weight (or the
 * template's fixed percentage) that earns it a share of the budget, and the widened
 * {@code [fromMin, toMin]} range the client shows. All times are minutes since midnight in the
 * owner's zone.
 */
public record PlannedWindow(
        SlotKey slotKey,
        WindowKind kind,
        String label,
        int timeMin,
        double weight,
        /** Only a template row carries one; {@code null} on the default rhythm. */
        Integer budgetPct,
        /** Template recipe role ({@code pre_workout} / {@code post_workout}); {@code null} = standard. */
        String role,
        WindowRule rule,
        int fromMin,
        int toMin) {
}
