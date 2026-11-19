package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetLegRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseHistoryResolver;
import io.mrkuhne.mezo.feature.train.service.PartialsBest;
import io.mrkuhne.mezo.feature.train.service.Technique;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** PARTIALS_BEST is derived, never stored: best partials-leg reps per weight over live parents (mezo-r36n9.80). */
class PartialsBestIT extends AbstractIntegrationTest {

    @Autowired PartialsBest partialsBest;
    @Autowired TrainPopulator train;
    @Autowired ExerciseSetLegRepository legs;
    @Autowired ExerciseSetRepository sets;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired OwnerProperties ownerProperties;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private ExerciseEntity exercise(UUID owner, WorkoutSessionEntity day, String name) {
        return train.createExercise(owner, day.getId(), name, "chest", "compound");
    }

    private ExerciseSetEntity setWithPartials(UUID owner, ExerciseEntity ex, WorkoutSessionEntity inst, int idx,
                                              String kg, String legKind, int legReps) {
        ExerciseSetEntity s = train.createLoggedSet(owner, ex.getId(), inst.getId(), idx, kg, 8, 0);
        ExerciseSetLegEntity l = new ExerciseSetLegEntity();
        l.setExerciseSetId(s.getId());
        l.setLegIndex(0);
        l.setKind(legKind);
        l.setReps(legReps);
        legs.saveAndFlush(l);
        return s;
    }

    @Test
    void bestPerWeight() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = exercise(owner, day, "Fekvenyomás");
        var inst = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        setWithPartials(owner, ex, inst, 0, "60", "partials", 12);
        setWithPartials(owner, ex, inst, 1, "60", "partials", 15);
        setWithPartials(owner, ex, inst, 2, "50", "partials", 20);
        setWithPartials(owner, ex, inst, 3, "70", "drop", 99); // not a partials leg

        assertThat(partialsBest.at(owner, ex, new BigDecimal("60"), Technique.NONE)).isEqualTo(15);
        assertThat(partialsBest.at(owner, ex, new BigDecimal("50.0"), Technique.NONE)).isEqualTo(20);
        assertThat(partialsBest.at(owner, ex, new BigDecimal("70"), Technique.NONE)).isNull();
        assertThat(partialsBest.at(owner, ex, null, Technique.NONE)).isNull();
        var all = partialsBest.bestPerWeight(owner, ExerciseHistoryResolver.identityKey(ex), "none");
        assertThat(all).hasSize(2);
        assertThat(all.get(0).weightKg()).isEqualByComparingTo("50");
        assertThat(all.get(0).reps()).isEqualTo(20);
        assertThat(all.get(1).weightKg()).isEqualByComparingTo("60");
        assertThat(all.get(1).reps()).isEqualTo(15);
    }

    @Test
    void deletedParentIgnored() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = exercise(owner, day, "Fekvenyomás");
        var inst = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        ExerciseSetEntity gone = setWithPartials(owner, ex, inst, 0, "60", "partials", 30);
        setWithPartials(owner, ex, inst, 1, "60", "partials", 10);
        sets.delete(gone); // soft delete: the legs stay, the parent is no longer live
        sets.flush();

        assertThat(partialsBest.at(owner, ex, new BigDecimal("60"), Technique.NONE)).isEqualTo(10);
    }

    @Test
    void otherIdentityIgnored() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var bench = exercise(owner, day, "Fekvenyomás");
        var fly = exercise(owner, day, "Tárogatás");
        var inst = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        setWithPartials(owner, fly, inst, 0, "60", "partials", 40);

        assertThat(partialsBest.at(owner, bench, new BigDecimal("60"), Technique.NONE)).isNull();
        assertThat(partialsBest.at(owner, fly, new BigDecimal("60"), Technique.NONE)).isEqualTo(40);
    }

    @Test
    void openAndDeletedWorkoutsIgnored() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = exercise(owner, day, "Fekvenyomás");
        var done = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        setWithPartials(owner, ex, done, 0, "60", "partials", 10);
        var open = train.createWorkoutInstance(owner, day, LocalDate.now(), "active");
        setWithPartials(owner, ex, open, 0, "60", "partials", 50);
        var gone = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(14), "completed");
        setWithPartials(owner, ex, gone, 0, "60", "partials", 40);
        jdbc.update("UPDATE workout_session SET is_deleted = true WHERE id = ?", gone.getId());

        assertThat(partialsBest.at(owner, ex, new BigDecimal("60"), Technique.NONE)).isEqualTo(10);
    }

    /** Half reps on a set that also ran a technique (mezo-r36n9.98): a second leg after the technique's own. */
    private void setWithTechniqueAndPartials(UUID owner, ExerciseEntity ex, WorkoutSessionEntity inst, int idx,
                                             String kg, String technique, String techniqueLeg, int partialsReps) {
        ExerciseSetEntity s = train.createLoggedSet(owner, ex.getId(), inst.getId(), idx, kg, 8, 0);
        jdbc.update("UPDATE exercise_set SET technique = ? WHERE id = ?", technique, s.getId());
        ExerciseSetLegEntity first = new ExerciseSetLegEntity();
        first.setExerciseSetId(s.getId());
        first.setLegIndex(0);
        first.setKind(techniqueLeg);
        first.setReps(8);
        legs.saveAndFlush(first);
        ExerciseSetLegEntity half = new ExerciseSetLegEntity();
        half.setExerciseSetId(s.getId());
        half.setLegIndex(1);
        half.setKind("partials");
        half.setReps(partialsReps);
        legs.saveAndFlush(half);
    }

    @Test
    void bestIsKeyedBySetup_plainAndTechniqueNumbersNeverMix() {
        UUID owner = owner();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = exercise(owner, day, "Tárogatás");
        var inst = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        // a plain challenge set (technique partials, as logged before the combination existed) and an older
        // technique-less one both read as setup none
        setWithPartials(owner, ex, inst, 0, "40", "partials", 14);
        jdbc.update("UPDATE exercise_set SET technique = 'partials' WHERE exercise_id = ? AND set_index = 0",
            ex.getId());
        setWithTechniqueAndPartials(owner, ex, inst, 1, "40", "rest_drop", "drop", 6);
        setWithTechniqueAndPartials(owner, ex, inst, 2, "40", "myo", "mini", 4);

        assertThat(partialsBest.at(owner, ex, new BigDecimal("40"), Technique.NONE)).isEqualTo(14);
        assertThat(partialsBest.at(owner, ex, new BigDecimal("40"), Technique.PARTIALS)).isEqualTo(14);
        assertThat(partialsBest.at(owner, ex, new BigDecimal("40"), Technique.REST_DROP)).isEqualTo(6);
        assertThat(partialsBest.at(owner, ex, new BigDecimal("40"), Technique.MYO)).isEqualTo(4);
        assertThat(partialsBest.at(owner, ex, new BigDecimal("40"), Technique.DROP)).isNull();
        // the records list keeps the plain challenge's number only
        assertThat(partialsBest.bestPerWeightByIdentity(owner).get(ExerciseHistoryResolver.identityKey(ex)))
            .singleElement().satisfies(b -> assertThat(b.reps()).isEqualTo(14));
    }
}
