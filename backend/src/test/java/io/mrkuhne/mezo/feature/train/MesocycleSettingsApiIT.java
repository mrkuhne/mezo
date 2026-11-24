package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseTechniqueUpdateRequest;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.MesocycleSettingsUpdateRequest;
import io.mrkuhne.mezo.api.dto.Technique;
import io.mrkuhne.mezo.api.dto.TrainingStyle;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * {@code PUT /api/train/mesocycles/{id}/settings} (mezo-r36n9.83, decision #51): partial update of a running
 * block's training style, techniques flag and weekly review mode. The style change re-stamps the run's rows
 * in place (ids kept); the effective review mode falls back to {@code mezo.volume.weekly-review.mode} (auto in
 * the test profile). The proposal-side effect of a per-run mode lives in {@code WeekProposalRunModeIT}.
 */
class MesocycleSettingsApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    private record Run(UUID mesoId, ExerciseEntity fly, ExerciseEntity pinned, ExerciseEntity closing) {}

    /** A balanced run: a free-to-restyle isolation row, one with an owner rep-range override, one non-volume row. */
    private Run run(UUID owner) {
        MesocycleEntity m = trainPopulator.createMesocycle(owner, "Beállítás " + UUID.randomUUID(), "active");
        jdbcTemplate.update("update mesocycle set training_style = 'balanced' where id = ?", m.getId());
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(owner, m.getId(), "Hét", "Push", 0, "planned");
        ExerciseEntity fly = trainPopulator.createExercise(owner, day.getId(), "Cable Fly", "chest-mid", "isolation");
        fly.setCatalogId(catalogRepository.findBySlug("cable-fly").orElseThrow().getId());
        fly = trainPopulator.save(fly);
        ExerciseEntity pinned = trainPopulator.createExercise(owner, day.getId(), "Pec Deck", "chest-mid", "isolation");
        pinned.setOverrides(List.of("repRange"));
        pinned = trainPopulator.save(pinned);
        ExerciseEntity closing = trainPopulator.createExercise(owner, day.getId(), "Plank", "core", "isolation");
        closing.setCountsTowardVolume(false);
        closing = trainPopulator.save(closing);
        return new Run(m.getId(), fly, pinned, closing);
    }

    private static String url(UUID mesoId) {
        return "/api/train/mesocycles/" + mesoId + "/settings";
    }

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private Map<String, Object> row(UUID id) {
        return jdbcTemplate.queryForMap("select rep_min, rep_max, is_deleted from exercise where id = ?", id);
    }

    @Test
    void emptyBodyKeepsEverythingAndReportsTheDefaultMode() {
        Run r = run(owner());
        MesocycleResponse out = putForBody(url(r.mesoId()), MesocycleSettingsUpdateRequest.builder().build(),
            ownerAuthHeaders(), HttpStatus.OK, MesocycleResponse.class);

        assertThat(out.getTrainingStyle()).isEqualTo(TrainingStyle.BALANCED);
        assertThat(out.getTechniquesEnabled()).isFalse();
        // no own mode → the server default (auto in the test profile)
        assertThat(out.getWeeklyReviewMode()).isEqualTo(MesocycleResponse.WeeklyReviewModeEnum.AUTO);
        assertThat(jdbcTemplate.queryForObject("select weekly_review_mode from mesocycle where id = ?", String.class,
            r.mesoId())).isNull();
        assertThat(row(r.fly().getId())).containsEntry("rep_min", 6).containsEntry("rep_max", 8);
    }

    @Test
    void ownModeIsStoredAndReturnedAndKeptWhenAbsent() {
        Run r = run(owner());
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleResponse out = putForBody(url(r.mesoId()),
            MesocycleSettingsUpdateRequest.builder().weeklyReviewMode("manual").build(), auth, HttpStatus.OK,
            MesocycleResponse.class);
        assertThat(out.getWeeklyReviewMode()).isEqualTo(MesocycleResponse.WeeklyReviewModeEnum.MANUAL);

        MesocycleResponse again = putForBody(url(r.mesoId()),
            MesocycleSettingsUpdateRequest.builder().techniquesEnabled(true).build(), auth, HttpStatus.OK,
            MesocycleResponse.class);
        assertThat(again.getWeeklyReviewMode()).isEqualTo(MesocycleResponse.WeeklyReviewModeEnum.MANUAL);
        assertThat(again.getTrainingStyle()).isEqualTo(TrainingStyle.BALANCED);
        assertThat(jdbcTemplate.queryForObject("select weekly_review_mode from mesocycle where id = ?", String.class,
            r.mesoId())).isEqualTo("manual");
    }

    @Test
    void styleChangeRestampsRowsInPlaceAndRespectsOverrides() {
        Run r = run(owner());
        MesocycleResponse out = putForBody(url(r.mesoId()),
            MesocycleSettingsUpdateRequest.builder().trainingStyle(TrainingStyle.VOLUME).build(), ownerAuthHeaders(),
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(out.getTrainingStyle()).isEqualTo(TrainingStyle.VOLUME);
        // isolation under "volume": 15–25, same row id, nothing soft-deleted
        assertThat(row(r.fly().getId())).containsEntry("rep_min", 15).containsEntry("rep_max", 25)
            .containsEntry("is_deleted", false);
        // the owner's rep-range override survives the re-stamp
        assertThat(row(r.pinned().getId())).containsEntry("rep_min", 6).containsEntry("rep_max", 8);
        // a row that does not count toward volume keeps its fixed prescription
        assertThat(row(r.closing().getId())).containsEntry("rep_min", 6).containsEntry("rep_max", 8);
        assertThat(out.getDays()).singleElement().satisfies(d -> assertThat(d.getExercises())
            .extracting(GymExercise::getId)
            .containsExactlyInAnyOrder(r.fly().getId(), r.pinned().getId(), r.closing().getId()));
        assertThat(jdbcTemplate.queryForObject("select count(*) from exercise where workout_session_id = "
            + "(select workout_session_id from exercise where id = ?)", Integer.class, r.fly().getId())).isEqualTo(3);
    }

    /** A stored pick the catalog no longer allows is cleared by the re-stamp, never a 400 on the settings change. */
    @Test
    void styleChangeClearsAStalePickInsteadOfFailing() {
        Run r = run(owner());
        jdbcTemplate.update("update exercise set technique = 'drop', technique_source = 'owner' where id = ?",
            r.fly().getId());
        jdbcTemplate.update("update exercise set challenge = true, technique_source = 'owner', catalog_id = ? "
            + "where id = ?", catalogRepository.findBySlug("pec-deck").orElseThrow().getId(), r.pinned().getId());
        jdbcTemplate.update("update exercise_catalog set allowed_techniques = ARRAY[]::varchar(16)[] where slug = 'cable-fly'");
        try {
            MesocycleResponse out = putForBody(url(r.mesoId()),
                MesocycleSettingsUpdateRequest.builder().trainingStyle(TrainingStyle.VOLUME).build(),
                ownerAuthHeaders(), HttpStatus.OK, MesocycleResponse.class);

            assertThat(out.getTrainingStyle()).isEqualTo(TrainingStyle.VOLUME);
            Map<String, Object> fly = jdbcTemplate.queryForMap(
                "select technique, technique_source, challenge, is_deleted from exercise where id = ?",
                r.fly().getId());
            assertThat(fly).containsEntry("technique", null).containsEntry("technique_source", null)
                .containsEntry("challenge", false).containsEntry("is_deleted", false);
            // a pick that is still valid stays
            assertThat(jdbcTemplate.queryForObject("select challenge from exercise where id = ?", Boolean.class,
                r.pinned().getId())).isTrue();
        } finally {
            jdbcTemplate.update("update exercise_catalog set allowed_techniques = "
                + "ARRAY['rest_drop','drop','myo','rest_pause','partials']::varchar(16)[] where slug = 'cable-fly'");
        }
    }

    @Test
    void nullStyleKeepsTheStoredStyle() {
        Run r = run(owner());
        MesocycleResponse out = putForBody(url(r.mesoId()), Map.of("weeklyReviewMode", "auto"), ownerAuthHeaders(),
            HttpStatus.OK, MesocycleResponse.class);
        assertThat(out.getTrainingStyle()).isEqualTo(TrainingStyle.BALANCED);
    }

    @Test
    void techniquesOnUnblocksTheTechniquePickAndOffKeepsIt() {
        Run r = run(owner());
        HttpHeaders auth = ownerAuthHeaders();
        String techniqueUrl = "/api/train/mesocycles/" + r.mesoId() + "/exercises/" + r.fly().getId() + "/technique";
        ExerciseTechniqueUpdateRequest pick =
            ExerciseTechniqueUpdateRequest.builder().technique(Technique.REST_DROP).challenge(false).build();
        putForBody(techniqueUrl, pick, auth, HttpStatus.CONFLICT, String.class);

        MesocycleResponse on = putForBody(url(r.mesoId()),
            MesocycleSettingsUpdateRequest.builder().techniquesEnabled(true).build(), auth, HttpStatus.OK,
            MesocycleResponse.class);
        assertThat(on.getTechniquesEnabled()).isTrue();
        putForBody(techniqueUrl, pick, auth, HttpStatus.OK, GymExercise.class);

        putForBody(url(r.mesoId()), MesocycleSettingsUpdateRequest.builder().techniquesEnabled(false).build(), auth,
            HttpStatus.OK, MesocycleResponse.class);
        // switching off never deletes the stored pick
        assertThat(jdbcTemplate.queryForObject("select technique from exercise where id = ?", String.class,
            r.fly().getId())).isEqualTo("rest_drop");
    }

    @Test
    void invalidModeIs400() {
        Run r = run(owner());
        putForBody(url(r.mesoId()), Map.of("weeklyReviewMode", "weekly"), ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void missingTokenIs401() {
        Run r = run(owner());
        putForBody(url(r.mesoId()), Map.of(), new HttpHeaders(), HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void foreignRunIs404() {
        owner();
        UUID other = databasePopulator.populateUser("someone-else@example.com");
        Run r = run(other);
        putForBody(url(r.mesoId()), MesocycleSettingsUpdateRequest.builder().techniquesEnabled(true).build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertThat(jdbcTemplate.queryForObject("select techniques_enabled from mesocycle where id = ?", Boolean.class,
            r.mesoId())).isFalse();
    }

    @Test
    void archivedRunIs409() {
        Run r = run(owner());
        jdbcTemplate.update("update mesocycle set status = 'archived' where id = ?", r.mesoId());
        String body = putForBody(url(r.mesoId()),
            MesocycleSettingsUpdateRequest.builder().weeklyReviewMode("manual").build(), ownerAuthHeaders(),
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "TRAIN_RUN_NOT_EDITABLE");
    }
}
