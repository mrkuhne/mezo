package io.mrkuhne.mezo.feature.penz.service.news;

import java.time.Instant;

/**
 * A stored article as the matcher and clusterer see it (mezo-r36n9.104) — a {@code penz_news_article} row: untrusted
 * text from the internet, only ever shown to the model inside a fence ({@link DigestPrompt}).
 */
public record NewsArticle(String url, String sourceName, String title, String summary, Instant publishedAt) {
}
