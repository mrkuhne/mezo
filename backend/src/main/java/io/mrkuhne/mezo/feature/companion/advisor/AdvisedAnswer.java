package io.mrkuhne.mezo.feature.companion.advisor;

/** The chain's outcome for one turn — the final answer text + whether it ships degraded (V1.3). */
public record AdvisedAnswer(String answer, boolean degraded) {}
