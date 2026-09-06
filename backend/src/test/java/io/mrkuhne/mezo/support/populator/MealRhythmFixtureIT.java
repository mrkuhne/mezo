package io.mrkuhne.mezo.support.populator;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.fuel.entity.MealSlotJson;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotTemplateEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Round 2 S4 (mezo-d58h.7.4): the three fixture seams the meal_rhythm_drift ITs stand on —
 *  a meal at a chosen wall-clock time on a past day, a FIXED-anchor slot template, and a
 *  completed workout instance with a real startedAt (day-type resolution's only input). */
class MealRhythmFixtureIT extends AbstractIntegrationTest {

    @Autowired private UserPopulator userPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private MealSlotTemplatePopulator mealSlotTemplatePopulator;
    @Autowired private TrainPopulator trainPopulator;

    @Test
    void bareMealAt_carriesTheRequestedWallClockTime() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(3);

        MealEntity meal = mealPopulator.createBareMealAt(owner, day, "dinner", LocalTime.of(21, 15));

        assertThat(meal.getMealDate()).isEqualTo(day);
        assertThat(meal.getLoggedAt().atZone(ZoneId.systemDefault()).toLocalTime())
            .isEqualTo(LocalTime.of(21, 15));
    }

    @Test
    void fixedTemplate_anchorsEverySlotToAClockTime() {
        UUID owner = userPopulator.createUser().getId();

        MealSlotTemplateEntity t =
            mealSlotTemplatePopulator.fixedTemplate(owner, "rest", "07:00", "13:00", "19:00");

        assertThat(t.getSlots()).extracting(MealSlotJson::anchorType).containsOnly("fixed");
        assertThat(t.getSlots()).extracting(MealSlotJson::time)
            .containsExactly("07:00", "13:00", "19:00");
    }

    @Test
    void completedInstanceStartedAt_carriesTheRequestedStart() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity templateDay = trainPopulator.createTemplateDay(owner, meso.getId(), "Push nap");
        LocalDate day = LocalDate.now().minusDays(2);

        WorkoutSessionEntity instance = trainPopulator.createCompletedInstanceStartedAt(
            owner, templateDay, day, LocalTime.of(7, 30));

        assertThat(instance.getStatus()).isEqualTo("completed");
        assertThat(instance.getStartedAt().atZone(ZoneId.systemDefault()).toLocalTime())
            .isEqualTo(LocalTime.of(7, 30));
    }
}
