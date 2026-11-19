package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties.Style;
import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.service.StallOffers.Decision;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Input;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Pick;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanDay;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanRow;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Week;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** A stalled muscle group gets at most one offer: technique, else rep range, else a one-week reduction (T3 Task 6). */
class StallOffersTest {

    private static final TrainTechniqueProperties.Planner CFG = new TrainTechniqueProperties.Planner(3, 2, 1, 2, 15);
    static final TrainStyleProperties P = new TrainStyleProperties(Map.of(
        "balanced", new Style(6, 10, 10, 15, null, 2, 3, 150, 90, 3),
        "volume", new Style(10, 15, 15, 25, null, 2, null, 120, 75, 4),
        "heavy", new Style(5, 8, 8, 12, null, 2, null, 180, 120, 2),
        "allout", new Style(6, 10, 8, 12, 2, 0, null, 180, 120, 2)),
        1, 56, 2, new TrainStyleProperties.Ramp(1, 2, 2, 1));
    private static final CatalogAttributes.Attrs MACHINE = new CatalogAttributes.Attrs(true, true, "machine");

    // ── builders ────────────────────────────────────────────────────────────────────────────────

    private static UUID id(int day, int ex) {
        return new UUID(day, ex);
    }

    /** A stable machine compound (rest-drop candidate), counting, 3 sets, no pick. */
    private static PlanRow machine(int day, int ex, String group, TrainingStyle style) {
        return new PlanRow(day, ex, id(day, ex), group, true, 3, "compound", 10, MACHINE, style, Technique.NONE, null,
            false);
    }

    /** A free (non-stable) compound: never a technique candidate. */
    private static PlanRow free(int day, int ex, String group, TrainingStyle style) {
        return new PlanRow(day, ex, id(day, ex), group, true, 3, "compound", 10, CatalogAttributes.Attrs.FREE, style,
            Technique.NONE, null, false);
    }

