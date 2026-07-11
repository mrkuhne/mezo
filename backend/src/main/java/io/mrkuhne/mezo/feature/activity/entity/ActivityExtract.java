package io.mrkuhne.mezo.feature.activity.entity;

/** Typed jsonb envelope of AI-extracted structured facts (spec §5: duration, HUF amount). */
public record ActivityExtract(Integer durationMin, Long amountHuf) {
}
