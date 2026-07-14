package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Fix zárás switch OFF (mezo-z2ul): with {@code mezo.feature.closing-block.enabled=false} the
 * {@code ClosingBlockGate} bean is absent, so getToday must serve the template day untouched.
 * Separate class because a @ConditionalOnProperty bean's presence is fixed per Spring context.
 */
@TestPropertySource(properties = "mezo.feature.closing-block.enabled=false")
class ClosingBlockSwitchOffIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;

    @Test
    void testGetToday_shouldNotAppendClosingExercises_whenSwitchOff() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        var meso = train.createActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        train.createExercise(owner, day.getId(), "Fekvenyomás", 0);

        WorkoutTodayResponse res = workoutService.getToday(owner);

        assertThat(res.getExercises()).hasSize(1);
        assertThat(res.getExercises().get(0).getName()).isEqualTo("Fekvenyomás");
    }
}
