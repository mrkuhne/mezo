package io.mrkuhne.mezo.feature.penz.service.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Regression tests from the L6 security review (mezo-r36n9.104), findings #5 (ReDoS: quadratic regexes over
 * adversarial feeds / pages on the single news thread) and #6 (NUL, control, bidi and lone-surrogate characters).
 */
class PenzNewsInputHardeningTest {

    private static final Duration LIMIT = Duration.ofSeconds(1);

    @Test
    void testRssParser_shouldStayLinear_onAdversarialFeeds() {
        String lt = "<".repeat(100_000);
        String[] inputs = {
            lt,
            "<item>".repeat(100_000 / 6),
            "<item><title>" + lt + "</title><link>https://a.b/c</link></item>",
            "<item><title><![CDATA[".repeat(20_000),
            "<item><link ".repeat(20_000),
            "<item><link>".repeat(20_000) + "</item>",
            "<entry>" + "<link href=\"https://a.b/c\"".repeat(20_000),
            "x".repeat(600_000),
            ("<item><title>t</title><link>https://a.b/c</link><description>" + "<".repeat(5_000) + "</description></item>")
                .repeat(100),
        };
        for (String in : inputs) {
            assertTimeoutPreemptively(LIMIT, () -> RssParser.parse(in), () -> "input of " + in.length());
        }
    }

    @Test
    void testRssParser_shouldParseOnlyTheFirst512Kb() {
        String item = "<item><title>T</title><link>https://a.b/c</link></item>";
        String big = item + " ".repeat(RssParser.MAX_INPUT_CHARS) + item.replace("/c", "/d");

        assertThat(RssParser.parse(big)).extracting(RssItem::link).containsExactly("https://a.b/c");
    }

    @Test
    void testArticleText_shouldStayLinear_onAdversarialPages() {
        String[] inputs = {
            "<".repeat(100_000),
            "<script>".repeat(100_000 / 8),
            "<article>".repeat(60_000),
            "<!--".repeat(100_000),
            "<p>" + "a<".repeat(256_000),
        };
        for (String in : inputs) {
            assertTimeoutPreemptively(LIMIT, () -> ArticleText.fromHtml(in), () -> "input of " + in.length());
        }
    }

    @Test
    void testRssParser_shouldStripNulControlBidiAndLoneSurrogates() {
        String feed = "<rss><item><title>Pél\u0000da‮ bank⁦ \uD800hír\u0007</title>"
            + "<link>https://a.b/c</link><description>Ös\u0001sze​foglaló</description></item>"
            + "<item><title>Rossz link</title><link>https://a.b/\u0000x</link></item></rss>";

        List<RssItem> items = RssParser.parse(feed);

        assertThat(items).singleElement().satisfies(i -> {
            assertThat(i.title()).isEqualTo("Példa bank hír");
            assertThat(i.summary()).isEqualTo("Összefoglaló");
        });
    }

    @Test
    void testArticleText_shouldStripControlCharacters() {
        assertThat(ArticleText.fromHtml("<p>A\u0000B ‮c\uD800</p>")).isEqualTo("AB c");
    }

    @Test
    void testClean_shouldKeepValidSurrogatePairsAndNewlines() {
        assertThat(NewsText.clean("a😀b\nc\td")).isEqualTo("a😀b\nc\td");
    }
}
