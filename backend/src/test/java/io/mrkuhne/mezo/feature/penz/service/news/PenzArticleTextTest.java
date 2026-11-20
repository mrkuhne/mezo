package io.mrkuhne.mezo.feature.penz.service.news;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** HTML → text (mezo-r36n9.104) — the old {@code htmlToText} vectors. */
class PenzArticleTextTest {

    @Test
    void testFromHtml_shouldDropChromeAndPreferTheArticle() {
        String body = "<html><nav>menu</nav><header>Head</header><p>outside</p><article><p>"
            + "Szöveg. ".repeat(120) + "</p><script>x()</script><aside>ad</aside></article><footer>foot</footer></html>";

        String text = ArticleText.fromHtml(body);

        assertThat(text).doesNotContain("menu", "Head", "outside", "x()", "ad", "foot").startsWith("Szöveg.");
        assertThat(ArticleText.body(body)).isPresent();
    }

    @Test
    void testFromHtml_shouldDecodeEntitiesAndCap() {
        assertThat(ArticleText.fromHtml("<p>A &amp; B&nbsp;&eacute;s &#337;</p>")).isEqualTo("A & B és ő");
        assertThat(ArticleText.fromHtml("<p>" + "a".repeat(20_000) + "</p>")).hasSize(ArticleText.MAX_CHARS);
        assertThat(ArticleText.fromHtml(null)).isEmpty();
    }

    @Test
    void testBody_shouldBeEmpty_whenThePageIsAPaywallStub() {
        assertThat(ArticleText.body("<p>Subscribe to read</p>")).isEmpty();
        assertThat(ArticleText.body("<p>" + "x".repeat(ArticleText.MIN_CHARS) + "</p>")).isPresent();
    }
}
