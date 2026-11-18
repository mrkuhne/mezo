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

        assertThat(partialsBest.at(owner, ex, new BigDecimal("60"))).isEqualTo(15);
        assertThat(partialsBest.at(owner, ex, new BigDecimal("50.0"))).isEqualTo(20);
        assertThat(partialsBest.at(owner, ex, new BigDecimal("70"))).isNull();
        assertThat(partialsBest.at(owner, ex, null)).isNull();
        var all = partialsBest.bestPerWeight(owner, ExerciseHistoryResolver.identityKey(ex));
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

        assertThat(partialsBest.at(owner, ex, new BigDecimal("60"))).isEqualTo(10);
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

        assertThat(partialsBest.at(owner, bench, new BigDecimal("60"))).isNull();
        assertThat(partialsBest.at(owner, fly, new BigDecimal("60"))).isEqualTo(40);
    }
}
