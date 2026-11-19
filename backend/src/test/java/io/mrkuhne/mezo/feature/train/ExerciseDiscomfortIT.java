package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseDiscomfortRepository;
import io.mrkuhne.mezo.feature.train.service.DiscomfortHistory;
import io.mrkuhne.mezo.feature.train.service.ExerciseDiscomfortService;
import io.mrkuhne.mezo.feature.train.service.PainLevel;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

/** The swap-time "nem esik jól" record and the per-exercise discomfort level (mezo-r36n9.66, spec §6.1). */
@Transactional
class ExerciseDiscomfortIT extends AbstractIntegrationTest {

    @Autowired private ExerciseDiscomfortService service;
    @Autowired private ExerciseDiscomfortRepository repository;
    @Autowired private DiscomfortHistory history;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID user;
    private WorkoutSessionEntity day;
    private WorkoutSessionEntity instance;

    @BeforeEach
    void setUp() {
        user = databasePopulator.populateUser("discomfort@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        day = trainPopulator.createTemplateDay(user, meso.getId(), "Szo");
        instance = trainPopulator.createWorkoutInstance(user, day, LocalDate.now(), "active");
    }

    private ExerciseCatalogEntity twin(String name) {
        return catalogRepository.findAll().stream().filter(c -> c.getName().equals(name)).findFirst().orElseThrow();
    }

    @Test
    void testMark_shouldKeepOneRow_whenPostedTwiceTheSameDay() {
        ExerciseEntity row = trainPopulator.createExercise(user, day.getId(), "Chest Supported Row", 0);

        service.mark(user, instance.getId(), row.getId());
        service.mark(user, instance.getId(), row.getId());

        assertThat(repository.findAll()).hasSize(1);
    }

    @Test
    void testClear_shouldRemoveTodaysRow() {
        ExerciseEntity row = trainPopulator.createExercise(user, day.getId(), "Chest Supported Row", 0);
        service.mark(user, instance.getId(), row.getId());

        service.clear(user, instance.getId(), row.getId());

        assertThat(repository.findAll()).isEmpty();
    }

    @Test
    void testMark_shouldStoreNullCatalogId_whenTheRowIsCustom() {
        ExerciseEntity row = trainPopulator.createExercise(user, day.getId(), "Chest Supported Row", 0);

        service.mark(user, instance.getId(), row.getId());

        var saved = repository.findAll().get(0);
        assertThat(saved.getCatalogId()).isNull();
        assertThat(saved.getIdentityKey()).isEqualTo("n:Chest Supported Row");
        assertThat(saved.getSource()).isEqualTo("swap");
        assertThat(saved.getNotedOn()).isEqualTo(instance.getDate());
    }

    @Test
    void testMark_shouldStoreCatalogIdAndKey_whenTheRowIsLinked() {
        ExerciseCatalogEntity cat = catalogRepository.findAll().get(0);
        ExerciseEntity row = trainPopulator.createExercise(
            user, day.getId(), cat.getName(), 0, cat.getMuscle(), cat.getType(), cat.getId());

        service.mark(user, instance.getId(), row.getId());

        var saved = repository.findAll().get(0);
        assertThat(saved.getCatalogId()).isEqualTo(cat.getId());
        assertThat(saved.getIdentityKey()).isEqualTo("c:" + cat.getId());
    }

    @Test
    void testLevels_shouldBeMildForTheCatalogueTwin_whenACustomRowWithTheSameNameWasMarked() {
        ExerciseCatalogEntity cat = catalogRepository.findAll().get(0);
        ExerciseEntity custom = trainPopulator.createExercise(user, day.getId(), cat.getName(), 0);
        service.mark(user, instance.getId(), custom.getId());

        Map<UUID, PainLevel> mine = history.levels(user, List.of(cat), LocalDate.now());
        UUID other = databasePopulator.populateUser("other-discomfort@test.local");
        Map<UUID, PainLevel> theirs = history.levels(other, List.of(cat), LocalDate.now());

        assertThat(mine).containsEntry(cat.getId(), PainLevel.MILD);
        assertThat(theirs).containsEntry(cat.getId(), PainLevel.NONE);
    }

    @Test
    void testLevels_shouldFoldTheLastThreeFeedbackAnswers_byIdentity() {
        ExerciseCatalogEntity cat = catalogRepository.findAll().get(0);
        ExerciseEntity row = trainPopulator.createExercise(
            user, day.getId(), cat.getName(), 0, cat.getMuscle(), cat.getType(), cat.getId());
        java.time.Instant t = java.time.Instant.now();
        // newest three are 1,1,1; the strong answer is fourth-newest and must not count
        trainPopulator.createFeedbackAt(user, instance.getId(), row.getId(), 3, 3, 2, t.minusSeconds(400));
        trainPopulator.createFeedbackAt(user, extra().getId(), row.getId(), 3, 1, 2, t.minusSeconds(300));
        trainPopulator.createFeedbackAt(user, extra().getId(), row.getId(), 3, 1, 2, t.minusSeconds(200));
        trainPopulator.createFeedbackAt(user, extra().getId(), row.getId(), 3, 1, 2, t.minusSeconds(100));

        assertThat(history.levels(user, List.of(cat), LocalDate.now())).containsEntry(cat.getId(), PainLevel.NONE);
    }

    private WorkoutSessionEntity extra() {
        return trainPopulator.createWorkoutInstance(user, day, LocalDate.now().minusDays(1), "completed");
    }

    @Test
    void testMark_shouldFail409_whenTheWorkoutIsFinished() {
        ExerciseEntity row = trainPopulator.createExercise(user, day.getId(), "Chest Supported Row", 0);
        WorkoutSessionEntity done = trainPopulator.createWorkoutInstance(user, day, LocalDate.now(), "completed");

        assertThatThrownBy(() -> service.mark(user, done.getId(), row.getId()))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void testMark_shouldFail404_whenTheExerciseIsAnotherUsers() {
        UUID other = databasePopulator.populateUser("intruder@test.local");

        ExerciseEntity row = trainPopulator.createExercise(user, day.getId(), "Chest Supported Row", 0);

        assertThatThrownBy(() -> service.mark(other, instance.getId(), row.getId()))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
