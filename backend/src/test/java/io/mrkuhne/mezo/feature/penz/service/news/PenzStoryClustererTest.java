package io.mrkuhne.mezo.feature.penz.service.news;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Story grouping (mezo-r36n9.104, build notes §3.3). */
class PenzStoryClustererTest {

    private static final Instant T0 = Instant.parse("2026-11-20T00:00:00Z");
    private static final StoryKey H = StoryKey.holding(UUID.fromString("00000000-0000-0000-0000-00000000000a"));

    private static NewsArticle a(String url, String title, int hour) {
        return new NewsArticle("https://example.com/" + url, "Src " + url, title, null, T0.plusSeconds(hour * 3600L));
    }

    @Test
    void testCluster_shouldGroupSimilarTitles_andKeepDifferentEventsApart() {
        List<NewsArticle> in = List.of(
            a("1", "Példabank quarterly profit beats forecasts", 1),
            a("2", "Példabank profit beats forecasts in quarter", 2),
            a("3", "Példabank opens new branch network in Vienna", 3),
            a("4", "Quarterly profit at Példabank beats forecasts", 4));

        List<Story> out = StoryClusterer.cluster(Map.of(H, in));

        assertThat(out).hasSize(2);
        assertThat(out.get(0).clusterSize()).isEqualTo(3);
        assertThat(out.get(0).articles()).extracting(NewsArticle::url)
            .containsExactly("https://example.com/4", "https://example.com/2", "https://example.com/1");
        assertThat(out.get(1).articles()).extracting(NewsArticle::url).containsExactly("https://example.com/3");
    }

    @Test
    void testCluster_shouldGiveStableIds_whenANewerSourceJoins() {
        NewsArticle first = a("1", "Példabank profit beats forecasts", 1);
        NewsArticle later = a("2", "Példabank profit beats all forecasts", 5);

        String before = StoryClusterer.cluster(Map.of(H, List.of(first))).get(0).id();
        String after = StoryClusterer.cluster(Map.of(H, List.of(later, first))).get(0).id();

        assertThat(after).isEqualTo(before).startsWith("holding-").hasSize("holding-".length() + 10);
        assertThat(StoryClusterer.cluster(Map.of(StoryKey.fx(), List.of(first))).get(0).id()).startsWith("fx-")
            .isNotEqualTo(before);
    }

    @Test
    void testCluster_shouldCapSourcesPerStory_andCountDuplicatesOnce() {
        List<NewsArticle> in = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            in.add(a("s" + i, "Példabank profit beats forecasts again", i));
        }
        in.add(a("s0", "Példabank profit beats forecasts again", 0));

        Story s = StoryClusterer.cluster(Map.of(H, in)).get(0);

        assertThat(s.clusterSize()).isEqualTo(8);
        assertThat(s.articles()).hasSize(StoryClusterer.MAX_SOURCES);
        assertThat(s.articles().get(0).url()).isEqualTo("https://example.com/s7");
    }

    @Test
    void testCluster_shouldCapThreePerKeyAndSixInTotal_rankedBySourcesThenNewest() {
        Map<StoryKey, List<NewsArticle>> in = new LinkedHashMap<>();
        String[] topics = {"alpha", "bravo", "charlie", "delta", "echo"};
        for (int k = 0; k < 3; k++) {
            StoryKey key = StoryKey.holding(new UUID(0, k + 1));
            List<NewsArticle> list = new ArrayList<>();
            for (int t = 0; t < topics.length; t++) {
                list.add(a(k + topics[t], topics[t] + k, t));
            }
            in.put(key, list);
        }
        // one extra-source story on the third key ranks first
        in.get(new ArrayList<>(in.keySet()).get(2)).add(a("dup", "alpha2 again", 1));

        List<Story> out = StoryClusterer.cluster(in);

        assertThat(out).hasSize(StoryClusterer.MAX_TOTAL);
        assertThat(out.get(0).clusterSize()).isEqualTo(2);
        assertThat(out.stream().collect(java.util.stream.Collectors.groupingBy(Story::key)).values())
            .allSatisfy(l -> assertThat(l).hasSizeLessThanOrEqualTo(StoryClusterer.MAX_PER_KEY));
        // after the two-source story: newest first
        assertThat(out.get(1).newest()).isAfterOrEqualTo(out.get(2).newest());
    }

    @Test
    void testJaccard_shouldIgnoreStopwordsAndDiacritics() {
        assertThat(StoryClusterer.tokens("The Forint és az Euró")).containsExactly("forint", "euro");
        assertThat(StoryClusterer.jaccard(StoryClusterer.tokens("forint euro"), StoryClusterer.tokens("Forint dollar")))
            .isEqualTo(1.0 / 3);
    }
}
