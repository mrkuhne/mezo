package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Input;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Pick;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanDay;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanRow;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Week;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Stored run rows vs a planned week → the proposal's technique lines (mezo-r36n9.81, T3 Task 5). */
class TechniqueLinesTest {

    private static final TrainTechniqueProperties.Planner CFG = new TrainTechniqueProperties.Planner(3, 2, 1, 2, 15);
    private static final CatalogAttributes.Attrs MACHINE = new CatalogAttributes.Attrs(true, true, "machine");

    // ── builders ────────────────────────────────────────────────────────────────────────────────

    private static UUID id(int day, int ex) {
        return new UUID(day, ex);
    }

    /** A plain stable machine row, balanced, counting, no pick. */
    private static PlanRow row(int day, int ex, String group, int sets) {
        return new PlanRow(day, ex, id(day, ex), group, true, sets, "compound", 10, MACHINE, TrainingStyle.BALANCED,
            Technique.NONE, null, false);
    }

    private static PlanRow held(PlanRow r, Technique t, String source, boolean challenge) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), r.workingSets(), r.type(),
            r.repMax(), r.attrs(), r.effectiveStyle(), t, source, challenge);
    }

    private static PlanRow allout(PlanRow r) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), r.workingSets(), r.type(),
            r.repMax(), r.attrs(), TrainingStyle.ALLOUT, r.technique(), r.source(), r.challenge());
    }

    private static Input input(boolean deficit, int exerciseCap, int sessionCap, PlanDay... days) {
        return new Input(3, false, List.of(days), Map.of("chest", "emphasize"), Set.of(), deficit, exerciseCap,
            sessionCap, 2, CFG);
    }

    private static Input input(PlanDay... days) {
        return input(false, 5, 8, days);
    }

    private static PlanDay day(int index, PlanRow... rows) {
        return new PlanDay(index, false, Arrays.asList(rows));
    }

    private static Pick technique(PlanRow r, Technique t, String reason) {
        return new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), t, TechniquePlanner.SOURCE_PLANNER, reason);
    }

    private static Pick challenge(PlanRow r) {
        return new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), Technique.PARTIALS, TechniquePlanner.SOURCE_PLANNER,
            TechniquePlanner.REASON_CHALLENGE);
    }

    private static Week week(List<Pick> techniques, List<Pick> challenges) {
        return new Week(techniques, challenges, List.of(), Map.of(), Map.of());
    }

    /** The template rows (counting, with names) of every plan row of the input. */
    private static List<TemplatePlan.Row> plan(Input in) {
        List<TemplatePlan.Row> rows = new ArrayList<>();
        for (PlanDay d : in.days()) {
            for (PlanRow r : d.rows()) {
                ExerciseEntity e = new ExerciseEntity();
                e.setId(r.id());
                e.setName("Ex " + r.dayIndex() + "/" + r.exerciseIndex());
                e.setWorkingSets(r.workingSets());
                rows.add(new TemplatePlan.Row(e, r.dayIndex(), r.group(), "Nap " + r.dayIndex(), 0));
            }
        }
        return rows;
    }

    private static Map<UUID, Integer> working(Input in) {
        Map<UUID, Integer> w = new HashMap<>();
        in.days().forEach(d -> d.rows().forEach(r -> w.put(r.id(), r.workingSets())));
        return w;
    }

    private static TechniqueLines.Result run(Input in, Week week) {
        return TechniqueLines.lines(plan(in), in, week, working(in));
    }

    // ── tests ───────────────────────────────────────────────────────────────────────────────────

    @Test
    void weekThreeAddsTechniqueAndTakesASet() {
        PlanRow a = row(0, 0, "chest", 3);
        PlanRow b = row(0, 1, "chest", 3);
        Input in = input(day(0, a, b));
        Map<UUID, Integer> working = working(in);

        TechniqueLines.Result r = TechniqueLines.lines(plan(in), in,
            week(List.of(technique(b, Technique.REST_DROP, TechniquePlanner.REASON_EMPHASIS)), List.of()), working);

        assertThat(r.lines()).singleElement().satisfies(l -> {
            assertThat(l.kind()).isEqualTo(WeekProposalLineJson.KIND_TECHNIQUE);
            assertThat(l.exerciseId()).isEqualTo(b.id());
            assertThat(l.exerciseName()).isEqualTo("Ex 0/1");
            assertThat(l.dayName()).isEqualTo("Nap 0");
            assertThat(l.muscleGroup()).isEqualTo("chest");
            assertThat(l.fromTechnique()).isEqualTo("none");
            assertThat(l.toTechnique()).isEqualTo("rest_drop");
            assertThat(l.challenge()).isFalse();
            assertThat(l.from()).isEqualTo(3);
            assertThat(l.to()).isEqualTo(2);
            assertThat(l.reasons()).containsExactly("emphasis");
            assertThat(l.decision()).isNull();
            assertThat(l.id()).isNotBlank();
        });
        assertThat(r.working()).containsEntry(b.id(), 2).containsEntry(a.id(), 3);
        assertThat(working).containsEntry(b.id(), 3); // the caller's copy is untouched
    }

    @Test
    void changeKeepsTheSets() {
        PlanRow b = held(row(0, 1, "chest", 2), Technique.REST_DROP, "planner", false);
        Input in = input(day(0, row(0, 0, "chest", 3), b));

        TechniqueLines.Result r = run(in,
            week(List.of(technique(b, Technique.MYO, TechniquePlanner.REASON_TECHNIQUE_WEEK)), List.of()));

        assertThat(r.lines()).extracting(WeekProposalLineJson::fromTechnique, WeekProposalLineJson::toTechnique,
                WeekProposalLineJson::from, WeekProposalLineJson::to, WeekProposalLineJson::reasons)
            .containsExactly(tuple("rest_drop", "myo", 2, 2, List.of("technique_week")));
    }

    @Test
    void ownerRowGetsNoLine() {
        PlanRow ownerTech = held(row(0, 1, "chest", 3), Technique.MYO, "owner", false);
        PlanRow ownerChallenge = held(row(0, 0, "chest", 3), Technique.NONE, "owner", true);
        PlanRow unsourcedChallenge = held(row(1, 0, "chest", 3), Technique.NONE, null, true);
        PlanRow aiTech = held(row(1, 1, "chest", 3), Technique.REST_DROP, "ai", false);
        Input in = input(day(0, ownerChallenge, ownerTech), day(1, unsourcedChallenge, aiTech));

        // even a (buggy) planner pick on them, or no pick at all, writes nothing
        TechniqueLines.Result r = run(in, week(
            List.of(technique(ownerTech, Technique.REST_DROP, "emphasis"),
                technique(unsourcedChallenge, Technique.MYO, "emphasis")),
            List.of(challenge(ownerTech))));

        assertThat(r.lines()).isEmpty();
        assertThat(r.working()).isEqualTo(working(in));
    }

    @Test
    void deficitRemovesOneAndGivesSetBack() {
        PlanRow a = held(row(0, 0, "chest", 2), Technique.REST_DROP, "planner", false);
        PlanRow b = held(row(0, 1, "back", 2), Technique.REST_DROP, "planner", false);
        Input in = input(true, 5, 8, day(0, a, b));

        // the deficit allows one: the planner keeps the back technique, the chest one goes
        TechniqueLines.Result r = run(in,
            week(List.of(technique(b, Technique.REST_DROP, "technique_week")), List.of()));

        assertThat(r.lines()).singleElement().satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(a.id());
            assertThat(l.fromTechnique()).isEqualTo("rest_drop");
            assertThat(l.toTechnique()).isEqualTo("none");
            assertThat(l.from()).isEqualTo(2);
            assertThat(l.to()).isEqualTo(3);
            assertThat(l.reasons()).containsExactly("deficit_allowance");
        });
        assertThat(r.working()).containsEntry(a.id(), 3);
    }

    @Test
    void removalReasonIsSportDayOrEmphasis() {
        PlanRow a = held(row(0, 0, "chest", 2), Technique.REST_DROP, "planner", false);
        Input sport = input(new PlanDay(0, true, List.of(a)));
        Input plain = input(day(0, a));

        assertThat(run(sport, week(List.of(), List.of())).lines().get(0).reasons()).containsExactly("sport_day");
        assertThat(run(plain, week(List.of(), List.of())).lines().get(0).reasons()).containsExactly("emphasis");
    }

    @Test
    void removalGivesSetBackWithinCaps() {
        // exercise cap: 5 sets held, a sixth would break the cap of 5 → the technique goes, the sets stay
        PlanRow atCap = held(row(0, 0, "chest", 5), Technique.REST_DROP, "planner", false);
        assertThat(run(input(day(0, atCap)), week(List.of(), List.of())).lines())
            .extracting(WeekProposalLineJson::from, WeekProposalLineJson::to).containsExactly(tuple(5, 5));

        // session cap 8: 2 (+1 for its technique) + 5 = 8 now; plain 3 + 5 = 8 still fits
        PlanRow fits = held(row(1, 1, "chest", 2), Technique.REST_DROP, "planner", false);
        assertThat(run(input(day(1, row(1, 0, "chest", 5), fits)), week(List.of(), List.of())).lines())
            .extracting(WeekProposalLineJson::from, WeekProposalLineJson::to).containsExactly(tuple(2, 3));

        // session cap 8 with a challenge on the other row (5 + 1 extra): 3 + 6 = 9 would break it
        PlanRow tight = held(row(2, 1, "chest", 2), Technique.REST_DROP, "planner", false);
        PlanRow challengeRow = held(row(2, 0, "chest", 5), Technique.NONE, "planner", true);
        assertThat(run(input(day(2, challengeRow, tight)),
                week(List.of(), List.of(challenge(challengeRow)))).lines())
            .extracting(WeekProposalLineJson::from, WeekProposalLineJson::to).containsExactly(tuple(2, 2));

        // another group on the same day does not count against this group's session cap
        PlanRow other = held(row(3, 1, "chest", 2), Technique.REST_DROP, "planner", false);
        assertThat(run(input(day(3, row(3, 0, "back", 7), other)), week(List.of(), List.of())).lines())
            .extracting(WeekProposalLineJson::from, WeekProposalLineJson::to).containsExactly(tuple(2, 3));

        // an all-out exercise is never given a set
        PlanRow hard = allout(held(row(4, 0, "chest", 2), Technique.REST_DROP, "planner", false));
        assertThat(run(input(day(4, hard)), week(List.of(), List.of())).lines())
            .extracting(WeekProposalLineJson::from, WeekProposalLineJson::to).containsExactly(tuple(2, 2));
    }

    @Test
    void challengeMoveIsOneLinePair() {
        PlanRow oldChallenge = held(row(0, 0, "chest", 3), Technique.NONE, "planner", true);
        PlanRow newChallenge = row(0, 1, "back", 3);
        Input in = input(day(0, oldChallenge, newChallenge));

        TechniqueLines.Result r = run(in, week(List.of(), List.of(challenge(newChallenge))));

        assertThat(r.lines()).extracting(WeekProposalLineJson::exerciseId, WeekProposalLineJson::fromTechnique,
                WeekProposalLineJson::toTechnique, WeekProposalLineJson::challenge, WeekProposalLineJson::from,
                WeekProposalLineJson::to, WeekProposalLineJson::reasons)
            .containsExactly(
                tuple(oldChallenge.id(), "partials", "none", true, 3, 3, List.of("challenge")),
                tuple(newChallenge.id(), "none", "partials", true, 3, 3, List.of("challenge")));
        assertThat(r.working()).isEqualTo(working(in));
    }

    @Test
    void newChallengeOnATechniqueRowRemovesTheTechniqueFirst() {
        PlanRow r0 = held(row(0, 0, "chest", 2), Technique.REST_DROP, "planner", false);
        Input in = input(day(0, r0, row(0, 1, "back", 3)));

        TechniqueLines.Result r = run(in, week(List.of(), List.of(challenge(r0))));

        assertThat(r.lines()).extracting(WeekProposalLineJson::fromTechnique, WeekProposalLineJson::toTechnique,
                WeekProposalLineJson::challenge, WeekProposalLineJson::from, WeekProposalLineJson::to)
            .containsExactly(tuple("rest_drop", "none", false, 2, 3), tuple("none", "partials", true, 3, 3));
    }

    @Test
    void removalOntoTheNewChallengeWeighsTheChallenge() {
        // day at exactly the session cap 8: 2 (+1 technique) + 5 = 8. The technique row becomes the challenge:
        // plain 3 + 1 (challenge extra) + 5 = 9 would break it → the technique goes, the set does not come back
        PlanRow moving = held(row(0, 1, "chest", 2), Technique.REST_DROP, "planner", false);
        Input in = input(day(0, row(0, 0, "chest", 5), moving));

        TechniqueLines.Result r = run(in, week(List.of(), List.of(challenge(moving))));

        assertThat(r.lines()).extracting(WeekProposalLineJson::fromTechnique, WeekProposalLineJson::toTechnique,
                WeekProposalLineJson::from, WeekProposalLineJson::to)
            .containsExactly(tuple("rest_drop", "none", 2, 2), tuple("none", "partials", 2, 2));
    }

    @Test
    void removalOntoTheNewChallengeKeepsTheExerciseCapByWeight() {
        // exercise cap 5: plain 4 + 1 (challenge extra) = 5 fits; plain 5 + 1 = 6 does not
        PlanRow fits = held(row(0, 0, "chest", 3), Technique.REST_DROP, "planner", false);
        assertThat(run(input(day(0, fits)), week(List.of(), List.of(challenge(fits)))).lines().get(0).to())
            .isEqualTo(4);
        PlanRow over = held(row(0, 0, "chest", 4), Technique.REST_DROP, "planner", false);
        assertThat(run(input(day(0, over)), week(List.of(), List.of(challenge(over)))).lines().get(0).to())
            .isEqualTo(4);
    }

    @Test
    void linesAreByDayRemovalsFirst() {
        PlanRow add0 = row(0, 2, "chest", 3);
        PlanRow remove0 = held(row(0, 3, "back", 2), Technique.MYO, "planner", false);
        PlanRow add1 = row(1, 0, "chest", 3);
        Input in = input(day(1, add1), day(0, add0, remove0));

        TechniqueLines.Result r = run(in, week(List.of(technique(add1, Technique.MYO, "emphasis"),
            technique(add0, Technique.REST_DROP, "emphasis")), List.of()));

        assertThat(r.lines()).extracting(WeekProposalLineJson::exerciseId)
            .containsExactly(remove0.id(), add0.id(), add1.id());
    }

    @Test
    void rowsOutsideTheTemplatePlanGetNoLine() {
        PlanRow warmup = row(0, 0, "chest", 3);
        PlanRow counted = row(0, 1, "chest", 3);
        Input in = input(day(0, warmup, counted));
        List<TemplatePlan.Row> plan = plan(in).stream().filter(t -> t.exercise().getId().equals(counted.id()))
            .toList();

        TechniqueLines.Result r = TechniqueLines.lines(plan, in,
            week(List.of(technique(warmup, Technique.MYO, "emphasis")), List.of(challenge(warmup))), working(in));

        assertThat(r.lines()).isEmpty();
    }
}
