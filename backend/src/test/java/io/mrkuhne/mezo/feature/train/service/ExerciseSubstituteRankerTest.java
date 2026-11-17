package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Candidate;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Context;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Label;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Ranked;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Result;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Signal;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Table test of the reasoned swap ranker (spec 2026-11-17 §6.2, mezo-r36n9.66). */
class ExerciseSubstituteRankerTest {

    private static final Map<UUID, String> NAMES = new HashMap<>();

    /** Fluent fixture builder; every default is a neutral chest-mid barbell press. */
    static final class X {
        final String name;
        String muscle = "chest-mid";
        String type = "compound";
        List<String> equipment = List.of("barbell", "bench");
        String pattern = "horizontal-push";
        List<String> secondary = List.of("triceps-lateral");
        List<String> joints = List.of("elbow");
        Boolean lengthened = false;
        String demand = "medium";
        BigDecimal stim = new BigDecimal("0.70");
        BigDecimal fatigue = new BigDecimal("0.50");
        boolean custom;
        boolean available = true;
        PainLevel pain = PainLevel.NONE;
        boolean doneBefore;

        X(String name) { this.name = name; }

        X muscle(String v) { muscle = v; return this; }
        X type(String v) { type = v; return this; }
        X equipment(String... v) { equipment = List.of(v); return this; }
        X pattern(String v) { pattern = v; return this; }
        X secondary(String... v) { secondary = List.of(v); return this; }
        X joints(String... v) { joints = List.of(v); return this; }
        X lengthened(boolean v) { lengthened = v; return this; }
        X demand(String v) { demand = v; return this; }
        X stim(String v) { stim = new BigDecimal(v); return this; }
        X fatigue(String v) { fatigue = new BigDecimal(v); return this; }
        X unavailable() { available = false; return this; }
        X pain(PainLevel v) { pain = v; return this; }
        X done() { doneBefore = true; return this; }
        X custom() {
            custom = true; equipment = null; pattern = null; secondary = null; joints = null;
            lengthened = null; demand = null; stim = null; fatigue = null;
            return this;
        }

