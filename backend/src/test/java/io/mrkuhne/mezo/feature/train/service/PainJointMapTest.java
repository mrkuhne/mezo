package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class PainJointMapTest {

    @Test
    void joints_shouldMapEveryLoadBearingRegion() {
        assertThat(PainJointMap.joints(List.of("VALL", "KONYOK", "CSUKLO_KEZ", "DEREK", "CSIPO", "TERD", "BOKA_LABFEJ")))
            .containsExactlyInAnyOrder("shoulder", "elbow", "wrist", "lower-back", "hip", "knee", "ankle");
    }

    @Test
    void joints_shouldIgnoreUnknownAndUnloadedRegions() {
        assertThat(PainJointMap.joints(Arrays.asList("FEJ", "FELSO_HAT", "NOT_A_REGION", null, "TERD")))
            .containsExactly("knee");
        assertThat(PainJointMap.joints(List.of("FEJ"))).isEmpty();
        assertThat(PainJointMap.joints(null)).isEmpty();
    }
}
