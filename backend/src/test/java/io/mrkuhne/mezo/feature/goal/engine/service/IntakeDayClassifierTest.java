package io.mrkuhne.mezo.feature.goal.engine.service;

import static io.mrkuhne.mezo.feature.goal.engine.service.IntakeDayClassifier.Status.*;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntakeDayClassifierTest {

    static final LocalDate FROM = LocalDate.of(2026, 9, 7);

    /** 28 reference days at ~2950 before FROM, then the owner's real pattern. */
    static Map<LocalDate, Integer> history() {
        Map<LocalDate, Integer> m = new HashMap<>();
        for (int i = 1; i <= 28; i++) {
            m.put(FROM.minusDays(i), 2900 + (i % 3) * 50);
        }
        m.put(FROM, 604);             // 1 meal logged
        m.put(FROM.plusDays(1), 2980);
        m.put(FROM.plusDays(2), 1347); // 2 meals logged
        m.put(FROM.plusDays(3), 2100); // a lighter but real day (71 % of the norm)
        return m;
    }

    @Test
    void daysFarBelowTheUsersOwnNormAreSuspiciousNotLowIntake() {
        var s = IntakeDayClassifier.classify(FROM, FROM.plusDays(4), history(), Map.of(), 2900, 0.60, 28, 5);
        assertThat(s.get(FROM)).isEqualTo(SUSPICIOUS);
        assertThat(s.get(FROM.plusDays(1))).isEqualTo(USABLE);
        assertThat(s.get(FROM.plusDays(2))).isEqualTo(SUSPICIOUS);
        assertThat(s.get(FROM.plusDays(3))).isEqualTo(USABLE);
        assertThat(s.get(FROM.plusDays(4))).isEqualTo(UNLOGGED);
    }

    @Test
    void aUserMarkBeatsTheRuleBothWays() {
        var marks = Map.of(FROM, true, FROM.plusDays(1), false);
        var s = IntakeDayClassifier.classify(FROM, FROM.plusDays(1), history(), marks, 2900, 0.60, 28, 5);
        assertThat(s.get(FROM)).isEqualTo(USABLE);
        assertThat(s.get(FROM.plusDays(1))).isEqualTo(MARKED_INCOMPLETE);
    }

    @Test
    void withTooFewReferenceDaysTheFallbackReferenceIsUsed() {
        Map<LocalDate, Integer> m = Map.of(FROM, 1500, FROM.plusDays(1), 2000);
        var s = IntakeDayClassifier.classify(FROM, FROM.plusDays(1), m, Map.of(), 2900, 0.60, 28, 5);
        assertThat(s.get(FROM)).isEqualTo(SUSPICIOUS);   // 1500 < 0.6 × 2900
        assertThat(s.get(FROM.plusDays(1))).isEqualTo(USABLE);
    }
}
