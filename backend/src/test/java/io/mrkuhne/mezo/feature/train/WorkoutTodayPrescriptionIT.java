package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class WorkoutTodayPrescriptionIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;

    @Test
    void testGetToday_shouldAttachPrescribedSets_whenSwitchOn() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        // template day must match today's HU day label so getToday resolves it
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setAnchorWeightKg(BigDecimal.valueOf(60));
        train.save(ex);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        // 1 created + the fix-zárás closing pair appended by the default-on closing block (mezo-z2ul)
        assertThat(res.getExercises()).hasSize(3);
        var te = res.getExercises().get(0);
        assertThat(te.getPrescribedSets()).hasSize(5);       // 2 warmup + 3 working
        assertThat(te.getRationale()).isNotBlank();
        assertThat(te.getWarmupSets()).isEqualTo(2);
        assertThat(te.getWorkingSets()).isEqualTo(3);
    }

    /**
     * Day-edit survival (mezo-eq4w): replaceDayExercises soft-deletes + re-inserts the rows, so
     * row-scoped history reads saw a "first session" afterwards — prescription targets and the
     * lastWeek ref must resolve by exercise IDENTITY (catalog id / exact name) instead.
     */
    @Test
    void testGetToday_shouldKeepPrescriptionAndLastWeek_whenDayEditReplacedRows() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        ExerciseEntity oldRow = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // Last week's COMPLETED instance carries the history on the OLD row (top working 60 kg × 8).
        var instance = train.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        train.createLoggedSet(owner, oldRow.getId(), instance.getId(), 0, "60", 8, 1);
        // The day edit: full-list replace re-inserts the SAME exercise as a brand-new row.
        trainService.replaceDayExercises(owner, meso.getId(), day.getId(), java.util.List.of(
            io.mrkuhne.mezo.api.dto.GymExerciseInput.builder()
                .name("Fekvenyomás").muscle("chest")
                .warmupSets(2).workingSets(3).repMin(6).repMax(8).targetRIR(1)
                .type(io.mrkuhne.mezo.api.dto.GymExerciseInput.TypeEnum.COMPOUND)
                .build()));

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        var te = res.getExercises().get(0);
        // lastWeek ref survives the row swap (identity-resolved)
        assertThat(te.getLastWeek()).isNotNull();
        assertThat(te.getLastWeek().getWeightKg()).isEqualByComparingTo("60");
        assertThat(te.getLastWeek().getReps()).isEqualTo(8);
        // 8 reps ≥ repMax(8) → double progression bumps the compound increment (60 → 65)
        var working = te.getPrescribedSets().stream()
            .filter(p -> p.getKind() == io.mrkuhne.mezo.api.dto.PrescribedSet.KindEnum.WORKING)
            .toList();
        assertThat(working).isNotEmpty();
        assertThat(working.get(0).getTargetWeightKg()).isEqualByComparingTo("65");
        assertThat(te.getRationale()).contains("Múlt hét");
    }

    @Autowired io.mrkuhne.mezo.feature.train.service.TrainService trainService;

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
