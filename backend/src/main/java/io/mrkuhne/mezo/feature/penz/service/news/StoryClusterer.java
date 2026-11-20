package io.mrkuhne.mezo.feature.penz.service.news;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Groups the matched articles into stories (Boop Pénz L6, mezo-r36n9.104, build notes §3.3) — M1's pattern: the same
 * event from several sources is one item with a source count.
 *
 * <ul>
 *   <li>Within one key, articles are taken oldest first; each joins the first cluster holding an article whose
 *       normalized title-token set has a Jaccard similarity ≥ {@link #JACCARD_MIN} with its own (single link), else it
 *       starts a new cluster. Duplicate urls count once.</li>
 *   <li>Rank: most articles first, then the newest, then the id. At most {@link #MAX_PER_KEY} stories per key and
 *       {@link #MAX_TOTAL} in all; each keeps its {@link #MAX_SOURCES} newest articles.</li>
 *   <li>Id: {@code <kind>-<10 hex>} of a name-based UUID (MD5) of the key and the cluster's first (oldest) url — stable across
 *       the two daily runs while that article stays in the window, so a story keeps its id as sources join.</li>
 * </ul>
 */
public final class StoryClusterer {

    public static final double JACCARD_MIN = 0.3;
    public static final int MAX_PER_KEY = 3;
    public static final int MAX_TOTAL = 6;
    public static final int MAX_SOURCES = 6;

    private static final Set<String> STOPWORDS = Set.of(
        "the", "and", "for", "with", "from", "that", "this", "over", "after", "into", "says", "are", "its", "has",
        "have", "was", "were", "will", "new", "how", "why", "what", "who", "but", "not", "than", "amid", "more",
        "egy", "hogy", "nem", "meg", "mar", "utan", "miatt", "szerint", "is", "az", "es", "van", "lesz",
        "volt", "mint", "ami", "aki", "csak", "most", "itt", "ezt", "azt", "igen");

    private static final Comparator<Story> RANK = Comparator
        .comparingInt(Story::clusterSize).reversed()
        .thenComparing(Story::newest, Comparator.nullsLast(Comparator.<Instant>reverseOrder()))
        .thenComparing(Story::id);

    private static final Comparator<NewsArticle> OLDEST_FIRST = Comparator
        .comparing(NewsArticle::publishedAt, Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
        .thenComparing(NewsArticle::url);

    private static final Comparator<NewsArticle> NEWEST_FIRST = Comparator
        .comparing(NewsArticle::publishedAt, Comparator.nullsLast(Comparator.<Instant>reverseOrder()))
        .thenComparing(NewsArticle::url);

    private StoryClusterer() {
    }

    /** The ranked, capped stories of all keys (input order of keys does not matter). */
    public static List<Story> cluster(Map<StoryKey, List<NewsArticle>> candidates) {
        List<Story> all = new ArrayList<>();
        for (Map.Entry<StoryKey, List<NewsArticle>> e : candidates.entrySet()) {
            all.addAll(clusterKey(e.getKey(), e.getValue()).stream().sorted(RANK).limit(MAX_PER_KEY).toList());
        }
        return all.stream().sorted(RANK).limit(MAX_TOTAL).toList();
    }

    private static List<Story> clusterKey(StoryKey key, List<NewsArticle> articles) {
        Map<String, NewsArticle> byUrl = new LinkedHashMap<>();
        articles.stream().sorted(OLDEST_FIRST).forEach(a -> byUrl.putIfAbsent(a.url(), a));
        List<List<NewsArticle>> clusters = new ArrayList<>();
        List<List<Set<String>>> tokens = new ArrayList<>();
        for (NewsArticle a : byUrl.values()) {
            Set<String> t = tokens(a.title());
            int target = -1;
            for (int i = 0; i < clusters.size() && target < 0; i++) {
                for (Set<String> other : tokens.get(i)) {
                    if (jaccard(t, other) >= JACCARD_MIN) {
                        target = i;
                        break;
                    }
                }
            }
            if (target < 0) {
                clusters.add(new ArrayList<>());
                tokens.add(new ArrayList<>());
                target = clusters.size() - 1;
            }
            clusters.get(target).add(a);
            tokens.get(target).add(t);
        }
        List<Story> out = new ArrayList<>();
        for (List<NewsArticle> c : clusters) {
            String id = key.kind().wire() + "-" + hash(key.slug() + "|" + c.get(0).url());
            List<NewsArticle> newest = c.stream().sorted(NEWEST_FIRST).limit(MAX_SOURCES).toList();
            out.add(new Story(id, key, newest, c.size()));
        }
        return out;
    }

    /** Folded title words of 3+ characters, minus stopwords. */
    static Set<String> tokens(String title) {
        Set<String> out = new LinkedHashSet<>();
        for (String w : NewsText.fold(title).split("[^\\p{L}\\p{N}]+")) {
            if (w.length() >= 3 && !STOPWORDS.contains(w)) {
                out.add(w);
            }
        }
        return out;
    }

    static double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        Set<String> inter = new LinkedHashSet<>(a);
        inter.retainAll(b);
        Set<String> union = new LinkedHashSet<>(a);
        union.addAll(b);
        return (double) inter.size() / union.size();
    }

    /** 10 hex characters of a name-based (MD5) UUID: stable, collision-safe at a handful of stories a day. */
    private static String hash(String s) {
        return UUID.nameUUIDFromBytes(s.getBytes(StandardCharsets.UTF_8)).toString().replace("-", "").substring(0, 10);
    }
}
