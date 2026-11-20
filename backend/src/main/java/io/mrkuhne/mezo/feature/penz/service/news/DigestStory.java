package io.mrkuhne.mezo.feature.penz.service.news;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * One story ready to narrate (mezo-r36n9.104): the grouped articles, the holding's name <b>from his ledger</b> (null
 * for a macro story), the backend-computed figures, the fetched article bodies by url (≤ 2 per story, plain text from
 * {@link ArticleText}; missing when the fetch failed or was not allowed), and the article urls that may be stored as
 * openable source links ({@code linkableUrls}, decided by the caller per feed — security review #7). With the 4-arg
 * constructor ({@code linkableUrls} null) an https url on any known feed's article host or Google News is linkable.
 */
public record DigestStory(Story story, String holdingName, DigestFigures figures, Map<String, String> bodiesByUrl,
                          Set<String> linkableUrls) {

    public DigestStory {
        bodiesByUrl = bodiesByUrl == null ? Map.of() : Map.copyOf(bodiesByUrl);
        linkableUrls = linkableUrls == null ? null : Set.copyOf(linkableUrls);
    }

    public DigestStory(Story story, String holdingName, DigestFigures figures, Map<String, String> bodiesByUrl) {
        this(story, holdingName, figures, bodiesByUrl, null);
    }

    public String id() {
        return story.id();
    }

    public DigestKind kind() {
        return story.key().kind();
    }

    public boolean hasBody() {
        return story.articles().stream().anyMatch(a -> bodiesByUrl.containsKey(a.url()));
    }

    /** True when {@code url} may be stored as a source link: the caller's decision, else https on a known host. */
    public boolean linkable(String url) {
        if (linkableUrls != null) {
            return linkableUrls.contains(url);
        }
        return url != null && url.startsWith("https://") && NewsSources.isAllowedArticleUrl(url, KNOWN_HOSTS);
    }

    private static final List<String> KNOWN_HOSTS = java.util.stream.Stream.concat(
            NewsSources.SEED.stream().flatMap(s -> s.articleHosts().stream()),
            java.util.stream.Stream.of(NewsSources.GOOGLE_NEWS_HOST))
        .distinct().toList();
}
