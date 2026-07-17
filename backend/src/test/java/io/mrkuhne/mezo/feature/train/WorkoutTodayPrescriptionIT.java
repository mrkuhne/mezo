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

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
