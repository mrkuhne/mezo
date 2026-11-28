package io.mrkuhne.mezo.feature.train.service.sport;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Boop Sport S2 (mezo-r36n9.202): the interference rules extracted from the character detector. */
class SportInterferenceTest {

    private static final LocalDate D = LocalDate.of(2026, 11, 23);

    @Test
    void heavyIsShoulderSixOrRpeEight() {
        assertThat(SportInterference.heavy(6, null)).isTrue();
        assertThat(SportInterference.heavy(5, new BigDecimal("8"))).isTrue();
        assertThat(SportInterference.heavy(5, new BigDecimal("7.9"))).isFalse();
        assertThat(SportInterference.heavy(null, null)).isFalse();
    }

    @Test
    void declinePairsCountOnlyHeavyDaysFollowedByAOneRepShortfall() {
        List<SportInterference.SportDay> sport = List.of(
            new SportInterference.SportDay(D, 7, null),                     // heavy, next day −1.5 → pair
            new SportInterference.SportDay(D.plusDays(2), null, new BigDecimal("8")), // heavy, next day −0.5 → no
            new SportInterference.SportDay(D.plusDays(4), 3, new BigDecimal("6")));   // light → no
        Map<LocalDate, Double> deltas = Map.of(D.plusDays(1), -1.5, D.plusDays(3), -0.5, D.plusDays(5), -3.0);
        assertThat(SportInterference.declinePairs(sport, deltas)).isEqualTo(1);
    }

    @Test
    void gapVerdictUsesThreeAndSixHours() {
        assertThat(SportInterference.gapVerdict(2.5)).isEqualTo("TIGHT");
        assertThat(SportInterference.gapVerdict(3.0)).isEqualTo("SHORT");
        assertThat(SportInterference.gapVerdict(5.9)).isEqualTo("SHORT");
        assertThat(SportInterference.gapVerdict(6.0)).isNull();
        assertThat(SportInterference.gapVerdict(null)).isNull();
    }
}
