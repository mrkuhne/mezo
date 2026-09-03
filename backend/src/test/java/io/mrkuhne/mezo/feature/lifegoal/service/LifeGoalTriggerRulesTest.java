package io.mrkuhne.mezo.feature.lifegoal.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class LifeGoalTriggerRulesTest {

    @Test
    void matches_shouldFireOnAnyLoggedSportLoad_andStaySilentWithoutOne() {
        assertThat(LifeGoalTriggerRules.matches("sport_session_logged", null, BigDecimal.valueOf(45))).isTrue();
        assertThat(LifeGoalTriggerRules.matches("sport_session_logged", null, BigDecimal.ZERO)).isFalse();
        assertThat(LifeGoalTriggerRules.matches("sport_session_logged", null, null)).isFalse();
    }

    @Test
    void matches_shouldReadTheConditionAsTheEnergyThreshold_andFallBackToFour() {
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "6", BigDecimal.valueOf(6))).isTrue();
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "6", BigDecimal.valueOf(7))).isFalse();
        // Nincs/értelmezhetetlen condition → 4-es alapküszöb, nem néma és nem mindig-tüzelő.
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", null, BigDecimal.valueOf(4))).isTrue();
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "hat", BigDecimal.valueOf(5))).isFalse();
        // Nincs check-in aznap → nem tudjuk, hogy alacsony volt-e; nem tüzel.
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "4", null)).isFalse();
    }

    @Test
    void matches_shouldTreatAMissingOrZeroRitualAsAMiss() {
        assertThat(LifeGoalTriggerRules.matches("ritual_missed", null, null)).isTrue();
        assertThat(LifeGoalTriggerRules.matches("ritual_missed", null, BigDecimal.ZERO)).isTrue();
        assertThat(LifeGoalTriggerRules.matches("ritual_missed", null, BigDecimal.ONE)).isFalse();
    }

    @Test
    void matches_shouldNeverFireForAnUnknownSource() {
        assertThat(LifeGoalTriggerRules.matches("made_up_signal", null, BigDecimal.TEN)).isFalse();
        assertThat(LifeGoalTriggerRules.matches(null, null, BigDecimal.TEN)).isFalse();
        assertThat(LifeGoalTriggerRules.sourceFor("made_up_signal")).isEmpty();
    }

    @Test
    void sourceFor_shouldMapEachKnownTriggerToItsMetricSignal() {
        assertThat(LifeGoalTriggerRules.sourceFor("sport_session_logged")).get()
            .extracting(s -> s.type() + ":" + s.key()).isEqualTo("metric:SPORT_LOAD_MIN");
        assertThat(LifeGoalTriggerRules.sourceFor("checkin_energy_lte")).get()
            .extracting(s -> s.type() + ":" + s.key()).isEqualTo("metric:CHECKIN_ENERGY");
        assertThat(LifeGoalTriggerRules.sourceFor("ritual_missed")).get()
            .extracting(s -> s.type() + ":" + s.key()).isEqualTo("metric:RITUAL_CLOSED");
    }
}
