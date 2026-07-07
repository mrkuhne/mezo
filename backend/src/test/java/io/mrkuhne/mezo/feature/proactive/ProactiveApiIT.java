package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.api.dto.HeartbeatNoteResponse;
import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.HeartbeatNotePopulator;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** HTTP-level briefing flow against the fake LLM (lazy generation on first GET). */
@ActiveProfiles("companion-fake")
class ProactiveApiIT extends ApiIntegrationTest {

    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private MemoirPopulator memoirPopulator;
    @Autowired private HeartbeatNotePopulator heartbeatNotePopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetBriefing_shouldLazilyGenerateAndBeIdempotent_whenSummariesExist() {
        dailySummaryPopulator.summary(ownerId(), LocalDate.now().minusDays(1),
                "Tegnap kemény leg-day volt.");

        BriefingResponse first = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.OK, BriefingResponse.class);

        // un-scripted fake answers the default valid JSON
        assertThat(first.getEyebrow()).isEqualTo("Fake briefing");
        assertThat(first.getBody()).containsExactly("FAKE-BRIEFING-NARRATÍVA");
        assertThat(first.getDate()).isEqualTo(LocalDate.now());
        assertThat(first.getGeneratedAt()).isNotNull();

        BriefingResponse second = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.OK, BriefingResponse.class);
        assertThat(second.getGeneratedAt()).isEqualTo(first.getGeneratedAt());   // no regeneration
    }

    @Test
    void testGetBriefing_shouldHonorDateParam_whenPastDateRequested() {
        LocalDate day = LocalDate.now().minusDays(3);
        dailySummaryPopulator.summary(ownerId(), day.minusDays(1), "Aznap előtt úszás volt.");

        BriefingResponse briefing = getForBody(
                "/api/proactive/briefing?date=" + day, ownerAuthHeaders(),
                HttpStatus.OK, BriefingResponse.class);

        assertThat(briefing.getDate()).isEqualTo(day);
    }

    @Test
    void testGetBriefing_shouldReturn404_whenNoNarrativeMemory() {
        String body = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetBriefing_shouldReturn401_whenNoToken() {
        getForBody("/api/proactive/briefing", null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testGetWeeklySuggestion_shouldLazilyGenerate_whenPriorWeekHasMemory() {
        LocalDate weekStart = LocalDate.now()
                .with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        dailySummaryPopulator.summary(ownerId(), weekStart.minusDays(2), "Előző héten edzés volt.");

        WeeklySuggestionResponse suggestion = getForBody(
                "/api/proactive/weekly-suggestion", ownerAuthHeaders(), HttpStatus.OK, WeeklySuggestionResponse.class);

        assertThat(suggestion.getWeekStart()).isEqualTo(weekStart);
        assertThat(suggestion.getProse()).isNotBlank();
    }

    @Test
    void testGetWeeklySuggestion_shouldReturn404_whenNoPriorWeekMemory() {
        String body = getForBody(
                "/api/proactive/weekly-suggestion", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetMemoir_shouldReturnLatestPersistedRow_whenOneExists() {
        LocalDate monday = LocalDate.now().with(
                java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        memoirPopulator.memoir(ownerId(), monday.minusWeeks(1));

        MemoirResponse memoir = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.OK, MemoirResponse.class);

        assertThat(memoir.getTitle()).isEqualTo("Teszt memoir");
        assertThat(memoir.getAnchors()).hasSize(1);
    }

    @Test
    void testGetMemoir_shouldLazilyGenerateLastCompletedWeek_whenNoneExists() {
        LocalDate lastWeek = LocalDate.now()
                .with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
                .minusWeeks(1);
        dailySummaryPopulator.summary(ownerId(), lastWeek.plusDays(1), "Múlt heti nap.");

        MemoirResponse memoir = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.OK, MemoirResponse.class);

        assertThat(memoir.getWeekStart()).isEqualTo(lastWeek);
        assertThat(memoir.getTitle()).isEqualTo("Fake memoir");   // the un-scripted fake default
    }

    @Test
    void testGetMemoir_shouldReturn404_whenNoMemoirAndNoMemory() {
        String body = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetHeartbeat_shouldReturnLatestNote_whenPersisted() {
        // two windows persisted for today — the newest (evening) wins; the lazy path is a no-op
        heartbeatNotePopulator.note(ownerId(), LocalDate.now(), HeartbeatNoteEntity.WINDOW_MIDDAY);
        heartbeatNotePopulator.note(ownerId(), LocalDate.now(), HeartbeatNoteEntity.WINDOW_EVENING);

        HeartbeatNoteResponse note = getForBody(
                "/api/proactive/heartbeat", ownerAuthHeaders(), HttpStatus.OK, HeartbeatNoteResponse.class);

        assertThat(note.getWindow()).isEqualTo(HeartbeatNoteEntity.WINDOW_EVENING);
        assertThat(note.getKind()).isEqualTo(HeartbeatNoteEntity.KIND_CLOSING);
        assertThat(note.getContent()).isNotBlank();
        assertThat(note.getDate()).isEqualTo(LocalDate.now());
    }

    @Test
    void testGetHeartbeat_shouldReturn404_whenPastDateHasNoNote() {
        // a past date never lazy-generates — honest absence even with narrative memory present
        dailySummaryPopulator.summary(ownerId(), LocalDate.now().minusDays(2), "Volt nap.");

        String body = getForBody(
                "/api/proactive/heartbeat?date=" + LocalDate.now().minusDays(1),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetHeartbeat_shouldReturn401_whenNoToken() {
        getForBody("/api/proactive/heartbeat", null, HttpStatus.UNAUTHORIZED, String.class);
    }
}