    private static PlanRow sets(PlanRow r, int sets) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), sets, r.type(), r.repMax(),
            r.attrs(), r.effectiveStyle(), r.technique(), r.source(), r.challenge());
    }

    private static PlanRow held(PlanRow r, Technique t, String source) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), r.workingSets(), r.type(),
            r.repMax(), r.attrs(), r.effectiveStyle(), t, source, r.challenge());
    }

    private static PlanDay day(int index, PlanRow... rows) {
        return new PlanDay(index, false, Arrays.asList(rows));
    }

    private static Input input(PlanDay... days) {
        return new Input(4, false, List.of(days), Map.of("back", "grow"), Set.of(), false, 5, 8, 2, CFG);
    }

    /** A planned week with no picks and the given allowance left on every day. */
    private static Week week(Input in, int left, Pick... techniques) {
        Map<Integer, Integer> remaining = new HashMap<>();
        in.days().forEach(d -> remaining.put(d.dayIndex(), left));
        Map<String, Integer> perGroup = new HashMap<>();
        return new Week(List.of(techniques), List.of(), List.of(), remaining, perGroup);
    }

    /** Template rows for every plan row: rep range = the style table's for its class (balanced compound 6–10). */
    private static List<TemplatePlan.Row> plan(Input in, int repMin, int repMax, List<String> overrides) {
        List<TemplatePlan.Row> rows = new ArrayList<>();
        for (PlanDay d : in.days()) {
            for (PlanRow r : d.rows()) {
                ExerciseEntity e = new ExerciseEntity();
                e.setId(r.id());
                e.setName("Ex " + r.dayIndex() + "/" + r.exerciseIndex());
                e.setMuscle("back-mid");
                e.setType(r.type());
                e.setWorkingSets(r.workingSets());
                e.setRepMin(repMin);
                e.setRepMax(repMax);
                e.setOverrides(overrides);
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

    private static StallOffers.Result offers(Input in, Week week, List<TemplatePlan.Row> plan, Lever lever,
                                             PriorityTier tier) {
        return StallOffers.offers(Map.of("back", new Decision(lever, tier, false)), plan, in, week, working(in), P);
    }

    // ── (a) technique ──────────────────────────────────────────────────────────────────────────

    @Test
    void techniqueOfferedFirst() {
        PlanRow early = machine(0, 0, "back", TrainingStyle.BALANCED);
        PlanRow late = machine(1, 0, "back", TrainingStyle.BALANCED);
        Input in = input(day(0, early), day(1, late));

        StallOffers.Result r = offers(in, week(in, 1), plan(in, 6, 10, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.week().techniques()).singleElement().satisfies(p -> {
            assertThat(p.id()).isEqualTo(late.id()); // the group's last day first
            assertThat(p.technique()).isEqualTo(Technique.REST_DROP);
            assertThat(p.source()).isEqualTo(TechniquePlanner.SOURCE_PLANNER);
            assertThat(p.reason()).isEqualTo(StallOffers.REASON_STALLED);
        });
        assertThat(r.week().remainingByDay()).containsEntry(1, 0).containsEntry(0, 1);
        assertThat(r.week().perGroup()).containsEntry("back", 1);
        assertThat(r.repRangeLines()).isEmpty();
        assertThat(r.reductions()).isEmpty();
    }

    @Test
    void noTechniqueBeforeTheStartWeek() {
        PlanRow row = machine(0, 0, "back", TrainingStyle.BALANCED);
        Input week4 = input(day(0, row));
        Input week2 = new Input(2, false, week4.days(), week4.priorities(), Set.of(), false, 5, 8, 2, CFG);

        StallOffers.Result r = offers(week2, week(week2, 1), plan(week2, 6, 10, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.week().techniques()).isEmpty();
        assertThat(r.repRangeLines()).hasSize(1); // falls through to the range change
    }

    @Test
    void noReductionInAWeekThatGaveSetsBack() {
        PlanRow row = sets(free(0, 0, "back", TrainingStyle.ALLOUT), 3);
        Input in = input(day(0, row));

        StallOffers.Result r = StallOffers.offers(Map.of("back", new Decision(Lever.HOLD, PriorityTier.GROW, true)),
            plan(in, 6, 10, null), in, week(in, 2), working(in), P);

        assertThat(r.reductions()).isEmpty();
    }

    @Test
    void maintainGroupGetsTheTechniqueToo() {
        PlanRow row = machine(0, 0, "back", TrainingStyle.BALANCED);
        Input in = input(day(0, row));

        StallOffers.Result r = offers(in, week(in, 2), plan(in, 6, 10, null), Lever.HOLD, PriorityTier.MAINTAIN);

        assertThat(r.week().techniques()).extracting(Pick::id).containsExactly(row.id());
    }

    @Test
    void anExistingPlannerPickIsTheOfferAndSaysStalled() {
        PlanRow row = machine(0, 0, "back", TrainingStyle.BALANCED);
        Input in = input(day(0, row));
        Pick planned = new Pick(0, 0, row.id(), Technique.REST_DROP, TechniquePlanner.SOURCE_PLANNER,
            TechniquePlanner.REASON_TECHNIQUE_WEEK);

        StallOffers.Result r = offers(in, week(in, 1, planned), plan(in, 6, 10, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.week().techniques()).singleElement().satisfies(p -> {
            assertThat(p.id()).isEqualTo(row.id());
            assertThat(p.reason()).isEqualTo(StallOffers.REASON_STALLED);
        });
        assertThat(r.repRangeLines()).isEmpty();
        assertThat(r.reductions()).isEmpty();
    }

    @Test
    void anOwnerTechniqueRowIsNotTheOffer() {
        PlanRow owned = held(machine(0, 0, "back", TrainingStyle.BALANCED), Technique.MYO, "owner");
        Input in = input(day(0, owned));

        StallOffers.Result r = offers(in, week(in, 1), plan(in, 6, 10, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.week().techniques()).isEmpty();
        assertThat(r.repRangeLines()).hasSize(1); // falls through to the range change
    }

    // ── (b) rep range ──────────────────────────────────────────────────────────────────────────

    @Test
    void rangeChangeWhenNoTechniqueRoom() {
        PlanRow row = machine(0, 0, "back", TrainingStyle.BALANCED);
        Input in = input(day(0, row));

        StallOffers.Result r = offers(in, week(in, 0), plan(in, 6, 10, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.week().techniques()).isEmpty();
        assertThat(r.reductions()).isEmpty();
        assertThat(r.repRangeLines()).singleElement().satisfies(l -> {
            assertThat(l.kind()).isEqualTo(WeekProposalLineJson.KIND_REP_RANGE);
            assertThat(l.exerciseId()).isEqualTo(row.id());
            assertThat(l.fromRepMin()).isEqualTo(6);
            assertThat(l.fromRepMax()).isEqualTo(10);
            assertThat(l.toRepMin()).isEqualTo(10); // balanced → volume, compound 10–15
            assertThat(l.toRepMax()).isEqualTo(15);
            assertThat(l.from()).isEqualTo(10);
            assertThat(l.to()).isEqualTo(15);
            assertThat(l.reasons()).containsExactly("stalled");
            assertThat(l.muscleGroup()).isEqualTo("back");
            assertThat(l.dayName()).isEqualTo("Nap 0");
        });
    }

    @Test
    void heavyGoesBalanced() {
        Input in = input(day(0, free(0, 0, "back", TrainingStyle.HEAVY)));

        StallOffers.Result r = offers(in, week(in, 2), plan(in, 5, 8, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.repRangeLines()).singleElement().satisfies(l -> {
            assertThat(l.toRepMin()).isEqualTo(6);
            assertThat(l.toRepMax()).isEqualTo(10);
        });
    }

    @Test
    void volumeGoesBalanced() {
        Input in = input(day(0, free(0, 0, "back", TrainingStyle.VOLUME)));

        StallOffers.Result r = offers(in, week(in, 2), plan(in, 10, 15, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.repRangeLines()).singleElement().satisfies(l -> {
            assertThat(l.toRepMin()).isEqualTo(6);
            assertThat(l.toRepMax()).isEqualTo(10);
        });
    }

    @Test
    void balancedGoesVolume() {
        Input in = input(day(0, free(0, 0, "back", TrainingStyle.BALANCED)));

        StallOffers.Result r = offers(in, week(in, 2), plan(in, 6, 10, null), Lever.HOLD, PriorityTier.MAINTAIN);

        assertThat(r.repRangeLines()).singleElement().satisfies(l -> {
            assertThat(l.toRepMin()).isEqualTo(10);
            assertThat(l.toRepMax()).isEqualTo(15);
        });
    }

    @Test
    void sameRangeTriesTheNextRow() {
        PlanRow first = free(0, 0, "back", TrainingStyle.BALANCED);
        PlanRow last = free(0, 1, "back", TrainingStyle.BALANCED);
        Input in = input(day(0, first, last));
        List<TemplatePlan.Row> plan = plan(in, 6, 10, null);
        plan.get(1).exercise().setRepMin(10); // the last row already sits in the volume range
        plan.get(1).exercise().setRepMax(15);

        StallOffers.Result r = offers(in, week(in, 2), plan, Lever.HOLD, PriorityTier.GROW);

        assertThat(r.repRangeLines()).extracting(WeekProposalLineJson::exerciseId).containsExactly(first.id());
    }

    @Test
    void alloutNoRangeChange() {
        PlanRow row = free(0, 0, "back", TrainingStyle.ALLOUT);
        Input in = input(day(0, row));

        StallOffers.Result r = offers(in, week(in, 2), plan(in, 6, 10, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.repRangeLines()).isEmpty();
        assertThat(r.reductions()).singleElement().satisfies(x -> assertThat(x.exerciseId()).isEqualTo(row.id()));
    }

    @Test
    void ownerRangeOverrideNoRangeChange() {
        Input in = input(day(0, free(0, 0, "back", TrainingStyle.BALANCED)));

        StallOffers.Result r = offers(in, week(in, 2), plan(in, 6, 10, List.of("repRange")), Lever.HOLD,
            PriorityTier.GROW);

        assertThat(r.repRangeLines()).isEmpty();
        assertThat(r.reductions()).hasSize(1);
    }

    // ── (c) reduction ──────────────────────────────────────────────────────────────────────────

    @Test
    void reductionOnlyOnHoldNotMaintain() {
        PlanRow small = sets(free(0, 0, "back", TrainingStyle.ALLOUT), 2);
        PlanRow big = sets(free(1, 0, "back", TrainingStyle.ALLOUT), 4);
        Input in = input(day(0, small), day(1, big));
        List<TemplatePlan.Row> plan = plan(in, 6, 10, null);

        StallOffers.Result hold = offers(in, week(in, 2), plan, Lever.HOLD, PriorityTier.GROW);
        assertThat(hold.reductions()).singleElement().satisfies(x -> {
            assertThat(x.exerciseId()).isEqualTo(big.id()); // SetSlots.pickDown: the most sets
            assertThat(x.from()).isEqualTo(4);
            assertThat(x.to()).isEqualTo(3);
            assertThat(x.restore().exerciseId()).isEqualTo(big.id());
            assertThat(x.restore().dayIndex()).isEqualTo(1);
            assertThat(x.restore().sets()).isEqualTo(4);
            assertThat(x.restore().deloadSets()).isEqualTo(3);
            assertThat(x.restore().exerciseName()).isEqualTo("Ex 1/0");
        });
        assertThat(offers(in, week(in, 2), plan, Lever.NONE, PriorityTier.EMPHASIZE).reductions()).hasSize(1);

        assertThat(offers(in, week(in, 2), plan, Lever.HOLD, PriorityTier.MAINTAIN).reductions()).isEmpty();
        assertThat(offers(in, week(in, 2), plan, Lever.UP, PriorityTier.GROW).reductions()).isEmpty();
        assertThat(offers(in, week(in, 2), plan, Lever.DOWN, PriorityTier.GROW).reductions()).isEmpty();
    }

    @Test
    void reductionSkipsTechniqueAndChallengeRows() {
        PlanRow technique = held(sets(free(0, 0, "back", TrainingStyle.ALLOUT), 4), Technique.MYO, "owner");
        PlanRow challenge = new PlanRow(1, 0, id(1, 0), "back", true, 4, "compound", 10, CatalogAttributes.Attrs.FREE,
            TrainingStyle.ALLOUT, Technique.NONE, "planner", true);
        PlanRow plain = sets(free(2, 0, "back", TrainingStyle.ALLOUT), 2);
        Input in = input(day(0, technique), day(1, challenge), day(2, plain));

        StallOffers.Result r = offers(in, week(in, 2), plan(in, 6, 10, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.reductions()).extracting(StallOffers.Reduction::exerciseId).containsExactly(plain.id());
    }

    @Test
    void nothingWhenNoOfferApplies() {
        PlanRow single = sets(free(0, 0, "back", TrainingStyle.ALLOUT), 1);
        Input in = input(day(0, single));

        StallOffers.Result r = offers(in, week(in, 2), plan(in, 6, 10, null), Lever.HOLD, PriorityTier.GROW);

        assertThat(r.week().techniques()).isEmpty();
        assertThat(r.repRangeLines()).isEmpty();
        assertThat(r.reductions()).isEmpty();
    }

    @Test
    void groupsWithoutAStallAreLeftAlone() {
        Input in = input(day(0, machine(0, 0, "back", TrainingStyle.BALANCED)));
        Week week = week(in, 2);

        StallOffers.Result r = StallOffers.offers(Map.of(), plan(in, 6, 10, null), in, week, working(in), P);

        assertThat(r.week()).isEqualTo(week);
        assertThat(r.repRangeLines()).isEmpty();
        assertThat(r.reductions()).isEmpty();
    }
}
