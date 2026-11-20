package io.mrkuhne.mezo.feature.penz.service.news;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/** The feed allow-list (mezo-r36n9.104) — the old app's seed list and its {@code isAllowedArticleUrl} vectors. */
class PenzNewsSourcesTest {

    @Test
    void testSeed_shouldHoldTheEightOldFeeds_withTheirArticleHosts() {
        assertThat(NewsSources.SEED).hasSize(8);
        assertThat(NewsSources.SEED).extracting(NewsSource::key).doesNotHaveDuplicates();
        assertThat(NewsSources.seed("marketwatch")).get().extracting(NewsSource::articleHosts)
            .isEqualTo(List.of("marketwatch.com"));
        assertThat(NewsSources.SEED).allSatisfy(s -> assertThat(s.url()).startsWith("https://"));
    }

    @Test
    void testGoogleNewsSearch_shouldEncodeTheTerm_andAllowOnlyGoogleNews() {
        NewsSource s = NewsSources.googleNewsSearch("Példa Nyrt & co");

        assertThat(s.url()).isEqualTo(
            "https://news.google.com/rss/search?q=P%C3%A9lda+Nyrt+%26+co&hl=hu&gl=HU&ceid=HU:hu");
        assertThat(s.articleHosts()).containsExactly("news.google.com");
        assertThat(s.key()).isEqualTo("gnews-pelda-nyrt-co");
        assertThat(NewsSources.googleNewsSearch("x".repeat(80)).key()).hasSize(40);
    }

    @Test
    void testIsAllowedArticleUrl_shouldFollowTheOldHostRules() {
        List<String> cnbc = List.of("cnbc.com");
        assertThat(NewsSources.isAllowedArticleUrl("https://www.cnbc.com/2026/11/06/x.html", cnbc)).isTrue();
        assertThat(NewsSources.isAllowedArticleUrl("https://evilcnbc.com/x", cnbc)).isFalse();
        assertThat(NewsSources.isAllowedArticleUrl("https://cnbc.com.evil.io/x", cnbc)).isFalse();
        assertThat(NewsSources.isAllowedArticleUrl("ftp://cnbc.com/x", cnbc)).isFalse();
        assertThat(NewsSources.isAllowedArticleUrl("https://169.254.169.254/latest", List.of("169.254.169.254")))
            .isFalse();
        assertThat(NewsSources.isAllowedArticleUrl("https://[::1]/x", List.of("::1", "[::1]"))).isFalse();
        assertThat(NewsSources.isAllowedArticleUrl("https://localhost/x", List.of("localhost"))).isFalse();
        assertThat(NewsSources.isAllowedArticleUrl("https://user:pw@cnbc.com/x", cnbc)).isFalse();
        assertThat(NewsSources.isAllowedArticleUrl("https://cnbc.com:8443/x", cnbc)).isFalse();
        assertThat(NewsSources.isAllowedArticleUrl("https://WWW.CNBC.COM/x", cnbc)).isTrue();
        assertThat(NewsSources.isAllowedArticleUrl("not a url", cnbc)).isFalse();
    }
}
