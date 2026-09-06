package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.PantryCatalogLoader.CatalogRow;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

/**
 * Pure guards on {@code seed/pantry-catalog.json} — no Spring, no DB (mezo-1f7b).
 *
 * <p>The saturated-fat column is the reason this file exists. It shipped on 2 of 147 rows while
 * {@code fiberG} shipped on 144, and because all three nutrient-driven dimensions used to share one
 * OR-ed "has any fact" flag, that gap did not read as "nincs adat" — it read as a perfect
 * Zsírminőség score on nearly every meal. Per-fact coverage fixed the scorer; seeding the column
 * fixed the data. These assertions keep both halves from silently regressing: a new row with fat but
 * no saturated fat would quietly degrade the dimension again, and a value above the row's own
 * {@code fatG} is arithmetically impossible (the scorer's {@code satFat / fat} share would exceed 1).
 */
class PantryCatalogSeedTest {

    /**
     * The rows that legitimately carry no saturated fat: an unidentifiable leftover and a non-food
     * row. They are the same two the NOVA seed leaves unclassified (mezo-32ko) — an honest null,
     * not an oversight. Naming them here is what makes the "everything else is filled" assertion
     * below meaningful instead of a count that drifts.
     */
    private static final List<String> UNCLASSIFIABLE = List.of("Jenny Kaja", "Szilvia Törlőkendő");

    private final List<CatalogRow> catalog = readCatalog();

    @Test
    void testCatalog_shouldCarrySaturatedFat_onEveryClassifiableRow() {
        List<String> missing = catalog.stream()
            .filter(r -> r.saturatedFatG() == null)
            .map(CatalogRow::name)
            .toList();

        assertThat(missing).containsExactlyInAnyOrderElementsOf(UNCLASSIFIABLE);
    }

    @Test
    void testCatalog_shouldNeverSeedMoreSaturatedFatThanTotalFat() {
        List<String> impossible = catalog.stream()
            .filter(r -> r.saturatedFatG() != null && r.fatG() != null)
            .filter(r -> r.saturatedFatG().compareTo(r.fatG()) > 0)
            .map(r -> r.name() + ": " + r.saturatedFatG() + " g > " + r.fatG() + " g fat")
            .toList();

        assertThat(impossible).isEmpty();
    }

    /** A fat-free row's zero is a FACT, not an estimate — it must be stated, never left null. */
    @Test
    void testCatalog_shouldSeedZero_whenTheRowCarriesNoFatAtAll() {
        List<String> wrong = catalog.stream()
            .filter(r -> !UNCLASSIFIABLE.contains(r.name()))
            .filter(r -> r.fatG() != null && r.fatG().signum() == 0)
            .filter(r -> r.saturatedFatG() == null
                || r.saturatedFatG().compareTo(BigDecimal.ZERO) != 0)
            .map(CatalogRow::name)
            .toList();

        assertThat(wrong).isEmpty();
    }

    private static List<CatalogRow> readCatalog() {
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream in = PantryCatalogSeedTest.class
                .getResourceAsStream("/seed/pantry-catalog.json")) {
            assertThat(in).as("seed/pantry-catalog.json on the test classpath").isNotNull();
            return mapper.readValue(in,
                mapper.getTypeFactory().constructCollectionType(List.class, CatalogRow.class));
        } catch (Exception e) {
            throw new IllegalStateException("seed/pantry-catalog.json is unreadable", e);
        }
    }
}
