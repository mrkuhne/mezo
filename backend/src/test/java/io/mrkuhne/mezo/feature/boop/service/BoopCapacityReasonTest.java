package io.mrkuhne.mezo.feature.boop.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BoopCapacityReasonTest {

    private static final String FACTS = "Rövid az alvás (6,5 óra) és 3 megbeszélés van.";

    @Test
    void inventedNumberFallsBackToRuleReason() {
        assertThat(BoopVerdictWriter.acceptReason("Csak 4 óra alvás után ez sok lesz.", FACTS)).isEqualTo(FACTS);
    }

    @Test
    void rephraseWithOnlyGivenNumbersIsKept() {
        String model = "A 3 megbeszélés és a 6,5 óra alvás miatt sűrű a nap.";
        assertThat(BoopVerdictWriter.acceptReason(model, FACTS)).isEqualTo(model);
    }

    @Test
    void blankOrMissingReasonUsesRuleReason() {
        assertThat(BoopVerdictWriter.acceptReason(null, FACTS)).isEqualTo(FACTS);
        assertThat(BoopVerdictWriter.acceptReason("  ", FACTS)).isEqualTo(FACTS);
    }

    @Test
    void numberlessReasonOverNumberlessFactsIsKept() {
        assertThat(BoopVerdictWriter.acceptReason("Könnyű nap.", "")).isEqualTo("Könnyű nap.");
        assertThat(BoopVerdictWriter.acceptReason("Ma 2 dolog van.", "")).isEqualTo("");
    }
}
