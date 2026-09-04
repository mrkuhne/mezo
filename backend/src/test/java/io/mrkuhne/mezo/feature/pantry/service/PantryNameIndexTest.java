package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Pure unit test of the deterministic pantry name matcher (mezo-qrks) — no Spring, no DB.
 * The house rule under test: an ambiguous or unit-mismatched lookup MUST miss, because a wrong
 * pantry match silently writes wrong macros into the log while a miss only costs convenience.
 */
class PantryNameIndexTest {

    private static PantryCatalogEntity item(String name, String brand, String servingUnit) {
        PantryCatalogEntity e = new PantryCatalogEntity();
        e.setId(UUID.randomUUID());
        e.setName(name);
        e.setBrand(brand);
        e.setServingAmount(new BigDecimal("100"));
        e.setServingUnit(servingUnit);
        e.setKind("food");
        return e;
    }

    @Test
    void testMatch_shouldFindExactName_whenCaseAndAccentsDiffer() {
        PantryCatalogEntity turo = item("Túró Rudi", null, "g");
        PantryNameIndex index = PantryNameIndex.of(List.of(turo));

        assertThat(index.match("Túró Rudi", "g")).contains(turo);
        assertThat(index.match("turo rudi", "g")).contains(turo);
        assertThat(index.match("  TÚRÓ   RUDI ", "g")).contains(turo);
    }

    @Test
    void testMatch_shouldFindByBrandPrefixedName() {
        PantryCatalogEntity rizs = item("Basmati rizs", "Rizspont", "g");
        PantryNameIndex index = PantryNameIndex.of(List.of(rizs));

        assertThat(index.match("Rizspont Basmati rizs", "g")).contains(rizs);
        assertThat(index.match("Basmati rizs", "g")).contains(rizs);
    }

    @Test
    void testMatch_shouldStripPackSize_whenNameEndsWithUnitSuffixedNumber() {
        PantryCatalogEntity zab = item("Zabpehely 500 g", null, "g");
        PantryNameIndex index = PantryNameIndex.of(List.of(zab));

        assertThat(index.match("Zabpehely", "g")).contains(zab);
        assertThat(index.match("Zabpehely 500 g", "g")).contains(zab);
    }

    @Test
    void testMatch_shouldNotStripPercentage_soMilkFatContentSurvives() {
        PantryCatalogEntity tej = item("Tej 1,5%", null, "ml");
        PantryNameIndex index = PantryNameIndex.of(List.of(tej));

        assertThat(index.match("Tej 1,5%", "ml")).contains(tej);
        assertThat(index.match("Tej", "ml")).isEmpty(); // the fat content is NOT packaging
    }

    @Test
    void testMatch_shouldMiss_whenAStrippedKeyIsAmbiguous() {
        PantryCatalogEntity small = item("Tej 1 l", null, "ml");
        PantryCatalogEntity big = item("Tej 2 l", null, "ml");
        PantryNameIndex index = PantryNameIndex.of(List.of(small, big));

        assertThat(index.match("Tej", "ml")).isEmpty();       // ambiguous -> no guess
        assertThat(index.match("Tej 1 l", "ml")).contains(small); // full names still resolve
        assertThat(index.match("Tej 2 l", "ml")).contains(big);
    }

    @Test
    void testMatch_shouldMiss_whenUnitDisagrees() {
        PantryCatalogEntity zab = item("Zabpehely", null, "g");
        PantryNameIndex index = PantryNameIndex.of(List.of(zab));

        assertThat(index.match("Zabpehely", "db")).isEmpty();
        assertThat(index.match("Zabpehely", null)).isEmpty();
        assertThat(index.match("Zabpehely", " ")).isEmpty();
    }

    @Test
    void testMatch_shouldAcceptUnitSynonyms() {
        PantryCatalogEntity zab = item("Zabpehely", null, "g");
        PantryCatalogEntity tojas = item("Tojás", null, "db");
        PantryNameIndex index = PantryNameIndex.of(List.of(zab, tojas));

        assertThat(index.match("Zabpehely", "gramm")).contains(zab);
        assertThat(index.match("Zabpehely", "GR")).contains(zab);
        assertThat(index.match("Tojás", "darab")).contains(tojas);
    }

    @Test
    void testMatch_shouldTreatNullServingUnitAsGrams() {
        PantryCatalogEntity e = item("Mák", null, null);
        PantryNameIndex index = PantryNameIndex.of(List.of(e));

        assertThat(index.match("Mák", "g")).contains(e);
        assertThat(index.match("Mák", "db")).isEmpty();
    }

    @Test
    void testMatch_shouldNotMatch_whenRowIsNotAFoodKind() {
        // Only kind="food" rows reach the composer's ingredient list (PantryService.getPantry
        // splits food into `ingredients`, everything else into `stash`); matching a supplement
        // by name would return a source=pantry line the frontend can't resolve, desyncing the
        // displayed totals from what actually gets logged on save.
        PantryCatalogEntity magnezium = item("Magnézium", null, "db");
        magnezium.setKind("supplement");
        PantryNameIndex index = PantryNameIndex.of(List.of(magnezium));

        assertThat(index.match("Magnézium", "db")).isEmpty();
    }

    @Test
    void testMatch_shouldMiss_whenIndexOrNameIsEmpty() {
        assertThat(PantryNameIndex.of(List.of()).match("Zabpehely", "g")).isEmpty();

        PantryNameIndex index = PantryNameIndex.of(List.of(item("Zabpehely", null, "g")));
        assertThat(index.match(null, "g")).isEmpty();
        assertThat(index.match("   ", "g")).isEmpty();
        assertThat(index.match("Nincs ilyen", "g")).isEmpty();
    }
}
