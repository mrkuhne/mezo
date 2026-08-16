package io.mrkuhne.mezo.feature.companion.advisor;

/** One advisor rejection — {@code check} ∈ {@code clinical | redundancy | unmarked} (V1.3, mezo-q71s). */
public record AdvisorViolation(String check, String reason) {}
