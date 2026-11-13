package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

/**
 * One row of a saved {@code meal_slot_template} as the placer reads it — the flattened anchor
 * ({@code fixed} uses {@code time}, the relative ones a signed {@code offsetMin}) plus the row's
 * fixed budget share. The Java twin of the web planner's {@code SlotTemplateRow}.
 */
public record TemplateRow(
        String label,
        SlotKey slotKind,
        /** {@code standard} | {@code pre_workout} | {@code post_workout}; null means standard. */
        String role,
        /** {@code fixed} | {@code wake} | {@code bed} | {@code training_start} | {@code training_end}. */
        String anchorType,
        String time,
        Integer offsetMin,
        int budgetPct) {
}
