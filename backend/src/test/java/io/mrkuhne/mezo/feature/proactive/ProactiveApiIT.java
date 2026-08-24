package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.api.dto.PredictionResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** HTTP-level weekly-suggestion/memoir/prediction flows against the fake LLM (lazy generation on
 *  first GET). The morning/sleep/weight/midday/evening companion-feed flow lives in
 *  {@link ProactiveApiFeedIT}. */
@ActiveProfiles("companion-fake")
class ProactiveApiIT extends ApiIntegrationTest {

    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private MemoirPopulator memoirPopulator;
    @Autowired private PredictionPopulator predictionPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
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
        // lazily generated inside the endpoint — no populated row to pin identity against
        assertThat(suggestion.getId()).isNotNull();
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
        MemoirEntity memoirRow = memoirPopulator.memoir(ownerId(), monday.minusWeeks(1));

        MemoirResponse memoir = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.OK, MemoirResponse.class);

        assertThat(memoir.getTitle()).isEqualTo("Teszt memoir");
        assertThat(memoir.getAnchors()).hasSize(1);
        assertThat(memoir.getId()).isEqualTo(memoirRow.getId());
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
        // lazily generated inside the endpoint — no populated row to pin identity against
        assertThat(memoir.getId()).isNotNull();
    }

    @Test
    void testGetMemoir_shouldReturn404_whenNoMemoirAndNoMemory() {
        String body = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetPredictions_shouldReturnRowsNewestWindowFirst_whenPersisted() {
        LocalDate monday = LocalDate.now().with(
                java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        // current-week row present ⇒ no lazy attempt; plus an older validated row
        predictionPopulator.prediction(ownerId(), monday.minusWeeks(1),
                PredictionEntity.METRIC_WEIGHT_TREND, PredictionEntity.DIRECTION_DOWN,
                PredictionEntity.STATUS_VALIDATED);
        predictionPopulator.prediction(ownerId(), monday,
                PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP,
                PredictionEntity.STATUS_PENDING);

        List<PredictionResponse> predictions = getForList(
                "/api/proactive/prediction", ownerAuthHeaders(), HttpStatus.OK, PredictionResponse.class);

        assertThat(predictions).hasSize(2);
        assertThat(predictions.getFirst().getValidFrom()).isEqualTo(monday);
        assertThat(predictions.getFirst().getConfidence()).isNull();   // „tanulom" — null on the wire
    }

    @Test
    void testGetPredictions_shouldReturnEmptyArray_whenNoRowsAndNoConfirmedPatterns() {
        List<PredictionResponse> predictions = getForList(
                "/api/proactive/prediction", ownerAuthHeaders(), HttpStatus.OK, PredictionResponse.class);

        assertThat(predictions).isEmpty();   // honest empty state — never a 404
    }

    @Test
    void testGetPredictions_shouldReturn401_whenNoToken() {
        getForBody("/api/proactive/prediction", null, HttpStatus.UNAUTHORIZED, String.class);
    }
}
