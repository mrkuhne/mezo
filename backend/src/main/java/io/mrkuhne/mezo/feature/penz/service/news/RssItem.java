package io.mrkuhne.mezo.feature.penz.service.news;

import java.time.Instant;

/**
 * One parsed feed entry (mezo-r36n9.104): the title and summary as plain text (tags stripped, entities decoded,
 * whitespace collapsed), an http(s) link, the publication instant or null when the feed gave none or garbage.
 */
public record RssItem(String title, String link, String summary, Instant publishedAt) {
}
