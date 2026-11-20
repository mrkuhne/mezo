package io.mrkuhne.mezo.feature.penz.service.practice;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** L7 build notes call 3: the fixed eight, server-owned, in order. */
class PenzPracticeTagTest {

    @Test
    void testValues_shouldBeTheFixedEightInOrder() {
        assertThat(PracticeTag.values()).extracting(PracticeTag::key).containsExactly(
            "kitores", "visszateszt", "nyitasi_tartomany", "trend", "fordulo", "hirre", "korai_zaras",
            "terven_kivul");
        assertThat(PracticeTag.values()).extracting(PracticeTag::label).containsExactly(
            "Kitörés", "Visszateszt", "Nyitási tartomány", "Trend mentén", "Fordulóra", "Hírre ugrottam",
            "Korán zártam", "Eltértem a tervtől");
    }

    @Test
    void testOf_shouldFindByKey_andBeEmptyForUnknown() {
        assertThat(PracticeTag.of("hirre")).contains(PracticeTag.HIRRE);
        assertThat(PracticeTag.of("HIRRE")).isEmpty();
        assertThat(PracticeTag.of("fomo")).isEmpty();
        assertThat(PracticeTag.of(null)).isEmpty();
    }
}
