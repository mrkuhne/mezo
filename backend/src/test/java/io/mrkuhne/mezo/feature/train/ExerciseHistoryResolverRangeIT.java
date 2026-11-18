package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseHistoryResolver;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The trained-range snapshot and the rep-range-aware reference (mezo-r36n9.79, Task 5). */
class ExerciseHistoryResolverRangeIT extends AbstractIntegrationTest {

    private static final int MAX_AGE = 56;

    @Autowired ExerciseHistoryResolver resolver;
    @Autowired TrainPopulator train;
    @Autowired WorkoutService workoutService;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired ExerciseSetRepository exerciseSetRepository;
    @Autowired OwnerProperties ownerProperties;
    @Autowired io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private ExerciseEntity row(UUID owner, UUID day, String name, int min, int max) {
        ExerciseEntity e = train.createExercise(owner, day, name, "chest", "compound");
        e.setRepMin(min);
        e.setRepMax(max);
        return train.save(e);
    }

    /** A completed instance dated {@code daysAgo} with one working set on {@code ex}; optional snapshot. */
    private void done(UUID owner, WorkoutSessionEntity day, ExerciseEntity ex, int daysAgo, String kg, int reps,
        Integer snapMin, Integer snapMax) {
        WorkoutSessionEntity inst = train.createWorkoutInstance(
            owner, day, LocalDate.now().minusDays(daysAgo), "completed");
        ExerciseSetEntity s = train.createLoggedSet(owner, ex.getId(), inst.getId(), 0, kg, reps, 1);
        s.setTargetRepMin(snapMin);
        s.setTargetRepMax(snapMax);
        exerciseSetRepository.saveAndFlush(s);
    }

    @Test
    void logSetSnapshotsTheRowRange() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = row(owner, day.getId(), "Fekvenyomás", 10, 12);
        var instance = train.startInstance(owner, day.getId());

        var res = workoutService.logSet(owner, instance.getId(), SetLogRequest.builder()
            .exerciseId(ex.getId()).setIndex(0).weightKg(BigDecimal.valueOf(50)).reps(11).rir(1).build());

