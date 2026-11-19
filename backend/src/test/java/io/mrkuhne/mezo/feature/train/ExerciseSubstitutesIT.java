package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseSubstitute;
import io.mrkuhne.mezo.api.dto.ExerciseSubstituteLabel;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitutesResponse;
import io.mrkuhne.mezo.api.dto.GymProfile;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP read of the reasoned swap suggestions (mezo-r36n9.66, spec 2026-11-17 §6.2). */
class ExerciseSubstitutesIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseCatalogRepository catalogRepository;

    private UUID user;
    private HttpHeaders auth;
    private WorkoutSessionEntity day;
    private WorkoutSessionEntity instance;
    private ExerciseEntity bench;
    private ExerciseCatalogEntity benchCatalog;

    @BeforeEach
    void setUp() {
        RegisteredUser u = registerUser("Substitutes");
        user = u.id();
        auth = u.headers();
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "meso", "active");
        day = trainPopulator.createTemplateDay(user, meso.getId(), "Szo");
        benchCatalog = catalog("Barbell Bench Press");
        bench = trainPopulator.createExercise(user, day.getId(), "Barbell Bench Press", 0,
            "chest-mid", "compound", benchCatalog.getId());
        instance = trainPopulator.createWorkoutInstance(user, day, LocalDate.now(), "active");
    }

    private ExerciseCatalogEntity catalog(String name) {
        return catalogRepository.findAll().stream().filter(c -> c.getName().equals(name)).findFirst().orElseThrow();
    }

    private static String uri(WorkoutSessionEntity workout, ExerciseEntity row) {
        return "/api/train/workouts/" + workout.getId() + "/exercises/" + row.getId() + "/substitutes";
    }

    private ExerciseSubstitutesResponse read() {
        return getForBody(uri(instance, bench), auth, HttpStatus.OK, ExerciseSubstitutesResponse.class);
    }

    /** A past, completed instance of a second day where {@code name} was trained — history and feedback source. */
    private ExerciseEntity pastRow(String name) {
        WorkoutSessionEntity other = trainPopulator.createTemplateDay(user, day.getMesocycleId(), "Past " + name);
        return trainPopulator.createExercise(user, other.getId(), name, 0, "chest-mid", "compound",
            catalog(name).getId());
    }

    @Test
    void testSubstitutes_shouldReturnUpToFiveReasonedSameMuscleSuggestions() {
        ExerciseSubstitutesResponse res = read();

        assertThat(res.getSuggestions()).isNotEmpty().hasSizeLessThanOrEqualTo(5);
        assertThat(res.getSuggestions()).allSatisfy(s -> {
            assertThat(s.getExercise().getMuscle()).isEqualTo("chest-mid");
            assertThat(s.getExercise().getId()).isNotEqualTo(benchCatalog.getId());
            assertThat(s.getReasonText()).isNotBlank().endsWith(".");
        });
        assertThat(res.getSuggestions().get(0).getExercise().getType().getValue()).isEqualTo("compound");
    }

    @Test
    void testSubstitutes_shouldLeaveOutAndLabelMachines_whenMachinesAreOff() {
        putForBody("/api/train/gym-profile", new GymProfile().offKinds(List.of("machine")).missingExerciseIds(List.of()),
            auth, HttpStatus.OK, GymProfile.class);

        ExerciseSubstitutesResponse res = read();

        assertThat(res.getSuggestions()).extracting(s -> s.getExercise().getName())
            .doesNotContain("Machine Chest Press", "Pec Deck");
        assertThat(res.getLabels()).extracting(ExerciseSubstituteLabel::getCatalogId)
            .contains(catalog("Machine Chest Press").getId(), catalog("Pec Deck").getId());
        assertThat(res.getLabels()).allSatisfy(l ->
            assertThat(l.getLabel()).isEqualTo(ExerciseSubstituteLabel.LabelEnum.NO_EQUIPMENT));
    }

    @Test
    void testSubstitutes_shouldLabelHurtBefore_whenStrongJointPainWasReported() {
        ExerciseEntity past = pastRow("DB Bench Press");
        WorkoutSessionEntity done = trainPopulator.completedInstanceWithWorkingSet(
            user, past.getWorkoutSessionId(), past.getId(), new BigDecimal("30"), 10, 1);
        trainPopulator.createFeedback(user, done.getId(), past.getId(), 3, 3, 2);

        ExerciseSubstitutesResponse res = read();

        assertThat(res.getLabels()).anySatisfy(l -> {
            assertThat(l.getCatalogId()).isEqualTo(catalog("DB Bench Press").getId());
            assertThat(l.getLabel()).isEqualTo(ExerciseSubstituteLabel.LabelEnum.HURT_BEFORE);
        });
        assertThat(res.getSuggestions()).extracting(s -> s.getExercise().getName()).doesNotContain("DB Bench Press");
    }

    @Test
    void testSubstitutes_shouldPreferSparingOrGuided_afterSwapTimeDiscomfort() {
        postForBody("/api/train/workouts/" + instance.getId() + "/exercises/" + bench.getId() + "/discomfort",
            null, auth, HttpStatus.NO_CONTENT, Void.class);

        ExerciseSubstitute first = read().getSuggestions().get(0);

        assertThat(first.getSignals()).containsAnyOf("SPARES_JOINT", "GUIDED");
    }

    @Test
    void testSubstitutes_shouldReturnLastTopSet_whenTheCandidateWasTrained() {
        ExerciseEntity past = pastRow("DB Bench Press");
        trainPopulator.completedInstanceWithWorkingSet(
            user, past.getWorkoutSessionId(), past.getId(), new BigDecimal("32.5"), 9, 1);

        ExerciseSubstitute db = read().getSuggestions().stream()
            .filter(s -> s.getExercise().getName().equals("DB Bench Press")).findFirst().orElseThrow();

        assertThat(db.getLastTopSet().getWeightKg()).isEqualByComparingTo("32.5");
        assertThat(db.getLastTopSet().getReps()).isEqualTo(9);
        assertThat(read().getSuggestions()).filteredOn(s -> s.getExercise().getName().equals("Pec Deck"))
            .allSatisfy(s -> assertThat(s.getLastTopSet()).isNull());
    }

    @Test
    void testSubstitutes_shouldReturn200_whenTheWorkoutHasNoMesocycle() {
        WorkoutSessionEntity custom = trainPopulator.createCustomTemplateDay(user, "Saját");
        ExerciseEntity row = trainPopulator.createExercise(user, custom.getId(), "Barbell Bench Press", 0,
            "chest-mid", "compound", benchCatalog.getId());
        WorkoutSessionEntity inst = trainPopulator.createWorkoutInstance(user, custom, LocalDate.now(), "active");

        ExerciseSubstitutesResponse res = getForBody(uri(inst, row), auth, HttpStatus.OK, ExerciseSubstitutesResponse.class);

        assertThat(res.getSuggestions()).isNotEmpty();
    }

    @Test
    void testSubstitutes_shouldReturn200_whenTheOutgoingExerciseIsCustom() {
        ExerciseEntity custom = trainPopulator.createExercise(user, day.getId(), "Saját húzás", 5);

        getForBody(uri(instance, custom), auth, HttpStatus.OK, ExerciseSubstitutesResponse.class);
    }

    @Test
    void testSubstitutes_shouldReturn409_whenTheWorkoutIsFinished() {
        WorkoutSessionEntity done = trainPopulator.createWorkoutInstance(user, day, LocalDate.now().minusDays(3), "completed");

        getForBody(uri(done, bench), auth, HttpStatus.CONFLICT, String.class);
    }

    @Test
    void testSubstitutes_shouldReturn404_whenTheWorkoutIsAnotherUsers() {
        HttpHeaders other = registerUser("Substitutes Other").headers();

        getForBody(uri(instance, bench), other, HttpStatus.NOT_FOUND, String.class);
    }
}
