package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.HabitCheckRequest;
import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitDefAdmin;
import io.mrkuhne.mezo.api.dto.HabitDefCreateRequest;
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
        assertThat(day.getHabits()).hasSize(15);
        assertThat(day.getHabits()).filteredOn(h -> "MORNING".equals(h.getChain())).hasSize(9);
        assertThat(day.getHabits()).filteredOn(h -> "EVENING".equals(h.getChain())).hasSize(6);
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
    void testCheckHabit_shouldReject_whenDerivedOrUnknown() {
        HabitCheckRequest body = HabitCheckRequest.builder().date(LocalDate.now()).build();
        String notManual = postForBody("/api/habit/morning_weigh_in/check", body,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(notManual, "HABIT_NOT_MANUAL");

        String unknown = postForBody("/api/habit/nope/check", body,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(unknown, "HABIT_UNKNOWN");
    }

    @Test
    void testCheckHabit_shouldReject_whenOutsideBackfillWindow() {
        HabitCheckRequest body = HabitCheckRequest.builder().date(LocalDate.now().minusDays(2)).build();
        String tooOld = postForBody("/api/habit/morning_sunlight/check", body,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(tooOld, "HABIT_TOO_OLD");
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
        // summary is read-only/non-bootstrapping (mezo-n5e9.1 review finding 3) — read the day
        // first (the honest real-world order: getDay is the bootstrap point) so the 15-def seed
        // catalog exists by the time summary is asked to report on it.
        getForBody("/api/habit/day/" + LocalDate.now(), ownerAuthHeaders(), HttpStatus.OK, HabitDayResponse.class);

        HabitSummaryResponse s = getForBody("/api/habit/summary",
            ownerAuthHeaders(), HttpStatus.OK, HabitSummaryResponse.class);
        assertThat(s.getPerfectMorningDays30()).isZero();
        assertThat(s.getHabits()).hasSize(15);
        assertThat(s.getHabits()).allSatisfy(h -> assertThat(h.getStrengthPct()).isNull());
    }

    @Test
    void testCheckHabit_shouldReconcileNewlyCreatedDef_afterDayAlreadyMaterialized() {
        // Materialize today's rows against the original 15-def catalog FIRST...
        getForBody("/api/habit/day/" + LocalDate.now(), ownerAuthHeaders(), HttpStatus.OK, HabitDayResponse.class);

        // ...then an admin creates a MANUAL def AFTER today's rows already exist — a runtime-
        // mutable catalog reaches this (mezo-n5e9.1 review finding 1, critical): the old
        // ensureRows() early-returned on ANY existing row for the day, so this def's habit_key
        // never got a row and check()'s bare .orElseThrow() 500'd.
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Új szokás")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        HabitCheckRequest body = HabitCheckRequest.builder().date(LocalDate.now()).build();
        HabitWriteResponse res = postForBody("/api/habit/" + created.getHabitKey() + "/check", body,
            ownerAuthHeaders(), HttpStatus.OK, HabitWriteResponse.class);

        assertThat(res.getHabit().getStatus().getValue()).isEqualTo("done");
        assertThat(res.getHabit().getXp()).isEqualTo(10);
        assertThat(res.getLevelUps()).isNotEmpty();
    }
}
