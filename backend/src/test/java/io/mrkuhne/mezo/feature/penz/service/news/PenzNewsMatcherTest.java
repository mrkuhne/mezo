package io.mrkuhne.mezo.feature.penz.service.news;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The deterministic article match (mezo-r36n9.104, build notes §3.2). Every holding here is invented. */
class PenzNewsMatcherTest {

    private static final Instant NOW = Instant.parse("2026-11-20T06:30:00Z");
    private static final UUID PELDA_ID = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private static final UUID WORLD_ID = UUID.fromString("00000000-0000-0000-0000-00000000000b");
    private static final UUID BOND_ID = UUID.fromString("00000000-0000-0000-0000-00000000000c");

    private static final NewsHolding PELDA =
        new NewsHolding(PELDA_ID, "Példabank Nyrt", "PLDB.BD", "HUF", "stock", "long", List.of());
    private static final NewsHolding WORLD = new NewsHolding(WORLD_ID, "Sample All-World UCITS ETF Acc", "SMPW.DE",
        "EUR", "etf", "long", List.of("Samplefund"));
    private static final NewsHolding BOND =
        new NewsHolding(BOND_ID, "Prémium Magyar Állampapír", null, "HUF", "bond", "short", List.of());

    private static NewsArticle article(String title, Duration age) {
        return new NewsArticle("https://example.com/" + title.hashCode(), "Example", title, null, NOW.minus(age));
    }

    @Test
    void testTermsFor_shouldUseSymbolRootDistinctWordsAndOwnTerms_whenHoldingIsGiven() {
        assertThat(NewsMatcher.termsFor(PELDA)).containsExactly("PLDB", "Példabank");
        // world, All, UCITS, ETF, Acc are generic: only the issuer-free distinct word and the owner's term remain
        assertThat(NewsMatcher.termsFor(WORLD)).containsExactly("SMPW", "Sample", "Samplefund");
        assertThat(NewsMatcher.termsFor(BOND)).isEmpty();
        assertThat(NewsMatcher.termsFor(new NewsHolding(UUID.randomUUID(), "Készpénz", null, "EUR", "cash", "short",
            List.of("x")))).isEmpty();
    }

    @Test
    void testSymbolRoot_shouldIgnoreFxPairsAndCryptoQuoteSuffixes() {
        assertThat(NewsMatcher.symbolRoot("OTP.BD")).isEqualTo("OTP");
        assertThat(NewsMatcher.symbolRoot("BTC-USD")).isEqualTo("BTC");
        assertThat(NewsMatcher.symbolRoot("EURHUF=X")).isNull();
        assertThat(NewsMatcher.symbolRoot("GE")).isNull();
        assertThat(NewsMatcher.symbolRoot(null)).isNull();
    }

    @Test
    void testMatch_shouldMatchWholeWordsCaseAndDiacriticInsensitively() {
        NewsArticle hu = article("A PELDABANK negyedéves jelentése", Duration.ofHours(2));
        NewsArticle suffix = article("Mi történt a Példabanknál?", Duration.ofHours(3));
        NewsArticle apostrophe = article("PLDB's results beat estimates", Duration.ofHours(4));
        NewsArticle partial = article("PLDBX token surges", Duration.ofHours(4));

        Map<StoryKey, List<NewsArticle>> out =
            NewsMatcher.match(List.of(hu, suffix, apostrophe, partial), List.of(PELDA), NOW);

        assertThat(out.get(StoryKey.holding(PELDA_ID))).containsExactly(hu, suffix, apostrophe);
    }

    @Test
    void testMatch_shouldKeepOnlyTheLast36Hours_andDropUndated() {
        NewsArticle fresh = article("Példabank news", Duration.ofHours(35));
        NewsArticle old = article("Példabank old news", Duration.ofHours(37));
        NewsArticle undated = new NewsArticle("https://example.com/u", "Example", "Példabank undated", null, null);

        assertThat(NewsMatcher.match(List.of(fresh, old, undated), List.of(PELDA), NOW))
            .containsExactly(Map.entry(StoryKey.holding(PELDA_ID), List.of(fresh)));
    }

    @Test
    void testMatch_shouldNotMatchTheWordWorld_whenTheHoldingIsAWorldEtf() {
        NewsArticle generic = article("World markets slip as oil climbs", Duration.ofHours(1));

        assertThat(NewsMatcher.match(List.of(generic), List.of(WORLD), NOW)).isEmpty();
    }

    @Test
    void testMatch_shouldAddFx_onlyWhenAForeignCurrencyHoldingExists() {
        NewsArticle fx = article("Erősödött a forint az euróval szemben", Duration.ofHours(1));
        NewsArticle pair = article("EUR/HUF falls below a round level", Duration.ofHours(1));
        NewsArticle amount = article("Tízmilliárd forintos beruházás indul", Duration.ofHours(1));

        assertThat(NewsMatcher.match(List.of(fx, pair, amount), List.of(WORLD), NOW).get(StoryKey.fx()))
            .containsExactly(fx, pair);
        assertThat(NewsMatcher.match(List.of(fx, pair), List.of(PELDA), NOW)).doesNotContainKey(StoryKey.fx());
    }

    @Test
    void testMatch_shouldAddRates_onlyWhenABondExists() {
        NewsArticle mnb = article("Az MNB nem változtatott az alapkamaton", Duration.ofHours(1));
        NewsArticle en = article("Hungary holds interest rates steady", Duration.ofHours(1));

        assertThat(NewsMatcher.match(List.of(mnb, en), List.of(BOND), NOW).get(StoryKey.rates()))
            .containsExactly(mnb, en);
        assertThat(NewsMatcher.match(List.of(mnb, en), List.of(PELDA), NOW)).isEmpty();
    }

    @Test
    void testMatch_shouldOrderHoldingsThenFxThenRates() {
        NewsArticle a = article("Példabank and the forint weakens", Duration.ofHours(1));
        NewsArticle b = article("Samplefund inflows; MNB rate decision", Duration.ofHours(1));

        Map<StoryKey, List<NewsArticle>> out = NewsMatcher.match(List.of(a, b), List.of(PELDA, WORLD, BOND), NOW);

        assertThat(out.keySet()).containsExactly(StoryKey.holding(PELDA_ID), StoryKey.holding(WORLD_ID), StoryKey.fx(),
            StoryKey.rates());
    }
}
