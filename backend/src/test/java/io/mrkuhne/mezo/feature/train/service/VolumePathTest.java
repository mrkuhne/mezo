package io.mrkuhne.mezo.feature.train.service;

import static io.mrkuhne.mezo.feature.train.service.PriorityTier.EMPHASIZE;
import static io.mrkuhne.mezo.feature.train.service.PriorityTier.GROW;
import static io.mrkuhne.mezo.feature.train.service.PriorityTier.MAINTAIN;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.VolumeBands.Band;
import io.mrkuhne.mezo.feature.train.service.VolumePath.Exercise;
import io.mrkuhne.mezo.feature.train.service.VolumePath.Group;
import io.mrkuhne.mezo.feature.train.service.VolumePath.Input;
import io.mrkuhne.mezo.feature.train.service.VolumePath.Week;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class VolumePathTest {

    private static final List<String> SIX = List.of("MEV", "MAV", "MAV", "MAV", "MAV", "Deload");

    private static Exercise ex(String key, int day, int sets) {
        return new Exercise(key, "back", day, sets);
    }

    /** Four exercises on four days, 10 sets in total. */
    private static List<Exercise> backTen() {
        return List.of(ex("a", 0, 3), ex("b", 1, 3), ex("c", 2, 2), ex("d", 3, 2));
    }

    private static Input input(int weeks, List<String> curve, int from, List<Exercise> amounts,
                               Map<String, Integer> restore, Group group, boolean deficit) {
        return new Input(weeks, curve, from, amounts, restore, Map.of("back", group), deficit, 2, 1, 1,
            new BigDecimal("0.5"), 5, 8);
    }

    private static List<Integer> totals(List<Week> weeks) {
        return weeks.stream().map(Week::total).toList();
    }

    @Test void growRampsByOneUpToTheTopAndTheDeloadHalves() {
        List<Week> w = VolumePath.project(input(6, SIX, 1, backTen(), Map.of(),
            new Group(GROW, new Band(10, 16, 22, false)), false));
        assertThat(totals(w)).containsExactly(10, 11, 12, 13, 14, 8);   // 4+4+3+3 halves to 2 each
        assertThat(w.get(5).phase()).isEqualTo("Deload");
        assertThat(w.get(0).week()).isEqualTo(1);
    }

    @Test void emphasizeRampsByTwoAndDeficitSlowsIt() {
        Group g = new Group(EMPHASIZE, new Band(10, 22, 22, false));
        List<String> curve = List.of("MEV", "MAV", "MAV", "MAV");
        assertThat(totals(VolumePath.project(input(4, curve, 1, backTen(), Map.of(), g, false))))
            .containsExactly(10, 12, 14, 16);
        assertThat(totals(VolumePath.project(input(4, curve, 1, backTen(), Map.of(), g, true))))
            .containsExactly(10, 11, 12, 13);
    }

    @Test void maintainNeverMoves() {
        Group g = new Group(MAINTAIN, new Band(4, 9, 22, false));
        assertThat(totals(VolumePath.project(input(4, List.of("MEV", "MAV", "MAV", "MAV"), 1, backTen(),
            Map.of(), g, false)))).containsExactly(10, 10, 10, 10);
    }

    @Test void deloadHalvesPerExerciseAndTheWeekAfterRestoresThenSteps() {
        List<String> curve = List.of("MEV", "MAV", "MAV", "Deload", "MEV", "MAV", "MAV", "MAV");
        List<Week> w = VolumePath.project(input(8, curve, 1, backTen(), Map.of(),
            new Group(GROW, new Band(10, 16, 22, false)), false));
        // 10 11 12 | deload ceil each of (3,3,3,3)->(2,2,2,2)=8 | restore 12 then +1 = 13 | 14 15 16
        assertThat(totals(w)).containsExactly(10, 11, 12, 8, 13, 14, 15, 16);
    }

    @Test void restoreAtTheTopHolds() {
        List<String> curve = List.of("Deload", "MEV", "MAV");
        List<Exercise> halved = List.of(ex("a", 0, 2), ex("b", 1, 2), ex("c", 2, 2), ex("d", 3, 2));
        List<Week> w = VolumePath.project(input(3, curve, 1, halved, Map.of("a", 4, "b", 4, "c", 4, "d", 4),
            new Group(GROW, new Band(10, 16, 22, false)), false));
        // restored 16 = high -> holds
        assertThat(totals(w)).containsExactly(8, 16, 16);
    }

    @Test void fromADeloadWeekRestoresFromRestoreTo() {
        List<String> curve = List.of("MEV", "MAV", "Deload", "MEV", "MAV");
        List<Exercise> halved = List.of(ex("a", 0, 2), ex("b", 1, 2), ex("c", 2, 1), ex("d", 3, 1));
        List<Week> w = VolumePath.project(input(5, curve, 3, halved, Map.of("a", 4, "b", 3, "c", 3, "d", 2),
            new Group(GROW, new Band(10, 16, 22, false)), false));
        assertThat(w).extracting(Week::week).containsExactly(3, 4, 5);
        assertThat(totals(w)).containsExactly(6, 13, 14);   // restored 12, +1, +1
    }

    @Test void capsStopTheRamp() {
        List<Week> w = VolumePath.project(input(3, List.of("MEV", "MAV", "MAV"), 1, List.of(ex("a", 0, 5)),
            Map.of(), new Group(GROW, new Band(4, 16, 22, false)), false));
        assertThat(totals(w)).containsExactly(5, 5, 5);
    }

    @Test void aboveTheBandHolds() {
        List<Week> w = VolumePath.project(input(3, List.of("MEV", "MAV", "MAV"), 1,
            List.of(ex("a", 0, 5), ex("b", 1, 5), ex("c", 2, 5)), Map.of(),
            new Group(GROW, new Band(4, 12, 22, false)), false));
        assertThat(totals(w)).containsExactly(15, 15, 15);
    }

    @Test void groupsWithoutLandmarksAreLeftOut() {
        Input in = new Input(2, List.of("MEV", "MAV"), 1, List.of(ex("a", 0, 3), new Exercise("x", "core", 0, 4)),
            Map.of(), Map.of("back", new Group(GROW, new Band(4, 16, 22, false))), false, 2, 1, 1,
            new BigDecimal("0.5"), 5, 8);
        List<Week> w = VolumePath.project(in);
        assertThat(w.get(1).sets()).containsOnlyKeys("back");
        assertThat(totals(w)).containsExactly(3, 4);
    }
}
