package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CapacityDayServiceTest {

    @Test
    void heavyLabelMatchesWholeWordsOnly() {
        assertThat(CapacityDayService.heavyLabel("Láb nap")).isTrue();
        assertThat(CapacityDayService.heavyLabel("Leg day")).isTrue();
        assertThat(CapacityDayService.heavyLabel("Alsótest")).isTrue();
        assertThat(CapacityDayService.heavyLabel("Guggolás")).isTrue();
        assertThat(CapacityDayService.heavyLabel("Lower A")).isTrue();
        assertThat(CapacityDayService.heavyLabel("Labda")).isFalse();
        assertThat(CapacityDayService.heavyLabel("Kosárlabda")).isFalse();
        assertThat(CapacityDayService.heavyLabel("Legjobb felsőtest")).isFalse();
        assertThat(CapacityDayService.heavyLabel(null)).isFalse();
    }
}
