package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
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
}