        ExerciseSetEntity saved = exerciseSetRepository.findById(res.getId()).orElseThrow();
        assertThat(saved.getTargetRepMin()).isEqualTo(10);
        assertThat(saved.getTargetRepMax()).isEqualTo(12);
    }

    @Test
    void twiceAWeekDifferentRangesUseTheirOwnReference() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var heavyDay = train.createTemplateDay(owner, meso.getId(), "Hétfő");
        var lightDay = train.createTemplateDay(owner, meso.getId(), "Csütörtök");
        ExerciseEntity heavy = row(owner, heavyDay.getId(), "Fekvenyomás", 4, 6);
        ExerciseEntity light = row(owner, lightDay.getId(), "Fekvenyomás", 10, 12);
        done(owner, heavyDay, heavy, 7, "100", 5, 4, 6);
        done(owner, lightDay, light, 4, "70", 11, 10, 12);   // the newest instance overall

        var forHeavy = resolver.reference(owner, heavy, LocalDate.now(), MAX_AGE);
        assertThat(forHeavy.sameRange()).isTrue();
        assertThat(forHeavy.refRepMin()).isEqualTo(4);
        assertThat(forHeavy.refRepMax()).isEqualTo(6);
        assertThat(forHeavy.sets()).singleElement().satisfies(s -> assertThat(s.getWeightKg()).isEqualByComparingTo("100"));

        var forLight = resolver.reference(owner, light, LocalDate.now(), MAX_AGE);
        assertThat(forLight.sameRange()).isTrue();
        assertThat(forLight.sets()).singleElement().satisfies(s -> assertThat(s.getWeightKg()).isEqualByComparingTo("70"));
    }

    @Test
    void staleSameRangeInstanceIsIgnored() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var other = train.createTemplateDay(owner, meso.getId(), "Péntek");
        ExerciseEntity cur = row(owner, day.getId(), "Fekvenyomás", 4, 6);
        ExerciseEntity old = row(owner, other.getId(), "Fekvenyomás", 10, 12);
        done(owner, day, cur, 57, "100", 5, 4, 6);     // same range, one day too old
        done(owner, other, old, 3, "70", 11, 10, 12);  // newest overall

        var ref = resolver.reference(owner, cur, LocalDate.now(), MAX_AGE);

        assertThat(ref.sameRange()).isFalse();
        assertThat(ref.refRepMin()).isEqualTo(10);
        assertThat(ref.refRepMax()).isEqualTo(12);
        assertThat(ref.sets()).singleElement().satisfies(s -> assertThat(s.getWeightKg()).isEqualByComparingTo("70"));
    }

    @Test
    void legacySetUsesItsRowRange() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var other = train.createTemplateDay(owner, meso.getId(), "Péntek");
        ExerciseEntity cur = row(owner, day.getId(), "Fekvenyomás", 4, 6);
        ExerciseEntity gone = row(owner, other.getId(), "Fekvenyomás", 10, 12);
        done(owner, other, gone, 5, "70", 11, null, null);   // legacy: no snapshot
        exerciseRepository.delete(gone);                     // soft-deleted row
        exerciseRepository.flush();

        var ref = resolver.reference(owner, cur, LocalDate.now(), MAX_AGE);

        assertThat(ref.sets()).hasSize(1);
        assertThat(ref.refRepMin()).isEqualTo(10);
        assertThat(ref.refRepMax()).isEqualTo(12);
        assertThat(ref.sameRange()).isFalse();
    }

    @Test
    void noHistoryIsEmpty() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity cur = row(owner, day.getId(), "Fekvenyomás", 4, 6);

        var ref = resolver.reference(owner, cur, LocalDate.now(), MAX_AGE);

        assertThat(ref.sets()).isEmpty();
        assertThat(ref.refRepMin()).isEqualTo(4);
        assertThat(ref.refRepMax()).isEqualTo(6);
        assertThat(ref.sameRange()).isFalse();
    }

    @Test
    void exactlyMaxAgeSameRangeInstanceQualifies() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var other = train.createTemplateDay(owner, meso.getId(), "Péntek");
        ExerciseEntity cur = row(owner, day.getId(), "Fekvenyomás", 4, 6);
        ExerciseEntity old = row(owner, other.getId(), "Fekvenyomás", 10, 12);
        done(owner, day, cur, MAX_AGE, "100", 5, 4, 6);
        done(owner, other, old, 3, "70", 11, 10, 12);

        var ref = resolver.reference(owner, cur, LocalDate.now(), MAX_AGE);

        assertThat(ref.sameRange()).isTrue();
        assertThat(ref.sets()).singleElement().satisfies(s -> assertThat(s.getWeightKg()).isEqualByComparingTo("100"));
    }

    @Test
    void anotherOwnersHistoryNeverLeaks() {
        UUID owner = ownerId();
        UUID stranger = databasePopulator.populateUser("stranger-range@example.com");
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity cur = row(owner, day.getId(), "Fekvenyomás", 4, 6);
        var smeso = train.createActiveMeso(stranger);
        var sday = train.createTemplateDay(stranger, smeso.getId(), "Kedd");
        ExerciseEntity theirs = row(stranger, sday.getId(), "Fekvenyomás", 4, 6);
        done(stranger, sday, theirs, 2, "150", 5, 4, 6);

        var ref = resolver.reference(owner, cur, LocalDate.now(), MAX_AGE);

        assertThat(ref.sets()).isEmpty();
    }

    @Test
    void sameDateTiePicksTheLaterCreatedInstance() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity cur = row(owner, day.getId(), "Fekvenyomás", 4, 6);
        done(owner, day, cur, 2, "100", 5, 4, 6);
        done(owner, day, cur, 2, "105", 5, 4, 6);   // same date, created later

        var ref = resolver.reference(owner, cur, LocalDate.now(), MAX_AGE);

        assertThat(ref.sets()).singleElement().satisfies(s -> assertThat(s.getWeightKg()).isEqualByComparingTo("105"));
    }
}
