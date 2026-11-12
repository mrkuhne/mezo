package io.mrkuhne.mezo.feature.dayclose.service;

/**
 * Port for Boop's one-liners after a close or a check-in (B3, mezo-r36n9.13) — the {@code DayReviewLlm}
 * shape. Implemented in {@code feature/companion} on the cheap chat tier; with the companion off there is no
 * bean and the line endpoints answer 503. Lives here so dayclose never imports companion (companion may read
 * dayclose later; spec §7.4).
 */
public interface DayCloseLlm {

    String complete(String systemPrompt, String userMessage);
}
