package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.HabitCheckRequest;
import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class HabitApiIT extends ApiIntegrationTest {

    @Test
    void testGetHabitDay_shouldLazilyCreateBothChains_whenTodayFirstRead() {
        HabitDayResponse day = getForBody("/api/habit/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDayResponse.class);
        assertThat(day.getHabits()).hasSize(10);
        assertThat(day.getHabits()).filteredOn(h -> "MORNING".equals(h.getChain().getValue())).hasSize(6);
        assertThat(day.getHabits()).filteredOn(h -> "EVENING".equals(h.getChain().getValue())).hasSize(4);
    }

    @Test
    void testCheckHabit_shouldAwardThenConflict_whenCheckedTwice() {
        HabitCheckRequest body = HabitCheckRequest.builder().date(LocalDate.now()).build();
        HabitWriteResponse res = postForBody("/api/habit/morning_sunlight/check", body,
            ownerAuthHeaders(), HttpStatus.OK, HabitWriteResponse.class);
        assertThat(res.getHabit().getStatus().getValue()).isEqualTo("done");
        assertThat(res.getLevelUps()).isNotEmpty();
        assertThat(res.getLevelUps().getFirst().getSource().getValue()).isEqualTo("HABIT");

        String err = postForBody("/api/habit/morning_sunlight/check", body,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "HABIT_ALREADY_DONE");
    }

    @Test
    void testCheckHabit_shouldRejectDerivedAndUnknown() {
        HabitCheckRequest body = HabitCheckRequest.builder().date(LocalDate.now()).build();
        String notManual = postForBody("/api/habit/morning_weigh_in/check", body,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(notManual, "HABIT_NOT_MANUAL");

        String unknown = postForBody("/api/habit/nope/check", body,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(unknown, "HABIT_UNKNOWN");
    }

    @Test
    void testUncheckHabit_shouldRevert_whenSameDayManualDone() {
        HabitCheckRequest body = HabitCheckRequest.builder().date(LocalDate.now()).build();
        postForBody("/api/habit/wind_down/check", body,
            ownerAuthHeaders(), HttpStatus.OK, HabitWriteResponse.class);
        deleteAndExpect("/api/habit/wind_down/check?date=" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK);

        HabitDayResponse day = getForBody("/api/habit/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDayResponse.class);
        assertThat(day.getHabits()).filteredOn(h -> "wind_down".equals(h.getKey()))
            .first().satisfies(h -> assertThat(h.getStatus().getValue()).isEqualTo("pending"));
    }

    @Test
    void testGetHabitSummary_shouldReturnHonestZeros_whenNoHistory() {
        HabitSummaryResponse s = getForBody("/api/habit/summary",
            ownerAuthHeaders(), HttpStatus.OK, HabitSummaryResponse.class);
        assertThat(s.getPerfectMorningDays30()).isZero();
        assertThat(s.getHabits()).hasSize(10);
        assertThat(s.getHabits()).allSatisfy(h -> assertThat(h.getStrengthPct()).isNull());
    }
}
