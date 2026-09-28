package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Check-in 2.0 pain region → muscle group map (mezo-ck2, spec 2026-09-27 §3.3). */
class PainRegionMapTest {

    @Test
    void testGroups_shouldMapEveryTrainingRegion_whenLookedUp() {
        assertThat(PainRegionMap.groups("VALL")).containsExactly("shoulder");
        assertThat(PainRegionMap.groups("KONYOK")).containsExactlyInAnyOrder("biceps", "triceps");
        // No forearm group in the coarse taxonomy → the grip arm groups.
        assertThat(PainRegionMap.groups("CSUKLO_KEZ")).containsExactlyInAnyOrder("biceps", "triceps");
        assertThat(PainRegionMap.groups("FELSO_HAT")).containsExactly("back");
        assertThat(PainRegionMap.groups("DEREK")).containsExactlyInAnyOrder("back", "core");
        assertThat(PainRegionMap.groups("CSIPO")).containsExactly("glute");
        assertThat(PainRegionMap.groups("TERD")).containsExactlyInAnyOrder("quad", "ham");
        assertThat(PainRegionMap.groups("BOKA_LABFEJ")).containsExactly("calf");
    }

    @Test
    void testGroups_shouldBeEmpty_whenRegionHasNoTrainingLoad() {
        assertThat(PainRegionMap.groups("FEJ")).isEmpty();
        assertThat(PainRegionMap.groups("NYAK")).isEmpty();
        assertThat(PainRegionMap.groups("HAS")).isEmpty();
        assertThat(PainRegionMap.groups("EGYEB")).isEmpty();
        assertThat(PainRegionMap.groups(null)).isEmpty();
    }

    @Test
    void testGroups_shouldOnlyKnowRealPainRegions_always() {
        List<String> known = java.util.Arrays.stream(PainRegion.values()).map(Enum::name).toList();
        for (String region : List.of("VALL", "KONYOK", "CSUKLO_KEZ", "FELSO_HAT", "DEREK", "CSIPO", "TERD", "BOKA_LABFEJ")) {
            assertThat(known).contains(region);
        }
    }

    @Test
    void testFirstLoading_shouldCollapseZoneTokens_whenExerciseLoadsRegion() {
        assertThat(PainRegionMap.firstLoading(List.of("VALL"), "shoulder-rear")).isEqualTo("VALL");
        assertThat(PainRegionMap.firstLoading(List.of("TERD"), "quad")).isEqualTo("TERD");
        assertThat(PainRegionMap.firstLoading(List.of("TERD"), "ham")).isEqualTo("TERD");
        assertThat(PainRegionMap.firstLoading(List.of("FELSO_HAT"), "traps")).isEqualTo("FELSO_HAT");
        // Report order wins when two regions load the same group.
        assertThat(PainRegionMap.firstLoading(List.of("DEREK", "FELSO_HAT"), "back-wide")).isEqualTo("DEREK");
        assertThat(PainRegionMap.firstLoading(List.of("KONYOK"), "biceps-long")).isEqualTo("KONYOK");
    }

    @Test
    void testFirstLoading_shouldReturnNull_whenNoRegionLoadsTheExercise() {
        assertThat(PainRegionMap.firstLoading(List.of("VALL"), "back-wide")).isNull();
        assertThat(PainRegionMap.firstLoading(List.of(), "quad")).isNull();
        assertThat(PainRegionMap.firstLoading(List.of("TERD"), null)).isNull();
    }

    @Test
    void testPossessive_shouldGiveTheCardPhrase_whenRegionKnown() {
        assertThat(PainRegionMap.possessive("VALL")).isEqualTo("vállad");
        assertThat(PainRegionMap.possessive("TERD")).isEqualTo("térded");
        assertThat(PainRegionMap.possessive("DEREK")).isEqualTo("derekad");
        assertThat(PainRegionMap.possessive("FELSO_HAT")).isEqualTo("felső hátad");
    }
}
