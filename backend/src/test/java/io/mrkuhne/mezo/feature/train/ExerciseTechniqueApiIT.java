package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseTechniqueUpdateRequest;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.Technique;
import io.mrkuhne.mezo.api.dto.TechniqueSource;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/** The mid-run technique PUT (mezo-r36n9.80, T2 Task 5). */
class ExerciseTechniqueApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    private record Run(UUID mesoId, UUID dayId, ExerciseEntity fly, ExerciseEntity deck, ExerciseEntity bench) {}

    private Run run(UUID owner, boolean enabled) {
        MesocycleEntity m = trainPopulator.createMesocycle(owner, "Technikás " + UUID.randomUUID(), "active");
        jdbcTemplate.update("update mesocycle set techniques_enabled = ? where id = ?", enabled, m.getId());
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(owner, m.getId(), "Hét", "Push", 0, "planned");
        return new Run(m.getId(), day.getId(),
            row(owner, day, "Cable Fly", "cable-fly"), row(owner, day, "Pec Deck", "pec-deck"),
            row(owner, day, "Barbell Bench Press", "barbell-bench-press"));
    }

    private ExerciseEntity row(UUID owner, WorkoutSessionEntity day, String name, String slug) {
        ExerciseEntity e = trainPopulator.createExercise(owner, day.getId(), name, "chest-mid", "isolation");
        e.setCatalogId(catalogRepository.findBySlug(slug).orElseThrow().getId());
        return trainPopulator.save(e);
    }

    private ExerciseEntity catalogRow(UUID owner, UUID dayId, String name, String muscle, String slug) {
        ExerciseEntity e = trainPopulator.createExercise(owner, dayId, name, muscle, "isolation");
        e.setCatalogId(catalogRepository.findBySlug(slug).orElseThrow().getId());
        return trainPopulator.save(e);
    }

    private static String url(Run r, ExerciseEntity e) {
        return "/api/train/mesocycles/" + r.mesoId() + "/exercises/" + e.getId() + "/technique";
    }

    private static ExerciseTechniqueUpdateRequest body(Technique t, Boolean challenge) {
        return ExerciseTechniqueUpdateRequest.builder().technique(t).challenge(challenge).build();
    }

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void setsTechniqueOnStableExercise() {
        Run r = run(owner(), true);
        GymExercise out = putForBody(url(r, r.fly()), body(Technique.REST_DROP, false), ownerAuthHeaders(),
            HttpStatus.OK, GymExercise.class);

        assertThat(out.getId()).isEqualTo(r.fly().getId());
        assertThat(out.getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(out.getTechniqueSource()).isEqualTo(TechniqueSource.OWNER);
        assertThat(jdbcTemplate.queryForObject("select technique from exercise where id = ?", String.class,
            r.fly().getId())).isEqualTo("rest_drop");
        assertThat(jdbcTemplate.queryForObject("select technique_source from exercise where id = ?", String.class,
            r.fly().getId())).isEqualTo("owner");
    }

    @Test
    void restPausePinsTheWholeExerciseToTwentyReps() {
        // mezo-r36n9.125: owner 2026-11-20 — every set of the exercise becomes 20, and the range is his
        Run r = run(owner(), true);
        GymExercise out = putForBody(url(r, r.fly()), body(Technique.REST_PAUSE, false), ownerAuthHeaders(),
            HttpStatus.OK, GymExercise.class);

        assertThat(out.getTechnique()).isEqualTo(Technique.REST_PAUSE);
        assertThat(out.getRepMin()).isEqualTo(20);
        assertThat(out.getRepMax()).isEqualTo(20);
        assertThat(jdbcTemplate.queryForObject("select technique from exercise where id = ?", String.class,
            r.fly().getId())).isEqualTo("rest_pause");
        assertThat(jdbcTemplate.queryForObject("select rep_min from exercise where id = ?", Integer.class,
            r.fly().getId())).isEqualTo(20);
        assertThat(jdbcTemplate.queryForObject("select rep_max from exercise where id = ?", Integer.class,
            r.fly().getId())).isEqualTo(20);
    }

    @Test
    void rejectsFreeExercise() {
        Run r = run(owner(), true);
        String res = putForBody(url(r, r.bench()), body(Technique.DROP, false), ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(res, "TRAIN_TECHNIQUE_NOT_ALLOWED");
        assertThat(res).contains("Barbell Bench Press");
        assertThat(jdbcTemplate.queryForObject("select technique from exercise where id = ?", String.class,
            r.bench().getId())).isNull();
    }

    @Test
    void testUpdate_shouldAllowOnlyReviewedTechniques_onHammerHipAndOverhead() {
        UUID owner = owner();
        Run r = run(owner, true);
        HttpHeaders auth = ownerAuthHeaders();
        ExerciseEntity hammer = catalogRow(owner, r.dayId(), "Hammer Curl", "biceps-brachialis", "hammer-curl");
        ExerciseEntity hip = catalogRow(owner, r.dayId(), "Hip Thrust", "glute", "hip-thrust");
        ExerciseEntity overhead = catalogRow(owner, r.dayId(), "Overhead Press", "shoulder-front", "overhead-press");
        for (Technique t : java.util.List.of(Technique.MYO, Technique.REST_DROP, Technique.DROP)) {
            assertThat(putForBody(url(r, hammer), body(t, false), auth, HttpStatus.OK, GymExercise.class)
                .getTechnique()).isEqualTo(t);
        }
        assertThat(putForBody(url(r, hip), body(Technique.TOP_PAUSE, false), auth, HttpStatus.OK,
            GymExercise.class).getTechnique()).isEqualTo(Technique.TOP_PAUSE);
        String wrongHip = putForBody(url(r, hip), body(Technique.DROP, false), auth,
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(wrongHip, "TRAIN_TECHNIQUE_NOT_ALLOWED");
        assertThat(wrongHip).contains("Hip Thrust");
        String wrongOverhead = putForBody(url(r, overhead), body(Technique.TOP_PAUSE, false), auth,
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(wrongOverhead, "TRAIN_TECHNIQUE_NOT_ALLOWED");
        assertThat(wrongOverhead).contains("Overhead Press");
    }

    @Test
    void rejectsWhenDisabled() {
        Run r = run(owner(), false);
        String res = putForBody(url(r, r.fly()), body(Technique.DROP, false), ownerAuthHeaders(),
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(res, "TRAIN_TECHNIQUES_DISABLED");
    }

    @Test
    void challengeMovesWithinTheDay() {
        Run r = run(owner(), true);
        HttpHeaders auth = ownerAuthHeaders();
        putForBody(url(r, r.fly()), body(Technique.NONE, true), auth, HttpStatus.OK, GymExercise.class);
        GymExercise out = putForBody(url(r, r.deck()), body(Technique.NONE, true), auth, HttpStatus.OK,
            GymExercise.class);

        assertThat(out.getChallenge()).isTrue();
        assertThat(jdbcTemplate.queryForObject("select challenge from exercise where id = ?", Boolean.class,
            r.fly().getId())).isFalse();
        assertThat(jdbcTemplate.queryForObject("select challenge from exercise where id = ?", Boolean.class,
            r.deck().getId())).isTrue();

    }

    @Test
    void techniqueAndChallengeTogether_shouldSaveBoth() {
        // mezo-r36n9.98: was 400 TRAIN_TECHNIQUE_ON_CHALLENGE; the owner allows both on one exercise
        Run r = run(owner(), true);
        HttpHeaders auth = ownerAuthHeaders();
        putForBody(url(r, r.deck()), body(Technique.NONE, true), auth, HttpStatus.OK, GymExercise.class);
        GymExercise out = putForBody(url(r, r.fly()), body(Technique.REST_DROP, true), auth, HttpStatus.OK,
            GymExercise.class);

        assertThat(out.getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(out.getChallenge()).isTrue();
        assertThat(out.getTechniqueSource()).isEqualTo(TechniqueSource.OWNER);
        assertThat(jdbcTemplate.queryForObject("select technique from exercise where id = ?", String.class,
            r.fly().getId())).isEqualTo("rest_drop");
        assertThat(jdbcTemplate.queryForObject("select challenge from exercise where id = ?", Boolean.class,
            r.fly().getId())).isTrue();
        assertThat(jdbcTemplate.queryForObject("select challenge from exercise where id = ?", Boolean.class,
            r.deck().getId())).isFalse();   // still one challenge a day
    }

    @Test
    void clearRemovesBoth() {
        Run r = run(owner(), true);
        HttpHeaders auth = ownerAuthHeaders();
        putForBody(url(r, r.fly()), body(Technique.MYO, false), auth, HttpStatus.OK, GymExercise.class);
        GymExercise out = putForBody(url(r, r.fly()), body(Technique.NONE, false), auth, HttpStatus.OK,
            GymExercise.class);

        assertThat(out.getTechnique()).isNull();
        assertThat(out.getTechniqueSource()).isNull();
        assertThat(out.getChallenge()).isFalse();
        assertThat(jdbcTemplate.queryForObject("select technique from exercise where id = ?", String.class,
            r.fly().getId())).isNull();
        assertThat(out.getWorkingSets()).isEqualTo(3); // his own pick gave no set away: none comes back
    }

    /** The planner's rest-drop on Cable Fly (2 sets: one straight set given for it); Bench Press at {@code benchSets}. */
    private Run runWithPlannerTechnique(int benchSets) {
        Run r = run(owner(), true);
        jdbcTemplate.update("update exercise set technique = 'rest_drop', technique_source = 'planner', "
            + "working_sets = 2 where id = ?", r.fly().getId());
        jdbcTemplate.update("update exercise set working_sets = ? where id = ?", benchSets, r.bench().getId());
        return r;
    }

    private Integer storedSets(ExerciseEntity e) {
        return jdbcTemplate.queryForObject("select working_sets from exercise where id = ?", Integer.class, e.getId());
    }

    @Test
    void clearingPlannerTechniqueGivesSetBack() {
        Run r = runWithPlannerTechnique(1); // chest that day after: 3 + 3 + 1 = 7 ≤ 8
        HttpHeaders auth = ownerAuthHeaders();

        GymExercise out = putForBody(url(r, r.fly()), body(Technique.NONE, false), auth, HttpStatus.OK,
            GymExercise.class);

        assertThat(out.getTechnique()).isNull();
        assertThat(out.getTechniqueSource()).isNull();
        assertThat(out.getWorkingSets()).isEqualTo(3);
        assertThat(storedSets(r.fly())).isEqualTo(3);
    }

    @Test
    void replacingPlannerTechniqueGivesSetBackWeighedWithHisTechnique() {
        Run r = runWithPlannerTechnique(1);
        jdbcTemplate.update("update exercise set working_sets = 1 where id = ?", r.deck().getId());

        GymExercise mine = putForBody(url(r, r.fly()), body(Technique.MYO, false), ownerAuthHeaders(),
            HttpStatus.OK, GymExercise.class);

        assertThat(mine.getTechnique()).isEqualTo(Technique.MYO);
        assertThat(mine.getTechniqueSource()).isEqualTo(TechniqueSource.OWNER);
        assertThat(mine.getWorkingSets()).isEqualTo(3); // 3 + 1 extra (his myo) + 1 + 1 = 6 ≤ 8
    }

    @Test
    void clearingPlannerTechniqueAtCapKeepsSets() {
        Run r = runWithPlannerTechnique(3); // chest that day after: 3 + 3 + 3 = 9 > 8
        HttpHeaders auth = ownerAuthHeaders();

        GymExercise out = putForBody(url(r, r.fly()), body(Technique.NONE, false), auth, HttpStatus.OK,
            GymExercise.class);

        assertThat(out.getTechnique()).isNull();
        assertThat(out.getWorkingSets()).isEqualTo(2);
        assertThat(storedSets(r.fly())).isEqualTo(2);

        // a challenge-only planner row (no technique) never had a set to give back
        jdbcTemplate.update("update exercise set challenge = true, technique_source = 'planner', working_sets = 2 "
            + "where id = ?", r.deck().getId());
        jdbcTemplate.update("update exercise set working_sets = 1 where id = ?", r.bench().getId());
        GymExercise deck = putForBody(url(r, r.deck()), body(Technique.NONE, false), auth, HttpStatus.OK,
            GymExercise.class);
        assertThat(deck.getChallenge()).isFalse();
        assertThat(deck.getWorkingSets()).isEqualTo(2);
    }

    @Test
    void otherUsersRunIs404() {
        owner();
        UUID other = databasePopulator.populateUser("someone-else@example.com");
        Run r = run(other, true);
        putForBody(url(r, r.fly()), body(Technique.DROP, false), ownerAuthHeaders(), HttpStatus.NOT_FOUND,
            String.class);

        // an exercise of a different run under the owner's own run id is 404 too
        UUID me = owner();
        Run mine = run(me, true);
        putForBody("/api/train/mesocycles/" + mine.mesoId() + "/exercises/" + r.fly().getId() + "/technique",
            body(Technique.DROP, false), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void rowAddedMidWorkoutIs404() {
        UUID owner = owner();
        Run r = run(owner, true);
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(owner, r.mesoId(), "Kedd", "Pull", 1,
            "planned");
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(owner, day,
            java.time.LocalDate.now(), "active");
        ExerciseEntity added = row(owner, instance, "Cable Fly extra", "cable-fly");

        putForBody(url(r, added), body(Technique.DROP, false), ownerAuthHeaders(), HttpStatus.NOT_FOUND,
            String.class);
    }

    @Test
    void archivedRunIs409() {
        Run r = run(owner(), true);
        jdbcTemplate.update("update mesocycle set status = 'archived' where id = ?", r.mesoId());

        String body = putForBody(url(r, r.fly()), body(Technique.DROP, false), ownerAuthHeaders(),
            HttpStatus.CONFLICT, String.class);
        assertThat(body).contains("TRAIN_RUN_NOT_EDITABLE");
    }
}
