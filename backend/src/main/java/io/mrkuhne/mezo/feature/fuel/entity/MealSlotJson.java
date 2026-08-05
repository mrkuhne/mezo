package io.mrkuhne.mezo.feature.fuel.entity;

/** One template slot, stored inside the {@code slots} jsonb array. Anchor is flattened:
 *  {@code anchorType=fixed} uses {@code time}, relative anchors use signed {@code offsetMin}. */
public record MealSlotJson(String label, String slotKind, String role,
                           String anchorType, String time, Integer offsetMin, Integer budgetPct) {}
