package io.mrkuhne.mezo.feature.quest.entity;

import java.math.BigDecimal;

/** Typed jsonb envelope for a quest's structured target (metric key + optional numeric threshold). */
public record QuestTargetEnvelope(String metric, BigDecimal threshold) {
}
