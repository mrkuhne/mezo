package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ComebackRampTest {

    @ParameterizedTest(name = "lightenedSets({0}) -> {1}")
    @CsvSource({
        "1, 1",
        "2, 1",
        "3, 2",
        "4, 3",
        "5, 3",
        "6, 4",
    })
    void lightenedSets_returnsCorrectCount(int sets, int expectedLightened) {
        int result = ComebackRamp.lightenedSets(sets);

        assertThat(result).isEqualTo(expectedLightened);
    }

    @ParameterizedTest(name = "rirFloor(null) -> 3, rirFloor({0}) -> {1}")
    @CsvSource({
        "1, 3",
        "3, 3",
        "4, 4",
        "5, 5",
    })
    void rirFloor_returnsCorrectFloor(Integer targetRir, int expectedFloor) {
        int result = ComebackRamp.rirFloor(targetRir);

        assertThat(result).isEqualTo(expectedFloor);
    }

    @ParameterizedTest(name = "rirFloor(null) -> 3")
    @CsvSource({
        "null",
    })
    void rirFloor_null_returns3(String nullStr) {
        Integer result = ComebackRamp.rirFloor(null);

        assertThat(result).isEqualTo(3);
    }

    void loadFactor_is090() {
        assertThat(ComebackRamp.LOAD_FACTOR).isEqualTo(new BigDecimal("0.90"));
    }
}
