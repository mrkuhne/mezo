package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.TodaySport;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Boop Sport S1 (mezo-r36n9.201): the Edzés day read names today's sport, so a sport-only day is never called a rest
 * day.
 */
class TodaySportContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator train;

    private static int todayDow() {
        return LocalDate.now().getDayOfWeek().getValue() - 1;
    }

    @Test
    void testGetTodayWorkout_shouldListTodaysSport_whenRestDayWithVolleyballSlot() {
        RegisteredUser user = registerUser("Today Sport Owner");
        train.createScheduleSlot(user.id(), todayDow(), "18:00", 90, "training");

        WorkoutTodayResponse today = getForBody(
            "/api/train/workouts/today", user.headers(), HttpStatus.OK, WorkoutTodayResponse.class);

        assertThat(today.getExercises()).isNullOrEmpty();
        assertThat(today.getSportToday()).singleElement().satisfies(s -> {
            assertThat(s.getSport()).isEqualTo("volleyball");
            assertThat(s.getTime()).isEqualTo("18:00");
            assertThat(s.getDurationMin()).isEqualTo(90);
            assertThat(s.getDone()).isFalse();
        });
    }

    @Test
    void testGetTodayWorkout_shouldMarkSportDone_whenLoggedToday() {
        RegisteredUser user = registerUser("Today Sport Logged");
        train.createScheduleSlot(user.id(), todayDow(), "18:00", 90, "training");
        train.createSportSession(user.id(), LocalDate.now(), "volleyball", 4, null, "7");

        WorkoutTodayResponse today = getForBody(
            "/api/train/workouts/today", user.headers(), HttpStatus.OK, WorkoutTodayResponse.class);

        assertThat(today.getSportToday()).extracting(TodaySport::getDone).containsExactly(true);
    }

    @Test
    void testGetTodayWorkout_shouldReturnEmptySportToday_whenNoSport() {
        RegisteredUser user = registerUser("Today Sport None");

        WorkoutTodayResponse today = getForBody(
            "/api/train/workouts/today", user.headers(), HttpStatus.OK, WorkoutTodayResponse.class);

        assertThat(today.getSportToday()).isEmpty();
    }
}
