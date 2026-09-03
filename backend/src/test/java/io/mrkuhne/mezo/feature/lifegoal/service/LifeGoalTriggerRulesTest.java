package io.mrkuhne.mezo.feature.lifegoal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class LifeGoalTriggerRulesTest {

    @Test
    void matches_shouldFireOnAnyLoggedSportLoad_andStaySilentWithoutOne() {
        assertThat(LifeGoalTriggerRules.matches("sport_session_logged", null, BigDecimal.valueOf(45))).isTrue();
        assertThat(LifeGoalTriggerRules.matches("sport_session_logged", null, BigDecimal.ZERO)).isFalse();
        assertThat(LifeGoalTriggerRules.matches("sport_session_logged", null, null)).isFalse();
    }

    @Test
    void matches_shouldReadTheConditionAsTheEnergyThreshold() {
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "6", BigDecimal.valueOf(6))).isTrue();
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "6", BigDecimal.valueOf(7))).isFalse();
        // Nincs check-in aznap → nem tudjuk, hogy alacsony volt-e; nem tüzel.
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "4", null)).isFalse();
    }

    @Test
    void matches_shouldDefaultToFourOnlyWhenTheConditionIsAbsent_andNoFireWhenItIsUnparseable() {
        // NINCS condition → dokumentált 4-es alapérték.
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", null, BigDecimal.valueOf(4))).isTrue();
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", null, BigDecimal.valueOf(5))).isFalse();
        // VAN condition, de nem szám → néma. A 4-es fallback LAZÍTHATNA a szándékon ("<=2" → 4).
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "<=2", BigDecimal.ONE)).isFalse();
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "hat", BigDecimal.valueOf(3))).isFalse();
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "", BigDecimal.ONE)).isFalse();
    }

    @Test
    void planKey_shouldBeStableAcrossPositions_andDifferPerPlanContent() {
        String a = LifeGoalTriggerRules.planKey("ha edzés volt", "nyújts", "sport_session_logged");
        String b = LifeGoalTriggerRules.planKey("ha alacsony az energia", "sétálj", "checkin_energy_lte");

        // Ugyanaz a terv → ugyanaz a kulcs, akárhányadik a listában (a kulcs nem lát indexet).
        List<IfThenPlanJson> first = List.of(plan("ha edzés volt", "nyújts", "sport_session_logged"),
            plan("ha alacsony az energia", "sétálj", "checkin_energy_lte"));
        List<IfThenPlanJson> reordered = List.of(first.get(1), first.get(0));
        assertThat(keys(first)).containsExactly(a, b);
        assertThat(keys(reordered)).containsExactly(b, a);
        // Két különböző terv → két különböző kulcs.
        assertThat(a).isNotEqualTo(b);
        // 12 hex karakter, stabil alak.
        assertThat(a).hasSize(12).matches("[0-9a-f]{12}");
    }

    @Test
    void planKey_shouldTreatNullComponentsAsEmpty_andSeparateTheFields() {
        assertThat(LifeGoalTriggerRules.planKey(null, null, null))
            .isEqualTo(LifeGoalTriggerRules.planKey("", "", ""));
        // A mezők nem folynak egymásba: az "ab"+"c" nem ugyanaz, mint az "a"+"bc".
        assertThat(LifeGoalTriggerRules.planKey("ab", "c", "sport_session_logged"))
            .isNotEqualTo(LifeGoalTriggerRules.planKey("a", "bc", "sport_session_logged"));
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

    private static IfThenPlanJson plan(String ha, String akkor, String source) {
        return new IfThenPlanJson(ha, akkor, new PlanTriggerJson(source, null, 0));
    }

    private static List<String> keys(List<IfThenPlanJson> plans) {
        return plans.stream()
            .map(p -> LifeGoalTriggerRules.planKey(p.ha(), p.akkor(), p.trigger().source()))
            .toList();
    }
}
