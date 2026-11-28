package io.mrkuhne.mezo.feature.train.service.sport;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.sport.SportMath.GymSession;
import io.mrkuhne.mezo.feature.train.service.sport.SportMath.GymSet;
import io.mrkuhne.mezo.feature.train.service.sport.SportMath.MuscleHeat;
import io.mrkuhne.mezo.feature.train.service.sport.SportMath.SportSession;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Golden fixture week (Boop Sport S2, mezo-r36n9.202): one leg day, one push day, two volleyball evenings (one with
 * no effort logged). Every number is hand-checked below; a change here changes what the phone draws.
 */
class SportMathTest {

    private static final LocalDate MON = LocalDate.of(2026, 11, 23);

    // Leg day, 60 min, 4 quad sets RIR 2 + 2 glute sets RIR 2 → RPE 8 → load 480; 80 per set
    private static final GymSession LEGS = new GymSession(MON, 60, List.of(
        new GymSet("quad", 2), new GymSet("quad", 2), new GymSet("quad", 2), new GymSet("quad", 2),
        new GymSet("glute", 2), new GymSet("glute", 2)));
    // Push day, 45 min, 3 chest sets RIR 1 + 2 shoulder-side sets RIR 3 → RPE (9·3 + 7·2)/5 = 8.2 → load 369
    private static final GymSession PUSH = new GymSession(MON.plusDays(2), 45, List.of(
        new GymSet("chest-mid", 1), new GymSet("chest-mid", 1), new GymSet("chest-mid", 1),
        new GymSet("shoulder-side", 3), new GymSet("shoulder-side", 3)));
    // Volleyball 90 min RPE 7 → load 630; shoulder 6
    private static final SportSession VB1 = new SportSession(MON.plusDays(1), "volleyball", new BigDecimal("7"),
        null, 90, 6);
    // Volleyball, no effort → unknown load, still counts for the shoulder (8)
    private static final SportSession VB2 = new SportSession(MON.plusDays(3), "volleyball", null, null, 90, 8);

    @Test
    void loadWeekSumsKnownLoadsAndCountsTheUnknown() {
        SportMath.LoadWeek w = SportMath.loadWeek(MON, List.of(LEGS, PUSH), List.of(VB1, VB2));
        assertThat(w).isEqualTo(new SportMath.LoadWeek(MON, 630, 480 + 369, 2, 2, 1, 0));
    }

    @Test
    void bodyHeatIsDeterministic() {
        List<MuscleHeat> heat = SportMath.body(List.of(LEGS, PUSH), List.of(VB1, VB2));
        // gym: quad 4·80 = 320, glute 160, chest-mid 3·73.8 = 221.4, shoulder-side 147.6
        // sport (630): shoulder-side 630, shoulder-front 504, quad 567, calf 567, glute 441, core 378, ham 252
        // together: quad 887 (top), shoulder-side 777.6, glute 601, calf 567, shoulder-front 504, core 378,
        //           ham 252, chest-mid 221.4
        assertThat(heat).extracting(MuscleHeat::muscle).containsExactly(
            "quad", "shoulder-side", "glute", "calf", "shoulder-front", "core", "ham", "chest-mid");
        assertThat(heat.get(0)).isEqualTo(new MuscleHeat("quad", 320, 567, 1.0, 0.9, 1.0));
        assertThat(heat.get(1)).isEqualTo(new MuscleHeat("shoulder-side", 148, 630, 0.46, 1.0, 0.88));
        assertThat(heat.get(2)).isEqualTo(new MuscleHeat("glute", 160, 441, 0.5, 0.7, 0.68));
        assertThat(heat.get(7)).isEqualTo(new MuscleHeat("chest-mid", 221, 0, 0.69, 0.0, 0.25));
        assertThat(SportMath.sportWithoutHeat(List.of(VB1, VB2))).isEqualTo(1);
        assertThat(SportMath.shoulderAverage(List.of(VB1, VB2))).isEqualByComparingTo("7.0");
    }

    @Test
    void aSetWithNoKnownMuscleTakesItsShareWithIt() {
        // 60 min, 4 sets RIR 2 → load 480 = 120 a set; the set with no muscle is not moved onto the quad
        GymSession g = new GymSession(MON, 60, List.of(
            new GymSet("quad", 2), new GymSet("quad", 2), new GymSet("quad", 2), new GymSet(null, 2)));
        assertThat(SportMath.body(List.of(g), List.of())).singleElement()
            .isEqualTo(new MuscleHeat("quad", 360, 0, 1.0, 0.0, 1.0));
    }

    @Test
    void otherSportAndAnEmptyWeekGiveNoHeat() {
        SportSession other = new SportSession(MON, "other", new BigDecimal("6"), null, 60, null);
        assertThat(SportMath.body(List.of(), List.of(other))).isEmpty();
        assertThat(SportMath.sportWithoutHeat(List.of(other))).isEqualTo(1);
        assertThat(SportMath.body(List.of(), List.of())).isEmpty();
        assertThat(SportMath.shoulderAverage(List.of())).isNull();
    }
}
