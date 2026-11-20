package io.mrkuhne.mezo.feature.penz.service.news;

import java.time.Instant;
import java.util.List;

/**
 * One grouped event (mezo-r36n9.104): a stable {@code id} (the digest item id and the story id the model answers
 * with), its key, the articles newest first (at most {@link StoryClusterer#MAX_SOURCES}), and how many distinct
 * articles the cluster had before that cap.
 */
public record Story(String id, StoryKey key, List<NewsArticle> articles, int clusterSize) {

    public Story {
        articles = List.copyOf(articles);
    }

    /** The newest article's publication instant (articles are sorted newest first). */
    public Instant newest() {
        return articles.isEmpty() ? null : articles.get(0).publishedAt();
    }
}
