package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.DayResult;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.Fit;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.Input;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.MuscleResult;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.PlanDay;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.PlanExercise;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.ProposalEdit;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.Result;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PlanEvaluatorTest {

    private static final VolumeProperties PROPS;
    static {
        Map<String, VolumeProperties.Baseline> b = new LinkedHashMap<>();
        b.put("chest", new VolumeProperties.Baseline(8, 14, 20));
        b.put("back", new VolumeProperties.Baseline(10, 16, 22));
        b.put("shoulder", new VolumeProperties.Baseline(8, 12, 18));
        b.put("biceps", new VolumeProperties.Baseline(6, 10, 14));
        b.put("triceps", new VolumeProperties.Baseline(6, 10, 14));
        b.put("quad", new VolumeProperties.Baseline(8, 12, 18));
        b.put("ham", new VolumeProperties.Baseline(6, 10, 14));
        b.put("glute", new VolumeProperties.Baseline(8, 12, 18));
        b.put("calf", new VolumeProperties.Baseline(6, 10, 16));
        PROPS = new VolumeProperties(new BigDecimal("0.5"), 2, b, new VolumeProperties.Bands(3, 2, 5, 8, 1, 2, 2, 4),
            new VolumeProperties.WeeklyReview("auto"), 2, 1, 1, new VolumeProperties.Signals(3, 2, 7),
            new VolumeProperties.Evaluator(new BigDecimal("2.4"), new BigDecimal("1.0"), 6, 40, new BigDecimal("1")),
            Map.of("volleyball", List.of("quad", "ham", "glute", "calf")));
    }

    private static PlanExercise ex(String group, int sets) {
        return new PlanExercise(group, sets, 0, true);
    }

    private static Input input(List<PlanDay> days, Map<String, String> prio, Set<String> sport, Integer target,
                               Set<Integer> sportDays) {
        return new Input(4, List.of("MEV", "MAV", "MAV", "Deload"), days, prio, sport, false, target, sportDays, PROPS, false);
    }

    private static Input styledInput(List<PlanDay> days) {
        return new Input(4, List.of("MEV", "MAV", "MAV", "Deload"), days, Map.of(), Set.of(), false, null, Set.of(),
            PROPS, true);
    }

    private static PlanDay restDay(Integer... rests) {
        List<PlanExercise> list = new ArrayList<>();
        for (Integer r : rests) {
            list.add(new PlanExercise("chest", 3, 2, true, 0, r));
        }
        return new PlanDay("Hét", list);
    }

    @Test void styledReferenceDay() {
        int minutes = PlanEvaluator.evaluate(styledInput(List.of(restDay(150, 150, 90, 90, 90))))
            .days().get(0).minutesEstimate();
        assertThat(minutes).isEqualTo(60);   // 6x190/60 + 9x130/60 + 10 + 5 + 6 = 59.5, HALF_UP
        assertThat(minutes).isBetween(35, 60);
    }

    @Test void unstyledUnchanged() {
        Input in = new Input(4, List.of("MEV", "MAV", "MAV", "Deload"),
            List.of(restDay(150, 150, 90, 90, 90)), Map.of(), Set.of(), false, null, Set.of(), PROPS, false);
        assertThat(PlanEvaluator.evaluate(in).days().get(0).minutesEstimate()).isEqualTo(52);   // 2.4x15 + 10 + 6
    }

    @Test void styledNullRestFallsBack() {
        // null rest = 2.4*60 - 40 = 104 s -> every set costs the flat 2.4 min; + 10 warm-up + 5 transition + 6
        int minutes = PlanEvaluator.evaluate(styledInput(List.of(restDay(null, null, null, null, null))))
            .days().get(0).minutesEstimate();
        assertThat(minutes).isEqualTo(57);   // 36 + 10 + 5 + 6
    }

    private static Input input(List<PlanDay> days, Map<String, String> prio) {
        return input(days, prio, Set.of(), null, Set.of());
    }

    private static MuscleResult muscle(Result r, String name) {
        return r.muscles().stream().filter(m -> m.muscle().equals(name)).findFirst().orElseThrow();
    }

    @Test void insideBandNoProposal() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(ex("chest", 4))),
            new PlanDay("Kedd", List.of(ex("chest", 4)))), Map.of()));   // 8 = grow low
        MuscleResult m = muscle(r, "chest");
        assertThat(m.fit()).isEqualTo(Fit.INSIDE);
        assertThat(m.diff()).isZero();
        assertThat(m.proposal()).isEmpty();
        assertThat(m.proposalBlocked()).isFalse();
        assertThat(m.spread()).hasSize(2);
    }

    @Test void belowProposesOntoTheFewestSetsExercise() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(ex("chest", 4), ex("chest", 2))),
            new PlanDay("Kedd", List.of(ex("chest", 1)))), Map.of()));   // 7, low 8
        MuscleResult m = muscle(r, "chest");
        assertThat(m.fit()).isEqualTo(Fit.BELOW);
        assertThat(m.diff()).isEqualTo(1);
        assertThat(m.proposal()).containsExactly(new ProposalEdit(1, 0, 1));
    }

    @Test void aboveProposesDownFromTheBiggest() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(ex("chest", 5), ex("chest", 4))),
            new PlanDay("Kedd", List.of(ex("chest", 6 - 1 + 1)))), Map.of()));   // 15, high 14
        MuscleResult m = muscle(r, "chest");
        assertThat(m.fit()).isEqualTo(Fit.ABOVE);
        assertThat(m.diff()).isEqualTo(-1);
        assertThat(m.proposal()).containsExactly(new ProposalEdit(1, 0, -1));
    }

    @Test void capsBlockTheProposal() {
        // 3 chest exercises of 5 on three days = 15 (grow 8..14 -> above is not it); use below with caps full:
        // one exercise at 5 sets, group low 8 -> only one slot, at exercise-cap -> blocked
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(ex("chest", 5)))), Map.of()));
        MuscleResult m = muscle(r, "chest");
        assertThat(m.fit()).isEqualTo(Fit.BELOW);
        assertThat(m.proposal()).isEmpty();
        assertThat(m.proposalBlocked()).isTrue();
    }

    @Test void emphasizedButUntrainedIsBlocked() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(ex("chest", 8)))),
            Map.of("calf", "emphasize")));
        MuscleResult m = muscle(r, "calf");
        assertThat(m.tier()).isEqualTo(PriorityTier.EMPHASIZE);
        assertThat(m.weeklySets()).isZero();
        assertThat(m.fit()).isEqualTo(Fit.BELOW);
        assertThat(m.diff()).isEqualTo(m.band().low());
        assertThat(m.spread()).isEmpty();
        assertThat(m.proposalBlocked()).isTrue();
        assertThat(r.muscles().stream().map(MuscleResult::muscle)).containsExactly("chest", "calf");
    }

    @Test void coreIsNeverJudgedButCountsForMinutes() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(
            new PlanExercise("core", 3, 0, true), new PlanExercise(null, 2, 0, true)))), Map.of()));
        assertThat(r.muscles()).isEmpty();
        assertThat(r.days().get(0).minutesEstimate()).isEqualTo(18);   // 12 + 6
        assertThat(r.path()).allSatisfy(w -> assertThat(w.total()).isZero());
    }

    @Test void minutesAndOverTarget() {
        List<PlanDay> days = List.of(new PlanDay("Hét", List.of(
            new PlanExercise("chest", 3, 1, true), new PlanExercise("back", 3, 1, true))), new PlanDay("Kedd", List.of()));
        Result r = PlanEvaluator.evaluate(input(days, Map.of(), Set.of(), 20, Set.of()));
        DayResult d = r.days().get(0);
        assertThat(d.minutesEstimate()).isEqualTo(22);   // 14.4 + 2 + 6
        assertThat(d.overTarget()).isTrue();
        assertThat(r.days().get(1).minutesEstimate()).isZero();
        assertThat(PlanEvaluator.evaluate(input(days, Map.of())).days().get(0).overTarget()).isNull();
    }

    /** A technique row weighs one extra set in the day's cap warnings and blocks a proposal at the cap (mezo-r36n9.80). */
    @Test void techniqueRowsWeighExtraAgainstTheCaps() {
        List<PlanDay> days = List.of(new PlanDay("Hét", List.of(
            new PlanExercise("chest", 4, 0, true, 1), new PlanExercise("chest", 4, 0, true))));   // 8 plain, 9 weighted
        Result r = PlanEvaluator.evaluate(input(days, Map.of()));
        DayResult d = r.days().get(0);
        assertThat(d.sessionCapWarnings()).singleElement()
            .satisfies(w -> assertThat(w.sets()).isEqualTo(9));
        assertThat(d.exerciseCapWarnings()).isEmpty();                     // 4 + 1 = 5 is AT the exercise cap
        assertThat(muscle(r, "chest").weeklySets()).isEqualTo(8);          // the band counts plain sets
        assertThat(PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(ex("chest", 4), ex("chest", 4)))),
            Map.of())).days().get(0).sessionCapWarnings()).isEmpty();
    }

    @Test void exemptExercisesCountForMinutesOnly() {
        List<PlanDay> days = List.of(new PlanDay("Hét", List.of(new PlanExercise("chest", 4, 0, false))));
        Result r = PlanEvaluator.evaluate(input(days, Map.of()));
        assertThat(r.muscles()).isEmpty();
        assertThat(r.days().get(0).minutesEstimate()).isEqualTo(16);   // 9.6 + 6
    }

    @Test void sessionCapWarning() {
        List<PlanDay> days = List.of(new PlanDay("Hét", List.of(ex("back", 5), ex("back", 4))));
        Result r = PlanEvaluator.evaluate(input(days, Map.of()));
        assertThat(r.days().get(0).sessionCapWarnings()).hasSize(1);
        assertThat(r.days().get(0).sessionCapWarnings().get(0).muscle()).isEqualTo("back");
        assertThat(r.days().get(0).sessionCapWarnings().get(0).sets()).isEqualTo(9);
        assertThat(r.days().get(0).sessionCapWarnings().get(0).cap()).isEqualTo(8);
    }

    @Test void exerciseCapWarning() {
        List<PlanDay> days = List.of(new PlanDay("Hét", List.of(ex("chest", 3), ex("chest", 7))));
        Result r = PlanEvaluator.evaluate(input(days, Map.of()));
        assertThat(r.days().get(0).exerciseCapWarnings()).hasSize(1);
        assertThat(r.days().get(0).exerciseCapWarnings().get(0).exerciseIndex()).isEqualTo(1);
        assertThat(r.days().get(0).exerciseCapWarnings().get(0).sets()).isEqualTo(7);
        assertThat(r.days().get(0).exerciseCapWarnings().get(0).cap()).isEqualTo(5);
    }

    @Test void explicitDayIndexIsReported() {
        List<PlanDay> days = List.of(new PlanDay("Csüt", List.of(ex("chest", 3)), 3));
        Result r = PlanEvaluator.evaluate(input(days, Map.of()));
        assertThat(r.days().get(0).dayIndex()).isEqualTo(3);
        assertThat(r.muscles().get(0).spread().get(0).dayIndex()).isEqualTo(3);
    }

    @Test void sportSameDay() {
        List<PlanDay> days = List.of(new PlanDay("Kedd", List.of(ex("chest", 3))),
            new PlanDay("Szo", List.of(ex("chest", 3))), new PlanDay("???", List.of(ex("chest", 3))));
        Result r = PlanEvaluator.evaluate(input(days, Map.of(), Set.of(), null, Set.of(1)));
        assertThat(r.days().stream().map(DayResult::sportSameDay)).containsExactly(true, false, false);
    }

    @Test void ownersBlockShape() {
        List<PlanDay> days = new ArrayList<>();
        days.add(new PlanDay("Hét", List.of(ex("biceps", 6), ex("quad", 3), ex("chest", 2))));
        days.add(new PlanDay("Kedd", List.of(ex("biceps", 5))));
        Result r = PlanEvaluator.evaluate(input(days, Map.of("quad", "maintain", "chest", "maintain"),
            Set.of("quad"), null, Set.of()));
        MuscleResult biceps = muscle(r, "biceps");
        assertThat(biceps.weeklySets()).isEqualTo(11);
        assertThat(biceps.fit()).isEqualTo(Fit.ABOVE);
        assertThat(biceps.diff()).isEqualTo(-1);
        assertThat(biceps.proposal()).containsExactly(new ProposalEdit(0, 0, -1));
        MuscleResult quad = muscle(r, "quad");
        assertThat(quad.band().low()).isEqualTo(2);
        assertThat(quad.band().high()).isEqualTo(5);
        assertThat(quad.fit()).isEqualTo(Fit.INSIDE);
        MuscleResult chest = muscle(r, "chest");
        assertThat(chest.fit()).isEqualTo(Fit.BELOW);
        assertThat(chest.band().low()).isEqualTo(3);
        assertThat(chest.proposal()).containsExactly(new ProposalEdit(0, 2, 1));
        assertThat(r.muscles().stream().map(MuscleResult::muscle)).containsExactly("chest", "biceps", "quad");
    }

    @Test void pathStartsFromThePlan() {
        List<PlanDay> days = List.of(new PlanDay("Hét", List.of(ex("chest", 4))), new PlanDay("Kedd", List.of(ex("chest", 4))));
        Result r = PlanEvaluator.evaluate(input(days, Map.of()));
        assertThat(r.path()).hasSize(4);
        assertThat(r.path().get(0).week()).isEqualTo(1);
        assertThat(r.path().get(0).total()).isEqualTo(8);
        assertThat(r.path().get(1).total()).isEqualTo(9);
        assertThat(r.path().get(3).phase()).isEqualTo("Deload");
    }

    // --- why (basis) + heavy back-to-back days (mezo-r36n9.113, Task 4) ---

    @Test void consecutiveHeavyFlagged() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(ex("back", 4), ex("back", 3))),
            new PlanDay("Kedd", List.of(ex("back", 4)))), Map.of()));
        assertThat(muscle(r, "back").consecutiveHeavy())
            .containsExactly(new PlanEvaluator.ConsecutiveHeavy(0, 1, 7, 4));
    }

    @Test void fullBodyLightNotFlagged() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(ex("back", 3))),
            new PlanDay("Kedd", List.of(ex("back", 3)))), Map.of()));
        assertThat(muscle(r, "back").consecutiveHeavy()).isEmpty();
    }

    @Test void coreExempt() {
        // even with a configured core landmark, core never counts as a heavy back-to-back day
        Map<String, VolumeProperties.Baseline> b = new LinkedHashMap<>(PROPS.baselines());
        b.put("core", new VolumeProperties.Baseline(6, 10, 16));
        VolumeProperties withCore = new VolumeProperties(PROPS.deloadFraction(), PROPS.grindRirGap(), b,
            PROPS.bands(), PROPS.weeklyReview(), PROPS.stepEmphasize(), PROPS.stepGrow(), PROPS.stepDeficit(),
            PROPS.signals(), PROPS.evaluator(), PROPS.sportGroupsBySport());
        Result r = PlanEvaluator.evaluate(new Input(4, List.of("MEV", "MAV", "MAV", "Deload"),
            List.of(new PlanDay("Hét", List.of(ex("core", 7))), new PlanDay("Kedd", List.of(ex("core", 4)))),
            Map.of(), Set.of(), false, null, Set.of(), withCore, false));
        assertThat(muscle(r, "core").consecutiveHeavy()).isEmpty();
    }

    @Test void sundayMondayWraps() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét", List.of(ex("back", 4))),
            new PlanDay("Sze", List.of(ex("back", 6))), new PlanDay("Vas", List.of(ex("back", 5)))), Map.of()));
        assertThat(muscle(r, "back").consecutiveHeavy())
            .containsExactly(new PlanEvaluator.ConsecutiveHeavy(2, 0, 5, 4));
    }

    @Test void nonWeekdayLabelSkipped() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("A nap", List.of(ex("back", 6))),
            new PlanDay("Hét", List.of(ex("back", 6)))), Map.of()));
        assertThat(muscle(r, "back").consecutiveHeavy()).isEmpty();
    }

    @Test void basisNamesWhyTheBandIsWhatItIs() {
        Result r = PlanEvaluator.evaluate(input(List.of(new PlanDay("Hét",
                List.of(ex("chest", 4), ex("back", 4), ex("quad", 4)))),
            Map.of("chest", "maintain"), Set.of("quad"), null, Set.of()));
        assertThat(muscle(r, "chest").basis()).isEqualTo(PlanEvaluator.BasisSource.MAINTAIN_THIRD);
        assertThat(muscle(r, "back").basis()).isEqualTo(PlanEvaluator.BasisSource.LANDMARKS_RP);
        assertThat(muscle(r, "quad").basis()).isEqualTo(PlanEvaluator.BasisSource.SPORT_ADJUSTED);
    }
}
