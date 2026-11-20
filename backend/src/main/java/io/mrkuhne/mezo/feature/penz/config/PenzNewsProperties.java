package io.mrkuhne.mezo.feature.penz.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Boop Pénz L6 news-digest tunables (mezo-r36n9.104, build notes §3).
 *
 * @param enabled                the poll switch ({@code FeaturesConfiguration.PENZ_NEWS_SWITCH}); true in production,
 *                               false in the test profile.
 * @param cron                   when the poll runs (06:30 and 13:30).
 * @param zone                   the cron's zone.
 * @param feedBaseUrlOverride    TEST ONLY: when set, every feed (and Google News) url keeps its path + query but
 *                               goes to this base (a WireMock). Blank in production.
 * @param maxFeedBytes           body cap of one feed fetch (2 MB).
 * @param maxArticleBytes        body cap of one article page fetch (2 MB).
 * @param bodiesPerStory         article pages fetched per story at most.
 * @param maxSearchTerms         Google News searches per poll at most (one per distinct holding term).
 * @param retentionDays          articles older than this are pruned.
 * @param refreshCooldownMinutes one manual refresh per user per this many minutes; the next answers 429.
 * @param executorQueue          queued poll / refresh runs beyond the one running; more are dropped (logged).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.penz.news")
public record PenzNewsProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("0 30 6,13 * * *") @NotBlank String cron,
        @DefaultValue("Europe/Budapest") @NotBlank String zone,
        @DefaultValue("") String feedBaseUrlOverride,
        @DefaultValue("2097152") @Min(1024) @Max(20_971_520) long maxFeedBytes,
        @DefaultValue("2097152") @Min(1024) @Max(20_971_520) long maxArticleBytes,
        @DefaultValue("2") @Min(0) @Max(6) int bodiesPerStory,
        @DefaultValue("40") @Min(0) @Max(200) int maxSearchTerms,
        @DefaultValue("30") @Min(1) @Max(365) int retentionDays,
        @DefaultValue("15") @Min(0) @Max(1_440) int refreshCooldownMinutes,
        @DefaultValue("4") @Min(1) @Max(100) int executorQueue) {
}
