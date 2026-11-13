package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.pantry.service.CatalogAllergenDefaults;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * The derivation rules of mezo-r36n9.48, checked against the owner's OWN catalog names (invented
 * values nowhere — these are the shelf labels the live rows carry).
 */
class CatalogAllergenDefaultsTest {

    @ParameterizedTest
    @CsvSource({
        // the shelf alone settles these two
        "fish,          'Atlanti tőkehal, nyers',                        fish",
        "fish,          'Fekete tőkehal filé, nyers',                    fish",
        "fish,          'Pangasius filé, nyers',                         fish",
        "fish,          'Tonhal sós lében',                              fish",
        "eggs,          'Tojás',                                         eggs",
        "eggs,          'Tojásfehérje, nyers',                           eggs",
        // dairy / cheese default to milk...
        "dairy,         'Skyr natúr',                                    milk",
        "dairy,         'Laktózmentes joghurt Lidl',                     milk",
        "cheese,        'Laktózmentes túró Lidl',                        milk",
        "cheese,        'Parmeggiano Regiano Lidl',                      milk",
        // ...except the plant drinks that share that shelf
        "dairy,         'Mandulaital',                                   nuts",
        "dairy,         'Almond Milk',                                   nuts",
        "dairy,         'Szójaital',                                     soybeans",
        "dairy,         'Lidl magas fehérjetartalmú szójaital',          soybeans",
        "dairy,         'Soy Milk High Protein LM Lidl',                 soybeans",
        // the nuts_seeds shelf carries three different keys
        "nuts_seeds,    'Házi mogyoróvaj',                               peanuts",
        "nuts_seeds,    'Peanut Butter ProteinCo',                       peanuts",
        "nuts_seeds,    'Mogyoróvaj por',                                peanuts",
        "nuts_seeds,    'Szezámmag',                                     sesame",
        "nuts_seeds,    'Nyers kesudió',                                 nuts",
        "nuts_seeds,    'Pörkölt kesudió',                               nuts",
        "nuts_seeds,    'Pekándió',                                      nuts",
        "nuts_seeds,    'Pecans',                                        nuts",
        "nuts_seeds,    'Cashew Nuts Roasted',                           nuts",
    })
    void derivesTheKeyTheShelfAndNameSettle(String category, String name, String expectedKey) {
        assertThat(CatalogAllergenDefaults.derive(category, name))
            .containsExactly(org.assertj.core.api.Assertions.entry(expectedKey, AllergenState.CONTAINS));
    }

    @ParameterizedTest
    @CsvSource({
        // coconut is not an EU-14 allergen, and it sits on the dairy shelf: say nothing
        "dairy,         'Lidl light kókusztej'",
        "dairy,         'Coconut Milk Light Lidl'",
        // "mag" does not say which seed; chia and poppy are not EU-14 keys
        "nuts_seeds,    'Lidl magkeverék'",
        "nuts_seeds,    'Mag Mix Lidl'",
        "nuts_seeds,    'Chiamag'",
        "nuts_seeds,    'Chia Seeds'",
        // shelves the category says nothing reliable about
        "snacks,        'Protein szelet'",
        "condiments,    'Majonéz'",
        "vegetables,    'Spenót, nyers'",
        "meat,          'Csirkemell, nyers'",
        "supplement,    'Kreatin monohidrát'",
    })
    void staysSilentWhereNothingIsCertain(String category, String name) {
        assertThat(CatalogAllergenDefaults.derive(category, name)).isEmpty();
    }

    @Test
    void neverAssertsTheAbsenceOfAnything() {
        // The derived map only ever carries CONTAINS: no key is written as "free of".
        assertThat(CatalogAllergenDefaults.derive("fish", "Tilápia, nyers").values())
            .containsOnly(AllergenState.CONTAINS);
        assertThat(CatalogAllergenDefaults.derive(null, "Tojás")).isEmpty();
        assertThat(CatalogAllergenDefaults.derive("fish", null))
            .containsEntry("fish", AllergenState.CONTAINS);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "Laktózmentes túró Lidl",
        "Laktózmentes mozzarella Lidl",
        "Sajt Szeleteltt Laktózmentes Sissy",
        "Mili Laktózmentes natúr joghurt",
        "Lidl laktózmentes, magas fehérjetartalmú epres joghurt",
        "Quark LM Lidl",
        "Tejföl LM",
        "Cottage Cheese LM Lidl",
        "Cooking Cream Milbona LM",
        "Lactose Free Milk",
    })
    void recognisesTheOwnersLactoseFreeProducts(String name) {
        assertThat(CatalogAllergenDefaults.isLactoseFree(name)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "Skyr natúr",
        "Görög joghurt",
        "Cheddar sajt",
        "Túró rögös zsír szegény",
        "Szeletelt gouda zsíros, félkemény sajt",
    })
    void doesNotInventALactoseFreeMarking(String name) {
        assertThat(CatalogAllergenDefaults.isLactoseFree(name)).isFalse();
    }

    @Test
    void anUnnamedRowIsNotLactoseFree() {
        assertThat(CatalogAllergenDefaults.isLactoseFree(null)).isFalse();
    }
}
