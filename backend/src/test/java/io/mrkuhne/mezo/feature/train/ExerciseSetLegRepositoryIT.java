package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetLegRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/** The set-legs table: hard-delete cascade, unique leg order, batched read (mezo-r36n9.80, Task 2). */
class ExerciseSetLegRepositoryIT extends AbstractIntegrationTest {

    @Autowired ExerciseSetLegRepository legs;
    @Autowired ExerciseSetRepository sets;
    @Autowired TrainPopulator train;
    @Autowired OwnerProperties ownerProperties;
    @Autowired io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired JdbcTemplate jdbc;

    private ExerciseSetEntity aSet(UUID owner, String name) {
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        var ex = train.createExercise(owner, day.getId(), name, "chest", "compound");
        var set = train.createExerciseSet(owner, ex.getId(), 0);
        set.setTechnique("rest_drop");
        return sets.saveAndFlush(set);
    }

    private ExerciseSetLegEntity leg(UUID setId, int index, String kind, String kg, Integer reps) {
        var l = new ExerciseSetLegEntity();
        l.setExerciseSetId(setId);
        l.setLegIndex(index);
        l.setKind(kind);
        l.setWeightKg(kg == null ? null : new BigDecimal(kg));
        l.setReps(reps);
        l.setRestSec(30);
        return l;
    }

    @Test
    void legsCascadeOnHardDelete() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        var set = aSet(owner, "Fekvenyomás");
        legs.saveAndFlush(leg(set.getId(), 0, "drop", "42.00", 8));
        assertThat(legs.findByExerciseSetIdIn(List.of(set.getId()))).hasSize(1);

        jdbc.update("DELETE FROM exercise_set WHERE id = ?", set.getId());

        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM exercise_set_leg WHERE exercise_set_id = ?", Integer.class, set.getId()))
            .isZero();
    }

    @Test
    void uniqueLegIndex() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        var set = aSet(owner, "Fekvenyomás");
        legs.saveAndFlush(leg(set.getId(), 0, "drop", "42.00", 8));
        assertThatThrownBy(() -> legs.saveAndFlush(leg(set.getId(), 0, "drop", "30.00", 6)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void findByExerciseSetIdIn() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        var a = aSet(owner, "Fekvenyomás");
        var b = aSet(owner, "Vállnyomás");
        legs.save(leg(a.getId(), 1, "drop", "30.00", 6));
        legs.save(leg(a.getId(), 0, "drop", "42.00", 8));
        legs.saveAndFlush(leg(b.getId(), 0, "partials", null, 5));

        var both = legs.findByExerciseSetIdIn(List.of(a.getId(), b.getId()));
        assertThat(both).hasSize(3);
        assertThat(legs.findByExerciseSetIdIn(List.of(a.getId())))
            .extracting(ExerciseSetLegEntity::getLegIndex).containsExactlyInAnyOrder(0, 1);
        assertThat(legs.findByExerciseSetIdIn(List.of())).isEmpty();
    }
}
