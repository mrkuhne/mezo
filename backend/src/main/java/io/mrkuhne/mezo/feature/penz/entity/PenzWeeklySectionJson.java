package io.mrkuhne.mezo.feature.penz.entity;

import java.time.Instant;
import java.util.List;

/**
 * One stored section of the weekly long-horizon review — an element of {@code penz_weekly_review.sections} (jsonb),
 * shaped 1:1 like the contract's {@code PenzWeeklySection} (mezo-r36n9.120): {@code sleeve} short|mid|long,
 * {@code horizonLabel} fixed copy, the counts and {@code coverageMonths} computed by the backend, the four prose
 * fields validated model text or fixed copy, {@code narratedBy} model|fallback|quiet, {@code stories} the week's
 * stories of this sleeve as the daily digests stored them (title, ledger name, sources) — capped for display.
 */
public record PenzWeeklySectionJson(String sleeve, String horizonLabel, int storyCount, int sourceCount,
                                    boolean matters, String verdict, String body, String uncertainty, String noAction,
                                    String narratedBy, Integer coverageMonths, List<Story> stories) {

    public static final String NARRATED_BY_MODEL = "model";
    public static final String NARRATED_BY_FALLBACK = "fallback";
    public static final String NARRATED_BY_QUIET = "quiet";

    public PenzWeeklySectionJson {
        stories = stories == null ? List.of() : List.copyOf(stories);
    }

    /** One story of the section — {@code PenzWeeklyStory}. */
    public record Story(String id, String title, String holdingName, String kind, List<Source> sources,
                        Instant publishedAt) {

        public Story {
            sources = sources == null ? List.of() : List.copyOf(sources);
        }
    }

    /** One source of a story — {@code PenzWeeklySource}. */
    public record Source(String name, String url) {
    }
}
