package io.mrkuhne.mezo.feature.companion.reflection.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ObservationLeadTest {

    @Test
    void stripsTheRecoveryMetaLeadAndCapitalizes() {
        assertThat(ObservationLead.strip("Korábbi bejegyzésekhez visszatérve: két azonos, 120 perces röplabdanapon…"))
                .isEqualTo("Két azonos, 120 perces röplabdanapon…");
        assertThat(ObservationLead.strip("Visszatérve a korábbi bejegyzésekhez, szeptember 22-én a randi mellett…"))
                .isEqualTo("Szeptember 22-én a randi mellett…");
        assertThat(ObservationLead.strip("A korábbi feljegyzésekre visszatekintve: hétfőn fáradtabb vagy."))
                .isEqualTo("Hétfőn fáradtabb vagy.");
    }

    @Test
    void leavesOrdinarySentencesAlone() {
        String plain = "Amikor Anna szerepel a hála-naplódban, másnap többet alszol.";
        assertThat(ObservationLead.strip(plain)).isSameAs(plain);
        String mid = "Hétfőn, a korábbi bejegyzésekhez visszatérve: fáradtabb vagy.";
        assertThat(ObservationLead.strip(mid)).isSameAs(mid);
        assertThat(ObservationLead.strip(null)).isNull();
        assertThat(ObservationLead.strip("Korábbi bejegyzésekhez visszatérve:")).isEqualTo("Korábbi bejegyzésekhez visszatérve:");
    }
}
