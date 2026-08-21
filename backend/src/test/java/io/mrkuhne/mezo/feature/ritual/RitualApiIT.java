package io.mrkuhne.mezo.feature.ritual;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RitualCloseRequest;
import io.mrkuhne.mezo.api.dto.RitualDayResponse;
import io.mrkuhne.mezo.api.dto.RitualReflectionRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

class RitualApiIT extends ApiIntegrationTest {

    @Autowired SleepGoalPopulator sleepGoalPopulator;
    @Autowired private RitualPopulator ritualPopulator;
    @Autowired private RitualDayRepository ritualDayRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetDay_shouldServeGhostWindow_whenNoSleepGoal() {
        RitualDayResponse day = getForBody("/api/ritual/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        // config-ghost bed anchor is 22:00 (WAKE 06:00 − 480 min default target, mezo.sleep defaults)
        assertThat(day.getClosed()).isFalse();
        assertThat(day.getWindow().getBedTime()).isEqualTo("22:00");
        assertThat(day.getWindow().getOpensAt()).isEqualTo("20:45");
        assertThat(day.getWindow().getPrepStartsAt()).isEqualTo("21:15");
    }

    @Test
    void testGetDay_shouldRecenterWindow_whenSleepGoalExists() {
        sleepGoalPopulator.goal(ownerId()); // WAKE 06:45, 450 min → derived bed 23:15
        RitualDayResponse day = getForBody("/api/ritual/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getWindow().getBedTime()).isEqualTo("23:15");
        assertThat(day.getWindow().getOpensAt()).isEqualTo("22:00");
    }

    @Test
    void testClose_shouldBeIdempotent_whenClosedTwice() {
        var req = RitualCloseRequest.builder().date(LocalDate.now()).build();
        RitualDayResponse first = postForBody("/api/ritual/close", req,
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        RitualDayResponse second = postForBody("/api/ritual/close", req,
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(first.getClosed()).isTrue();
        assertThat(second.getClosedAt()).isEqualTo(first.getClosedAt());
    }

    @Test
    void testClose_shouldReject_whenNotToday() {
        String err = postForBody("/api/ritual/close",
            RitualCloseRequest.builder().date(LocalDate.now().minusDays(1)).build(),
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "RITUAL_NOT_TODAY");
    }

    @Test
    void testGetDay_shouldReportNotClosed_whenOnlyAReflectionRowExists() {
        ritualPopulator.openDay(ownerId(), LocalDate.now(), "Fáradt voltam, de befejeztem.");
        RitualDayResponse day = getForBody("/api/ritual/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getClosed()).isFalse();
        assertThat(day.getClosedAt()).isNull();
    }

    @Test
    void testClose_shouldCloseTheExistingOpenRow_whenAReflectionRowAlreadyExists() {
        ritualPopulator.openDay(ownerId(), LocalDate.now(), "Fáradt voltam, de befejeztem.");
        RitualDayResponse day = postForBody("/api/ritual/close",
            RitualCloseRequest.builder().date(LocalDate.now()).build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getClosed()).isTrue();
        assertThat(day.getClosedAt()).isNotNull();
        // the close must REUSE the open row, never insert a second one (uq_ritual_day_user_date)
        assertThat(ritualDayRepository.findByCreatedByAndRitualDate(ownerId(), LocalDate.now()))
            .get().extracting(RitualDayEntity::getReflectionText)
            .isEqualTo("Fáradt voltam, de befejeztem.");
    }

    @Test
    void testSaveReflection_shouldUpsertAnOpenRow_whenNoRowExists() {
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("Nehéz nap volt, de bírtam.").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isEqualTo("Nehéz nap volt, de bírtam.");
        assertThat(day.getClosed()).isFalse();
    }

    @Test
    void testSaveReflection_shouldOverwrite_whenCalledTwice() {
        putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("Első").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("Második").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isEqualTo("Második");
        assertThat(ritualDayRepository.findByCreatedByAndRitualDate(ownerId(), LocalDate.now()))
            .get().extracting(RitualDayEntity::getReflectionText).isEqualTo("Második");
        // the upsert must never insert a SECOND row for the same (created_by, ritual_date)
        assertThat(ritualDayRepository.count()).isEqualTo(1);
    }

    @Test
    void testSaveReflection_shouldStripSurroundingWhitespace_whenTheProseIsPadded() {
        // whitespace-only already collapses to null; stripping makes that normalisation TOTAL
        // rather than "blank is cleaned but padding survives" — and keeps a textarea's trailing
        // newline from changing Task 3's embedding vector for otherwise identical prose
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("  Csendes nap volt.\n").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isEqualTo("Csendes nap volt.");
        assertThat(ritualDayRepository.findByCreatedByAndRitualDate(ownerId(), LocalDate.now()))
            .get().extracting(RitualDayEntity::getReflectionText).isEqualTo("Csendes nap volt.");
    }

    @Test
    void testSaveReflection_shouldCreateNoRow_whenTextIsBlankAndNoRowExists() {
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("   ").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isNull();
        assertThat(ritualDayRepository.findByCreatedByAndRitualDate(ownerId(), LocalDate.now())).isEmpty();
    }

    @Test
    void testSaveReflection_shouldClear_whenTextIsBlankAndRowExists() {
        ritualPopulator.openDay(ownerId(), LocalDate.now(), "Valami");
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isNull();
        assertThat(ritualDayRepository.findByCreatedByAndRitualDate(ownerId(), LocalDate.now()))
            .get().extracting(RitualDayEntity::getReflectionText).isNull();
    }

    @Test
    void testSaveReflection_shouldReject_whenNotToday() {
        String err = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now().minusDays(1)).text("Tegnap").build(),
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "RITUAL_NOT_TODAY");
    }

    @Test
    void testSaveReflection_shouldKeepTheDayClosed_whenEditedAfterTheClose() {
        ritualPopulator.closedDay(ownerId(), LocalDate.now());
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("Utólag pontosítom.").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getClosed()).isTrue();
        assertThat(day.getReflectionText()).isEqualTo("Utólag pontosítom.");
    }

    @Test
    void testGetDay_shouldServeTheReflection_whenOneWasSaved() {
        ritualPopulator.openDay(ownerId(), LocalDate.now(), "Megírtam.");
        RitualDayResponse day = getForBody("/api/ritual/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isEqualTo("Megírtam.");
    }
}
