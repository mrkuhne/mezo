package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BlockExerciseSuggestionsRequest;
import io.mrkuhne.mezo.api.dto.BlockSuggestionOutgoing;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitute;
import io.mrkuhne.mezo.api.dto.ExerciseSubstituteLabel;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitutesResponse;
import io.mrkuhne.mezo.api.dto.GymProfile;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.MuscleGroup;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
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

/** HTTP read of the block day editor's add/swap suggestions (mezo-r36n9.116, spec 2026-11-20 §6.3). */
class BlockExerciseSuggestionsIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private CheckInPopulator checkIns;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private MesocycleRepository mesocycleRepository;

    private UUID user;
    private HttpHeaders auth;
    private MesocycleEntity block;
    private WorkoutSessionEntity day;
    private ExerciseCatalogEntity benchCatalog;

    @BeforeEach
    void setUp() {
        RegisteredUser u = registerUser("Block Suggestions");
        user = u.id();
        auth = u.headers();
        block = trainPopulator.createMesocycle(user, "block", "active");
        block.setTrainingStyle("balanced");
        block = mesocycleRepository.saveAndFlush(block);
        day = trainPopulator.createTemplateDay(user, block.getId(), "Hét");
        benchCatalog = catalog("Barbell Bench Press");
        trainPopulator.createExercise(user, day.getId(), "Barbell Bench Press", 0, "chest-mid", "compound",
            benchCatalog.getId());
    }

    private ExerciseCatalogEntity catalog(String name) {
        return catalogRepository.findAll().stream().filter(c -> c.getName().equals(name)).findFirst().orElseThrow();
    }

    private static int todayIndex() {
        return LocalDate.now().getDayOfWeek().getValue() - 1;
    }

    private static String uri(MesocycleEntity meso) {
        return "/api/train/mesocycles/" + meso.getId() + "/exercise-suggestions";
    }

    private BlockExerciseSuggestionsRequest replaceBench(int dayIndex, UUID... dayCatalogIds) {
        return new BlockExerciseSuggestionsRequest()
            .mode(BlockExerciseSuggestionsRequest.ModeEnum.REPLACE)
            .dayIndex(dayIndex)
            .outgoing(new BlockSuggestionOutgoing().catalogId(benchCatalog.getId()).name("Barbell Bench Press")
                .muscle("chest-mid").type("compound"))
            .dayCatalogIds(List.of(dayCatalogIds));
    }

    private BlockExerciseSuggestionsRequest add(String muscle, UUID... dayCatalogIds) {
        return new BlockExerciseSuggestionsRequest()
            .mode(BlockExerciseSuggestionsRequest.ModeEnum.ADD)
            .dayIndex((todayIndex() + 3) % 7)
            .muscle(muscle)
            .dayCatalogIds(List.of(dayCatalogIds));
    }

    private ExerciseSubstitutesResponse read(BlockExerciseSuggestionsRequest req) {
        return postForBody(uri(block), req, auth, HttpStatus.OK, ExerciseSubstitutesResponse.class);
    }

    private static List<String> names(ExerciseSubstitutesResponse res) {
        return res.getSuggestions().stream().map(s -> s.getExercise().getName()).toList();
    }

    @Test
    void testSuggestions_shouldReturnReasonedPrescribedSuggestions_whenReplacingOnAStyledBlock() {
        ExerciseSubstitutesResponse res = read(replaceBench(todayIndex(), benchCatalog.getId()));

        assertThat(res.getSuggestions()).isNotEmpty().hasSizeLessThanOrEqualTo(5);
        assertThat(res.getSuggestions()).allSatisfy(s -> {
            assertThat(s.getExercise().getId()).isNotEqualTo(benchCatalog.getId());
            assertThat(s.getReasonText()).isNotBlank().endsWith(".");
            assertThat(s.getPrescription()).isNotNull();
            assertThat(s.getPrescription().getRepMin()).isPositive();
            assertThat(s.getPrescription().getRepMax()).isGreaterThanOrEqualTo(s.getPrescription().getRepMin());
            assertThat(s.getPrescription().getWorkingSets()).isPositive();
            assertThat(s.getPrescription().getRestSec()).isPositive();
            assertThat(s.getPrescription().getTargetRIR()).isNotNull();
        });
    }

    @Test
    void testSuggestions_shouldReturnNullPrescription_whenTheBlockIsUnstyled() {
        block.setTrainingStyle(null);
        mesocycleRepository.saveAndFlush(block);

        ExerciseSubstitutesResponse res = read(replaceBench(todayIndex(), benchCatalog.getId()));

        assertThat(res.getSuggestions()).isNotEmpty()
            .allSatisfy(s -> assertThat(s.getPrescription()).isNull());
    }

    @Test
    void testSuggestions_shouldSuggestOnlyTheChosenGroup_whenAdding() {
        ExerciseSubstitutesResponse res = read(add("back", benchCatalog.getId()));

        assertThat(res.getSuggestions()).isNotEmpty().hasSizeLessThanOrEqualTo(5)
            .allSatisfy(s -> {
                assertThat(MuscleGroup.of(s.getExercise().getMuscle())).isEqualTo("back");
                assertThat(s.getReasonText()).endsWith(".");
            });
        // the whole group, not one token: a day without back work gets rows/pulldowns, not only lower back
        assertThat(res.getSuggestions()).extracting(s -> s.getExercise().getMuscle())
            .anyMatch(m -> !"back-lower".equals(m))
            .satisfies(muscles -> assertThat(muscles.stream().distinct().count()).isGreaterThan(1));
    }

    @Test
    void testSuggestions_shouldExplainUnderBand_whenTheBlockTrainsTheGroupBelowItsBand() {
        // the stored block trains back with one 3-set row, below its weekly band in the run evaluation
        // (an untrained group is not judged by the evaluator, so it is never "under band")
        trainPopulator.createExercise(user, day.getId(), "Seated Row", 1, "back-mid", "compound", null);

        ExerciseSubstitutesResponse res = read(add("back", benchCatalog.getId()));

        assertThat(res.getSuggestions()).anySatisfy(s -> {
            assertThat(s.getSignals()).contains("UNDER_BAND");
            assertThat(s.getReasonText()).contains("ezen a héten kevés jut erre az izomra");
        });
    }

    @Test
    void testSuggestions_shouldNeverSuggestTheDraftDaysExercises() {
        UUID db = catalog("DB Bench Press").getId();
        UUID machine = catalog("Machine Chest Press").getId();

        ExerciseSubstitutesResponse res = read(replaceBench(todayIndex(), benchCatalog.getId(), db, machine));

        assertThat(res.getSuggestions()).extracting(s -> s.getExercise().getId())
            .doesNotContain(benchCatalog.getId(), db, machine);
    }

    @Test
    void testSuggestions_shouldLeaveOutAndLabelMachines_whenMachinesAreOff() {
        putForBody("/api/train/gym-profile", new GymProfile().offKinds(List.of("machine")).missingExerciseIds(List.of()),
            auth, HttpStatus.OK, GymProfile.class);

        ExerciseSubstitutesResponse res = read(replaceBench(todayIndex(), benchCatalog.getId()));

        assertThat(res.getSuggestions()).allSatisfy(s ->
            assertThat(s.getExercise().getGear()).doesNotContain("machine"));
        assertThat(res.getLabels()).anySatisfy(l -> {
            assertThat(l.getCatalogId()).isEqualTo(catalog("Machine Chest Press").getId());
            assertThat(l.getLabel()).isEqualTo(ExerciseSubstituteLabel.LabelEnum.NO_EQUIPMENT);
        });
    }

    @Test
    void testSuggestions_shouldLabelHurtBefore_whenStrongJointPainWasReported() {
        WorkoutSessionEntity other = trainPopulator.createTemplateDay(user, block.getId(), "Past");
        ExerciseEntity past = trainPopulator.createExercise(user, other.getId(), "DB Bench Press", 0, "chest-mid",
            "compound", catalog("DB Bench Press").getId());
        WorkoutSessionEntity done = trainPopulator.completedInstanceWithWorkingSet(
            user, past.getWorkoutSessionId(), past.getId(), new BigDecimal("30"), 10, 1);
        trainPopulator.createFeedback(user, done.getId(), past.getId(), 3, 3, 2);

        ExerciseSubstitutesResponse res = read(replaceBench(todayIndex(), benchCatalog.getId()));

        assertThat(res.getLabels()).anySatisfy(l -> {
            assertThat(l.getCatalogId()).isEqualTo(catalog("DB Bench Press").getId());
            assertThat(l.getLabel()).isEqualTo(ExerciseSubstituteLabel.LabelEnum.HURT_BEFORE);
        });
        assertThat(names(res)).doesNotContain("DB Bench Press");
    }

    @Test
    void testSuggestions_shouldIgnoreTodaysCheckIn_whenTheEditedDayIsNotToday() {
        int otherDay = (todayIndex() + 3) % 7;
        ExerciseSubstitutesResponse plain = read(replaceBench(otherDay, benchCatalog.getId()));
        checkIns.createCheckIn(user, LocalDate.now(), "06:30", c -> {
            c.setPain(true);
            c.setPainRegions(List.of(PainRegion.VALL));
            c.setPainIntensity(5);
        });

        ExerciseSubstitutesResponse otherDayRes = read(replaceBench(otherDay, benchCatalog.getId()));
        ExerciseSubstitutesResponse todayRes = read(replaceBench(todayIndex(), benchCatalog.getId()));

        assertThat(names(otherDayRes)).containsExactlyElementsOf(names(plain));
        assertThat(otherDayRes.getSuggestions()).extracting(ExerciseSubstitute::getSignals)
            .containsExactlyElementsOf(plain.getSuggestions().stream().map(ExerciseSubstitute::getSignals).toList());
        // control: on today's weekday the same check-in does steer the read
        assertThat(todayRes.getSuggestions()).extracting(ExerciseSubstitute::getSignals)
            .isNotEqualTo(plain.getSuggestions().stream().map(ExerciseSubstitute::getSignals).toList());
    }

    @Test
    void testSuggestions_shouldReturn400_whenReplaceHasNoOutgoing() {
        postForBody(uri(block), replaceBench(todayIndex()).outgoing(null), auth, HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testSuggestions_shouldReturn404_whenTheBlockIsAnotherUsers() {
        HttpHeaders other = registerUser("Block Suggestions Other").headers();

        postForBody(uri(block), replaceBench(todayIndex()), other, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testSuggestions_shouldReturn404_whenTheBlockIsUnknown() {
        postForBody("/api/train/mesocycles/" + UUID.randomUUID() + "/exercise-suggestions", replaceBench(todayIndex()),
            auth, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testSuggestions_shouldReturn409_whenTheBlockIsArchived() {
        MesocycleEntity archived = trainPopulator.createMesocycle(user, "old", "archived");

        postForBody(uri(archived), replaceBench(todayIndex()), auth, HttpStatus.CONFLICT, String.class);
    }
}
