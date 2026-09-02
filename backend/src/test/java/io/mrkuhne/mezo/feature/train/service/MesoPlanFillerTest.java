package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MesoPlanFillerTest {

    static final MesoPlanProperties PROPS = new MesoPlanProperties(8, 2, 2, 8, 10, 12, 15, 1, 2, 1);
    static final Map<String, VolumeProperties.Baseline> RP = MesoPlanSkeletonTest.RP;

    static MesoPlanFiller.Candidate c(String name, String zone, String type, double stim) {
        return new MesoPlanFiller.Candidate(UUID.randomUUID(), name, zone, MuscleGroup.of(zone), type, stim, 0.5);
    }

    static final List<MesoPlanFiller.Candidate> CATALOG = List.of(
        c("Row", "back-mid", "compound", 0.9), c("Pulldown", "back-wide", "compound", 0.8),
        c("Pullover", "back-wide", "isolation", 0.6), c("Shrug", "traps", "isolation", 0.4),
        c("Bench", "chest-mid", "compound", 0.9), c("Fly", "chest-mid", "isolation", 0.6),
        c("OHP", "shoulder-front", "compound", 0.8), c("Lateral raise", "shoulder-side", "isolation", 0.7),
        c("Curl", "biceps-short", "isolation", 0.6), c("Pushdown", "triceps-lateral", "isolation", 0.6),
        c("Squat", "quad", "compound", 0.9), c("Leg press", "quad", "compound", 0.8),
        c("RDL", "ham", "compound", 0.8), c("Hip thrust", "glute", "compound", 0.8),
        c("Calf raise", "calf", "isolation", 0.6));

    @Test
    void fillGroup_shouldPickTwoCompoundFirst_whenSixOrMoreSets() {
        var picks = MesoPlanFiller.fillGroup("back", 6, CATALOG, 0, PROPS);
        assertThat(picks).extracting(p -> p.candidate().name()).containsExactly("Row", "Pulldown");
        assertThat(picks).extracting(MesoPlanFiller.Pick::workingSets).containsExactly(3, 3);
    }

    @Test
    void fillGroup_shouldPickOne_whenFewerThanSixSets() {
        var picks = MesoPlanFiller.fillGroup("chest", 4, CATALOG, 0, PROPS);
        assertThat(picks).hasSize(1);
        assertThat(picks.get(0).candidate().name()).isEqualTo("Bench");
        assertThat(picks.get(0).workingSets()).isEqualTo(4);
    }

    @Test
    void fillGroup_shouldRotateOnSecondOccurrence_whenCatalogIsDeepEnough() {
        var second = MesoPlanFiller.fillGroup("back", 6, CATALOG, 1, PROPS);
        assertThat(second).extracting(p -> p.candidate().name()).containsExactly("Pullover", "Shrug");
    }

    @Test
    void fillGroup_shouldGiveRemainderToFirstPick_whenOdd() {
        var picks = MesoPlanFiller.fillGroup("back", 7, CATALOG, 0, PROPS);
        assertThat(picks).extracting(MesoPlanFiller.Pick::workingSets).containsExactly(4, 3);
    }

    @Test
    void fillGroup_shouldReturnEmpty_whenNoCandidateForGroup() {
        assertThat(MesoPlanFiller.fillGroup("calf", 3, List.of(), 0, PROPS)).isEmpty();
    }

    @Test
    void fill_shouldCoverEveryFrameSetExactly_whenCatalogCoversAllGroups() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of("back", "emphasize"), RP);
        var days = MesoPlanFiller.fill(s, CATALOG, PROPS);
        assertThat(days).hasSize(7);
        for (int i = 0; i < 7; i++) {
            var frame = s.days().get(i);
            var filled = days.get(i);
            assertThat(filled.day()).isEqualTo(frame.day());
            for (var m : frame.muscles()) {
                int got = filled.picks().stream().filter(p -> p.candidate().group().equals(m.group()))
                    .mapToInt(MesoPlanFiller.Pick::workingSets).sum();
                assertThat(got).as("%s %s", frame.day(), m.group()).isEqualTo(m.sets());
            }
        }
        assertThat(days.get(1).picks()).isEmpty(); // Kedd = Rest
    }
}
