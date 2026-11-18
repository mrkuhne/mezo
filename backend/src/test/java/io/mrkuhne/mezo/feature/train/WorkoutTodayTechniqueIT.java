package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.SetLegKind;
import io.mrkuhne.mezo.api.dto.Technique;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetLegRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The technique prescription overlay in the today view (mezo-r36n9.80, T2 Task 6). */
class WorkoutTodayTechniqueIT extends AbstractIntegrationTest {

    private static final List<String> CURVE = List.of("MAV", "MAV", "MAV", "Deload");

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseSetLegRepository legs;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired OwnerProperties ownerProperties;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private static String todayLabel() {
        return WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    private MesocycleEntity run(UUID owner, int week, boolean enabled) {
        MesocycleEntity m = train.createActiveMeso(owner);
        m.setPhaseCurve(CURVE);
        m.setCurrentWeek(week);
        m.setTechniquesEnabled(enabled);
        m.setVolumeRecompute(new VolumeRecomputeJson("W999", "W1000", "batch", List.of()));
        return mesocycleRepository.saveAndFlush(m);
    }

    private record Fixture(UUID owner, WorkoutSessionEntity day, ExerciseEntity bench) { }

    private Fixture fixture(int week, boolean enabled, String technique, boolean challenge, boolean history) {
        UUID owner = owner();
        MesocycleEntity meso = run(owner, week, enabled);
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        ExerciseEntity bench = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        bench.setTechnique(technique);
        bench.setTechniqueSource(technique == null ? null : "owner");
        bench.setChallenge(challenge);
        train.save(bench);
        if (history) {
            WorkoutSessionEntity past =
                train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
            train.createLoggedSet(owner, bench.getId(), past.getId(), 0, "60", 8, 1);
            train.createLoggedSet(owner, bench.getId(), past.getId(), 1, "60", 7, 0);
        }
        return new Fixture(owner, day, bench);
    }

    private TodayExercise bench(WorkoutTodayResponse res) {
        return res.getExercises().stream().filter(e -> "Fekvenyomás".equals(e.getName())).findFirst().orElseThrow();
    }

    private static List<PrescribedSet> working(TodayExercise t) {
        return t.getPrescribedSets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
    }

    @Test
    void disabledBlockPrescribesAsBefore() {
        Fixture f = fixture(2, false, "rest_drop", true, true);
        TodayExercise flagged = bench(workoutService.getToday(f.owner(), null));
        assertThat(flagged.getTechnique()).isEqualTo(Technique.REST_DROP); // maps as stored
        assertThat(flagged.getChallenge()).isTrue();
        assertThat(flagged.getChallengeBest()).isNull();

        f.bench().setTechnique(null);
        f.bench().setTechniqueSource(null);
        f.bench().setChallenge(false);
        train.save(f.bench());
        TodayExercise plain = bench(workoutService.getToday(f.owner(), null));

        assertThat(flagged.getPrescribedSets()).isEqualTo(plain.getPrescribedSets());
        assertThat(working(flagged)).allSatisfy(s -> assertThat(s.getLegs()).isNullOrEmpty());
    }

    @Test
    void restDropOnLastSet() {
        Fixture f = fixture(2, true, "rest_drop", false, true);
        TodayExercise t = bench(workoutService.getToday(f.owner(), null));

        List<PrescribedSet> w = working(t);
        assertThat(w).hasSize(3);
        PrescribedSet last = w.get(2);
        assertThat(last.getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(last.getLegs()).hasSize(1);
        var leg = last.getLegs().get(0);
        assertThat(leg.getKind()).isEqualTo(SetLegKind.DROP);
        assertThat(leg.getDropPercent()).isEqualTo(30);
        assertThat(leg.getWeightKg()).isNotNull();
        assertThat(leg.getWeightKg()).isLessThanOrEqualTo(
            last.getTargetWeightKg().multiply(new BigDecimal("0.70")));
        assertThat(w.get(0).getTechnique()).isNull();
        assertThat(w.get(1).getLegs()).isNullOrEmpty();
        assertThat(t.getTechniqueSource().getValue()).isEqualTo("owner");
    }

    @Test
    void challengeCarriesBestAtWeight() {
        Fixture f = fixture(2, true, null, true, true);
        TodayExercise first = bench(workoutService.getToday(f.owner(), null));
        PrescribedSet last = working(first).get(2);
        assertThat(last.getTechnique()).isEqualTo(Technique.PARTIALS);
        assertThat(first.getChallengeBest()).isNull(); // no record yet
        BigDecimal w = last.getTargetWeightKg();

        WorkoutSessionEntity old = train.createWorkoutInstance(f.owner(), f.day(), LocalDate.now().minusDays(30),
            "completed");
        seedPartials(f, old, 0, w.toPlainString(), 12);
        seedPartials(f, old, 1, w.toPlainString(), 15);
        seedPartials(f, old, 2, w.subtract(BigDecimal.TEN).toPlainString(), 25);

        TodayExercise second = bench(workoutService.getToday(f.owner(), null));
        assertThat(working(second).get(2).getTargetWeightKg()).isEqualByComparingTo(w);
        assertThat(second.getChallenge()).isTrue();
        assertThat(second.getChallengeBest()).isEqualTo(15);
    }

    private void seedPartials(Fixture f, WorkoutSessionEntity inst, int idx, String kg, int reps) {
        ExerciseSetEntity s = train.createLoggedSet(f.owner(), f.bench().getId(), inst.getId(), idx, kg, 8, 0);
        ExerciseSetLegEntity l = new ExerciseSetLegEntity();
        l.setExerciseSetId(s.getId());
        l.setLegIndex(0);
        l.setKind("partials");
        l.setReps(reps);
        legs.saveAndFlush(l);
    }

    @Test
    void deloadWeekIsPlain() {
        Fixture f = fixture(4, true, "rest_drop", true, true);
        TodayExercise t = bench(workoutService.getToday(f.owner(), null));

        assertThat(working(t)).allSatisfy(s -> {
            assertThat(s.getTechnique()).isNull();
            assertThat(s.getLegs()).isNullOrEmpty();
        });
    }

    @Test
    void noHistoryLegHasNoWeight() {
        Fixture f = fixture(2, true, "rest_drop", false, false);
        TodayExercise t = bench(workoutService.getToday(f.owner(), null));

        PrescribedSet last = working(t).get(working(t).size() - 1);
        assertThat(last.getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(last.getLegs()).hasSize(1);
        assertThat(last.getLegs().get(0).getWeightKg()).isNull();
        assertThat(last.getLegs().get(0).getDropPercent()).isEqualTo(30);
    }
}
