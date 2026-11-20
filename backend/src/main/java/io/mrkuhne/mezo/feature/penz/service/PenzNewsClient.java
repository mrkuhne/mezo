package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.config.PenzNewsProperties;
import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzHoldingRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzNewsArticleRepository;
import io.mrkuhne.mezo.feature.penz.service.net.PenzHttpFetcher;
import io.mrkuhne.mezo.feature.penz.service.net.PenzHttpFetcher.FetchResult;
import io.mrkuhne.mezo.feature.penz.service.news.ArticleText;
import io.mrkuhne.mezo.feature.penz.service.news.NewsArticle;
import io.mrkuhne.mezo.feature.penz.service.news.NewsHolding;
import io.mrkuhne.mezo.feature.penz.service.news.NewsMatcher;
import io.mrkuhne.mezo.feature.penz.service.news.NewsSource;
import io.mrkuhne.mezo.feature.penz.service.news.NewsSources;
import io.mrkuhne.mezo.feature.penz.service.news.RssItem;
import io.mrkuhne.mezo.feature.penz.service.news.RssParser;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * The news side of the twice-daily poll (Boop Pénz L6, mezo-r36n9.104, build notes §3.1 / §3.5). Every request goes
 * through the SSRF-guarded {@link PenzHttpFetcher} with its own host allow-list; nothing here ever follows a redirect.
 *
 * <ul>
 *   <li>{@link #poll}: the eight seed feeds + one Google News search per distinct holding term of all users' live
 *       holdings (de-duplicated, capped), parsed with {@link RssParser}, upserted by url, then the store is pruned.
 *       Health: one provider row per seed feed ({@code rss:<key>}) and ONE row for all Google searches
 *       ({@code rss:google-news}: a success when any search answered) — so {@code PenzNewsProviderDown}
 *       ({@code min(fail_streak{kind="news"}) >= 3}) means every news source is failing, and a removed holding term
 *       never leaves a stale row behind.</li>
 *   <li>{@link #bodies}: at most {@code bodiesPerStory} article pages per story, only from that feed's allowed article
 *       hosts, HTML → text ({@link ArticleText#body}). Google News links are redirects (never followed), so they are
 *       not fetched at all.</li>
 * </ul>
 * Logs carry hosts and counts only, never article text.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PenzNewsClient {

    public static final String GOOGLE_PROVIDER_KEY = "rss:google-news";
    static final String FEED_ACCEPT = "application/rss+xml, application/atom+xml, application/xml, text/xml";
    static final String PAGE_ACCEPT = "text/html,application/xhtml+xml";
    private static final int SOURCE_NAME_MAX = 80;

    private final PenzHttpFetcher fetcher;
    private final PenzNewsArticleRepository articles;
    private final PenzHoldingRepository holdings;
    private final PenzProviderHealth health;
    private final PenzNewsProperties newsProps;
    private final PenzProperties penzProps;

    /** How one poll went. */
    public record PollResult(int feedsOk, int feedsFailed, int inserted, int pruned) {
    }

    /** Fetches every feed, stores the new articles, prunes the old ones, records each provider's health. */
    public PollResult poll(Instant now) {
        int ok = 0;
        int failed = 0;
        int inserted = 0;
        for (NewsSource source : NewsSources.SEED) {
            Optional<List<RssItem>> items = fetchFeed(source);
            if (items.isPresent()) {
                ok++;
                inserted += store(source, items.get(), now);
                health.recordSuccess(providerKey(source), PenzProviderHealth.KIND_NEWS);
            } else {
                failed++;
            }
        }
        List<String> terms = searchTerms();
        if (!terms.isEmpty()) {
            boolean anyOk = false;
            for (String term : terms) {
                NewsSource search = NewsSources.googleNewsSearch(term);
                Optional<List<RssItem>> items = fetchFeed(search);
                if (items.isPresent()) {
                    anyOk = true;
                    inserted += store(search, items.get(), now);
                }
            }
            if (anyOk) {
                ok++;
                health.recordSuccess(GOOGLE_PROVIDER_KEY, PenzProviderHealth.KIND_NEWS);
            } else {
                failed++;
                health.recordFailure(GOOGLE_PROVIDER_KEY, PenzProviderHealth.KIND_NEWS, "every search failed");
            }
        }
        int pruned = articles.deleteOlderThan(now.minus(Duration.ofDays(newsProps.retentionDays())));
        log.info("Penz news poll: {} source(s) ok, {} failed, {} new article(s), {} pruned", ok, failed, inserted,
            pruned);
        return new PollResult(ok, failed, inserted, pruned);
    }

    /** The provider key of a seed feed. */
    public static String providerKey(NewsSource source) {
        return "rss:" + source.key();
    }

    /**
     * The article bodies of {@code stories}' articles, by url: per story at most {@code bodiesPerStory} pages, only
     * from the article hosts of the feed the article came from ({@code sourceKeyByUrl}).
     */
    public Map<String, String> bodies(List<List<NewsArticle>> stories, Map<String, String> sourceKeyByUrl) {
        Map<String, String> out = new LinkedHashMap<>();
        for (List<NewsArticle> story : stories) {
            int tried = 0;
            for (NewsArticle a : story) {
                if (tried >= newsProps.bodiesPerStory()) {
                    break;
                }
                List<String> hosts = articleHosts(sourceKeyByUrl.get(a.url()));
                if (hosts.isEmpty() || !allowedArticle(a.url(), hosts)) {
                    continue;
                }
                tried++;
                if (out.containsKey(a.url())) {
                    continue;
                }
                FetchResult page = fetcher.fetch(URI.create(a.url()), Set.copyOf(hosts), newsProps.maxArticleBytes(),
                    PAGE_ACCEPT);
                if (page.ok()) {
                    ArticleText.body(page.body()).ifPresent(text -> out.put(a.url(), text));
                }
            }
        }
        return out;
    }

    /** The seed feed's article hosts; none for a Google News search or an unknown key. */
    static List<String> articleHosts(String sourceKey) {
        if (sourceKey == null || sourceKey.startsWith("gnews-")) {
            return List.of();
        }
        return NewsSources.seed(sourceKey).map(NewsSource::articleHosts).orElse(List.of());
    }

    private boolean allowedArticle(String url, List<String> hosts) {
        if (NewsSources.isAllowedArticleUrl(url, hosts)) {
            return true;
        }
        // the IT WireMock serves the article pages on loopback; the switch is false outside tests
        return penzProps.allowLoopbackForTests() && isLoopback(url);
    }

    private static boolean isLoopback(String url) {
        try {
            String host = URI.create(url).getHost();
            return "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private Optional<List<RssItem>> fetchFeed(NewsSource source) {
        URI uri;
        try {
            uri = URI.create(effectiveUrl(source.url()));
        } catch (IllegalArgumentException e) {
            recordFeedFailure(source, "bad url");
            return Optional.empty();
        }
        String feedHost = URI.create(source.url()).getHost().toLowerCase(Locale.ROOT);
        FetchResult result = fetcher.fetch(uri, Set.of(feedHost), newsProps.maxFeedBytes(), FEED_ACCEPT);
        if (!result.ok()) {
            log.warn("Penz news feed {} failed: {}", source.key(), result.failure());
            recordFeedFailure(source, result.failure());
            return Optional.empty();
        }
        return Optional.of(RssParser.parse(result.body()));
    }

    private void recordFeedFailure(NewsSource source, String reason) {
        if (!source.key().startsWith("gnews-")) {
            health.recordFailure(providerKey(source), PenzProviderHealth.KIND_NEWS, reason);
        }
    }

    /** The feed url, or — in an IT only — the same path + query on the override base. */
    String effectiveUrl(String url) {
        String base = newsProps.feedBaseUrlOverride();
        if (base == null || base.isBlank()) {
            return url;
        }
        URI original = URI.create(url);
        String b = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
        return b + original.getRawPath() + (original.getRawQuery() == null ? "" : "?" + original.getRawQuery());
    }

    private int store(NewsSource source, List<RssItem> items, Instant now) {
        String name = source.name().length() > SOURCE_NAME_MAX ? source.name().substring(0, SOURCE_NAME_MAX)
            : source.name();
        int inserted = 0;
        for (RssItem item : items) {
            inserted += articles.insertIfAbsent(item.link(), source.key(), name, item.title(), item.summary(),
                item.publishedAt(), now);
        }
        return inserted;
    }

    /** The distinct match terms of every live holding of anyone, capped. */
    List<String> searchTerms() {
        Set<String> folded = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        for (PenzHoldingEntity h : holdings.findAllLive()) {
            NewsHolding nh = new NewsHolding(h.getId(), h.getName(), h.getSymbol(), h.getCurrency(), h.getAssetType(),
                h.getSleeve(), h.getNewsTerms());
            for (String term : NewsMatcher.termsFor(nh)) {
                if (out.size() < newsProps.maxSearchTerms() && folded.add(term.toLowerCase(Locale.ROOT))) {
                    out.add(term);
                }
            }
        }
        return out;
    }
}
