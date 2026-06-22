package io.mrkuhne.mezo.feature.pantry.entity;

/** A single micronutrient coverage fact, stored inside the {@code micros} jsonb array. */
public record MicroFact(String name, int pct) {}
