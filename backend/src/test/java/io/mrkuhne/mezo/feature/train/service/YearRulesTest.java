package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.YearGenerator.Note;
import io.mrkuhne.mezo.feature.train.service.YearRules.Suggestion;
import io.mrkuhne.mezo.feature.train.service.YearRules.View;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class YearRulesTest {

    private static final LocalDate START = LocalDate.of(2027, 1, 4);
    private static final Set<String> GROUPS = Set.of("chest", "back", "shoulder", "biceps", "triceps",
        "quad", "ham", "glute", "calf");

    /** A clean year: every group focused, table pairs, no repeats in consecutive blocks. */
    private static List<List<String>> cleanFocus() {
        return new ArrayList<>(List.of(
            List.of("back", "biceps"), List.of("quad", "glute"),
            List.of("chest", "triceps"), List.of("ham", "calf"),
            List.of("chest", "shoulder"), List.of("quad", "glute"),
            List.of("back", "shoulder"), List.of("ham", "glute")));
    }

    private static List<View> views(List<List<String>> focus) {
        List<View> v = new ArrayList<>();
        for (int i = 0; i < focus.size(); i++) {
            v.add(new View(UUID.nameUUIDFromBytes(new byte[] {(byte) i}), i + 1, i % 2 == 0 ? "upper" : "lower",
                focus.get(i), "planned", START.plusWeeks(6L * i)));
        }
        v.add(new View(UUID.randomUUID(), focus.size() + 1, "consolidation", List.of(), "planned",
            START.plusWeeks(50)));
        return v;
    }

    private static List<Note> warn(List<List<String>> focus) {
        return YearRules.warnings(views(focus), GROUPS, YearGeneratorTest.P);
    }

    @Test void cleanYear_noWarnings() {
        assertThat(warn(cleanFocus())).isEmpty();
    }

    @Test void consecutiveFocusWarned() {
        List<List<String>> f = cleanFocus();
        f.set(1, List.of("back", "quad")); // back in blocks 1 and 2 (also a mixed block)
        assertThat(warn(f)).contains(new Note("focus_consecutive", "back", 2));
    }

    @Test void consecutiveAcrossSkippedBlockWarned() {
        List<View> v = views(cleanFocus());
        View b2 = v.get(1);
        v.set(1, new View(b2.id(), 2, "lower", b2.focus(), "skipped", b2.start()));
        View b3 = v.get(2);
        v.set(2, new View(b3.id(), 3, "upper", List.of("back", "triceps"), "planned", b3.start()));
        assertThat(YearRules.warnings(v, GROUPS, YearGeneratorTest.P))
            .contains(new Note("focus_consecutive", "back", 3));
    }

    @Test void noFocusThisYearWarned() {
        List<List<String>> f = cleanFocus();
        f.set(3, List.of("ham", "glute")); // calf gone
        f.set(7, List.of("quad", "glute"));
        assertThat(warn(f)).contains(new Note("no_focus_this_year", "calf", null));
    }

    @Test void skippingTheOnlyFocusBlock_warnsNoFocusThisYear() {
        List<View> v = views(cleanFocus());
        View b1 = v.get(0); // the only block focusing biceps
        v.set(0, new View(b1.id(), 1, "upper", b1.focus(), "skipped", b1.start()));
        assertThat(YearRules.warnings(v, GROUPS, YearGeneratorTest.P))
            .contains(new Note("no_focus_this_year", "biceps", null))
            .doesNotContain(new Note("no_focus_this_year", "back", null));
    }

    @Test void skipConsequence_listsOnlyFocusGroups() {
        List<List<String>> f = cleanFocus();
        f.set(3, List.of("ham", "glute"));
        f.set(5, List.of("quad", "calf")); // calf only in block 6
        List<View> v = views(f);
        assertThat(YearRules.skipConsequence(v, v.get(5).id())).containsExactly("calf");
        assertThat(YearRules.skipConsequence(v, v.get(4).id())).isEmpty();
    }

    @Test void placeFor_replacesARepeatedGroup() {
        List<List<String>> f = cleanFocus();
        f.set(3, List.of("ham", "glute"));
        f.set(7, List.of("quad", "glute")); // calf missing; quad ×3, glute ×4
        List<View> v = views(f);
        Optional<Suggestion> s = YearRules.placeFor("calf", v, START.plusWeeks(1), YearGeneratorTest.P);
        assertThat(s).isPresent();
        assertThat(s.get().ordinal()).isEqualTo(8);
        assertThat(s.get().blockId()).isEqualTo(v.get(7).id());
        assertThat(s.get().replaces()).isEqualTo("glute"); // glute ×4 beats quad ×3
    }

    @Test void placeFor_addsToSingleFocusBlock() {
        List<List<String>> f = new ArrayList<>(List.of(
            List.of("back", "biceps"), List.of("quad"),
            List.of("chest", "triceps"), List.of("ham", "glute"),
            List.of("chest", "shoulder"), List.of("calf"),
            List.of("back", "shoulder"), List.of("glute")));
        // Lower blocks are all single-focus and no group repeats, so nothing can be replaced.
        f.set(3, List.of("ham"));
        List<View> v = views(f);
        Optional<Suggestion> s = YearRules.placeFor("ham", v, START.plusWeeks(1), YearGeneratorTest.P);
        // ham is already in block 4; the latest single-focus lower block without ham is block 8.
        assertThat(s).contains(new Suggestion(v.get(7).id(), 8, null));
    }

    @Test void placeFor_ignoresPastAndNonPlannedBlocks() {
        List<List<String>> f = cleanFocus();
        f.set(3, List.of("ham", "glute"));
        f.set(7, List.of("quad", "glute"));
        List<View> v = views(f);
        // Today is past every lower block's start → no place.
        assertThat(YearRules.placeFor("calf", v, START.plusWeeks(49), YearGeneratorTest.P)).isEmpty();
    }

    @Test void mixedFocusWarned() {
        List<List<String>> f = cleanFocus();
        f.set(3, List.of("ham", "biceps"));
        f.set(1, List.of("quad", "calf"));
        assertThat(warn(f)).contains(new Note("mixed_focus", null, 4))
            .doesNotContain(new Note("pair_unusual", null, 4));
    }

    @Test void unusualPairWarned() {
        List<List<String>> f = cleanFocus();
        f.set(2, List.of("chest", "biceps"));
        f.set(4, List.of("triceps", "shoulder"));
        assertThat(warn(f)).contains(new Note("pair_unusual", null, 3));
    }
}
