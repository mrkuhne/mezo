package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Pure unit test of the lexical shortlist (mezo-r36n9.63) — no Spring, no DB. The shortlist only
 * PROPOSES candidates: the AI picks among them and the owner confirms, so it may be generous, but it
 * must never offer a non-food row or a row with no word in common.
 */
class PantryMatcherTest {

    private static PantryCatalogEntity row(String kind, String name, String brand) {
        PantryCatalogEntity e = new PantryCatalogEntity();
        e.setId(UUID.randomUUID());
        e.setKind(kind);
        e.setName(name);
        e.setBrand(brand);
        return e;
    }

    private static PantryCatalogEntity food(String name) {
        return row("food", name, null);
    }

    @Test
    void testShortlist_shouldFindFoodBySaidHeadWord() {
        var m = PantryMatcher.of(List.of(food("Csirkemell filé, friss"), food("Csirkecomb"), food("Jázmin rizs")), Set.of());

        assertThat(m.shortlist("csirkemell", 8)).extracting(c -> c.food().getName())
            .containsExactly("Csirkemell filé, friss");
    }

    @Test
    void testShortlist_shouldMatchCompoundByPrefix() {
        var m = PantryMatcher.of(List.of(food("Csirkemellfilé"), food("Olívaolaj")), Set.of());

        assertThat(m.shortlist("csirkemell", 8)).extracting(c -> c.food().getName()).containsExactly("Csirkemellfilé");
        // The suffixed said form finds the base word too ("olívaolajat" -> "Olívaolaj").
        assertThat(m.shortlist("olívaolajat", 8)).extracting(c -> c.food().getName()).containsExactly("Olívaolaj");
    }

    @Test
    void testShortlist_shouldPreferShelfRowOnEqualOverlap() {
        PantryCatalogEntity onShelf = food("Olívaolaj extra szűz");
        PantryCatalogEntity shorter = food("Olívaolaj");
        var m = PantryMatcher.of(List.of(shorter, onShelf), Set.of(onShelf.getId()));

        List<PantryMatcher.Candidate> hits = m.shortlist("olívaolaj", 8);

        assertThat(hits).extracting(c -> c.food().getName()).containsExactly("Olívaolaj extra szűz", "Olívaolaj");
        assertThat(hits.get(0).onShelf()).isTrue();
        assertThat(hits.get(1).onShelf()).isFalse();
    }

    @Test
    void testShortlist_shouldPutShorterNameFirstOnATie() {
        var m = PantryMatcher.of(List.of(food("Rizs jázmin hosszú szemű"), food("Rizs")), Set.of());

        assertThat(m.shortlist("rizs", 8)).extracting(c -> c.food().getName())
            .containsExactly("Rizs", "Rizs jázmin hosszú szemű");
    }

    @Test
    void testShortlist_shouldReturnEmptyWhenNothingOverlaps() {
        var m = PantryMatcher.of(List.of(food("Jázmin rizs"), food("Csirkemell")), Set.of());

        assertThat(m.shortlist("kurkuma", 8)).isEmpty();
        assertThat(m.shortlist("", 8)).isEmpty();
        assertThat(m.shortlist(null, 8)).isEmpty();
    }

    @Test
    void testShortlist_shouldIgnoreNonFoodKinds() {
        var m = PantryMatcher.of(List.of(row("supplement", "Kurkuma kapszula", null), row("med", "Kurkuma", null)), Set.of());

        assertThat(m.shortlist("kurkuma", 8)).isEmpty();
    }

    @Test
    void testShortlist_shouldFoldDiacriticsAndCase() {
        var m = PantryMatcher.of(List.of(food("Olívaolaj")), Set.of());

        assertThat(m.shortlist("OLIVAOLAJ", 8)).extracting(c -> c.food().getName()).containsExactly("Olívaolaj");
    }

    @Test
    void testShortlist_shouldCountBrandWords() {
        var m = PantryMatcher.of(List.of(row("food", "Zabital", "Alpro"), food("Zabpehely")), Set.of());

        assertThat(m.shortlist("alpro zabital", 8)).extracting(c -> c.food().getName()).first().isEqualTo("Zabital");
    }

    @Test
    void testShortlist_shouldCapAtLimit() {
        List<PantryCatalogEntity> rows = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            rows.add(food("Rizs fajta " + (char) ('a' + i) + (char) ('a' + i)));
        }

        assertThat(PantryMatcher.of(rows, Set.of()).shortlist("rizs", 8)).hasSize(8);
    }

    @Test
    void testTokens_shouldFoldAndDropShortWords() {
        assertThat(PantryMatcher.tokens("  Tej 1,5% – UHT, a ")).containsExactly("tej", "uht");
    }
}
