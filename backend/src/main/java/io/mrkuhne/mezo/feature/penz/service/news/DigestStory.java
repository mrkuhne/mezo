package io.mrkuhne.mezo.feature.penz.service.news;

import java.util.Map;

/**
 * One story ready to narrate (mezo-r36n9.104): the grouped articles, the holding's name <b>from his ledger</b> (null
 * for a macro story), the backend-computed figures, and the fetched article bodies by url (≤ 2 per story, plain text
 * from {@link ArticleText}; missing when the fetch failed or was not allowed).
 */
public record DigestStory(Story story, String holdingName, DigestFigures figures, Map<String, String> bodiesByUrl) {

    public DigestStory {
        bodiesByUrl = bodiesByUrl == null ? Map.of() : Map.copyOf(bodiesByUrl);
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
}
