package io.mrkuhne.mezo.feature.penz.service.news;

import java.util.List;

/**
 * One allow-listed feed (mezo-r36n9.104): {@code key} is the stable id stored in {@code penz_news_article.source_key}
 * and used as the provider key of its health row; {@code articleHosts} are the only hosts an article body of this
 * feed may be fetched from (a host matches itself and its subdomains).
 */
public record NewsSource(String key, String name, String url, List<String> articleHosts) {

    public NewsSource {
        articleHosts = List.copyOf(articleHosts);
    }
}
