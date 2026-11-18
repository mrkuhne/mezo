package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.api.dto.Medal;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.progression.gym.GymSignal;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetLegRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseHistoryResolver;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.feature.train.service.MedalService;
import io.mrkuhne.mezo.feature.train.service.OneRepMax;
import io.mrkuhne.mezo.feature.train.service.WeeklySignalReader;
import io.mrkuhne.mezo.feature.train.signal.GymSignalCalculator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Every reader of spec §6.4's table (mezo-r36n9.80): records, e1RM and the per-set medals read the parent row only;
 * tonnage ({@code SESSION_VOLUME}, records' volumes, the gym signal) adds drop/mini legs but never partials; a
 * technique set is one weekly set, never a grind, and never the progression reference while straight sets exist.
 */
class TechniqueExclusionIT extends AbstractIntegrationTest {

    @Autowired ExerciseRecordService records;
    @Autowired MedalService medals;
    @Autowired GymSignalCalculator gymSignal;
    @Autowired WeeklySignalReader signalReader;
    @Autowired ExerciseHistoryResolver resolver;
    @Autowired TrainPopulator train;
    @Autowired ExerciseSetRepository setRepository;
    @Autowired ExerciseSetLegRepository legRepository;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired OwnerProperties ownerProperties;

    private static final Instant T0 = Instant.now().minus(10, ChronoUnit.DAYS);

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private ExerciseSetEntity set(UUID owner, ExerciseEntity ex, WorkoutSessionEntity inst, int idx, String kg,
                                  int reps, int rir, Instant at) {
        return train.createLoggedSet(owner, ex.getId(), inst.getId(), idx, kg, reps, rir, at);
    }

    /** A technique set: the parent row plus its legs ({kind, kg or null, reps}). */
    private ExerciseSetEntity technique(UUID owner, ExerciseEntity ex, WorkoutSessionEntity inst, int idx, String kg,
                                        int reps, Instant at, String technique, Object[]... legs) {
        // technique is immutable after create (updatable = false): stamp it on the first insert
        ExerciseSetEntity s = new ExerciseSetEntity();
        s.setCreatedBy(owner);
        s.setExerciseId(ex.getId());
        s.setWorkoutSessionId(inst.getId());
        s.setSetIndex(idx);
        s.setWeightKg(new BigDecimal(kg));
        s.setReps(reps);
        s.setRir(0);
        s.setDoneAt(at);
        s.setTechnique(technique);
        s = setRepository.saveAndFlush(s);
        for (int i = 0; i < legs.length; i++) {
            ExerciseSetLegEntity l = new ExerciseSetLegEntity();
            l.setExerciseSetId(s.getId());
            l.setLegIndex(i);
            l.setKind((String) legs[i][0]);
            l.setWeightKg(legs[i][1] == null ? null : new BigDecimal((String) legs[i][1]));
            l.setReps((Integer) legs[i][2]);
            legRepository.saveAndFlush(l);
        }
        return s;
    }

    private static Object[] leg(String kind, String kg, int reps) {
        return new Object[] {kind, kg, reps};
    }

    private WorkoutSessionEntity completed(UUID owner, WorkoutSessionEntity day, int daysAgo) {
        return train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(daysAgo), "completed");
    }

    @Test
    void legsNeverEnterRecordsOrE1rm() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var first = completed(owner, day, 9);
        set(owner, ex, first, 0, "100", 8, 1, T0);
        var second = completed(owner, day, 2);
        // a (nonsensical) heavier leg proves the rule: legs never become a set record, a rep record or an e1RM
        technique(owner, ex, second, 0, "100", 8, T0.plus(7, ChronoUnit.DAYS), "drop",
            leg("drop", "150", 10), leg("drop", "140", 12));

        ExerciseRecordResponse r = records.list(owner).get(0);
        assertThat(r.getBestSet().getWeightKg()).isEqualByComparingTo("100");
        assertThat(r.getBestE1rm().getValue()).isEqualByComparingTo(
            OneRepMax.estimate(new BigDecimal("100"), 8).setScale(1, RoundingMode.HALF_UP));
        assertThat(r.getRepRecords()).allSatisfy(ref -> assertThat(ref.getWeightKg()).isEqualByComparingTo("100"));
        assertThat(r.getTotalSets()).isEqualTo(2);              // a technique set is one set
        assertThat(r.getTotalReps()).isEqualTo(16);             // leg reps are not set reps
        assertThat(r.getE1rmSeries()).allSatisfy(p -> assertThat(p.getE1rm()).isLessThan(new BigDecimal("130")));

        assertThat(medals.list(owner))
            .filteredOn(m -> m.getType() != Medal.TypeEnum.SESSION_VOLUME)
            .isEmpty();                                         // 100×8 again: no WEIGHT / E1RM / REPS_AT_WEIGHT
    }

    @Test
    void partialsNeverEnterTonnage() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var first = completed(owner, day, 9);
        set(owner, ex, first, 0, "100", 8, 1, T0);
        var second = completed(owner, day, 2);
        technique(owner, ex, second, 0, "100", 8, T0.plus(7, ChronoUnit.DAYS), "partials",
            leg("partials", "100", 15));

        ExerciseRecordResponse r = records.list(owner).get(0);
        assertThat(r.getTotalVolume()).isEqualByComparingTo("1600");
        assertThat(r.getBestSessionVolume().getVolumeKg()).isEqualByComparingTo("800");
        assertThat(medals.list(owner)).filteredOn(m -> m.getType() == Medal.TypeEnum.SESSION_VOLUME).isEmpty();
        GymSignal signal = gymSignal.compute(owner, second.getId());
        assertThat(signal.volumeByMuscle().get("chest")).isEqualTo(800L);
        assertThat(signal.workSetCount()).isEqualTo(1);
    }

    @Test
    void dropAndMiniLegsEnterSessionVolume() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var bench = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var fly = train.createExercise(owner, day.getId(), "Tárogatás", "chest", "isolation");
        var first = completed(owner, day, 9);
        for (int i = 0; i < 3; i++) {
            set(owner, bench, first, i, "100", 8, 1, T0.plusSeconds(i));     // 2400
        }
        set(owner, fly, first, 0, "20", 12, 1, T0.plusSeconds(10));          // 240
        var second = completed(owner, day, 2);
        Instant t1 = T0.plus(7, ChronoUnit.DAYS);
        set(owner, bench, second, 0, "100", 8, 1, t1);
        set(owner, bench, second, 1, "100", 8, 1, t1.plusSeconds(1));
        technique(owner, bench, second, 2, "100", 8, t1.plusSeconds(2), "rest_drop",
            leg("drop", "80", 6), leg("drop", null, 5));                        // 2400 + 480 (+ 0 unweighted)
        technique(owner, fly, second, 0, "20", 12, t1.plusSeconds(10), "myo",
            leg("mini", "20", 5), leg("mini", "20", 4));                        // 240 + 180

        assertThat(medals.list(owner))
            .filteredOn(m -> m.getType() == Medal.TypeEnum.SESSION_VOLUME)
            .extracting(Medal::getValue)
            .containsExactlyInAnyOrder(new BigDecimal("2880"), new BigDecimal("420"));

        ExerciseRecordResponse benchRec = records.list(owner).stream()
            .filter(x -> x.getName().equals("Fekvenyomás")).findFirst().orElseThrow();
        assertThat(benchRec.getBestSessionVolume().getVolumeKg()).isEqualByComparingTo("2880");
        assertThat(benchRec.getTotalVolume()).isEqualByComparingTo("5280");

        GymSignal signal = gymSignal.compute(owner, second.getId());
        assertThat(signal.volumeByMuscle().get("chest")).isEqualTo(2880L + 420L);
        assertThat(signal.workSetCount()).isEqualTo(4);
    }

    @Test
    void partialsBestOnRecords() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = train.createExercise(owner, day.getId(), "Lábtolás", "quad", "compound");
        var other = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var inst = completed(owner, day, 2);
        technique(owner, ex, inst, 0, "120", 10, T0, "partials", leg("partials", null, 12));
        technique(owner, ex, inst, 1, "100", 10, T0.plusSeconds(1), "partials", leg("partials", null, 18));
        set(owner, other, inst, 0, "80", 8, 1, T0.plusSeconds(2));

        List<ExerciseRecordResponse> res = records.list(owner);
        ExerciseRecordResponse press = res.stream().filter(x -> x.getName().equals("Lábtolás")).findFirst().orElseThrow();
        assertThat(press.getPartialsBest()).hasSize(2);
        assertThat(press.getPartialsBest().get(0).getWeightKg()).isEqualByComparingTo("100");
        assertThat(press.getPartialsBest().get(0).getReps()).isEqualTo(18);
        assertThat(press.getPartialsBest().get(1).getWeightKg()).isEqualByComparingTo("120");
        assertThat(press.getPartialsBest().get(1).getReps()).isEqualTo(12);
        ExerciseRecordResponse bench = res.stream().filter(x -> x.getName().equals("Fekvenyomás")).findFirst().orElseThrow();
        assertThat(bench.getPartialsBest()).isEmpty();
    }

    // ── weekly signals ───────────────────────────────────────────────────────────────────────

    /** Week 3 reads week 2: two straight sets at the target reserve plus a technique set taken to failure. */
    private WeeklySignalReader.GroupSignals weekTwoWithTechnique(String ownerEmail) {
        UUID owner = databasePopulator.populateUser(ownerEmail);
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 2, 6,
            List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        WorkoutSessionEntity day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "planned");
        ExerciseEntity row = train.createExercise(owner, day.getId(), "Behúzás", "back-mid", "compound");
        row.setTargetRir(3);
        train.save(row);
        WorkoutSessionEntity inst = train.createWorkoutInstance(owner, day, meso.getStartDate().plusDays(8), "completed");
        train.createLoggedSet(owner, row.getId(), inst.getId(), 0, "60", 8, 3);
        train.createLoggedSet(owner, row.getId(), inst.getId(), 1, "60", 8, 3);
        technique(owner, row, inst, 2, "60", 8, Instant.now(), "drop", leg("drop", "45", 6));
        return signalReader.read(owner, meso, 3).get("back");
    }

    @Test
    void techniqueSetCountsAsOneWeeklySet() {
        assertThat(weekTwoWithTechnique("tech-count@test.local").logged()).isEqualTo(3);
    }

    @Test
    void techniqueSetIsNotAGrind() {
        // reserve 0 <= target 3 - gap 2 would be a grind on a straight set; on the technique set it is expected
        assertThat(weekTwoWithTechnique("tech-grind@test.local").grind()).isFalse();
    }

    // ── progression reference ─────────────────────────────────────────────────────────────────

    @Test
    void referenceSkipsTechniqueSet() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var inst = completed(owner, day, 3);
        set(owner, ex, inst, 0, "80", 8, 2, T0);
        set(owner, ex, inst, 1, "80", 7, 2, T0.plusSeconds(1));
        technique(owner, ex, inst, 2, "85", 8, T0.plusSeconds(2), "rest_drop", leg("drop", "60", 6));

        var ref = resolver.reference(owner, ex, LocalDate.now(), 56);
        assertThat(ref.sets()).hasSize(2).allSatisfy(s -> assertThat(s.getTechnique()).isNull());
    }

    @Test
    void onlyTechniqueSetsStillGiveAReference() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var inst = completed(owner, day, 3);
        technique(owner, ex, inst, 0, "80", 8, T0, "myo", leg("mini", "80", 4));

        var ref = resolver.reference(owner, ex, LocalDate.now(), 56);
        assertThat(ref.sets()).singleElement().satisfies(s -> assertThat(s.getTechnique()).isEqualTo("myo"));
    }
}
