package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.Medal;
import io.mrkuhne.mezo.api.dto.MedalListResponse;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.service.MedalService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
    @Autowired private ProgressionProperties progressionProperties;

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
    void testLogSet_shouldReturnAWeightMedal_whenTheSetBeatsAPriorSession() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity priorSession =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), priorSession.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        WorkoutSessionEntity active =
            trainPopulator.createWorkoutInstance(owner, template, DAY_2, "active");

        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(bench.getId()).setIndex(0)
            .weightKg(new BigDecimal("102.50")).reps(8).rir(1).kind("working")
            .build();
        ExerciseSetResponse body = postForBody(
            "/api/train/workouts/" + active.getId() + "/sets", req,
            ownerAuthHeaders(), HttpStatus.CREATED, ExerciseSetResponse.class);

        // SESSION_VOLUME is session-scoped and must NEVER ride along on a set row. This fixture is
        // deliberately volume-POSITIVE (prior session 100×8 = 800, this one 102.5×8 = 820), so a
        // forSet→forSession swap at logSet — the signatures are identical, so it would compile —
        // really would leak one here. The absence assertion is the trap that catches it.
        assertThat(body.getMedals()).extracting(Medal::getType)
            .contains(Medal.TypeEnum.WEIGHT)
            .doesNotContain(Medal.TypeEnum.SESSION_VOLUME);
        Medal weight = medalOfType(body.getMedals(), Medal.TypeEnum.WEIGHT);
        assertThat(weight.getPreviousValue()).isEqualByComparingTo("100.00");
    }

    @Test
    void testLogSet_shouldReturnATargetHitMedal_whenThePrescribedValuesAreMet() {
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

        Medal target = medalOfType(body.getMedals(), Medal.TypeEnum.TARGET_HIT);
        assertThat(target.getPreviousValue()).isNull();
    }

    @Test
    void testLogSet_shouldReturnNoMedals_whenTheSetTiesTheRecordWithNoTarget() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity priorSession =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), priorSession.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        WorkoutSessionEntity active =
            trainPopulator.createWorkoutInstance(owner, template, DAY_2, "active");

        // ties the 100 kg × 8 record exactly — strict > is required, so a tie earns nothing;
        // no target carried either, so TARGET_HIT cannot fire.
        SetLogRequest req = SetLogRequest.builder()
            .exerciseId(bench.getId()).setIndex(0)
            .weightKg(new BigDecimal("100.00")).reps(8).rir(2).kind("working")
            .build();
        ExerciseSetResponse body = postForBody(
            "/api/train/workouts/" + active.getId() + "/sets", req,
            ownerAuthHeaders(), HttpStatus.CREATED, ExerciseSetResponse.class);

        assertThat(body.getMedals()).isNotNull().isEmpty();

        // deferred finding from Task 2: the no-target path must round-trip as null, not be coerced
        ExerciseSetEntity reloaded = exerciseSetRepository.findById(body.getId()).orElseThrow();
        assertThat(reloaded.getTargetWeightKg()).isNull();
        assertThat(reloaded.getTargetReps()).isNull();
    }

    @Test
    void testFinishWorkout_shouldReturnSessionMedals_whenTheSessionBeatsAPriorVolume() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity priorSession =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), priorSession.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        WorkoutSessionEntity active =
            trainPopulator.createWorkoutInstance(owner, template, DAY_2, "active");
        trainPopulator.createLoggedSet(owner, bench.getId(), active.getId(), 0,
            "102.50", 8, 1, middayOf(DAY_2));

        WorkoutInstanceResponse body = postForBody(
            "/api/train/workouts/" + active.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(body.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        Medal volume = medalOfType(body.getMedals(), Medal.TypeEnum.SESSION_VOLUME);
        assertThat(volume.getValue()).isEqualByComparingTo("820");
        assertThat(volume.getPreviousValue()).isEqualByComparingTo("800");
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
    void testGetMedals_shouldReadTiedSetsInSetIndexOrder_whenAWholeSessionSharesOneTimestamp() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity first =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), first.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        // one batch, ONE shared instant — what a seed/import produces (Postgres now() is
        // transaction-scoped) — and inserted in reverse, so scan order contradicts setIndex order
        WorkoutSessionEntity second =
            trainPopulator.createWorkoutInstance(owner, template, DAY_2, "completed");
        Instant tied = middayOf(DAY_2);
        trainPopulator.createLoggedSet(owner, bench.getId(), second.getId(), 2, "100.00", 8, 1, tied);
        trainPopulator.createLoggedSet(owner, bench.getId(), second.getId(), 1, "105.00", 8, 1, tied);
        trainPopulator.createLoggedSet(owner, bench.getId(), second.getId(), 0, "102.50", 8, 1, tied);

        List<Medal> medals = getMedals().getMedals();

        // read as 102.5 → 105 → 100, the escalation medals twice; read in insert order the 102.5
        // set would follow the 105 one and earn nothing, leaving a single WEIGHT medal
        List<Medal> weights = medals.stream()
            .filter(m -> m.getType() == Medal.TypeEnum.WEIGHT).toList();
        assertThat(weights).extracting(
                m -> m.getValue().stripTrailingZeros().toPlainString(),
                m -> m.getPreviousValue().stripTrailingZeros().toPlainString(),
                Medal::getSetIndex)
            .containsExactly(tuple("102.5", "100", 0), tuple("105", "102.5", 1));
        assertThat(medals).extracting(Medal::getType).containsExactly(
            Medal.TypeEnum.WEIGHT, Medal.TypeEnum.WEIGHT,
            Medal.TypeEnum.E1_RM, Medal.TypeEnum.E1_RM,
            Medal.TypeEnum.SESSION_VOLUME);
    }

    @Test
    void testGetMedals_shouldAwardTargetHit_whenTheSnapshottedPrescriptionIsMet() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        ExerciseSetEntity onTarget = trainPopulator.createTargetedSet(owner, bench.getId(),
            instance.getId(), 0, "100.00", 8, "100.00", 8, middayOf(DAY_1));

        assertThat(onTarget.getTargetWeightKg()).isEqualByComparingTo("100.00"); // the row really carries it
        List<Medal> medals = getMedals().getMedals();

        // history-independent: a lone session earns no RECORD medal, but the prescription still pays
        assertThat(medals).hasSize(1);
        Medal target = medals.get(0);
        assertThat(target.getType()).isEqualTo(Medal.TypeEnum.TARGET_HIT);
        assertThat(target.getTier()).isEqualTo(Medal.TierEnum.TARGET);
        assertThat(target.getUnit()).isEqualTo(Medal.UnitEnum.REPS);
        assertThat(target.getValue()).isEqualByComparingTo("8");
        assertThat(target.getPreviousValue()).isNull();
        assertThat(target.getPreviousDate()).isNull();
        assertThat(target.getWeightKg()).isEqualByComparingTo("100.00");
        assertThat(target.getReps()).isEqualTo(8);
        assertThat(target.getDate()).isEqualTo(DAY_1);
        assertThat(target.getExerciseName()).isEqualTo("Fekvenyomás");
        assertThat(target.getWorkoutSessionId()).isEqualTo(instance.getId());
        assertThat(target.getSetIndex()).isZero();
    }

    @Test
    void testGetMedals_shouldNotAwardTargetHit_whenTheSetCarriesNoTarget() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        // the same lift as the TARGET_HIT test, unprescribed: no target to hit, and no target to MISS
        trainPopulator.createTargetedSet(owner, bench.getId(), instance.getId(), 0,
            "100.00", 8, null, null, middayOf(DAY_1));

        assertThat(getMedals().getMedals()).isEmpty();
    }

    @Test
    void testGetMedals_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/medals", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testFinishWorkout_shouldPayThePrBonusPerRecordMedal_whenRecordsWereBroken() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        // prior session: TWO sets at 100 kg × 8 (volume 1600) — a tie earns no set-level medal, but
        // it raises the prior session-volume baseline safely above this session's 820, so the active
        // session below fires WEIGHT + E1RM only, never SESSION_VOLUME too (still RECORD-tier, but
        // would otherwise inflate recordMedalCount past the 2 this test pins).
        WorkoutSessionEntity priorSession =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), priorSession.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        trainPopulator.createLoggedSet(owner, bench.getId(), priorSession.getId(), 1,
            "100.00", 8, 2, middayOf(DAY_1).plusSeconds(180));
        WorkoutSessionEntity active =
            trainPopulator.createWorkoutInstance(owner, template, DAY_2, "active");
        trainPopulator.createLoggedSet(owner, bench.getId(), active.getId(), 0,
            "102.50", 8, 1, middayOf(DAY_2));

        WorkoutInstanceResponse body = postForBody(
            "/api/train/workouts/" + active.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        // exactly 2 RECORD-tier medals on this session: WEIGHT + E1RM
        assertThat(body.getMedals()).extracting(Medal::getType)
            .containsExactlyInAnyOrder(Medal.TypeEnum.WEIGHT, Medal.TypeEnum.E1_RM);
        assertThat(body.getMedals()).allSatisfy(
            m -> assertThat(m.getTier()).isEqualTo(Medal.TierEnum.RECORD));

        BigDecimal bestE1rm = new BigDecimal("102.50")
            .multiply(BigDecimal.valueOf(38)).divide(BigDecimal.valueOf(30), 4, RoundingMode.HALF_UP);
        ProgressionProperties.Gym gym = progressionProperties.gym();
        long plainE1rmXp = (long) bestE1rm.intValue() * gym.e1rmXpPerKg();
        long expectedBonus = 2L * gym.prBonusXp();

        assertThat(body.getLevelUp()).isNotNull();
        assertThat(body.getLevelUp().getGains()).anySatisfy(g -> {
            assertThat(g.getSkillKey()).isEqualTo("max_strength");
            assertThat(g.getXpGained()).isEqualTo(plainE1rmXp + expectedBonus);
        });
    }

    @Test
    void testFinishWorkout_shouldStayIdempotent_whenFinishedTwice() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity priorSession =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "completed");
        trainPopulator.createLoggedSet(owner, bench.getId(), priorSession.getId(), 0,
            "100.00", 8, 2, middayOf(DAY_1));
        WorkoutSessionEntity active =
            trainPopulator.createWorkoutInstance(owner, template, DAY_2, "active");
        trainPopulator.createLoggedSet(owner, bench.getId(), active.getId(), 0,
            "102.50", 8, 1, middayOf(DAY_2));

        WorkoutInstanceResponse first = postForBody(
            "/api/train/workouts/" + active.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);
        WorkoutInstanceResponse second = postForBody(
            "/api/train/workouts/" + active.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(second.getLevelUp().getTotalXp()).isEqualTo(first.getLevelUp().getTotalXp());
        assertThat(second.getLevelUp().getGains()).isEqualTo(first.getLevelUp().getGains());
    }

    @Test
    void testFinishWorkout_shouldSaturateTheTargetBonus_whenTheSessionBeatsTheTargetMedalCap() {
        ProgressionProperties.Gym gym = progressionProperties.gym();
        int setCount = gym.targetMedalCap() + 3; // strictly ABOVE the cap — the point of the test

        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        ExerciseEntity bench = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity active =
            trainPopulator.createWorkoutInstance(owner, template, DAY_1, "active");
        // Every set is identical (100 kg × 8) and exactly on its prescribed target. A tie beats
        // nothing, so WEIGHT / REPS_AT_WEIGHT / E1RM never fire (the first set only establishes the
        // baseline silently); with no PRIOR session there is no volume baseline either, so
        // SESSION_VOLUME cannot fire. The session therefore earns TARGET_HIT medals and NOTHING
        // else — no RECORD-tier medal can perturb max_strength and muddy the arithmetic below.
        // Distinct doneAt per set keeps the replay order total.
        for (int i = 0; i < setCount; i++) {
            trainPopulator.createTargetedSet(owner, bench.getId(), active.getId(), i,
                "100.00", 8, "100.00", 8, middayOf(DAY_1).plusSeconds(60L * i));
        }

        WorkoutInstanceResponse body = postForBody(
            "/api/train/workouts/" + active.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        // the fixture really does clear the cap, and really does earn TARGET-tier medals only
        assertThat(body.getMedals()).hasSize(setCount)
            .allSatisfy(m -> assertThat(m.getTier()).isEqualTo(Medal.TierEnum.TARGET));

        // bodyweightRepCount is 0 here (every set is weighted), so that term drops out
        long capped = (long) setCount * gym.strengthEnduranceXpPerSet()
            + gym.targetMedalCap().longValue() * gym.targetMedalXp();
        long uncapped = (long) setCount * gym.strengthEnduranceXpPerSet()
            + (long) setCount * gym.targetMedalXp();

        assertThat(body.getLevelUp()).isNotNull();
        assertThat(body.getLevelUp().getGains()).anySatisfy(g -> {
            assertThat(g.getSkillKey()).isEqualTo("strength_endurance");
            // isNotEqualTo(uncapped) is the tooth: it fails both if Math.min never saturated AND
            // if a future tuning made the fixture degenerate (setCount <= cap ⇒ capped == uncapped)
            assertThat(g.getXpGained()).isEqualTo(capped).isNotEqualTo(uncapped);
        });
    }
}