        Candidate c() {
            UUID id = UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8));
            NAMES.put(id, name);
            return new Candidate(id, muscle, type, equipment, pattern, secondary, joints, lengthened, demand,
                stim, fatigue, custom, available, pain, doneBefore);
        }
    }

    static X x(String name) { return new X(name); }

    // ── the bench-press slot (mirrors the spike) ──
    static final Candidate BENCH = x("Barbell Bench Press").equipment("barbell", "bench")
        .secondary("triceps-lateral", "shoulder-front").joints("shoulder", "elbow").demand("high")
        .stim("0.85").fatigue("0.70").c();
    static final X DB_BENCH = x("Dumbbell Bench Press").equipment("dumbbell", "bench")
        .secondary("triceps-lateral", "shoulder-front").joints("shoulder", "elbow").demand("medium")
        .stim("0.85").fatigue("0.60");
    static final X MACHINE_PRESS = x("Machine Chest Press").equipment("machine")
        .secondary("triceps-lateral", "shoulder-front").joints("shoulder", "elbow").demand("low")
        .stim("0.85").fatigue("0.60");

    // ── the hack-squat slot ──
    static final Candidate HACK = x("Hack Squat").muscle("quad").equipment("machine").pattern("squat")
        .secondary("glute").joints("knee", "hip").demand("low").c();

    static Context ctx() { return new Context(null, false, Set.of(), Set.of()); }

    static Context goal(String preset) { return new Context(preset, false, Set.of(), Set.of()); }

    static List<String> names(Result r) {
        return r.suggestions().stream().map(s -> NAMES.get(s.id())).toList();
    }

    static Ranked ranked(Result r, String name) {
        return r.suggestions().stream().filter(s -> name.equals(NAMES.get(s.id()))).findFirst().orElseThrow();
    }

    static List<Candidate> pool(X... xs) {
        return Arrays.stream(xs).map(X::c).toList();
    }

    @Test
    void rank_shouldPutSameTypeAboveOtherType() {
        var r = ExerciseSubstituteRanker.rank(BENCH, pool(
            x("Cable Fly").type("isolation").pattern("fly").equipment("cable").demand("low").done(),
            x("Push-Up").equipment("bodyweight")), ctx());
        assertThat(names(r)).containsExactly("Push-Up", "Cable Fly");
        assertThat(ranked(r, "Push-Up").signals().get(0)).isEqualTo(Signal.SAME_ROLE);
        assertThat(ranked(r, "Cable Fly").signals().get(0)).isEqualTo(Signal.OTHER_TYPE);
    }

    @Test
    void rank_shouldPutSamePatternAboveOtherPattern_withinType() {
        var r = ExerciseSubstituteRanker.rank(BENCH, pool(
            x("Decline Dip Press").pattern("vertical-push").done(),
            x("Floor Press")), ctx());
        assertThat(names(r)).containsExactly("Floor Press", "Decline Dip Press");
    }

    @Test
    void rank_shouldPreferSecondaryMuscleOverlap_whenTypeAndPatternMatch() {
        var r = ExerciseSubstituteRanker.rank(BENCH, pool(
            x("Narrow Press").secondary("biceps-long").done(),
            x("Wide Press").secondary("triceps-lateral", "shoulder-front")), ctx());
        assertThat(names(r)).containsExactly("Wide Press", "Narrow Press");
    }

    @Test
    void rank_shouldDemoteSharedJointsAndLiftGuidedLowDemand_whenSoreNow() {
        List<Candidate> pool = pool(
            x("Shoulder Heavy").joints("shoulder").fatigue("0.20"),
            x("Wrist Free").joints("wrist").fatigue("0.40"),
            x("Wrist Machine").joints("wrist").equipment("machine").demand("low").fatigue("0.60"));
        var calm = ExerciseSubstituteRanker.rank(BENCH, pool, new Context("cut-prep", false, Set.of(), Set.of()));
        assertThat(names(calm)).containsExactly("Shoulder Heavy", "Wrist Free", "Wrist Machine");

        var sore = ExerciseSubstituteRanker.rank(BENCH, pool, new Context("cut-prep", true, Set.of(), Set.of()));
        assertThat(names(sore)).containsExactly("Wrist Machine", "Wrist Free", "Shoulder Heavy");
        assertThat(ranked(sore, "Wrist Free").signals()).containsExactly(Signal.SAME_ROLE, Signal.SPARES_JOINT);
    }

    @Test
    void rank_shouldDemoteShoulderLoading_whenShoulderPainToday() {
        List<Candidate> pool = pool(
            x("Shoulder Loader").joints("shoulder", "elbow").fatigue("0.20"),
            x("Elbow Only").joints("elbow").fatigue("0.60"));
        assertThat(names(ExerciseSubstituteRanker.rank(BENCH, pool, goal("cut-prep"))))
            .containsExactly("Shoulder Loader", "Elbow Only");

        var r = ExerciseSubstituteRanker.rank(BENCH, pool, new Context("cut-prep", false, Set.of("shoulder"), Set.of()));
        assertThat(names(r)).containsExactly("Elbow Only", "Shoulder Loader");
        assertThat(ranked(r, "Elbow Only").signals()).containsExactly(Signal.SAME_ROLE, Signal.PAIN_TODAY);
    }

    @Test
    void rank_shouldDemoteMildPain() {
        var r = ExerciseSubstituteRanker.rank(BENCH, pool(
            x("Mild Last Time").pain(PainLevel.MILD).fatigue("0.20"),
            x("Fine Last Time").fatigue("0.60")), goal("cut-prep"));
        assertThat(names(r)).containsExactly("Fine Last Time", "Mild Last Time");
        assertThat(ranked(r, "Mild Last Time").signals()).containsExactly(Signal.SAME_ROLE, Signal.MILD_BEFORE);
    }

    @Test
    void rank_shouldLeaveOutStrongPain_withHurtBeforeLabel() {
        Candidate strong = x("Hurt Press").pain(PainLevel.STRONG).c();
        var r = ExerciseSubstituteRanker.rank(BENCH, List.of(strong, DB_BENCH.c()), ctx());
        assertThat(names(r)).containsExactly("Dumbbell Bench Press");
        assertThat(r.labels()).containsEntry(strong.id(), Label.HURT_BEFORE);
    }

    @Test
    void rank_shouldLeaveOutUnavailable_withNoEquipmentLabel() {
        Candidate gone = x("Smith Press").equipment("smith").unavailable().c();
        var r = ExerciseSubstituteRanker.rank(BENCH, List.of(gone, DB_BENCH.c()), ctx());
        assertThat(names(r)).containsExactly("Dumbbell Bench Press");
        assertThat(r.labels()).containsEntry(gone.id(), Label.NO_EQUIPMENT);
    }

    @Test
    void rank_shouldLeaveOutPlyo_whenOutgoingIsNotPlyo() {
        X plyo = x("Plyo Push-Up").type("plyo").equipment("bodyweight").pattern("jump");
        var r = ExerciseSubstituteRanker.rank(BENCH, pool(plyo, DB_BENCH), ctx());
        assertThat(names(r)).containsExactly("Dumbbell Bench Press");
        assertThat(r.labels()).isEmpty();

        Candidate plyoOut = x("Clap Push-Up").type("plyo").equipment("bodyweight").pattern("jump").c();
        assertThat(names(ExerciseSubstituteRanker.rank(plyoOut, pool(plyo), ctx()))).containsExactly("Plyo Push-Up");
    }

    @Test
    void rank_shouldPutFreeWeightFirst_forStrength_andGuidedFirst_forHypertrophy() {
        List<Candidate> pool = pool(MACHINE_PRESS, DB_BENCH);
        var strength = ExerciseSubstituteRanker.rank(BENCH, pool, goal("strength"));
        assertThat(names(strength)).containsExactly("Dumbbell Bench Press", "Machine Chest Press");
        assertThat(ranked(strength, "Dumbbell Bench Press").signals())
            .containsExactly(Signal.SAME_ROLE, Signal.GOAL_STRENGTH);

        var hyper = ExerciseSubstituteRanker.rank(BENCH, pool, goal("hypertrophy"));
        assertThat(names(hyper)).containsExactly("Machine Chest Press", "Dumbbell Bench Press");
        assertThat(ranked(hyper, "Machine Chest Press").signals())
            .containsExactly(Signal.SAME_ROLE, Signal.GOAL_HYPERTROPHY);
    }

    @Test
    void rank_shouldTreatNullUnknownSportAndErohipertrofia_asHypertrophy() {
        List<Candidate> pool = pool(DB_BENCH, MACHINE_PRESS);
        for (String preset : new String[] {null, "sport", "erohipertrofia", "something-new"}) {
            assertThat(names(ExerciseSubstituteRanker.rank(BENCH, pool, goal(preset))))
                .as("preset %s", preset)
                .containsExactly("Machine Chest Press", "Dumbbell Bench Press");
        }
    }

    @Test
    void rank_shouldPutLowerFatigueFirst_forCutPrepAndRecovery() {
        List<Candidate> pool = pool(
            x("Tiring Press").equipment("machine").demand("low").fatigue("0.80"),
            x("Easy Press").fatigue("0.30"));
        for (String preset : new String[] {"cut-prep", "recovery"}) {
            var r = ExerciseSubstituteRanker.rank(BENCH, pool, goal(preset));
            assertThat(names(r)).as("preset %s", preset).containsExactly("Easy Press", "Tiring Press");
            assertThat(ranked(r, "Easy Press").signals()).containsExactly(Signal.SAME_ROLE, Signal.GOAL_LOW_FATIGUE);
        }
    }

    @Test
    void rank_shouldUseLengthened_onlyToBreakAnExactTie() {
        var tie = ExerciseSubstituteRanker.rank(BENCH, pool(
            x("Short Press"), x("Long Press").lengthened(true)), ctx());
        assertThat(names(tie)).containsExactly("Long Press", "Short Press");
        assertThat(ranked(tie, "Long Press").signals()).containsExactly(Signal.SAME_ROLE, Signal.LENGTHENED);

        var trackBeats = ExerciseSubstituteRanker.rank(BENCH, pool(
            x("Long Press 2").lengthened(true), x("Known Press").done()), ctx());
        assertThat(names(trackBeats)).containsExactly("Known Press", "Long Press 2");

        var goalBeats = ExerciseSubstituteRanker.rank(BENCH, pool(
            x("Long Press 3").lengthened(true), x("Efficient Press").stim("0.90").fatigue("0.40")), ctx());
        assertThat(names(goalBeats)).containsExactly("Efficient Press", "Long Press 3");
    }

    @Test
    void rank_shouldPutDoneBeforeAboveNeverDone_atEqualFit() {
        var r = ExerciseSubstituteRanker.rank(BENCH, pool(x("New Press"), x("Logged Press").done()), ctx());
        assertThat(names(r)).containsExactly("Logged Press", "New Press");
        assertThat(ranked(r, "Logged Press").signals()).containsExactly(Signal.SAME_ROLE, Signal.DONE_BEFORE);
    }

    @Test
    void rank_shouldSkipExercisesInTodaysWorkout_andTheOutgoingOne() {
        Candidate inToday = DB_BENCH.c();
        var r = ExerciseSubstituteRanker.rank(BENCH, List.of(BENCH, inToday, MACHINE_PRESS.c()),
            new Context(null, false, Set.of(), Set.of(inToday.id())));
        assertThat(names(r)).containsExactly("Machine Chest Press");
    }

    @Test
    void rank_shouldRankCustomAfterAttributedOfSameType_withCustomSignal() {
        var r = ExerciseSubstituteRanker.rank(BENCH, pool(
            x("My Own Press").custom(),
            x("Pec Deck").type("isolation").pattern("fly").equipment("machine").demand("low"),
            x("Odd Compound").pattern("vertical-push")), ctx());
        assertThat(names(r)).containsExactly("Odd Compound", "My Own Press", "Pec Deck");
        assertThat(ranked(r, "My Own Press").signals()).containsExactly(Signal.SAME_ROLE, Signal.CUSTOM);
    }

    @Test
    void rank_shouldNotFail_whenOutgoingIsCustom() {
        Candidate customOut = x("My Bench").custom().c();
        var r = ExerciseSubstituteRanker.rank(customOut, pool(DB_BENCH, x("Fly").type("isolation").pattern("fly")),
            new Context(null, true, Set.of("shoulder"), Set.of()));
        assertThat(names(r)).containsExactly("Dumbbell Bench Press", "Fly");
    }

    @Test
    void rank_shouldWidenToSamePatternInRegion_whenFewerThanThreeRemain() {
        List<Candidate> pool = pool(
            DB_BENCH,
            x("Incline Barbell Press").muscle("chest-upper"),
            x("Incline Fly").muscle("chest-upper").type("isolation").pattern("fly"),
            x("Overhead Press").muscle("shoulder-front").pattern("horizontal-push"),
            x("Unavailable Incline").muscle("chest-upper").unavailable());
        var r = ExerciseSubstituteRanker.rank(BENCH, pool, ctx());
        assertThat(names(r)).containsExactly("Dumbbell Bench Press", "Incline Barbell Press");
    }

    @Test
    void rank_shouldNotWiden_whenThreeSameMuscleRemain() {
        List<Candidate> pool = pool(DB_BENCH, MACHINE_PRESS, x("Floor Press"),
            x("Incline Barbell Press").muscle("chest-upper"));
        assertThat(names(ExerciseSubstituteRanker.rank(BENCH, pool, ctx())))
            .doesNotContain("Incline Barbell Press").hasSize(3);
    }

    @Test
    void rank_shouldWidenWithinBackRegion_acrossBackTokens() {
        Candidate row = x("Barbell Row").muscle("back-mid").pattern("horizontal-pull").c();
        var r = ExerciseSubstituteRanker.rank(row, pool(
            x("Cable Row Wide").muscle("back-wide").pattern("horizontal-pull"),
            x("Face Pull").muscle("shoulder-rear").pattern("horizontal-pull")), ctx());
        assertThat(names(r)).containsExactly("Cable Row Wide");
    }

    @Test
    void rank_shouldReturnEmptySuggestionsWithLabels_whenEverythingIsFiltered() {
        Candidate a = x("Gone Press").unavailable().c();
        Candidate b = x("Hurt Press 2").pain(PainLevel.STRONG).c();
        var r = ExerciseSubstituteRanker.rank(BENCH, List.of(a, b), ctx());
        assertThat(r.suggestions()).isEmpty();
        assertThat(r.labels()).containsOnly(Map.entry(a.id(), Label.NO_EQUIPMENT), Map.entry(b.id(), Label.HURT_BEFORE));
    }

    @Test
    void rank_shouldReturnAtMostFive() {
        List<Candidate> pool = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            pool.add(x("Press " + i).c());
        }
        var r = ExerciseSubstituteRanker.rank(BENCH, pool, ctx());
        assertThat(r.suggestions()).hasSize(5);
        assertThat(names(r)).containsExactly("Press 0", "Press 1", "Press 2", "Press 3", "Press 4");
    }

    @Test
    void rank_shouldLetRoleDominateEveryLowerTier() {
        Context c = new Context("hypertrophy", true, Set.of("shoulder"), Set.of());
        var r = ExerciseSubstituteRanker.rank(BENCH, pool(
            x("Gifted Fly").type("isolation").pattern("horizontal-push").equipment("machine").demand("low")
                .joints("knee").stim("0.94").fatigue("0.10").lengthened(true).done(),
            x("Burdened Press").pattern("vertical-push").equipment("barbell").demand("high")
                .joints("shoulder", "elbow").pain(PainLevel.MILD).stim("0.30").fatigue("0.90")), c);
        assertThat(names(r)).containsExactly("Burdened Press", "Gifted Fly");
    }

    @Test
    void rank_shouldWorkOnTheHackSquatSlot() {
        var r = ExerciseSubstituteRanker.rank(HACK, pool(
            x("Leg Extension").muscle("quad").type("isolation").equipment("machine").pattern("knee-extension")
                .joints("knee").demand("low"),
            x("Back Squat").muscle("quad").equipment("barbell").pattern("squat").secondary("glute", "back-lower")
                .joints("knee", "hip", "lower-back").demand("high"),
            x("Leg Press").muscle("quad").equipment("machine").pattern("squat").secondary("glute")
                .joints("knee", "hip").demand("low").done()), goal("strength"));
        assertThat(names(r)).containsExactly("Back Squat", "Leg Press", "Leg Extension");
    }
}
