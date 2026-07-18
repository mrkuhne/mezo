package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Pure jsoup reduction: drop chrome, keep visible text, flatten tables (mezo-8vum). */
class HtmlNutritionStripperTest {

    private final HtmlNutritionStripper stripper = new HtmlNutritionStripper();

    @Test
    void testStrip_shouldDropScriptStyleNavFooter_whenPresent() {
        String html = """
            <html><head><style>.x{}</style><script>var a=1;</script></head>
            <body><nav>Menü</nav><h1>Impact Whey</h1><footer>© shop</footer></body></html>""";
        String out = stripper.strip(html, 10_000);
        assertThat(out).contains("Impact Whey").doesNotContain("Menü").doesNotContain("var a=1").doesNotContain("© shop");
    }

    @Test
    void testStrip_shouldFlattenTableRowsToLabelValueLines_whenNutritionTable() {
        String html = """
            <table><tr><th>Energia</th><td>412 kcal</td></tr>
            <tr><th>Fehérje</th><td>82 g</td></tr></table>""";
        String out = stripper.strip(html, 10_000);
        assertThat(out).contains("Energia: 412 kcal").contains("Fehérje: 82 g");
    }

    @Test
    void testStrip_shouldTruncate_whenLongerThanMaxChars() {
        String out = stripper.strip("<p>" + "a".repeat(500) + "</p>", 100);
        assertThat(out).hasSizeLessThanOrEqualTo(100);
    }
}
