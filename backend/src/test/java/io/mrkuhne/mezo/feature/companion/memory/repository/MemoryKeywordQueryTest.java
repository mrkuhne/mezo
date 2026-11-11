package io.mrkuhne.mezo.feature.companion.memory.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** mezo-lb2yb: the lexical/fact retrievers' query shaping. */
class MemoryKeywordQueryTest {

    private static final String DUMP = ("Mai állapot: alvás 6 óra, edzés kimaradt, kalória 2100, fehérje 90 gramm. "
            + "Boglárka költözés Boglárka költözés. Hangulat közepes, stressz magas, lépés 4200. ").repeat(6);

    @Test
    void shortQuery_staysAsTheUserWroteIt_folded() {
        MemoryKeywordQuery shaped = MemoryKeywordQuery.of("Boglárka futás");

        assertThat(shaped.keywordMode()).isFalse();
        assertThat(shaped.text()).isEqualTo("boglarka futas");
    }

    @Test
    void longDump_becomesAFewFrequentContentKeywords_orJoined() {
        MemoryKeywordQuery shaped = MemoryKeywordQuery.of(DUMP);

        assertThat(shaped.keywordMode()).isTrue();
        assertThat(shaped.text().split(" ")).hasSizeLessThanOrEqualTo(MemoryKeywordQuery.MAX_KEYWORDS)
                .startsWith("boglarka", "koltozes");
        assertThat(shaped.tsQuery()).startsWith("boglarka | koltozes").doesNotContain("2100", "mai", "&");
    }

    @Test
    void blankOrPunctuationOnly_isEmpty() {
        assertThat(MemoryKeywordQuery.of("  ").text()).isEmpty();
        assertThat(MemoryKeywordQuery.of("... !!! ??? , ; : -- ...  ,,, ''' ").text()).isEmpty();
    }
}
