package io.mrkuhne.mezo.feature.penz.service.news;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * The news feeds Boop reads (mezo-r36n9.104): the old app's eight seed feeds ({@code base44/shared/news.ts
 * SEED_SOURCES}, each with its allowed article hosts) and one Google News RSS search per distinct holding term.
 * Config-free constants: a feed is code, reviewed like code, because every one of them is an outbound allow-list
 * entry. {@link #isAllowedArticleUrl} is the old {@code isAllowedArticleUrl} — the pre-check before anything reaches
 * the SSRF-guarded fetcher (which re-checks the host and every resolved address on its own).
 */
public final class NewsSources {

    public static final String GOOGLE_NEWS_HOST = "news.google.com";
    public static final String GOOGLE_NEWS_NAME = "Google News";
    /** {@code penz_news_article.source_key} is varchar(40). */
    private static final int KEY_MAX = 40;

    public static final List<NewsSource> SEED = List.of(
        new NewsSource("cnbc-top", "CNBC Top News", "https://www.cnbc.com/id/100003114/device/rss/rss.html",
            List.of("cnbc.com")),
        new NewsSource("cnbc-economy", "CNBC Economy", "https://www.cnbc.com/id/20910258/device/rss/rss.html",
            List.of("cnbc.com")),
        new NewsSource("marketwatch", "MarketWatch Top Stories",
            "https://feeds.content.dowjones.io/public/rss/mw_topstories", List.of("marketwatch.com")),
        new NewsSource("bbc-business", "BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml",
            List.of("bbc.co.uk", "bbc.com")),
        new NewsSource("ft-markets", "FT Markets", "https://www.ft.com/markets?format=rss", List.of("ft.com")),
        new NewsSource("ecb-press", "ECB press", "https://www.ecb.europa.eu/rss/press.html",
            List.of("ecb.europa.eu")),
        new NewsSource("bbj", "Budapest Business Journal", "https://bbj.hu/rss", List.of("bbj.hu")),
        new NewsSource("hungary-today", "Hungary Today", "https://hungarytoday.hu/feed/",
            List.of("hungarytoday.hu")));

    private static final Pattern IPV4ISH = Pattern.compile("^\\d+(\\.\\d+){0,3}$|^0x[0-9a-f]+$");

    private NewsSources() {
    }

    /**
     * The Google News RSS search for one holding term, Hungarian edition. Its article links are Google redirect
     * links: the fetcher follows no redirects, so these stories are narrated from title + summary (build notes §1.10).
     */
    public static NewsSource googleNewsSearch(String term) {
        String q = term == null ? "" : term.strip();
        String url = "https://news.google.com/rss/search?q=" + URLEncoder.encode(q, StandardCharsets.UTF_8)
            + "&hl=hu&gl=HU&ceid=HU:hu";
        String slug = NewsText.fold(q).replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        String key = ("gnews-" + slug);
        return new NewsSource(key.length() > KEY_MAX ? key.substring(0, KEY_MAX) : key, GOOGLE_NEWS_NAME, url,
            List.of(GOOGLE_NEWS_HOST));
    }

    /** The seed feed with this key, if any. */
    public static Optional<NewsSource> seed(String key) {
        return SEED.stream().filter(s -> s.key().equals(key)).findFirst();
    }

    /**
     * True when {@code url} is http(s), carries no credentials or port, is not an IP literal or localhost, and its
     * host is one of {@code hosts} or a subdomain of one.
     */
    public static boolean isAllowedArticleUrl(String url, List<String> hosts) {
        if (url == null || hosts == null || hosts.isEmpty()) {
            return false;
        }
        URI u;
        try {
            u = new URI(url);
        } catch (Exception e) {
            return false;
        }
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("https") && !scheme.equals("http")) {
            return false;
        }
        if (u.getRawUserInfo() != null || u.getPort() != -1 || u.getHost() == null) {
            return false;
        }
        String host = u.getHost().toLowerCase(Locale.ROOT);
        if (host.isEmpty() || host.equals("localhost") || host.startsWith("[") || host.contains(":")
            || IPV4ISH.matcher(host).matches()) {
            return false;
        }
        return hosts.stream().map(h -> h.toLowerCase(Locale.ROOT))
            .anyMatch(h -> host.equals(h) || host.endsWith("." + h));
    }
}
