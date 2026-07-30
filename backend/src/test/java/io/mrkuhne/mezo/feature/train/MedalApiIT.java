package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.Medal;
import io.mrkuhne.mezo.api.dto.MedalListResponse;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.service.MedalService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Medal collection (bd mezo-wp6n): contract IT for the derived-medal surface — the target snapshot
 * persisted at {@code logSet} time (Task 2) and the replayed cabinet behind
 * {@code GET /api/train/medals} (Task 4). Medals are never stored, so every assertion here is
 * really an assertion about the replay: a lone session medals nothing, a beaten record medals once,
 * and {@code previousDate} names the day the fallen record was SET, not the last day it was matched.
 */
class MedalApiIT extends ApiIntegrationTest {

    private static final LocalDate DAY_1 = LocalDate.of(2026, 6, 1);
    private static final LocalDate DAY_2 = LocalDate.of(2026, 6, 8);
    private static final LocalDate DAY_3 = LocalDate.of(2026, 6, 15);

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseSetRepository exerciseSetRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MedalService medalService;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /** Midday of {@code date} — the replay orders and dates sets by doneAt, so fixtures must carry one. */
    private static Instant middayOf(LocalDate date) {
        return date.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant();
    }

    private MedalListResponse getMedals() {
        return getForBody("/api/train/medals", ownerAuthHeaders(), HttpStatus.OK, MedalListResponse.class);
    }

    private Medal medalOfType(List<Medal> medals, Medal.TypeEnum type) {
        return medals.stream().filter(m -> m.getType() == type).findFirst().orElseThrow();
    }

