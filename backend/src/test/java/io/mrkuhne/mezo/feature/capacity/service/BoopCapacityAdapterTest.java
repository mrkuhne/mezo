package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BoopCapacityAdapterTest {

    @Test
    void verdictMappingIsTotal() {
        assertThat(BoopCapacityAdapter.verdict("túl sok")).isEqualTo("tulSok");
        assertThat(BoopCapacityAdapter.verdict("laza")).isEqualTo("laza");
        assertThat(BoopCapacityAdapter.verdict("rendben")).isEqualTo("rendben");
        assertThat(BoopCapacityAdapter.verdict("szoros")).isEqualTo("szoros");
        assertThat(BoopCapacityAdapter.verdict("valami más")).isNull();
        assertThat(BoopCapacityAdapter.verdict(null)).isNull();
    }
}
