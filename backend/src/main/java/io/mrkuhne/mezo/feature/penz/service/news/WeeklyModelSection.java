package io.mrkuhne.mezo.feature.penz.service.news;

import java.util.List;

/**
 * One section of the model's weekly answer, as parsed (mezo-r36n9.120) — untrusted until
 * {@link WeeklyReviewValidator} passes it. {@code matters} is null when the model sent no boolean.
 */
public record WeeklyModelSection(String sleeve, Boolean matters, List<String> storyIds, String verdict, String body,
                                 String uncertainty, String noAction) {

    public WeeklyModelSection {
        storyIds = storyIds == null ? List.of() : List.copyOf(storyIds);
    }
}
