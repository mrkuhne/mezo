package io.mrkuhne.mezo.feature.companion.advisor;

/** One advisor rejection — {@code check} ∈ {@code clinical | redundancy | grounding} (V1.3). */
public record AdvisorViolation(String check, String reason) {}
