package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * mezo-1jm8: the {@code active_seconds} history backfill inside
 * {@code 202609021400_mezo-1jm8_workout_session_timing.sql} sums consecutive
 * {@code exercise_set.done_at} gaps per completed instance, clipping each gap at 300s
 * (the gap cap). Liquibase already ran this migration once against an empty schema at
 * context start (zero-row no-op), so this test inserts a fixture AFTER that and
 * re-executes the same {@code with gaps as (...) update ...} statement directly —
 * exercising both the clipping arithmetic and the statement's idempotency (rerunning it
 * against rows it already filled must not change them, since it only touches rows where
 * {@code active_seconds IS NULL}).
 */
class WorkoutTimingBackfillIT extends AbstractIntegrationTest {

    private static final String SCRIPT_PATH =
        "src/main/resources/db/changelog/1.0.0/script/202609021400_mezo-1jm8_workout_session_timing.sql";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void testBackfill_shouldClipLongGaps_whenSetIntervalExceedsCap() throws Exception {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, template, java.time.LocalDate.now(), "completed");
        UUID sessionId = instance.getId();

        Instant t = Instant.parse("2026-08-01T10:00:00Z");
        trainPopulator.createLoggedSet(owner, exercise.getId(), sessionId, 0, "60", 8, 1, t);
        trainPopulator.createLoggedSet(owner, exercise.getId(), sessionId, 1, "60", 8, 1, t.plusSeconds(60));
        trainPopulator.createLoggedSet(owner, exercise.getId(), sessionId, 2, "60", 8, 1, t.plusSeconds(660));
        trainPopulator.createLoggedSet(owner, exercise.getId(), sessionId, 3, "60", 8, 1, t.plusSeconds(750));

        runBackfill();

        // 60s + min(600,300) + 90s = 450
        assertThat(loadActiveSeconds(sessionId)).isEqualTo(450);

        // Idempotency: the statement only touches rows where active_seconds IS NULL, so
        // rerunning it against an already-filled row must not change the value.
        runBackfill();

        assertThat(loadActiveSeconds(sessionId)).isEqualTo(450);
    }

    @Test
    void testBackfill_shouldLeaveActiveSecondsNull_whenSessionHasOneLoggedSet() throws Exception {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, template, java.time.LocalDate.now(), "completed");
        UUID sessionId = instance.getId();

        trainPopulator.createLoggedSet(owner, exercise.getId(), sessionId, 0, "60", 8, 1, Instant.now());

        runBackfill();

        // A lone set has no lag() predecessor, so it produces no delta at all (not even one
        // that gets clipped) — active_seconds stays NULL ("unknown"), not 0.
        assertThat(loadActiveSeconds(sessionId)).isNull();
    }

    @Test
    void testBackfill_shouldLeaveActiveSecondsNull_whenSessionHasNoLoggedSets() throws Exception {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        WorkoutSessionEntity emptyInstance =
            trainPopulator.createWorkoutInstance(owner, template, java.time.LocalDate.now(), "completed");
        UUID emptySessionId = emptyInstance.getId();

        runBackfill();

        assertThat(loadActiveSeconds(emptySessionId)).isNull();
    }

    private Integer loadActiveSeconds(UUID sessionId) {
        return jdbcTemplate.queryForObject(
            "select active_seconds from workout_session where id = ?", Integer.class, sessionId);
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /**
     * Extracts and re-runs the {@code with raw_deltas as (...) update workout_session ...}
     * statement from the real migration file (the three {@code alter table} statements already
     * applied during schema migration and would fail to re-run against the same schema). Located
     * by {@code indexOf}, not a blind {@code split(";")}, because the file's header comments
     * themselves contain semicolons; the backfill is the last statement in the file, so its
     * text runs to the end.
     */
    private void runBackfill() throws Exception {
        String sql = Files.readString(Path.of(SCRIPT_PATH));
        int start = sql.indexOf("with raw_deltas as");
        if (start < 0) {
            throw new IllegalStateException("with raw_deltas as statement not found in " + SCRIPT_PATH);
        }
        jdbcTemplate.update(sql.substring(start).trim());
    }
}
