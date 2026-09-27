package io.mrkuhne.mezo.feature.goal.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExpenditureExplanationResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * "Hogy tanultam?" (mezo-y72o3) HTTP contract for {@code GET /api/goals/expenditure/explanation}
 * — the caller's latest reviewed week that carries an explanation, 204 when none, and never
 * another user's row (owner-scoped like every goal read).
 */
class ExpenditureExplanationControllerIT extends ApiIntegrationTest {

    @Autowired private ExpenditureEstimateRepository expenditureEstimateRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void explanationReturnsTheOwnerLatestExplainedWeek() {
        UUID owner = ownerId();
        // Older, explained.
        expenditureEstimateRepository.saveAndFlush(
            estimate(owner, LocalDate.of(2026, 9, 7), explanationOf(LocalDate.of(2026, 9, 7))));
        // Newer, explained — the one the endpoint must serve.
        ExpenditureExplanationJson newest = explanationOf(LocalDate.of(2026, 9, 14));
        expenditureEstimateRepository.saveAndFlush(estimate(owner, LocalDate.of(2026, 9, 14), newest));
        // Newest of all, but written before the explainer shipped — must be skipped.
        expenditureEstimateRepository.saveAndFlush(estimate(owner, LocalDate.of(2026, 9, 21), null));

        ExpenditureExplanationResponse response = getForBody(
            "/api/goals/expenditure/explanation", ownerAuthHeaders(), HttpStatus.OK,
            ExpenditureExplanationResponse.class);

        assertThat(response.getWeekStart()).isEqualTo(LocalDate.of(2026, 9, 14));
        assertThat(response.getStatus()).isEqualTo(ExpenditureExplanationResponse.StatusEnum.LEARNING);
        assertThat(response.getConfidence()).isEqualTo(ExpenditureExplanationResponse.ConfidenceEnum.LOW);
        assertThat(response.getFormulaBaseKcal()).isEqualTo(2200);
        assertThat(response.getPosteriorBaseKcal()).isEqualTo(2150);
        assertThat(response.getPosteriorSdKcal()).isEqualTo(120);
        assertThat(response.getAppliedBaseKcal()).isEqualTo(2180);
        assertThat(response.getStepKcal()).isEqualTo(20);
        assertThat(response.getWindowStart()).isEqualTo(newest.windowStart());
        assertThat(response.getWindowEnd()).isEqualTo(newest.windowEnd());
        assertThat(response.getDataStart()).isEqualTo(newest.dataStart());
        assertThat(response.getUsableDays()).isEqualTo(20);
        assertThat(response.getWeighInDays()).isEqualTo(15);
        assertThat(response.getUnloggedDays()).isEqualTo(5);
        assertThat(response.getHistoryWeeks()).isEqualTo(5);
        assertThat(response.getAvgIntakeKcal()).isEqualTo(2200);
        assertThat(response.getAvgMovementKcal()).isEqualTo(300);
        assertThat(response.getTissueRateKgPerWeek()).isEqualByComparingTo(new BigDecimal("-0.30"));
        assertThat(response.getTissueKcalPerDay()).isEqualTo(-150);
        assertThat(response.getSimpleBaseKcal()).isEqualTo(2350);
        assertThat(response.getStartBaseKcal()).isEqualTo(2180);
        assertThat(response.getExcludedDays()).hasSize(1);
        assertThat(response.getExcludedDays().get(0).getDate()).isEqualTo(LocalDate.of(2026, 9, 13));
        assertThat(response.getExcludedDays().get(0).getKcal()).isEqualTo(604);
        assertThat(response.getExcludedDays().get(0).getReason())
            .isEqualTo(io.mrkuhne.mezo.api.dto.ExpenditureExcludedDay.ReasonEnum.SUSPICIOUS);
        assertThat(response.getWaterEvents()).isEmpty();
        assertThat(response.getSeries()).hasSize(1);
        assertThat(response.getSeries().get(0).getStatus())
            .isEqualTo(io.mrkuhne.mezo.api.dto.ExpenditureSeriesPoint.StatusEnum.USABLE);
    }

    @Test
    void explanationIs204WhenNoExplainedRowExists() {
        exchangeForBody(org.springframework.http.HttpMethod.GET, "/api/goals/expenditure/explanation",
            null, ownerAuthHeaders(), HttpStatus.NO_CONTENT, String.class);
    }

    @Test
    void explanationIs204WhenTheOwnerHasOnlyUnexplainedRows() {
        expenditureEstimateRepository.saveAndFlush(
            estimate(ownerId(), LocalDate.of(2026, 9, 14), null));

        exchangeForBody(org.springframework.http.HttpMethod.GET, "/api/goals/expenditure/explanation",
            null, ownerAuthHeaders(), HttpStatus.NO_CONTENT, String.class);
    }

    @Test
    void explanationNeverServesAnotherUsersRow() {
        RegisteredUser other = registerUser("expenditure-explanation-other");
        expenditureEstimateRepository.saveAndFlush(
            estimate(other.id(), LocalDate.of(2026, 9, 14), explanationOf(LocalDate.of(2026, 9, 14))));

        // The owner has no explained row of their own — the other user's must not leak through.
        exchangeForBody(org.springframework.http.HttpMethod.GET, "/api/goals/expenditure/explanation",
            null, ownerAuthHeaders(), HttpStatus.NO_CONTENT, String.class);
    }

    private ExpenditureEstimateEntity estimate(UUID user, LocalDate weekStart, ExpenditureExplanationJson explanation) {
        ExpenditureEstimateEntity e = new ExpenditureEstimateEntity();
        e.setCreatedBy(user);
        e.setWeekStart(weekStart);
        e.setStatus("LEARNING");
        e.setFormulaBaseKcal(2200);
        e.setPosteriorBaseKcal(2150);
        e.setPosteriorSdKcal(120);
        e.setAppliedBaseKcal(2180);
        e.setStepKcal(20);
        e.setDirection(-1);
        e.setConfidence("LOW");
        e.setUsableDays(20);
        e.setWeighInDays(15);
        e.setExcludedDays(List.of());
        e.setExplanation(explanation);
        return e;
    }

    private ExpenditureExplanationJson explanationOf(LocalDate windowEnd) {
        LocalDate windowStart = windowEnd.minusDays(55);
        LocalDate dataStart = windowEnd.minusDays(30);
        return new ExpenditureExplanationJson(
            windowStart, windowEnd, dataStart, 20, 15, 5, 5,
            2200, 300, new BigDecimal("-0.30"), -150, 2350, 2180,
            List.of(new ExcludedIntakeDayJson(LocalDate.of(2026, 9, 13), 604, "suspicious")),
            List.of(),
            List.of(new ExpenditureExplanationJson.SeriesPoint(
                windowEnd, 2200, "usable", new BigDecimal("82.5"), new BigDecimal("-0.04"), new BigDecimal("-0.04"))));
    }
}
