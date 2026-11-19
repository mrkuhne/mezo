package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Input;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Pick;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanDay;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanRow;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Warning;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Week;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TechniquePlannerTest {
    private static final TrainTechniqueProperties.Planner CFG = new TrainTechniqueProperties.Planner(3, 2, 1, 2, 15);
    private static final CatalogAttributes.Attrs MACHINE = new CatalogAttributes.Attrs(true, false, "machine");
    private static final CatalogAttributes.Attrs CABLE = new CatalogAttributes.Attrs(true, false, "cable");
    private static final CatalogAttributes.Attrs STABLE_DB = new CatalogAttributes.Attrs(true, false, "dumbbell");
    private static final CatalogAttributes.Attrs LENGTHENED = new CatalogAttributes.Attrs(true, true, "machine");

    // ---- builders ------------------------------------------------------------------------------------------------

    /** A plain stable machine compound, 3 sets, rep max 10, balanced, counting, no pick. */
    private static PlanRow row(int day, int ex, String group) {
        return new PlanRow(day, ex, id(day, ex), group, true, 3, "compound", 10, MACHINE, TrainingStyle.BALANCED,
            Technique.NONE, null, false);
    }

    private static UUID id(int day, int ex) {
        return new UUID(day, ex);
    }

    private static PlanRow attrs(PlanRow r, CatalogAttributes.Attrs a) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), r.workingSets(), r.type(),
            r.repMax(), a, r.effectiveStyle(), r.technique(), r.source(), r.challenge());
    }

    private static PlanRow iso(PlanRow r, int repMax) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), r.workingSets(), "isolation",
            repMax, r.attrs(), r.effectiveStyle(), r.technique(), r.source(), r.challenge());
    }

    private static PlanRow sets(PlanRow r, int sets) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), sets, r.type(),
            r.repMax(), r.attrs(), r.effectiveStyle(), r.technique(), r.source(), r.challenge());
    }

    private static PlanRow style(PlanRow r, TrainingStyle s) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), r.workingSets(), r.type(),
            r.repMax(), r.attrs(), s, r.technique(), r.source(), r.challenge());
    }

    private static PlanRow owner(PlanRow r, Technique t, boolean challenge) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), r.workingSets(), r.type(),
            r.repMax(), r.attrs(), r.effectiveStyle(), t, "owner", challenge);
    }

    private static PlanDay day(int index, PlanRow... rows) {
        return new PlanDay(index, false, Arrays.asList(rows));
    }

    private static PlanDay sportDay(int index, PlanRow... rows) {
        return new PlanDay(index, true, Arrays.asList(rows));
    }

    private static Input input(int week, Map<String, String> priorities, PlanDay... days) {
        return new Input(week, false, List.of(days), priorities, Set.of(), false, 5, 8, 2, CFG);
    }

    private static Input deficit(Input in) {
        return new Input(in.week(), in.deloadWeek(), in.days(), in.priorities(), in.sportGroups(), true,
            in.exerciseCap(), in.sessionCap(), in.capWeight(), in.cfg());
    }

    private static Input sportGroups(Input in, String... groups) {
        return new Input(in.week(), in.deloadWeek(), in.days(), in.priorities(), Set.of(groups), in.deficit(),
            in.exerciseCap(), in.sessionCap(), in.capWeight(), in.cfg());
    }

    private static Input deload(Input in) {
        return new Input(in.week(), true, in.days(), in.priorities(), in.sportGroups(), in.deficit(),
            in.exerciseCap(), in.sessionCap(), in.capWeight(), in.cfg());
    }

    private static List<int[]> at(List<Pick> picks) {
        return picks.stream().map(p -> new int[] {p.dayIndex(), p.exerciseIndex()}).toList();
    }

    private static Map<String, String> emph(String... groups) {
        java.util.Map<String, String> m = new java.util.LinkedHashMap<>();
        for (String g : groups) m.put(g, "emphasize");
        return m;
    }

    // ---- weeks ---------------------------------------------------------------------------------------------------

    @Test
    void weeksOneAndTwoHaveOnlyChallenges() {
        PlanDay d = day(0, attrs(row(0, 0, "chest"), LENGTHENED), row(0, 1, "back"));
        for (int week : new int[] {1, 2}) {
            Week w = TechniquePlanner.plan(input(week, Map.of(), d));
            assertThat(w.techniques()).isEmpty();
            assertThat(at(w.challenges())).containsExactly(new int[] {0, 0});
            assertThat(w.remainingByDay()).containsEntry(0, 0);
        }
        assertThat(TechniquePlanner.plan(input(3, Map.of(), d)).techniques()).isNotEmpty();
    }

    @Test
    void deloadWeekHasNothing() {
        PlanDay d = day(0, owner(attrs(row(0, 0, "chest"), LENGTHENED), Technique.NONE, true),
            owner(row(0, 1, "back"), Technique.DROP, false), row(0, 2, "legs"));
        Week w = TechniquePlanner.plan(deload(input(4, Map.of(), d)));
        assertThat(w.techniques()).isEmpty();
        assertThat(w.challenges()).isEmpty();
        assertThat(w.warnings()).isEmpty();
    }

    // ---- rule 1 / 5 / 6: eligibility and which technique ---------------------------------------------------------

    @Test
    void freeExerciseNeverPicked() {
        PlanDay d = day(0, attrs(row(0, 0, "chest"), CatalogAttributes.Attrs.FREE));
        Week w = TechniquePlanner.plan(input(3, Map.of(), d));
        assertThat(w.techniques()).isEmpty();
        assertThat(w.challenges()).isEmpty();
    }

    @Test
    void onlyLastExerciseOfTheGroupThatDay() {
        PlanDay d = day(0, row(0, 0, "chest"), row(0, 1, "chest"), row(0, 2, "back"));
        Week w = TechniquePlanner.plan(input(3, Map.of(), d));
        assertThat(at(w.techniques())).containsExactly(new int[] {0, 1}, new int[] {0, 2});
        Input in = input(3, Map.of(), d);
        assertThat(TechniquePlanner.eligible(d.rows().get(0), d, in)).isFalse();
        assertThat(TechniquePlanner.eligible(d.rows().get(1), d, in)).isTrue();
    }

    @Test
    void emphasizeBeforeGrowMaintainNever() {
        PlanDay d = day(0, row(0, 0, "chest"), row(0, 1, "back"), row(0, 2, "legs"), row(0, 3, "arms"));
        Map<String, String> pr = Map.of("chest", "emphasize", "legs", "maintain");
        Week w = TechniquePlanner.plan(input(3, pr, d));
        // chest (emphasize) first, then the grow rows latest-first: arms (3) before back (1); legs never.
        assertThat(at(w.techniques())).containsExactly(new int[] {0, 0}, new int[] {0, 3});
        assertThat(w.techniques()).extracting(Pick::reason).containsExactly("emphasis", "technique_week");
        assertThat(w.techniques()).extracting(Pick::source).containsOnly("planner");
    }

    @Test
    void twoPerDayOneInDeficit() {
        PlanDay d = day(0, row(0, 0, "chest"), row(0, 1, "back"), row(0, 2, "legs"));
        assertThat(TechniquePlanner.plan(input(3, Map.of(), d)).techniques()).hasSize(2);
        Week w = TechniquePlanner.plan(deficit(input(3, Map.of(), d)));
        assertThat(at(w.techniques())).containsExactly(new int[] {0, 2});
        assertThat(w.remainingByDay()).containsEntry(0, 0);
    }

    @Test
    void oneOnASportDay() {
        PlanDay d = sportDay(0, row(0, 0, "chest"), row(0, 1, "back"), row(0, 2, "legs"));
        assertThat(at(TechniquePlanner.plan(input(3, Map.of(), d)).techniques())).containsExactly(new int[] {0, 2});
    }

    @Test
    void sportLoadedGroupSkippedOnSportDay() {
        PlanDay sport = sportDay(0, attrs(row(0, 0, "legs"), LENGTHENED), row(0, 1, "back"));
        PlanDay plain = day(1, attrs(row(1, 0, "legs"), LENGTHENED));
        Week w = TechniquePlanner.plan(sportGroups(input(3, Map.of(), sport, plain), "legs"));
        // day 0: legs neither challenge nor technique; back gets the one technique; day 1 legs is fine.
        assertThat(at(w.techniques())).containsExactly(new int[] {0, 1});
        assertThat(at(w.challenges())).containsExactly(new int[] {1, 0});
        assertThat(w.warnings()).containsExactly(new Warning("no_challenge_candidate", 0, null));
    }

    @Test
    void maxTwoPerMuscleWeek() {
        PlanDay d0 = day(0, row(0, 0, "chest"));
        PlanDay d1 = day(1, row(1, 0, "chest"));
        PlanDay d2 = day(2, row(2, 0, "chest"));
        Week w = TechniquePlanner.plan(input(3, Map.of(), d0, d1, d2));
        // a muscle trained three times gets its technique on its two last days of the week
        assertThat(at(w.techniques())).containsExactly(new int[] {1, 0}, new int[] {2, 0});
        assertThat(w.perGroup()).containsEntry("chest", 2);
        assertThat(w.remainingByDay()).containsEntry(0, 2).containsEntry(1, 1).containsEntry(2, 1);
    }

    @Test
    void myoForHighRepIsolation() {
        PlanDay d = day(0, iso(attrs(row(0, 0, "arms"), STABLE_DB), 15), iso(row(0, 1, "back"), 12));
        Week w = TechniquePlanner.plan(input(3, Map.of(), d));
        assertThat(w.techniques()).extracting(Pick::technique).containsExactly(Technique.MYO, Technique.REST_DROP);
        assertThat(TechniquePlanner.defaultTechnique(d.rows().get(0), CFG)).contains(Technique.MYO);
    }

    @Test
    void restDropForMachineAndCable() {
        PlanDay d = day(0, row(0, 0, "chest"), attrs(row(0, 1, "back"), CABLE));
        Week w = TechniquePlanner.plan(input(3, Map.of(), d));
        assertThat(w.techniques()).extracting(Pick::technique).containsOnly(Technique.REST_DROP).hasSize(2);
    }

    @Test
    void stableDumbbellCompoundNotEligible() {
        PlanRow r = attrs(row(0, 0, "chest"), STABLE_DB);
        assertThat(TechniquePlanner.defaultTechnique(r, CFG)).isEmpty();
        assertThat(TechniquePlanner.plan(input(3, Map.of(), day(0, r))).techniques()).isEmpty();
    }

    @Test
    void alloutGetsNone() {
        PlanRow r = style(row(0, 0, "chest"), TrainingStyle.ALLOUT);
        PlanDay d = day(0, r);
        assertThat(TechniquePlanner.defaultTechnique(r, CFG)).isEmpty();
        assertThat(TechniquePlanner.eligible(r, d, input(3, Map.of(), d))).isFalse();
        assertThat(TechniquePlanner.plan(input(3, Map.of(), d)).techniques()).isEmpty();
    }

    @Test
    void singleSetNotEligible() {
        PlanDay d = day(0, sets(row(0, 0, "chest"), 1));
        assertThat(TechniquePlanner.plan(input(3, Map.of(), d)).techniques()).isEmpty();
    }

    @Test
    void sessionCapAlreadyOverNotEligible() {
        // chest that day: 5 + 4 = 9 > session cap 8
        PlanDay d = day(0, sets(row(0, 0, "chest"), 5), sets(row(0, 1, "chest"), 4));
        assertThat(TechniquePlanner.plan(input(3, Map.of(), d)).techniques()).isEmpty();
    }

    // ---- rule 7: owner picks -------------------------------------------------------------------------------------

    @Test
    void ownerPickKeptAndCountsAgainstAllowance() {
        PlanDay d = day(0, owner(attrs(row(0, 0, "chest"), STABLE_DB), Technique.DROP, false),
            row(0, 1, "back"), row(0, 2, "legs"));
        Week w = TechniquePlanner.plan(input(3, Map.of(), d));
        assertThat(w.techniques()).extracting(Pick::dayIndex, Pick::exerciseIndex, Pick::technique, Pick::source)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(0, 0, Technique.DROP, "owner"),
                org.assertj.core.groups.Tuple.tuple(0, 2, Technique.REST_DROP, "planner"));
        assertThat(w.perGroup()).containsEntry("chest", 1).containsEntry("legs", 1);
        assertThat(w.warnings()).extracting(Warning::code).doesNotContain("owner_over_allowance");
    }

    @Test
    void ownerOverAllowanceWarns() {
        PlanDay d = sportDay(0, owner(row(0, 0, "chest"), Technique.DROP, false),
            owner(row(0, 1, "back"), Technique.REST_DROP, false), row(0, 2, "legs"));
        Week w = TechniquePlanner.plan(input(3, Map.of(), d));
        assertThat(w.techniques()).extracting(Pick::source).containsExactly("owner", "owner");
        assertThat(w.warnings()).contains(new Warning("owner_over_allowance", 0, 1));
        assertThat(w.remainingByDay()).containsEntry(0, 0);
    }

    // ---- the challenge -------------------------------------------------------------------------------------------

    @Test
    void challengeFirstStableLengthenedEmphasizeFirst() {
        PlanDay d = day(0, row(0, 0, "chest"), attrs(row(0, 1, "back"), LENGTHENED),
            attrs(row(0, 2, "legs"), LENGTHENED), attrs(row(0, 3, "back"), LENGTHENED));
        Week grow = TechniquePlanner.plan(input(1, Map.of(), d));
        assertThat(at(grow.challenges())).containsExactly(new int[] {0, 1});
        Week w = TechniquePlanner.plan(input(1, emph("legs"), d));
        assertThat(at(w.challenges())).containsExactly(new int[] {0, 2});
        assertThat(w.challenges()).extracting(Pick::technique, Pick::source, Pick::reason)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(Technique.PARTIALS, "planner", "challenge"));
    }

    @Test
    void ownerChallengeWins() {
        PlanDay d = day(0, attrs(row(0, 0, "chest"), LENGTHENED), owner(attrs(row(0, 1, "back"), LENGTHENED),
            Technique.NONE, true));
        Week w = TechniquePlanner.plan(input(1, emph("chest"), d));
        assertThat(w.challenges()).extracting(Pick::exerciseIndex, Pick::source)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1, "owner"));
    }

    @Test
    void challengeRowGetsNoTechnique() {
        PlanDay d = day(0, attrs(row(0, 0, "chest"), LENGTHENED), row(0, 1, "back"));
        Week w = TechniquePlanner.plan(input(3, Map.of(), d));
        assertThat(at(w.challenges())).containsExactly(new int[] {0, 0});
        assertThat(at(w.techniques())).containsExactly(new int[] {0, 1});
    }

    @Test
    void noCandidateNoChallengeWarns() {
        PlanDay d = day(0, row(0, 0, "chest"));
        PlanDay empty = day(1, new PlanRow(1, 0, id(1, 0), "chest", false, 3, "compound", 10, MACHINE,
            TrainingStyle.BALANCED, Technique.NONE, null, false));
        Week w = TechniquePlanner.plan(input(1, Map.of(), d, empty));
        assertThat(w.challenges()).isEmpty();
        assertThat(w.warnings()).containsExactly(new Warning("no_challenge_candidate", 0, null));
    }

    // ---- determinism ---------------------------------------------------------------------------------------------

    @Test
    void deterministic() {
        PlanDay d0 = day(0, attrs(row(0, 0, "chest"), LENGTHENED), row(0, 1, "back"), row(0, 2, "chest"));
        PlanDay d1 = day(1, row(1, 0, "back"), iso(row(1, 1, "arms"), 20), row(1, 2, "legs"));
        Input in = input(5, emph("back"), d0, d1);
        Week first = TechniquePlanner.plan(in);
        for (int i = 0; i < 5; i++) {
            assertThat(TechniquePlanner.plan(in)).isEqualTo(first);
        }
        assertThat(TechniquePlanner.defaultTechnique(row(0, 0, "x"), CFG)).isEqualTo(Optional.of(Technique.REST_DROP));
    }
}
