package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
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

/**
 * Verifies the demo {@code video_url} on a linked catalog row surfaces onto the workout DTOs:
 * {@code TodayExercise.videoUrl} (via {@link WorkoutService#getToday}) and {@code
 * GymExercise.videoUrl} (via {@link TrainService#listMesocycles}), resolved by
 * {@code exercise.catalog_id → exercise_catalog.video_url}. An unlinked exercise (or a linked row
 * with no video) yields a null videoUrl.
 */
class CatalogVideoResolutionIT extends AbstractIntegrationTest {

    private static final String BENCH_VIDEO = "https://youtu.be/dQw4w9WgXcQ";
    private static final String SQUAT_VIDEO = "https://youtu.be/9bZkp7q19f0";

    @Autowired WorkoutService workoutService;
    @Autowired TrainService trainService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired ExerciseCatalogRepository catalogRepository;

    @Test
    void testGetToday_shouldResolveVideoUrlFromCatalog_whenExerciseLinked() {
        UUID owner = databasePopulator.populateUser("video-today@test.local");
        MesocycleEntity meso = train.createActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        UUID catalogId = catalogWithVideo(owner, "Fekvenyomás", "chest", "compound", BENCH_VIDEO);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", 0, "chest", "compound", catalogId);
        ex.setAnchorWeightKg(BigDecimal.valueOf(60));
        train.save(ex);

        WorkoutTodayResponse res = workoutService.getToday(owner);

        // 1 created + the fix-zárás closing pair appended by the default-on closing block (mezo-z2ul)
        assertThat(res.getExercises()).hasSize(3);
        assertThat(res.getExercises().get(0).getVideoUrl()).isEqualTo(BENCH_VIDEO);
    }

    @Test
    void testGetToday_shouldLeaveVideoUrlNull_whenExerciseNotLinked() {
        UUID owner = databasePopulator.populateUser("video-today-null@test.local");
        MesocycleEntity meso = train.createActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Húzódzkodás", 0, "back", "compound", null);
        ex.setAnchorWeightKg(BigDecimal.valueOf(20));
        train.save(ex);

        WorkoutTodayResponse res = workoutService.getToday(owner);

        // 1 created + the fix-zárás closing pair appended by the default-on closing block (mezo-z2ul)
        assertThat(res.getExercises()).hasSize(3);
        assertThat(res.getExercises().get(0).getVideoUrl()).isNull();
    }

    @Test
    void testListMesocycles_shouldResolveVideoUrlPerExercise_whenCatalogLinked() {
        UUID owner = databasePopulator.populateUser("video-meso@test.local");
        MesocycleEntity meso = train.createMesocycle(owner, "Video meso", "active");
        WorkoutSessionEntity day = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "active");
        UUID catalogId = catalogWithVideo(owner, "Guggolás", "quad", "compound", SQUAT_VIDEO);
        train.createExercise(owner, day.getId(), "Guggolás", 0, "quad", "compound", catalogId);
        // Sibling with no catalog link — must stay null (no cross-contamination).
        train.createExercise(owner, day.getId(), "Lábtolás", 1, "quad", "compound", null);

        List<MesocycleResponse> res = trainService.listMesocycles(owner);

        List<GymExercise> exercises = res.get(0).getDays().get(0).getExercises();
        assertThat(exercises).hasSize(2);
        assertThat(exercises.get(0).getVideoUrl()).isEqualTo(SQUAT_VIDEO);
        assertThat(exercises.get(1).getVideoUrl()).isNull();
    }

    /** A user-authored catalog row carrying a demo video; returns its id. */
    private UUID catalogWithVideo(UUID owner, String name, String muscle, String type, String video) {
        ExerciseCatalogEntity catalog = train.createUserCatalogExercise(owner, name, muscle, type);
        catalog.setVideoUrl(video);
        return catalogRepository.saveAndFlush(catalog).getId();
    }
}
