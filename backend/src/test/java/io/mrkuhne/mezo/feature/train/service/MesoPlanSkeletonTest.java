package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MesoPlanSkeletonTest {

    static final Map<String, VolumeProperties.Baseline> RP = Map.of(
        "chest", new VolumeProperties.Baseline(8, 14, 20),
        "back", new VolumeProperties.Baseline(10, 16, 22),
        "shoulder", new VolumeProperties.Baseline(8, 12, 18),
        "biceps", new VolumeProperties.Baseline(6, 10, 14),
        "triceps", new VolumeProperties.Baseline(6, 10, 14),
        "quad", new VolumeProperties.Baseline(8, 12, 18),
        "ham", new VolumeProperties.Baseline(6, 10, 14),
        "glute", new VolumeProperties.Baseline(8, 12, 18),
        "calf", new VolumeProperties.Baseline(6, 10, 16));

    @Test
    void build_shouldDeriveUpperLower_whenFourDays() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of(), RP);
        assertThat(s.splitLabel()).isEqualTo("Upper / Lower · 4×/hét");
        assertThat(s.days()).hasSize(7);
        assertThat(s.days()).extracting(MesoPlanSkeleton.DayFrame::type)
            .containsExactly("Upper", "Rest", "Lower", "Rest", "Upper", "Lower", "Rest");
    }

    @Test
    void build_shouldDeriveSplitByDayCount_whenTwoToSixDays() {
        assertThat(MesoPlanSkeleton.build(List.of("Hét", "Csü"), 6, Map.of(), RP).splitLabel()).isEqualTo("Full body · 2×/hét");
        assertThat(MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén"), 6, Map.of(), RP).splitLabel()).isEqualTo("Full body · 3×/hét");
        assertThat(MesoPlanSkeleton.build(List.of("Hét", "Kedd", "Sze", "Pén", "Szo"), 6, Map.of(), RP).splitLabel()).isEqualTo("Upper / Lower / Push / Pull / Legs · 5×/hét");
        assertThat(MesoPlanSkeleton.build(List.of("Hét", "Kedd", "Sze", "Pén", "Szo", "Vas"), 6, Map.of(), RP).splitLabel()).isEqualTo("Push / Pull / Legs ×2 · 6×/hét");
    }

    @Test
    void build_shouldStartEmphasizeAtMevPlusTwoAndCeilAtMrv_whenPrioritiesGiven() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6,
            Map.of("back", "emphasize", "calf", "maintain"), RP);
        assertThat(s.weekOneSets()).containsEntry("back", 12).containsEntry("chest", 8).containsEntry("calf", 6);
        assertThat(s.ceilings()).containsEntry("back", 22).containsEntry("chest", 14).containsEntry("calf", 6);
    }

    @Test
    void build_shouldSpreadWeeklySetsAcrossDays_withRemainderOnEarliestDay() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of("back", "emphasize"), RP);
        var upperDays = s.days().stream().filter(d -> d.type().equals("Upper")).toList();
        assertThat(upperDays).hasSize(2);
        assertThat(setsOf(upperDays.get(0), "back") + setsOf(upperDays.get(1), "back")).isEqualTo(12);
        // shoulder 8 / 2 = 4 each; biceps 6 / 2 = 3 each
        assertThat(setsOf(upperDays.get(0), "shoulder")).isEqualTo(4);
        assertThat(setsOf(upperDays.get(0), "biceps")).isEqualTo(3);
    }

    @Test
    void build_shouldTrainEveryGroupAtLeastTwiceAWeek_forEveryDayCount() {
        for (int n = 2; n <= 6; n++) {
            var s = MesoPlanSkeleton.build(MesoPlanSkeleton.DAY_ORDER.subList(0, n), 6, Map.of(), RP);
            for (String g : RP.keySet()) {
                assertThat(MesoPlanSkeleton.frequencyOf(s, g)).as("%d days, %s", n, g).isGreaterThanOrEqualTo(2);
            }
        }
    }

    @Test
    void build_shouldKeepEveryFrameUnderSessionCapOfEight_forEveryDayCount() {
        for (int n = 2; n <= 6; n++) {
            var s = MesoPlanSkeleton.build(MesoPlanSkeleton.DAY_ORDER.subList(0, n), 6,
                Map.of("back", "emphasize", "quad", "emphasize"), RP);
            s.days().forEach(d -> d.muscles().forEach(m -> assertThat(m.sets()).isBetween(1, 8)));
        }
    }

    @Test
    void phaseCurve_shouldRampThenDeload() {
        assertThat(MesoPlanSkeleton.phaseCurve(6)).containsExactly("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");
        assertThat(MesoPlanSkeleton.phaseCurve(4)).containsExactly("MEV", "MAV", "MRV", "Deload");
        assertThat(MesoPlanSkeleton.phaseCurve(8)).containsExactly("MEV", "MEV", "MAV", "MAV", "MAV", "MAV", "MRV", "Deload");
    }

    @Test
    void build_shouldIgnoreUnknownGroupsInPriorities() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Csü"), 6, Map.of("core", "emphasize"), RP);
        assertThat(s.weekOneSets()).doesNotContainKey("core");
    }

    private static int setsOf(MesoPlanSkeleton.DayFrame d, String group) {
        return d.muscles().stream().filter(m -> m.group().equals(group)).mapToInt(MesoPlanSkeleton.MuscleFrame::sets).sum();
    }
}
