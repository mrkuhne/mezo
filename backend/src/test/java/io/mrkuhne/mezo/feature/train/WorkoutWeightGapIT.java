package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.SetUpdateRequest;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseWeightGapEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseWeightGapRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseHistoryResolver;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Per-machine weight memory (mezo-bk7l2): logSet learns a missing weight from a NEAR swap away
 * from the engine's original prescription, heals it when that weight is logged/edited, and
 * getToday moves a WEIGHT prescription off a known gap onto an available weight with equivalent
 * reps. Fixture exercise: compound (5 kg increment), repMin 6, repMax 8, targetRir 0.
 */
class WorkoutWeightGapIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired ExerciseWeightGapRepository gapRepository;

    @Test
    void testLogSet_shouldLearnAGap_whenANearSwapIsLogged() {
        UUID owner = ownerId();
        ExerciseEntity ex = benchOnKedd(owner);
        var instance = train.startInstance(owner, ex.getWorkoutSessionId());

        workoutService.logSet(owner, instance.getId(), log(ex, 0, "95", "98"));

        assertThat(gapRepository.findByCreatedByAndIdentityKey(owner, ExerciseHistoryResolver.identityKey(ex)))
            .extracting(ExerciseWeightGapEntity::getWeightKg)
            .singleElement().satisfies(w -> assertThat(w).isEqualByComparingTo("98"));
    }

    @Test
    void testLogSet_shouldLearnNothing_whenTheSwapIsAChoice() {
        UUID owner = ownerId();
        ExerciseEntity ex = benchOnKedd(owner);
        var instance = train.startInstance(owner, ex.getWorkoutSessionId());

        workoutService.logSet(owner, instance.getId(), log(ex, 0, "80", "98")); // 18 kg > max(5, 9.8)
        workoutService.logSet(owner, instance.getId(), log(ex, 1, "98", "98")); // exactly as prescribed

        assertThat(gapRepository.findByCreatedByAndIdentityKey(owner, ExerciseHistoryResolver.identityKey(ex))).isEmpty();
    }

    @Test
    void testLogAndUpdateSet_shouldHealAGap_whenThatWeightIsLogged() {
        UUID owner = ownerId();
        ExerciseEntity ex = benchOnKedd(owner);
        gap(owner, ex, "98");
        gap(owner, ex, "100");
        var instance = train.startInstance(owner, ex.getWorkoutSessionId());

        workoutService.logSet(owner, instance.getId(), log(ex, 0, "98", null));
        var second = workoutService.logSet(owner, instance.getId(), log(ex, 1, "95", null));
        workoutService.updateSet(owner, instance.getId(), second.getId(),
            SetUpdateRequest.builder().weightKg(new BigDecimal("100")).reps(6).rir(0).build());

        assertThat(gapRepository.findByCreatedByAndIdentityKey(owner, ExerciseHistoryResolver.identityKey(ex))).isEmpty();
    }

    @Test
    void testGetToday_shouldMoveAWeightBumpOffAKnownGap_withEquivalentReps() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        var last = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        train.createLoggedSet(owner, ex.getId(), last.getId(), 0, "60", 8, 0); // top of 6–8 → +5 → 65
        gap(owner, ex, "65");

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        var te = res.getExercises().get(0);
        // 65 × 6 @ RIR 0 → e1RM 78 → 7 reps at 62.5 (inside 6–8); 60 is the reference, never a target.
        assertThat(te.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(te.getProgression().getTargetWeightKg()).isEqualByComparingTo("62.5");
        assertThat(te.getProgression().getTargetReps()).isEqualTo(7);
        assertThat(te.getProgression().getDeltaKg()).isEqualByComparingTo("2.5");
        assertThat(te.getRationale()).contains("65 kg nincs a gépen → 62.5 kg");
        assertThat(te.getPrescribedSets()).filteredOn(s -> s.getKind() == PrescribedSet.KindEnum.WORKING)
            .allSatisfy(s -> {
                assertThat(s.getTargetWeightKg()).isEqualByComparingTo("62.5");
                assertThat(s.getTargetReps()).isEqualTo(7);
            });
        assertThat(res.getOverloadSummary().getWeightUp()).isEqualTo(1);
    }

    private ExerciseEntity benchOnKedd(UUID owner) {
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        return train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
    }

    private static SetLogRequest log(ExerciseEntity ex, int idx, String kg, String prescribedKg) {
        return SetLogRequest.builder()
            .exerciseId(ex.getId()).setIndex(idx)
            .weightKg(new BigDecimal(kg)).reps(8).rir(0)
            .prescribedWeightKg(prescribedKg != null ? new BigDecimal(prescribedKg) : null)
            .build();
    }

    private void gap(UUID owner, ExerciseEntity ex, String kg) {
        ExerciseWeightGapEntity g = new ExerciseWeightGapEntity();
        g.setCreatedBy(owner);
        g.setIdentityKey(ExerciseHistoryResolver.identityKey(ex));
        g.setWeightKg(new BigDecimal(kg));
        gapRepository.saveAndFlush(g);
    }

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