    @Test
    void testLogSet_shouldPersistTheTargetSnapshot_whenTheRequestCarriesOne() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "active");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);

        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(bench.getId()).setIndex(0)
            .weightKg(new BigDecimal("100.00")).reps(8).rir(2).kind("working")
            .targetWeightKg(new BigDecimal("100.00")).targetReps(8)
            .build();
        ExerciseSetResponse body = postForBody(
            "/api/train/workouts/" + instance.getId() + "/sets", req,
            ownerAuthHeaders(), HttpStatus.CREATED, ExerciseSetResponse.class);

        ExerciseSetEntity reloaded = exerciseSetRepository.findById(body.getId()).orElseThrow();
        assertThat(reloaded.getTargetWeightKg()).isEqualByComparingTo("100.00");
        assertThat(reloaded.getTargetReps()).isEqualTo(8);
    }

    @Test
    void testGetMedals_shouldReturnEmpty_whenTheOwnerHasNoSets() {
        ownerId();

        assertThat(getMedals().getMedals()).isEmpty();
    }

    @Test
    void testGetMedals_shouldNotAwardAnything_whenOnlyOneSessionWasEverLogged() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        trainPopulator.createLoggedSet(owner, bench.getId(), instance.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        trainPopulator.createLoggedSet(owner, bench.getId(), instance.getId(), 1,
            "100.00", 8, 2, middayOf(DAY_1).plusSeconds(180));

        // the baseline is established silently — nothing to beat, and the second set only tied it
        assertThat(getMedals().getMedals()).isEmpty();
    }

    @Test
    void testGetMedals_shouldAwardWeightAndE1rm_whenASecondSessionBeatsTheFirst() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity first =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), first.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        WorkoutSessionEntity second =
            trainPopulator.createWorkoutInstance(owner, template, DAY_2, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), second.getId(), 0,
            "102.50", 8, 1, middayOf(DAY_2));

        List<Medal> medals = getMedals().getMedals();

        assertThat(medals).extracting(Medal::getType).containsExactlyInAnyOrder(
            Medal.TypeEnum.WEIGHT, Medal.TypeEnum.E1_RM, Medal.TypeEnum.SESSION_VOLUME);
        assertThat(medals).allSatisfy(m -> {
            assertThat(m.getDate()).isEqualTo(DAY_2);
            assertThat(m.getPreviousDate()).isEqualTo(DAY_1);
            assertThat(m.getTier()).isEqualTo(Medal.TierEnum.RECORD);
            assertThat(m.getExerciseName()).isEqualTo("Fekvenyomás");
            assertThat(m.getWorkoutSessionId()).isEqualTo(second.getId());
            assertThat(m.getUnit()).isEqualTo(Medal.UnitEnum.KG);
            assertThat(m.getWeightKg()).isEqualByComparingTo("102.50");
            assertThat(m.getReps()).isEqualTo(8);
        });

        Medal weight = medalOfType(medals, Medal.TypeEnum.WEIGHT);
        assertThat(weight.getValue()).isEqualByComparingTo("102.50");
        assertThat(weight.getPreviousValue()).isEqualByComparingTo("100.00");

        Medal e1rm = medalOfType(medals, Medal.TypeEnum.E1_RM);
        assertThat(e1rm.getValue()).isEqualByComparingTo("129.8"); // 102.5 × 38 / 30
        assertThat(e1rm.getPreviousValue()).isEqualByComparingTo("126.7"); // 100 × 38 / 30

        Medal volume = medalOfType(medals, Medal.TypeEnum.SESSION_VOLUME);
        assertThat(volume.getValue()).isEqualByComparingTo("820");
        assertThat(volume.getPreviousValue()).isEqualByComparingTo("800");
    }

    @Test
    void testGetMedals_shouldDatePreviousToWhenTheRecordWasSet_whenALaterSessionOnlyMatchedIt() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        // DAY_1 sets the 100 kg record; DAY_2 only adds reps at that same 100 kg; DAY_3 breaks it
        WorkoutSessionEntity first =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), first.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        WorkoutSessionEntity second =
            trainPopulator.createWorkoutInstance(owner, template, DAY_2, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), second.getId(), 0,
            "100.00", 10, 1, middayOf(DAY_2));
        WorkoutSessionEntity third =
            trainPopulator.createWorkoutInstance(owner, template, DAY_3, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), third.getId(), 0,
            "102.50", 8, 1, middayOf(DAY_3));

        List<Medal> medals = getMedals().getMedals();

        assertThat(medals).extracting(Medal::getType).containsExactlyInAnyOrder(
            Medal.TypeEnum.REPS_AT_WEIGHT, Medal.TypeEnum.E1_RM, Medal.TypeEnum.SESSION_VOLUME,
            Medal.TypeEnum.WEIGHT);
        assertThat(medals.get(0).getDate()).isEqualTo(DAY_3); // newest first

        Medal reps = medalOfType(medals, Medal.TypeEnum.REPS_AT_WEIGHT);
        assertThat(reps.getDate()).isEqualTo(DAY_2);
        assertThat(reps.getUnit()).isEqualTo(Medal.UnitEnum.REPS);
        assertThat(reps.getValue()).isEqualByComparingTo("10");
        assertThat(reps.getWeightKg()).isEqualByComparingTo("100.00");
        assertThat(reps.getPreviousValue()).isEqualByComparingTo("8");
        assertThat(reps.getPreviousDate()).isEqualTo(DAY_1);

        // the 100 kg record was SET on DAY_1 and merely matched on DAY_2 — DAY_1 is what stood
        Medal weight = medalOfType(medals, Medal.TypeEnum.WEIGHT);
        assertThat(weight.getDate()).isEqualTo(DAY_3);
        assertThat(weight.getPreviousValue()).isEqualByComparingTo("100.00");
        assertThat(weight.getPreviousDate()).isEqualTo(DAY_1);

        // DAY_3's lighter-but-heavier set beats neither the DAY_2 e1RM (133.3) nor its volume (1000)
        assertThat(medalOfType(medals, Medal.TypeEnum.E1_RM).getDate()).isEqualTo(DAY_2);
        assertThat(medalOfType(medals, Medal.TypeEnum.SESSION_VOLUME).getDate()).isEqualTo(DAY_2);
    }

    @Test
    void testForSet_shouldReturnOnlyThatSetsOwnRecords_whenAnotherExerciseSharesTheSetIndex() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        ExerciseEntity squat = trainPopulator.createExercise(owner, template.getId(), "Guggolás", 1);
        WorkoutSessionEntity first =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), first.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        trainPopulator.createLoggedSet(owner, squat.getId(), first.getId(), 0,
            "140.00", 5, 2, middayOf(DAY_1).plusSeconds(600));
        WorkoutSessionEntity second =
            trainPopulator.createWorkoutInstance(owner, template, DAY_2, "completed");
        ExerciseSetEntity benchPr = trainPopulator.createLoggedSet(owner, bench.getId(), second.getId(), 0,
            "102.50", 8, 1, middayOf(DAY_2));
        trainPopulator.createLoggedSet(owner, squat.getId(), second.getId(), 0,
            "145.00", 5, 1, middayOf(DAY_2).plusSeconds(600));

        // both exercises used setIndex 0 in the same instance — only the bench set's own medals here,
        // and SESSION_VOLUME is session-scoped, so it never rides along on a set row
        List<Medal> setMedals = medalService.forSet(owner, benchPr.getId());
        assertThat(setMedals).extracting(Medal::getType)
            .containsExactlyInAnyOrder(Medal.TypeEnum.WEIGHT, Medal.TypeEnum.E1_RM);
        assertThat(setMedals).allSatisfy(m -> assertThat(m.getExerciseName()).isEqualTo("Fekvenyomás"));

        List<Medal> sessionMedals = medalService.forSession(owner, second.getId());
        assertThat(sessionMedals).extracting(Medal::getType, Medal::getExerciseName)
            .containsExactlyInAnyOrder(
                tuple(Medal.TypeEnum.WEIGHT, "Fekvenyomás"),
                tuple(Medal.TypeEnum.E1_RM, "Fekvenyomás"),
                tuple(Medal.TypeEnum.SESSION_VOLUME, "Fekvenyomás"),
                tuple(Medal.TypeEnum.WEIGHT, "Guggolás"),
                tuple(Medal.TypeEnum.E1_RM, "Guggolás"),
                tuple(Medal.TypeEnum.SESSION_VOLUME, "Guggolás"));
    }

    @Test
    void testGetMedals_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/medals", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
