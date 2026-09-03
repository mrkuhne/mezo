package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MesoPlanMergerTest {

    static final List<MesoPlanFiller.Candidate> CATALOG = MesoPlanFillerTest.CATALOG;
    static final MesoPlanProperties PROPS = MesoPlanFillerTest.PROPS;

    static MesoPlanFiller.Candidate byName(String n) {
        return CATALOG.stream().filter(c -> c.name().equals(n)).findFirst().orElseThrow();
    }

    @Test
    void merge_shouldHonorLlmPickInsideFrame_andRenormalizeSets() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of("back", "emphasize"), MesoPlanSkeletonTest.RP);
        var det = MesoPlanFiller.fill(s, CATALOG, PROPS);
        var sug = new MesoPlanLlm.Suggestion("teszt", List.of(
            new MesoPlanLlm.DayPick("Hét", List.of(new MesoPlanLlm.ExercisePick(byName("Pullover").id(), 99)))));

        var result = MesoPlanMerger.merge(s, det, sug, CATALOG, PROPS);
        var merged = result.days();

        var monBack = merged.get(0).picks().stream().filter(p -> p.candidate().group().equals("back")).toList();
        assertThat(monBack).extracting(p -> p.candidate().name()).containsExactly("Pullover");
        assertThat(monBack.get(0).workingSets()).isEqualTo(6); // the frame's 6, not the LLM's 99
        // other groups on Hét untouched (deterministic)
        assertThat(merged.get(0).picks().stream().filter(p -> p.candidate().group().equals("chest")).toList())
            .extracting(p -> p.candidate().name()).containsExactly("Bench");
        assertThat(result.appliedPicks()).isEqualTo(1);
    }

    @Test
    void merge_shouldIgnoreUnknownIdsWrongGroupsAndRestDays() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of(), MesoPlanSkeletonTest.RP);
        var det = MesoPlanFiller.fill(s, CATALOG, PROPS);
        var sug = new MesoPlanLlm.Suggestion("x", List.of(
            new MesoPlanLlm.DayPick("Hét", List.of(new MesoPlanLlm.ExercisePick(UUID.randomUUID(), 3))),
            new MesoPlanLlm.DayPick("Kedd", List.of(new MesoPlanLlm.ExercisePick(byName("Bench").id(), 3))),
            new MesoPlanLlm.DayPick("Sze", List.of(new MesoPlanLlm.ExercisePick(byName("Bench").id(), 3)))));

        var result = MesoPlanMerger.merge(s, det, sug, CATALOG, PROPS);

        assertThat(result.days()).isEqualTo(det);
        assertThat(result.appliedPicks()).isEqualTo(0);
    }

    @Test
    void merge_shouldCapPicksPerGroup_whenLlmSendsTooMany() {
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of("back", "emphasize"), MesoPlanSkeletonTest.RP);
        var det = MesoPlanFiller.fill(s, CATALOG, PROPS);
        var sug = new MesoPlanLlm.Suggestion("x", List.of(new MesoPlanLlm.DayPick("Hét", List.of(
            new MesoPlanLlm.ExercisePick(byName("Row").id(), 2),
            new MesoPlanLlm.ExercisePick(byName("Pulldown").id(), 2),
            new MesoPlanLlm.ExercisePick(byName("Pullover").id(), 2)))));

        var result = MesoPlanMerger.merge(s, det, sug, CATALOG, PROPS);
        var merged = result.days();

        var monBack = merged.get(0).picks().stream().filter(p -> p.candidate().group().equals("back")).toList();
        assertThat(monBack).hasSize(2);
        assertThat(monBack).extracting(MesoPlanFiller.Pick::workingSets).containsExactly(3, 3);
        assertThat(result.appliedPicks()).isEqualTo(1);
    }

    @Test
    void merge_shouldCapAtOnePick_whenFrameHasFewerThanSixSets() {
        // "Kedd" is Rest in this 4-day split, use a day/group combo with < 6 sets: chest on Hét
        // in a plain (no priorities) build gets 4 sets (8 MEV / 2 chest days).
        var s = MesoPlanSkeleton.build(List.of("Hét", "Sze", "Pén", "Szo"), 6, Map.of(), MesoPlanSkeletonTest.RP);
        var det = MesoPlanFiller.fill(s, CATALOG, PROPS);
        var sug = new MesoPlanLlm.Suggestion("x", List.of(new MesoPlanLlm.DayPick("Hét", List.of(
            new MesoPlanLlm.ExercisePick(byName("Bench").id(), 2),
            new MesoPlanLlm.ExercisePick(byName("Fly").id(), 2)))));

        var result = MesoPlanMerger.merge(s, det, sug, CATALOG, PROPS);
        var merged = result.days();

        var monChest = merged.get(0).picks().stream().filter(p -> p.candidate().group().equals("chest")).toList();
        assertThat(monChest).extracting(p -> p.candidate().name()).containsExactly("Bench");
        assertThat(monChest.get(0).workingSets()).isEqualTo(4);
        assertThat(result.appliedPicks()).isEqualTo(1);
    }
}
