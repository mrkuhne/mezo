package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.service.TechniqueLlm.ChallengeMove;
import io.mrkuhne.mezo.feature.train.service.TechniqueLlm.Change;
import io.mrkuhne.mezo.feature.train.service.TechniqueLlm.Suggestion;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Input;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Pick;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanDay;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanRow;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.Week;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TechniqueMergerTest {
    private static final TrainTechniqueProperties.Planner CFG = new TrainTechniqueProperties.Planner(3, 2, 1, 2, 15);
    private static final CatalogAttributes.Attrs MACHINE = new CatalogAttributes.Attrs(true, false, "machine");
    private static final CatalogAttributes.Attrs LENGTHENED = new CatalogAttributes.Attrs(true, true, "machine");

    private static UUID id(int day, int ex) {
        return new UUID(day, ex);
    }

    private static PlanRow row(int day, int ex, String group) {
        return new PlanRow(day, ex, id(day, ex), group, true, 3, "isolation", 15, MACHINE, TrainingStyle.BALANCED,
            Technique.NONE, null, false);
    }

    private static PlanRow with(PlanRow r, CatalogAttributes.Attrs a, Technique t, String source, boolean challenge) {
        return new PlanRow(r.dayIndex(), r.exerciseIndex(), r.id(), r.group(), r.counts(), r.workingSets(), r.type(),
            r.repMax(), a, r.effectiveStyle(), t, source, challenge);
    }

    private static PlanDay day(int index, PlanRow... rows) {
        return new PlanDay(index, false, Arrays.asList(rows));
    }

    private static Input input(int week, boolean deficit, PlanDay... days) {
        return new Input(week, false, List.of(days), Map.of("chest", "emphasize", "back", "emphasize",
            "arms", "emphasize"), Set.of(), deficit, 5, 8, 2, CFG);
    }

    private static Pick planner(PlanRow r, Technique t) {
        return new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), t, TechniquePlanner.SOURCE_PLANNER, "emphasis");
    }

    private static Week week(List<Pick> techniques, List<Pick> challenges) {
        return new Week(techniques, challenges, List.of(), Map.of(), Map.of());
    }

    private static Suggestion changes(Change... c) {
        return new Suggestion(List.of(c), List.of());
    }

    @Test
    void swapsTheKindOnAPlannerPick() {
        PlanRow a = row(0, 0, "chest");
        Input in = input(3, false, day(0, a));
        Week planned = week(List.of(planner(a, Technique.MYO)), List.of());

        TechniqueMerger.Merged m = TechniqueMerger.merge(in, planned,
            changes(new Change(a.id(), "rest_drop", "  A könyököd   fájt, a pihenős drop kíméletesebb. ")));

        assertThat(m.week().techniques()).singleElement().satisfies(p -> {
            assertThat(p.technique()).isEqualTo(Technique.REST_DROP);
            assertThat(p.source()).isEqualTo(TechniquePlanner.SOURCE_AI);
            assertThat(p.reason()).isEqualTo(TechniquePlanner.REASON_AI_SUGGESTED);
        });
        assertThat(m.notes()).containsEntry(a.id(), "A könyököd fájt, a pihenős drop kíméletesebb.");
    }

    @Test
    void movesATechniqueWithinTheDayAllowance() {
        PlanRow a = row(0, 0, "chest");
        PlanRow b = row(0, 1, "back");
        Input in = input(3, true, day(0, a, b));   // deficit: one technique a day
        Week planned = week(List.of(planner(a, Technique.MYO)), List.of());

        // the add comes first in the answer, the removal frees the slot — removals are applied first
        TechniqueMerger.Merged m = TechniqueMerger.merge(in, planned, changes(
            new Change(b.id(), "myo", "A hát megtorpant."), new Change(a.id(), "none", "A mell most pihenjen.")));

        assertThat(m.week().techniques()).extracting(Pick::id).containsExactly(b.id());
        assertThat(m.notes()).containsOnlyKeys(a.id(), b.id());
    }

    @Test
    void anAddOverTheAllowanceIsDropped() {
        PlanRow a = row(0, 0, "chest");
        PlanRow b = row(0, 1, "back");
        Input in = input(3, true, day(0, a, b));
        Week planned = week(List.of(planner(a, Technique.MYO)), List.of());

        TechniqueMerger.Merged m = TechniqueMerger.merge(in, planned, changes(new Change(b.id(), "myo", "Plusz.")));

        assertThat(m.changed()).isFalse();
        assertThat(m.week()).isSameAs(planned);
    }

    @Test
    void theMuscleWeekLimitHolds() {
        PlanRow a = row(0, 0, "chest");
        PlanRow b = row(1, 0, "chest");
        PlanRow c = row(2, 0, "chest");
        Input in = input(3, false, day(0, a), day(1, b), day(2, c));
        Week planned = week(List.of(planner(a, Technique.MYO), planner(b, Technique.MYO)), List.of());

        TechniqueMerger.Merged m = TechniqueMerger.merge(in, planned, changes(new Change(c.id(), "drop", "Még egy.")));

        assertThat(m.changed()).isFalse();
    }

    @Test
    void ownerPicksAndIneligibleRowsAreUntouched() {
        PlanRow owner = with(row(0, 0, "chest"), MACHINE, Technique.MYO, "owner", false);
        PlanRow free = with(row(0, 1, "back"), CatalogAttributes.Attrs.FREE, Technique.NONE, null, false);
        PlanRow notLast = row(0, 2, "arms");
        PlanRow last = row(0, 3, "arms");
        Input in = input(3, false, day(0, owner, free, notLast, last));
        Week planned = week(List.of(new Pick(0, 0, owner.id(), Technique.MYO, "owner", null)), List.of());

        TechniqueMerger.Merged m = TechniqueMerger.merge(in, planned, changes(
            new Change(owner.id(), "none", "Le vele."),
            new Change(free.id(), "drop", "Szabad súly."),
            new Change(notLast.id(), "myo", "Nem az utolsó.")));

        assertThat(m.changed()).isFalse();
    }

    @Test
    void beforeTheStartWeekNoTechniqueIsAdded() {
        PlanRow a = row(0, 0, "chest");
        Input in = input(2, false, day(0, a));

        TechniqueMerger.Merged m = TechniqueMerger.merge(in, week(List.of(), List.of()),
            changes(new Change(a.id(), "myo", "Korán.")));

        assertThat(m.changed()).isFalse();
    }

    @Test
    void unknownIdsTechniquesAndMissingReasonsAreDropped() {
        PlanRow a = row(0, 0, "chest");
        Input in = input(3, false, day(0, a));
        Week planned = week(List.of(), List.of());

        TechniqueMerger.Merged m = TechniqueMerger.merge(in, planned, changes(
            new Change(UUID.randomUUID(), "myo", "Ismeretlen."),
            new Change(a.id(), "partials", "Nem technika."),
            new Change(a.id(), "superset", "Nincs ilyen."),
            new Change(a.id(), "myo", "  ")));

        assertThat(m.changed()).isFalse();
    }

    @Test
    void movesTheChallengeAndClearsATechniqueOnTheNewRow() {
        PlanRow first = with(row(0, 0, "chest"), LENGTHENED, Technique.NONE, null, false);
        PlanRow second = with(row(0, 1, "back"), LENGTHENED, Technique.NONE, null, false);
        Input in = input(3, false, day(0, first, second));
        Pick plannedChallenge = new Pick(0, 0, first.id(), Technique.PARTIALS, TechniquePlanner.SOURCE_PLANNER,
            "challenge");
        Week planned = week(List.of(planner(second, Technique.MYO)), List.of(plannedChallenge));

        TechniqueMerger.Merged m = TechniqueMerger.merge(in, planned, new Suggestion(List.of(),
            List.of(new ChallengeMove(0, second.id(), "A hát nyújtott helyzetben jobban bírja."))));

        assertThat(m.week().challenges()).singleElement().satisfies(p -> {
            assertThat(p.id()).isEqualTo(second.id());
            assertThat(p.source()).isEqualTo(TechniquePlanner.SOURCE_AI);
        });
        assertThat(m.week().techniques()).isEmpty();
        assertThat(m.notes()).containsOnlyKeys(first.id(), second.id());
    }

    @Test
    void anInvalidChallengeTargetOrAnOwnerChallengeIsKept() {
        PlanRow ownerChallenge = with(row(0, 0, "chest"), LENGTHENED, Technique.NONE, "owner", true);
        PlanRow other = with(row(0, 1, "back"), LENGTHENED, Technique.NONE, null, false);
        PlanRow plannerChallenge = with(row(1, 0, "chest"), LENGTHENED, Technique.NONE, null, false);
        PlanRow notLengthened = row(1, 1, "back");
        Input in = input(3, false, day(0, ownerChallenge, other), day(1, plannerChallenge, notLengthened));
        Week planned = week(List.of(), List.of(
            new Pick(0, 0, ownerChallenge.id(), Technique.PARTIALS, "owner", null),
            new Pick(1, 0, plannerChallenge.id(), Technique.PARTIALS, TechniquePlanner.SOURCE_PLANNER, "challenge")));

        TechniqueMerger.Merged m = TechniqueMerger.merge(in, planned, new Suggestion(List.of(), List.of(
            new ChallengeMove(0, other.id(), "Át a hátra."),
            new ChallengeMove(1, notLengthened.id(), "Nem nyújtott."),
            new ChallengeMove(0, plannerChallenge.id(), "Rossz nap."))));

        assertThat(m.changed()).isFalse();
    }

    @Test
    void emptyOrNullSuggestionKeepsThePlannerWeek() {
        PlanRow a = row(0, 0, "chest");
        Input in = input(3, false, day(0, a));
        Week planned = week(List.of(planner(a, Technique.MYO)), List.of());

        assertThat(TechniqueMerger.merge(in, planned, new Suggestion(null, null)).week()).isSameAs(planned);
        assertThat(TechniqueMerger.merge(in, planned, null).week()).isSameAs(planned);
    }
}
