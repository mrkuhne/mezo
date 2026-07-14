package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Fix zárás (mezo-z2ul): getToday lazily appends the configured closing exercises (dead hang +
 * 45° back extension) to the END of every non-empty template day of the active meso — idempotent,
 * catalog-linked, rest days untouched. Switch-off behavior lives in {@code ClosingBlockSwitchOffIT}
 * (a @ConditionalOnProperty bean's presence is fixed per context).
 */
class ClosingBlockIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired ExerciseCatalogRepository exerciseCatalogRepository;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    @Test
    void testGetToday_shouldAppendClosingExercisesAtEnd_whenDayHasExercises() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        train.createExercise(owner, day.getId(), "Fekvenyomás", 0);

        WorkoutTodayResponse res = workoutService.getToday(owner);

        List<TodayExercise> ex = res.getExercises();
        assertThat(ex).hasSize(3);
        assertThat(ex.get(0).getName()).isEqualTo("Fekvenyomás");
        assertThat(ex.get(1).getName()).isEqualTo("Dead Hang");
        assertThat(ex.get(1).getWarmupSets()).isZero();
        assertThat(ex.get(1).getWorkingSets()).isEqualTo(2);
        assertThat(ex.get(1).getRepMin()).isEqualTo(45);
        assertThat(ex.get(1).getRepMax()).isEqualTo(60);
        assertThat(ex.get(2).getName()).isEqualTo("45° Back Extension");
        assertThat(ex.get(2).getRepMin()).isEqualTo(12);
        assertThat(ex.get(2).getRepMax()).isEqualTo(15);
        // catalog-linked template rows, appended after the existing ones
        List<ExerciseEntity> rows = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, List.of(day.getId()));
        assertThat(rows).extracting(ExerciseEntity::getOrderIndex).containsExactly(0, 1, 2);
        assertThat(rows.get(1).getCatalogId()).isNotNull();
        assertThat(rows.get(1).getType()).isEqualTo("plyo"); // weightless -> reps(seconds)-only FE
        assertThat(rows.get(2).getType()).isEqualTo("isolation");
    }

    @Test
    void testGetToday_shouldNotDuplicateClosingExercises_whenCalledTwice() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        train.createExercise(owner, day.getId(), "Fekvenyomás", 0);

        workoutService.getToday(owner);
        WorkoutTodayResponse res = workoutService.getToday(owner);

        assertThat(res.getExercises()).hasSize(3);
    }

    @Test
    void testGetToday_shouldEnsureClosingOnEveryTemplateDay_whenMesoHasMultipleDays() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var today = train.createTemplateDay(owner, meso.getId(), todayLabel());
        train.createExercise(owner, today.getId(), "Fekvenyomás", 0);
        var otherDay = train.createTemplateDay(owner, meso.getId(), otherLabel());
        train.createExercise(owner, otherDay.getId(), "Guggolás", 0);

        workoutService.getToday(owner);

        List<ExerciseEntity> otherRows = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, List.of(otherDay.getId()));
        assertThat(otherRows).extracting(ExerciseEntity::getName)
            .containsExactly("Guggolás", "Dead Hang", "45° Back Extension");
    }

    @Test
    void testGetToday_shouldLeaveRestDayEmpty_whenTemplateDayHasNoExercises() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var today = train.createTemplateDay(owner, meso.getId(), todayLabel());
        train.createExercise(owner, today.getId(), "Fekvenyomás", 0);
        var restDay = train.createTemplateDay(owner, meso.getId(), otherLabel());

        workoutService.getToday(owner);

        assertThat(exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, List.of(restDay.getId())))
            .isEmpty();
    }

    @Test
    void testGetToday_shouldSkipAlreadyPresentClosingExercise_whenManuallyAdded() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel());
        UUID deadHangCatalogId = exerciseCatalogRepository.findBySlug("dead-hang").orElseThrow().getId();
        train.createExercise(owner, day.getId(), "Dead Hang", 0, "lats", "plyo", deadHangCatalogId);

        WorkoutTodayResponse res = workoutService.getToday(owner);

        assertThat(res.getExercises()).extracting(TodayExercise::getName)
            .containsExactly("Dead Hang", "45° Back Extension");
    }

    private String todayLabel() {
        return WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    /** A weekday label that is guaranteed NOT today (the next day of the week). */
    private String otherLabel() {
        return WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() % 7);
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }
}
