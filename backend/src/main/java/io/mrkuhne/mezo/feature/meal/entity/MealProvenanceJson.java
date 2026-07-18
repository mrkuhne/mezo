package io.mrkuhne.mezo.feature.meal.entity;

import java.math.BigDecimal;

/**
 * Typed payload of meal.provenance (jsonb) — ADR 0006 typed-envelope idiom.
 * origin: manual | ai-text | ai-photo. NULL column = manual/legacy row (no backfill).
 */
public record MealProvenanceJson(String origin, String model, BigDecimal confidence, String rawText) {
}
