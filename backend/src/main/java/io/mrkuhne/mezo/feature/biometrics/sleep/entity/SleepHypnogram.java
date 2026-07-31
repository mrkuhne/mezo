package io.mrkuhne.mezo.feature.biometrics.sleep.entity;

/**
 * Typed jsonb envelope for a quantised sleep-stage sequence (mezo-fk9a): one letter per
 * {@code bucketMin} minutes from the row's bedtime — D=deep, L=light, R=REM, A=awake.
 * DISPLAY-ONLY provenance (ADR 0015): never the source of a phase ratio. Named
 * SleepHypnogram so it never collides with the generated API model {@code api.dto.Hypnogram}.
 */
public record SleepHypnogram(Integer bucketMin, String stages) {
}
