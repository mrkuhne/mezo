package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.SetLegKind;
import io.mrkuhne.mezo.api.dto.SkippedTechnique;
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
    @Autowired io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator recovery;
    @Autowired io.mrkuhne.mezo.support.populator.CheckInPopulator checkIns;
    @Autowired io.mrkuhne.mezo.support.populator.ReadinessChoicePopulator choices;
    @Autowired OwnerProperties ownerProperties;
    @Autowired io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository catalog;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

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
        // stable + lengthened-friendly catalog row: the picks are re-checked against it at prescription time
        bench.setCatalogId(catalog.findBySlug("cable-fly").orElseThrow().getId());
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
        assertThat(last.getTargetRIR()).isZero();
        assertThat(leg.getRestBeforeSec()).isEqualTo(30);
        assertThat(leg.getReps()).isEqualTo(last.getTargetReps());
        assertThat(w.get(0).getTechnique()).isNull();
        assertThat(w.get(1).getLegs()).isNullOrEmpty();
        assertThat(t.getTechniqueSource().getValue()).isEqualTo("owner");
    }

    @Test
    void testToday_shouldPrescribeTopPause_onLastHipThrustWorkingSetOnly() {
        Fixture f = fixture(2, true, "top_pause", false, true);
        f.bench().setName("Hip Thrust");
        f.bench().setMuscle("glute");
        f.bench().setCatalogId(catalog.findBySlug("hip-thrust").orElseThrow().getId());
        train.save(f.bench());

        TodayExercise marked = workoutService.getToday(f.owner(), null).getExercises().stream()
            .filter(e -> "Hip Thrust".equals(e.getName())).findFirst().orElseThrow();
        List<PrescribedSet> sets = working(marked);
        assertThat(sets).hasSize(3);
        assertThat(sets.subList(0, 2)).allSatisfy(s -> {
            assertThat(s.getTechnique()).isNull();
            assertThat(s.getTopHoldSec()).isNull();
        });
        PrescribedSet last = sets.get(2);
        assertThat(last.getTechnique()).isEqualTo(Technique.TOP_PAUSE);
        assertThat(last.getTopHoldSec()).isEqualTo(2);
        assertThat(last.getLegs()).isEmpty();

        f.bench().setTechnique(null);
        f.bench().setTechniqueSource(null);
        train.save(f.bench());
        PrescribedSet plainLast = working(workoutService.getToday(f.owner(), null).getExercises().stream()
            .filter(e -> "Hip Thrust".equals(e.getName())).findFirst().orElseThrow()).get(2);
        assertThat(last.getTargetWeightKg()).isEqualByComparingTo(plainLast.getTargetWeightKg());
        assertThat(last.getTargetReps()).isEqualTo(plainLast.getTargetReps());
        assertThat(last.getTargetRIR()).isEqualTo(plainLast.getTargetRIR());
        assertThat(last.getRestSec()).isEqualTo(plainLast.getRestSec());
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
        assertSuppressed(t); // the echo says plain too
        // ...but says what the mesocycle has on it, and why it is off today (mezo-r36n9.195)
        assertThat(t.getSkippedToday().getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(t.getSkippedToday().getChallenge()).isTrue();
        assertThat(t.getSkippedToday().getReason()).isEqualTo(SkippedTechnique.ReasonEnum.DELOAD);
    }

    @Test
    void pickThatTheCatalogNoLongerAllowsIsPlain() {
        Fixture f = fixture(2, true, "rest_drop", false, true);
        UUID catalogId = f.bench().getCatalogId();
        jdbc.update("update exercise_catalog set allowed_techniques = ARRAY[]::varchar(16)[] where id = ?", catalogId);
        try {
            TodayExercise t = bench(workoutService.getToday(f.owner(), null));

            assertSuppressed(t);
            assertThat(working(t)).hasSize(3);
            // the stored plan is untouched
            assertThat(jdbc.queryForObject("select technique from exercise where id = ?", String.class,
                f.bench().getId())).isEqualTo("rest_drop");
        } finally {
            jdbc.update("update exercise_catalog set allowed_techniques = "
                + "ARRAY['rest_drop','drop','myo','rest_pause','partials']::varchar(16)[] where id = ?", catalogId);
        }
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
        assertThat(working(t)).hasSize(3);
    }

    private void assertSuppressed(TodayExercise t) {
        assertThat(t.getTechnique()).isNull();
        assertThat(t.getTechniqueSource()).isNull();
        assertThat(t.getChallenge()).isFalse();
        assertThat(t.getChallengeBest()).isNull();
        assertThat(working(t)).allSatisfy(s -> {
            assertThat(s.getTechnique()).isNull();
            assertThat(s.getLegs()).isNullOrEmpty();
        });
    }

    @Test
    void comebackDayCarriesNoTechnique() {
        Fixture f = fixture(2, true, "rest_drop", true, true);
        recovery.ended(f.owner(), io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason.ILLNESS,
            LocalDate.now().minusDays(4), LocalDate.now());

        WorkoutTodayResponse res = workoutService.getToday(f.owner(), null);

        assertThat(res.getComeback()).isNotNull();
        assertSuppressed(bench(res));
        assertThat(bench(res).getSkippedToday().getReason()).isEqualTo(SkippedTechnique.ReasonEnum.GENTLE);
        assertThat(bench(res).getSkippedToday().getTechnique()).isEqualTo(Technique.REST_DROP);
    }

    @Test
    void lightenDayCarriesNoTechniqueOnAnyRow() {
        Fixture f = fixture(2, true, "rest_drop", false, true);
        ExerciseEntity care = train.createExercise(f.owner(), f.day().getId(), "Rear Delt Fly", 1,
            "shoulder-rear", "isolation", null);
        care.setTechnique("drop");
        care.setTechniqueSource("owner");
        train.save(care);
        WorkoutSessionEntity past = train.createWorkoutInstance(f.owner(), f.day(), LocalDate.now().minusDays(8),
            "completed");
        train.createLoggedSet(f.owner(), care.getId(), past.getId(), 0, "20", 8, 1);
        checkIns.createCheckIn(f.owner(), LocalDate.now(), "06:30", c -> {
            c.setSoreness(8);
            c.setPain(true);
            c.setPainRegions(List.of(io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion.VALL));
            c.setPainIntensity(5);
        });
        choices.createChoice(f.owner(), LocalDate.now(),
            io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity.Choice.LIGHTEN);

        WorkoutTodayResponse res = workoutService.getToday(f.owner(), null);

        assertSuppressed(bench(res)); // a non-care row on a lighten day
        TodayExercise careRow = res.getExercises().stream()
            .filter(e -> "Rear Delt Fly".equals(e.getName())).findFirst().orElseThrow();
        assertThat(careRow.getWorkingSets()).isEqualTo(1); // the care row was lightened
        assertSuppressed(careRow); // and a care row never carries one
    }

    // --- sport-day rule (mezo-r36n9.81, spec §11 Q4) ---

    private void sportDay(Fixture f, boolean today) {
        MesocycleEntity m = mesocycleRepository.findById(f.day().getMesocycleId()).orElseThrow();
        m.setSportGroups(List.of("chest"));
        mesocycleRepository.saveAndFlush(m);
        int weekday = LocalDate.now().getDayOfWeek().getValue() - 1;
        train.createScheduleSlot(f.owner(), today ? weekday : (weekday + 1) % 7, "18:00", 60, "training");
    }

    @Test
    void sportDayHidesChallenge() {
        Fixture f = fixture(2, true, null, true, true);
        sportDay(f, true);
        TodayExercise sport = bench(workoutService.getToday(f.owner(), null));
        assertSuppressed(sport);
        assertThat(sport.getSkippedToday().getChallenge()).isTrue();
        assertThat(sport.getSkippedToday().getTechnique()).isNull();
        assertThat(sport.getSkippedToday().getReason()).isEqualTo(SkippedTechnique.ReasonEnum.SPORT);

        // the same run on a day without a sport slot keeps the challenge
        jdbc.update("update sport_schedule_slot set day_of_week = ?", (LocalDate.now().getDayOfWeek().getValue()) % 7);
        TodayExercise rest = bench(workoutService.getToday(f.owner(), null));
        assertThat(rest.getChallenge()).isTrue();
        assertThat(rest.getSkippedToday()).isNull(); // nothing left out on a normal day
        assertThat(working(rest).get(2).getTechnique()).isEqualTo(Technique.PARTIALS);
    }

    @Test
    void sportDayHidesPlannerTechniqueOnLoadedGroup() {
        Fixture f = fixture(2, true, "drop", false, true);
        f.bench().setTechniqueSource("planner");
        train.save(f.bench());
        sportDay(f, true);
        TodayExercise t = bench(workoutService.getToday(f.owner(), null));
        assertSuppressed(t);
        assertThat(t.getSkippedToday().getTechnique()).isEqualTo(Technique.DROP);
        assertThat(t.getSkippedToday().getChallenge()).isFalse();
        // the stored row is untouched
        assertThat(f.bench().getTechniqueSource()).isEqualTo("planner");
    }

    @Test
    void sportDayKeepsOwnerTechnique() {
        Fixture f = fixture(2, true, "drop", false, true);
        sportDay(f, true); // the fixture row is owner-sourced
        TodayExercise t = bench(workoutService.getToday(f.owner(), null));
        assertThat(t.getSkippedToday()).isNull(); // the owner's technique stands, no challenge to drop
        assertThat(t.getTechnique()).isEqualTo(Technique.DROP);
        assertThat(t.getTechniqueSource().getValue()).isEqualTo("owner");
        assertThat(working(t).get(2).getTechnique()).isEqualTo(Technique.DROP);
    }

    // --- technique + challenge on one exercise (mezo-r36n9.98) ---

    @Test
    void techniqueAndChallengeTogether_techniqueLegsThenChallengePartials() {
        Fixture f = fixture(2, true, "rest_drop", true, true);
        TodayExercise t = bench(workoutService.getToday(f.owner(), null));

        assertThat(t.getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(t.getChallenge()).isTrue();
        List<PrescribedSet> w = working(t);
        PrescribedSet last = w.get(2);
        assertThat(last.getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(last.getTargetRIR()).isZero();
        assertThat(last.getLegs()).extracting(l -> l.getKind())
            .containsExactly(SetLegKind.DROP, SetLegKind.PARTIALS);
        assertThat(last.getLegs().get(0).getChallenge()).isNull();
        var half = last.getLegs().get(1);
        assertThat(half.getChallenge()).isTrue();
        assertThat(half.getToFailure()).isTrue();
        assertThat(half.getRestBeforeSec()).isZero();
        assertThat(w.get(1).getLegs()).isNullOrEmpty();
    }

    @Test
    void challengeBestComparesTheSameSetupOnly() {
        Fixture f = fixture(2, true, "rest_drop", true, true);
        BigDecimal w = working(bench(workoutService.getToday(f.owner(), null))).get(2).getTargetWeightKg();
        WorkoutSessionEntity old = train.createWorkoutInstance(f.owner(), f.day(), LocalDate.now().minusDays(30),
            "completed");
        seedPartials(f, old, 0, w.toPlainString(), 14);   // a plain challenge set (no technique before)
        ExerciseSetEntity combined = train.createLoggedSet(f.owner(), f.bench().getId(), old.getId(), 1,
            w.toPlainString(), 8, 0);
        jdbc.update("update exercise_set set technique = 'rest_drop' where id = ?", combined.getId());
        ExerciseSetLegEntity drop = new ExerciseSetLegEntity();
        drop.setExerciseSetId(combined.getId());
        drop.setLegIndex(0);
        drop.setKind("drop");
        drop.setReps(8);
        legs.saveAndFlush(drop);
        ExerciseSetLegEntity half = new ExerciseSetLegEntity();
        half.setExerciseSetId(combined.getId());
        half.setLegIndex(1);
        half.setKind("partials");
        half.setReps(6);
        legs.saveAndFlush(half);

        // rest-drop before the half reps: only the rest-drop session's number counts
        assertThat(bench(workoutService.getToday(f.owner(), null)).getChallengeBest()).isEqualTo(6);

        // the plain challenge: only the plain session's number counts
        f.bench().setTechnique(null);
        train.save(f.bench());
        assertThat(bench(workoutService.getToday(f.owner(), null)).getChallengeBest()).isEqualTo(14);
    }

    @Test
    void sportDayKeepsOwnerTechniqueButDropsTheChallenge() {
        Fixture f = fixture(2, true, "drop", true, true);
        sportDay(f, true);
        TodayExercise t = bench(workoutService.getToday(f.owner(), null));
        assertThat(t.getTechnique()).isEqualTo(Technique.DROP);
        assertThat(t.getChallenge()).isFalse();
        assertThat(t.getChallengeBest()).isNull();
        assertThat(working(t).get(2).getLegs()).extracting(l -> l.getKind()).containsExactly(SetLegKind.DROP);
    }
}
