package io.mrkuhne.mezo.feature.gamification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.gamification.TitleCatalog.TitleDef;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class TitleCatalogIT extends AbstractIntegrationTest {

    @Autowired private TitleCatalog catalog;

    @Test
    void testAll_shouldExposeSixteenTitles_whenContextBoots() {
        assertThat(catalog.all()).hasSize(16);
        assertThat(catalog.all()).extracting(TitleDef::kind)
            .filteredOn("LADDER"::equals).hasSize(9);
        assertThat(catalog.all()).extracting(TitleDef::kind)
            .filteredOn("SHOP"::equals).hasSize(7);
    }

    @Test
    void testFind_shouldReturnDefaultTitle_whenKeyIsUjonc() {
        assertThat(catalog.find(TitleCatalog.DEFAULT_TITLE_KEY)).hasValueSatisfying(d -> {
            assertThat(d.name()).isEqualTo("Az Újonc");
            assertThat(d.kind()).isEqualTo("LADDER");
            assertThat(d.unlockLevel()).isEqualTo(1);
            assertThat(d.priceCoins()).isNull();
        });
    }

    @Test
    void testFind_shouldReturnShopTitle_withPriceAndNoUnlockLevel() {
        assertThat(catalog.find("gainz-nagyur")).hasValueSatisfying(d -> {
            assertThat(d.kind()).isEqualTo("SHOP");
            assertThat(d.priceCoins()).isEqualTo(600);
            assertThat(d.unlockLevel()).isNull();
        });
    }

    @Test
    void testFind_shouldBeEmpty_whenKeyUnknown() {
        assertThat(catalog.find("nope")).isEmpty();
    }

    @Test
    void testLoad_shouldFailFast_whenKeysDuplicated() {
        TitleDef a = new TitleDef("dup", "A", "LADDER", 1, null);
        TitleDef b = new TitleDef("dup", "B", "LADDER", 3, null);
        assertThatThrownBy(() -> catalog.load(List.of(a, b)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("dup");
    }

    @Test
    void testLoad_shouldFailFast_whenLadderRowHasNoUnlockLevel() {
        TitleDef bad = new TitleDef("no-unlock", "No Unlock", "LADDER", null, null);
        assertThatThrownBy(() -> catalog.load(List.of(bad)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("no-unlock");
    }

    @Test
    void testLoad_shouldFailFast_whenShopRowHasNoPrice() {
        TitleDef bad = new TitleDef("no-price", "No Price", "SHOP", null, null);
        assertThatThrownBy(() -> catalog.load(List.of(bad)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("no-price");
    }

    @Test
    void testLoad_shouldFailFast_whenDefaultTitleKeyMissing() {
        TitleDef row = new TitleDef("something-else", "Something Else", "LADDER", 1, null);
        assertThatThrownBy(() -> catalog.load(List.of(row)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining(TitleCatalog.DEFAULT_TITLE_KEY);
    }
}
