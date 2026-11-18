package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.Prescription;
import io.mrkuhne.mezo.feature.train.service.SetRecommendationService;
import io.mrkuhne.mezo.feature.train.service.SetRecommendationService.PrescribeOptions;
import io.mrkuhne.mezo.feature.train.service.StyleContext;
import io.mrkuhne.mezo.feature.train.service.TrainingStyle;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class SetRecommendationServiceIT extends AbstractIntegrationTest {

    @Autowired SetRecommendationService svc;
    @Autowired TrainPopulator train;

    @Test
    void testPrescribe_shouldSeedFromAnchor_whenNoHistory() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setAnchorWeightKg(BigDecimal.valueOf(60));
        train.save(ex);

        Prescription p = svc.prescribe(owner, ex, false);

        // 2 warmup + 3 working; working weight = anchor 60
        assertThat(p.sets()).hasSize(5);
        assertThat(p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP)).hasSize(2);
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work).hasSize(3);
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(60));
        assertThat(work.get(0).getTargetReps()).isEqualTo(8);        // repMax
        assertThat(work.get(0).getTargetRIR()).isEqualTo(0);
        // warmups ramp off 60: 50% -> 30, 75% -> 45
        var warm = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP).toList();
        assertThat(warm.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(30));
        assertThat(warm.get(1).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(45));
    }

    @Test
    void testPrescribe_shouldLeaveWeightNull_whenNoHistoryAndNoAnchor() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");

        Prescription p = svc.prescribe(owner, ex, false);

        // base==null must NOT suppress warmups (mezo-eerq): the FE needs the warmup rows to label
        // B1/B2 and hide RIR — they simply carry a null target weight, like the working sets.
        assertThat(p.sets()).hasSize(5);
        assertThat(p.sets()).allSatisfy(s -> assertThat(s.getTargetWeightKg()).isNull());
        var warm = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP).toList();
        assertThat(warm).hasSize(2);
        // count-keyed ladder for n=2: [50%x8, 75%x3] — absolute reps, not repMax-derived
        assertThat(warm.get(0).getTargetReps()).isEqualTo(8);
        assertThat(warm.get(1).getTargetReps()).isEqualTo(3);
        assertThat(warm).allSatisfy(s -> assertThat(s.getTargetRIR()).isNull());
    }

    @Test
    void testPrescribe_shouldRampThreeRungs_whenWarmupSetsIsThree() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setAnchorWeightKg(BigDecimal.valueOf(100));
        ex.setWarmupSets(3);
        train.save(ex);

        Prescription p = svc.prescribe(owner, ex, false);

        var warm = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP).toList();
        assertThat(warm).hasSize(3);
        assertThat(warm.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(50));
        assertThat(warm.get(0).getTargetReps()).isEqualTo(8);
        assertThat(warm.get(1).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(70));
        assertThat(warm.get(1).getTargetReps()).isEqualTo(4);
        assertThat(warm.get(2).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(90));
        assertThat(warm.get(2).getTargetReps()).isEqualTo(2);
        assertThat(warm).allSatisfy(s -> assertThat(s.getTargetRIR()).isNull());
    }

    @Test
    void testPrescribe_shouldEmitSingleRung_whenWarmupSetsIsOne() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setAnchorWeightKg(BigDecimal.valueOf(100));
        ex.setWarmupSets(1);
        train.save(ex);

        Prescription p = svc.prescribe(owner, ex, false);

        var warm = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP).toList();
        assertThat(warm).hasSize(1);
        assertThat(warm.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(70));
        assertThat(warm.get(0).getTargetReps()).isEqualTo(4);
    }

    @Test
    void testPrescribe_shouldPrependRepeatedFirstRung_whenWarmupSetsExceedsThree() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setAnchorWeightKg(BigDecimal.valueOf(100));
        ex.setWarmupSets(4);
        train.save(ex);

        Prescription p = svc.prescribe(owner, ex, false);

        var warm = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP).toList();
        assertThat(warm).hasSize(4);
        assertThat(warm.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(50));
        assertThat(warm.get(0).getTargetReps()).isEqualTo(8);
        assertThat(warm.get(1).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(50));
        assertThat(warm.get(1).getTargetReps()).isEqualTo(8);
        assertThat(warm.get(2).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(70));
        assertThat(warm.get(2).getTargetReps()).isEqualTo(4);
        assertThat(warm.get(3).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(90));
        assertThat(warm.get(3).getTargetReps()).isEqualTo(2);
    }

    @Test
    void testPrescribe_shouldEmitNullWeightAbsoluteReps_whenBaseNullAndWarmupSetsIsThree() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setWarmupSets(3);
        train.save(ex);

        Prescription p = svc.prescribe(owner, ex, false);

        var warm = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP).toList();
        assertThat(warm).hasSize(3);
        assertThat(warm).allSatisfy(s -> assertThat(s.getTargetWeightKg()).isNull());
        assertThat(warm.get(0).getTargetReps()).isEqualTo(8);
        assertThat(warm.get(1).getTargetReps()).isEqualTo(4);
        assertThat(warm.get(2).getTargetReps()).isEqualTo(2);
        assertThat(warm).allSatisfy(s -> assertThat(s.getTargetRIR()).isNull());
    }

    @Test
    void testPrescribe_shouldExcludeSkippedWorkingSet_fromReference() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // a heavier SKIPPED working row (100kg) must not become the reference; only the valid 80×8 counts
        train.completedInstanceWithSets(owner, day.getId(), ex.getId(), sets -> {
            var skipped = train.set("working", BigDecimal.valueOf(100), 8, 0);
            skipped.setSkipped(true);
            sets.add(skipped);
            sets.add(train.set("working", BigDecimal.valueOf(80), 8, 0));
        });

        Prescription p = svc.prescribe(owner, ex, false);
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(82.5)); // 80 × 1.025 = 82 → nearest real weight 82.5
    }

    @Test
    void testPrescribe_shouldExcludeNullRepsWorkingSet_fromReference() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // a heavier working row with null reps (unlogged) must not become the reference; only 80×8 counts
        train.completedInstanceWithSets(owner, day.getId(), ex.getId(), sets -> {
            var nullReps = train.set("working", BigDecimal.valueOf(100), 8, 0);
            nullReps.setReps(null);
            sets.add(nullReps);
            sets.add(train.set("working", BigDecimal.valueOf(80), 8, 0));
        });

        Prescription p = svc.prescribe(owner, ex, false);
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(82.5)); // 80 × 1.025 = 82 → nearest real weight 82.5
    }

    @Test
    void testPrescribe_shouldAddIncrement_whenLastTopSetHitRepMax() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // completed instance with a working top set 8 × 77.5 (repMax=8 → compound 2.5 % step)
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(77.5), 8, 0);

        Prescription p = svc.prescribe(owner, ex, false);

        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(80)); // 77.5 × 1.025 = 79.4 → 80
        assertThat(p.rationale()).contains("+2,5 kg (+3%)");
    }

    @Test
    void testPrescribe_shouldHoldWeight_whenLastRepsInRange() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(80), 7, 0); // 7 in [6,8) → hold

        Prescription p = svc.prescribe(owner, ex, false);
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(80));
    }

    @Test
    void testPrescribe_shouldReduceWeight_whenLastRepsBelowRepMin() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(80), 4, 0); // 4 < 6, grind → 80 × 0.975 = 78 → 77.5

        Prescription p = svc.prescribe(owner, ex, false);
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(77.5));
    }

    @Test
    void testPrescribe_shouldIgnoreWarmupHistory_whenComputingBase() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // a heavier WARMUP row (100kg) must not become the reference; only working (80×8) counts
        train.completedInstanceWithSets(owner, day.getId(), ex.getId(), sets -> {
            sets.add(train.set("warmup", BigDecimal.valueOf(100), 8, 4));
            sets.add(train.set("working", BigDecimal.valueOf(80), 8, 0));
        });

        Prescription p = svc.prescribe(owner, ex, false);
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(82.5)); // 80 × 1.025 = 82 → nearest real weight 82.5
    }

    @Test
    void testPrescribe_shouldEmitWeightSignal_whenLastTopSetHitRepMax() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(60), 8, 0); // repMax hit → 60 × 1.025 = 61.5 → 62.5 (compound)

        Prescription p = svc.prescribe(owner, ex, false);

        assertThat(p.progression()).isNotNull();
        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(62.5));
        assertThat(p.progression().getDeltaKg()).isEqualByComparingTo(BigDecimal.valueOf(2.5));
    }

    @Test
    void testPrescribe_shouldEmitRepSignal_whenInRange() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(60), 7, 0); // 7 in [6,8) → build a rep

        Prescription p = svc.prescribe(owner, ex, false);

        assertThat(p.progression()).isNotNull();
        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.REP);
        assertThat(p.progression().getDeltaReps()).isEqualTo(1);
        assertThat(p.progression().getTargetReps()).isEqualTo(8);
    }

    @Test
    void testPrescribe_shouldEmitNullSignal_whenNoHistoryAndNoAnchor() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");

        Prescription p = svc.prescribe(owner, ex, false);

        assertThat(p.progression()).isNull();
        assertThat(p.rationale()).contains("Első alkalom");
    }

    @Test
    void testPrescribe_shouldProgressReps_whenLastTopSetWasZeroKgAtRepMax() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Hiperextenzió", "back", "isolation");
        // 0 kg logged = bodyweight; at the range top the proportional step divided by it (mezo-xbhrm)
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.ZERO, ex.getRepMax(), 2);

        Prescription p = svc.prescribe(owner, ex, false);

        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.REP);
        assertThat(p.rationale()).contains("Testsúlyos");
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isNull();
    }

    @Test
    void testPrescribe_shouldRegress_whenDeloadWeek() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(60), 8, 0);

        Prescription p = svc.prescribe(owner, ex, true);

        assertThat(p.progression()).isNotNull();
        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.DELOAD);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(55));
        assertThat(p.progression().getDeltaKg().signum()).isNegative();
    }

    @Test
    void testPrescribe_shouldLightenToLoadFactorWithRirFloor_whenComebackLoadFactor() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Guggolás", "quad", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(100), 8, 0);

        Prescription p = svc.prescribe(owner, ex, false, 3, false, new BigDecimal("0.90"), 3);

        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.DELOAD);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo("90");
        assertThat(p.progression().getDeltaKg()).isEqualByComparingTo("-10");
        assertThat(p.rationale()).isEqualTo("Visszatérő edzés — kb. 10%-kal könnyebb");
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work).hasSize(3).allSatisfy(s -> {
            assertThat(s.getTargetWeightKg()).isEqualByComparingTo("90");
            assertThat(s.getTargetRIR()).isEqualTo(3);
        });
    }

    @Test
    void testPrescribe_shouldKeepHold_whenLoadFactorSnapsBackToHeldBase() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Oldalemelés", "shoulders", "isolation");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(10), 8, 0);

        Prescription p = svc.prescribe(owner, ex, false, 3, false, new BigDecimal("0.90"), 3);

        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.HOLD);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo("10");
        assertThat(p.rationale()).doesNotContain("könnyebb");
    }

    @Test
    void testPrescribe_shouldBehaveAsBefore_whenLoadFactorNull() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Guggolás", "quad", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(100), 8, 0);

        Prescription plain = svc.prescribe(owner, ex, false, 3, false);
        Prescription p = svc.prescribe(owner, ex, false, 3, false, null, 0);

        assertThat(p.progression().getLever()).isEqualTo(plain.progression().getLever());
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo(plain.progression().getTargetWeightKg());
        assertThat(p.rationale()).isEqualTo(plain.rationale());
        assertThat(p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING))
            .allSatisfy(s -> assertThat(s.getTargetRIR()).isZero());
    }

    // ── rep-range-aware reference + styled prescription (mezo-r36n9.79, T1 Task 8) ──────────────

    private ExerciseEntity ranged(UUID owner, UUID day, String name, String muscle, String type,
                                  int repMin, int repMax, int rir) {
        ExerciseEntity e = train.createExercise(owner, day, name, muscle, type);
        e.setRepMin(repMin);
        e.setRepMax(repMax);
        e.setTargetRir(rir);
        return train.save(e);
    }

    /** A completed instance {@code daysAgo} with one working set snapshotted at its trained range. */
    private ExerciseSetEntity done(UUID owner, WorkoutSessionEntity day, ExerciseEntity ex, int daysAgo,
                                   String kg, int reps, int rir, int snapMin, int snapMax) {
        WorkoutSessionEntity inst = train.createWorkoutInstance(
            owner, day, LocalDate.now().minusDays(daysAgo), "completed");
        ExerciseSetEntity s = train.createLoggedSet(owner, ex.getId(), inst.getId(), 0, kg, reps, rir);
        s.setTargetRepMin(snapMin);
        s.setTargetRepMax(snapMax);
        return exerciseSetRepository.saveAndFlush(s);
    }

    private static PrescribeOptions styled(ExerciseEntity ex, StyleContext ctx) {
        return new PrescribeOptions(false, ex.getWorkingSets(), false, null, 0, ctx, LocalDate.now());
    }

    @Test
    void twiceAWeekDifferentRangesUseTheirOwnReference() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var heavyDay = train.createTemplateDay(owner, meso.getId(), "Hétfő");
        var lightDay = train.createTemplateDay(owner, meso.getId(), "Csütörtök");
        ExerciseEntity heavy = ranged(owner, heavyDay.getId(), "Fekvenyomás", "chest", "compound", 4, 6, 1);
        ExerciseEntity light = ranged(owner, lightDay.getId(), "Fekvenyomás", "chest", "compound", 10, 12, 1);
        done(owner, heavyDay, heavy, 7, "100", 5, 1, 4, 6);
        done(owner, lightDay, light, 4, "70", 11, 1, 10, 12);   // the newest instance overall

        Prescription forHeavy = svc.prescribe(owner, heavy, false);
        Prescription forLight = svc.prescribe(owner, light, false);

        // heavy day judged against its own 100×5 (in 4–6 → +1 rep), not against Thursday's 70×11
        assertThat(forHeavy.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.REP);
        assertThat(forHeavy.progression().getTargetWeightKg()).isEqualByComparingTo("100");
        assertThat(forHeavy.progression().getTargetReps()).isEqualTo(6);
        assertThat(forLight.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.REP);
        assertThat(forLight.progression().getTargetWeightKg()).isEqualByComparingTo("70");
        assertThat(forLight.progression().getTargetReps()).isEqualTo(12);
    }

    @Test
    void convertedReferenceAfterRangeChange() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = ranged(owner, day.getId(), "Fekvenyomás", "chest", "compound", 10, 12, 1);
        done(owner, day, ex, 10, "100", 5, 1, 4, 6); // inside its own 4–6, outside the new 10–12

        Prescription p = svc.prescribe(owner, ex, false);

        // e1RM 100 × (1 + 6/30) = 120 → at 10 reps @ RIR 1: 120 / (1 + 11/30) = 87.8 → 87.5 kg × 10
        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo("87.5");
        assertThat(p.progression().getTargetReps()).isEqualTo(10);
        assertThat(p.progression().getDeltaKg()).isEqualByComparingTo("-12.5");
        assertThat(p.rationale()).startsWith("Új tartomány (10–12)");
    }

    @Test
    void convertedReferenceOnDeloadWeekRegressesAfterConverting() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = ranged(owner, day.getId(), "Fekvenyomás", "chest", "compound", 10, 12, 1);
        done(owner, day, ex, 10, "100", 5, 1, 4, 6);

        Prescription p = svc.prescribe(owner, ex, true);

        // converted 87.5 × 0.9 = 78.75 → plate grid 80, reps at the floor
        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.DELOAD);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo("80");
        assertThat(p.progression().getTargetReps()).isEqualTo(10);
        assertThat(p.progression().getDeltaKg()).isEqualByComparingTo("-20");
    }

    @Test
    void inRangeDifferentRangeReferenceIsJudgedAsToday() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = ranged(owner, day.getId(), "Lábtolás", "quad", "compound", 8, 12, 1);
        done(owner, day, ex, 7, "145", 11, 1, 8, 10); // trained at 8–10, 11 reps lie in the new 8–12

        Prescription p = svc.prescribe(owner, ex, false);

        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.REP);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo("145");
        assertThat(p.progression().getTargetReps()).isEqualTo(12);
        assertThat(p.rationale()).isEqualTo("Múlt hét 11 rep a tartományban → +1 rep");
    }

    @Test
    void outOfOwnRangeReferenceIsNotConverted() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = ranged(owner, day.getId(), "Evezés", "back", "compound", 8, 12, 1);
        done(owner, day, ex, 7, "60", 6, 1, 8, 10); // 6 reps: under its own 8–10 AND the new 8–12

        Prescription p = svc.prescribe(owner, ex, false);

        // judged as today: under the floor at target effort → the proportional drop (60 × 0.975 → 57.5)
        assertThat(p.rationale()).doesNotContain("Új tartomány");
        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo("57.5");
        assertThat(p.rationale()).contains("a cél alatt");
    }

    @Test
    void styledPrescriptionCarriesReserveAndRest() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = ranged(owner, day.getId(), "Fekvenyomás", "chest", "compound", 6, 10, 2);
        done(owner, day, ex, 7, "80", 8, 1, 6, 10);

        Prescription p = svc.prescribe(owner, ex,
            styled(ex, new StyleContext(TrainingStyle.BALANCED, 1, 150, 3)));

        assertThat(p.sets()).allSatisfy(s -> assertThat(s.getRestSec()).isEqualTo(150));
        assertThat(p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING))
            .allSatisfy(s -> assertThat(s.getTargetRIR()).isEqualTo(1));
        assertThat(p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP))
            .allSatisfy(s -> assertThat(s.getTargetRIR()).isNull());
    }

    @Test
    void styledGrindHoldsWhenTwoRepsShortOfPrescribed() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = ranged(owner, day.getId(), "Fekvenyomás", "chest", "compound", 6, 10, 1);
        ExerciseSetEntity s = done(owner, day, ex, 7, "80", 8, 1, 6, 10);
        s.setTargetReps(10);
        exerciseSetRepository.saveAndFlush(s);

        Prescription unstyled = svc.prescribe(owner, ex, false);
        Prescription p = svc.prescribe(owner, ex, styled(ex, new StyleContext(TrainingStyle.BALANCED, 1, 150, 3)));

        // unstyled: RIR 1 on target → +1 rep. Styled at reserve 1: 8 of 10 prescribed reps is a grind → hold
        assertThat(unstyled.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.REP);
        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.HOLD);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo("80");
    }

    @Test
    void styledOvershootUsesTheStyleOverflow() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = ranged(owner, day.getId(), "Oldalemelés", "shoulders", "isolation", 12, 15, 2);
        done(owner, day, ex, 7, "10", 18, 2, 12, 15); // 12.5 kg would be +25 % → reps first

        Prescription unstyled = svc.prescribe(owner, ex, false);
        Prescription volume = svc.prescribe(owner, ex, styled(ex, new StyleContext(TrainingStyle.VOLUME, 2, 75, 4)));

        // 18 = 15 + 3: unstyled overflow (3) is spent → forced jump; volume's overflow (4) builds one more rep
        assertThat(unstyled.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(volume.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.REP);
        assertThat(volume.progression().getTargetReps()).isEqualTo(19);
    }

    @Autowired private io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository exerciseSetRepository;

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
