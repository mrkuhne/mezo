package io.mrkuhne.mezo.feature.mail.service.classify;

import java.util.UUID;

/** One validated relevance score: an asked item id, 1-10, and the one-line "why" in Hungarian. */
public record ScoredDeal(UUID itemId, int score, String why) {}
