package io.mrkuhne.mezo.feature.goal.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExpenditureHistoryResponse;
import io.mrkuhne.mezo.api.dto.ExpenditureWeek;
import io.mrkuhne.mezo.api.dto.ExpenditureWeeklyCardResponse;
import io.mrkuhne.mezo.api.dto.IntakeDayMarkRequest;
import io.mrkuhne.mezo.api.dto.IntakeDayMarkResult;
import io.mrkuhne.mezo.api.dto.IntakeDayStatus;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * HTTP contract for the learned-expenditure read/write surface added in mezo-3n2so's controller
 * task: the weekly-history chart, the weekly-summary card (+ dismiss), live day statuses and the
 * owner day-mark endpoints. Estimate rows are seeded directly (as {@link ExpenditureExplanationControllerIT}
 * does) for the read-only card/history/dismiss tests; the mark/clear tests only need one logged day —
 * with no prior estimate row, {@code rechainFrom} is a safe no-op, which keeps the happy-path setup small.
 */
class ExpenditureInsightControllerIT extends ApiIntegrationTest {

    @Autowired private ExpenditureEstimateRepository expenditureEstimateRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private GoalEngineProperties goalEngineProperties;
    @Autowired private MealPopulator mealPopulator;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    // ── history ─────────────────────────────────────────────────────────────

    @Test
    void historyReturnsTheOwnersWeeksAscendingWithTheLearningSwitch() {
        UUID owner = ownerId();
        expenditureEstimateRepository.saveAndFlush(estimate(owner, LocalDate.of(2026, 8, 31), 20));
        expenditureEstimateRepository.saveAndFlush(estimate(owner, LocalDate.of(2026, 9, 14), 40));
        expenditureEstimateRepository.saveAndFlush(estimate(owner, LocalDate.of(2026, 9, 7), 0));

        ExpenditureHistoryResponse response = getForBody(
            "/api/goals/expenditure/weeks", ownerAuthHeaders(), HttpStatus.OK, ExpenditureHistoryResponse.class);

        assertThat(response.getLearningEnabled()).isTrue();
        assertThat(response.getWeeks()).extracting(ExpenditureWeek::getWeekStart)
            .containsExactly(LocalDate.of(2026, 8, 31), LocalDate.of(2026, 9, 7), LocalDate.of(2026, 9, 14));
        assertThat(response.getWeeks().get(0).getStatus()).isEqualTo(ExpenditureWeek.StatusEnum.LEARNING);
        assertThat(response.getWeeks().get(0).getConfidence()).isEqualTo(ExpenditureWeek.ConfidenceEnum.LOW);
    }

    @Test
    void historyHonoursTheLimitParameter() {
        UUID owner = ownerId();
        for (int i = 0; i < 3; i++) {
            expenditureEstimateRepository.saveAndFlush(estimate(owner, LocalDate.of(2026, 8, 3).plusWeeks(i), 10));
        }

        ExpenditureHistoryResponse response = getForBody(
            "/api/goals/expenditure/weeks?limit=1", ownerAuthHeaders(), HttpStatus.OK, ExpenditureHistoryResponse.class);

        assertThat(response.getWeeks()).hasSize(1);
        assertThat(response.getWeeks().get(0).getWeekStart()).isEqualTo(LocalDate.of(2026, 8, 17));
    }

    @Test
    void historyNeverServesAnotherUsersRow() {
        RegisteredUser other = registerUser("history-other");
        expenditureEstimateRepository.saveAndFlush(estimate(other.id(), LocalDate.of(2026, 9, 14), 20));

        ExpenditureHistoryResponse response = getForBody(
            "/api/goals/expenditure/weeks", ownerAuthHeaders(), HttpStatus.OK, ExpenditureHistoryResponse.class);

        assertThat(response.getWeeks()).noneMatch(w -> w.getWeekStart().equals(LocalDate.of(2026, 9, 14)));
    }

    // ── weekly card ─────────────────────────────────────────────────────────

    @Test
    void weeklyCardReturnsTheLastWeekWhenWorthSaying() {
        RegisteredUser user = registerUser("weekly-card-worth-saying");
        LocalDate lastWeek = lastReviewedWeek();
        expenditureEstimateRepository.saveAndFlush(estimate(user.id(), lastWeek, 30)); // step != 0 -> worth saying

        ExpenditureWeeklyCardResponse response = getForBody("/api/goals/expenditure/weekly-card",
            user.headers(), HttpStatus.OK, ExpenditureWeeklyCardResponse.class);

        assertThat(response.getWeekStart()).isEqualTo(lastWeek);
        assertThat(response.getWeekEnd()).isEqualTo(lastWeek.plusDays(6));
        assertThat(response.getMinUsableDays()).isEqualTo(goalEngineProperties.expenditure().minUsableDaysPerWeek());
        assertThat(response.getMinWeighInDays()).isEqualTo(goalEngineProperties.expenditure().minWeighInDaysPerWeek());
        assertThat(response.getExcludedDays()).isEmpty();
    }

    @Test
    void weeklyCardIs204WhenNothingWorthShowing() {
        RegisteredUser user = registerUser("weekly-card-nothing");
        LocalDate lastWeek = lastReviewedWeek();
        expenditureEstimateRepository.saveAndFlush(estimate(user.id(), lastWeek, 0)); // step 0, no excluded, not holding

        exchangeForBody(HttpMethod.GET, "/api/goals/expenditure/weekly-card", null, user.headers(),
            HttpStatus.NO_CONTENT, String.class);
    }

    @Test
    void weeklyCardIs204WhenNoReviewedWeekExists() {
        RegisteredUser user = registerUser("weekly-card-empty");

        exchangeForBody(HttpMethod.GET, "/api/goals/expenditure/weekly-card", null, user.headers(),
            HttpStatus.NO_CONTENT, String.class);
    }

    @Test
    void dismissHidesTheCardAndIsCrossDevice() {
        RegisteredUser user = registerUser("weekly-card-dismiss");
        LocalDate lastWeek = lastReviewedWeek();
        expenditureEstimateRepository.saveAndFlush(estimate(user.id(), lastWeek, 30));

        exchangeForBody(HttpMethod.POST, "/api/goals/expenditure/weekly-card/" + lastWeek + "/dismiss",
            null, user.headers(), HttpStatus.NO_CONTENT, String.class);

        exchangeForBody(HttpMethod.GET, "/api/goals/expenditure/weekly-card", null, user.headers(),
            HttpStatus.NO_CONTENT, String.class);
    }

    @Test
    void dismissIs404WhenTheCallerHasNoSuchWeek() {
        RegisteredUser user = registerUser("weekly-card-dismiss-404");

        exchangeForBody(HttpMethod.POST, "/api/goals/expenditure/weekly-card/2026-09-14/dismiss",
            null, user.headers(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void dismissNeverTouchesAnotherUsersWeek() {
        RegisteredUser other = registerUser("weekly-card-dismiss-other");
        LocalDate lastWeek = lastReviewedWeek();
        expenditureEstimateRepository.saveAndFlush(estimate(other.id(), lastWeek, 30));

        exchangeForBody(HttpMethod.POST, "/api/goals/expenditure/weekly-card/" + lastWeek + "/dismiss",
            null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    // ── live days ───────────────────────────────────────────────────────────

    @Test
    void daysReturnsUsableForALoggedDayAndUnloggedForAGap() {
        RegisteredUser user = registerUser("days-happy-path");
        LocalDate d = LocalDate.now().minusDays(2);
        mealPopulator.createMealWithItems(user.id(), d, "lunch",
            List.of(new MealPopulator.Line("Nap étel", "2000", "150", "200", "70", (short) 1)));

        List<IntakeDayStatus> days = getForList("/api/goals/expenditure/days?from=" + d.minusDays(1) + "&to=" + d,
            user.headers(), HttpStatus.OK, IntakeDayStatus.class);

        assertThat(days).hasSize(2);
        assertThat(days.get(0).getStatus()).isEqualTo(IntakeDayStatus.StatusEnum.UNLOGGED);
        assertThat(days.get(1).getStatus()).isEqualTo(IntakeDayStatus.StatusEnum.USABLE);
        assertThat(days.get(1).getKcal()).isEqualTo(2000);
    }

    @Test
    void daysIs400WhenToIsAfterToday() {
        RegisteredUser user = registerUser("days-future");
        LocalDate tomorrow = LocalDate.now().plusDays(1);

        exchangeForBody(HttpMethod.GET,
            "/api/goals/expenditure/days?from=" + tomorrow.minusDays(1) + "&to=" + tomorrow,
            null, user.headers(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void daysIs400WhenTheRangeIsTooLong() {
        RegisteredUser user = registerUser("days-too-long");
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(60);

        exchangeForBody(HttpMethod.GET, "/api/goals/expenditure/days?from=" + from + "&to=" + to,
            null, user.headers(), HttpStatus.BAD_REQUEST, String.class);
    }

    // ── day marks ───────────────────────────────────────────────────────────

    @Test
    void markingALoggedDayReturnsTheRecomputedResult() {
        RegisteredUser user = registerUser("mark-happy-path");
        LocalDate d = LocalDate.now().minusDays(3);
        mealPopulator.createMealWithItems(user.id(), d, "lunch",
            List.of(new MealPopulator.Line("Mark étel", "2000", "150", "200", "70", (short) 1)));

        IntakeDayMarkResult result = putForBody("/api/goals/expenditure/days/" + d + "/mark",
            IntakeDayMarkRequest.builder().status(IntakeDayMarkRequest.StatusEnum.COMPLETE).build(),
            user.headers(), HttpStatus.OK, IntakeDayMarkResult.class);

        assertThat(result.getDay().getDate()).isEqualTo(d);
        assertThat(result.getDay().getMark()).isEqualTo(IntakeDayStatus.MarkEnum.COMPLETE);
        assertThat(result.getRecomputed()).isFalse(); // no prior estimate row — nothing to re-chain

        IntakeDayMarkResult cleared = exchangeForBody(HttpMethod.DELETE, "/api/goals/expenditure/days/" + d + "/mark",
            null, user.headers(), HttpStatus.OK, IntakeDayMarkResult.class);
        assertThat(cleared.getDay().getMark()).isNull();
    }

    @Test
    void markIs400ForAFutureDay() {
        RegisteredUser user = registerUser("mark-future");
        LocalDate tomorrow = LocalDate.now().plusDays(1);

        putForBody("/api/goals/expenditure/days/" + tomorrow + "/mark",
            IntakeDayMarkRequest.builder().status(IntakeDayMarkRequest.StatusEnum.COMPLETE).build(),
            user.headers(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void markIs409ForAnUnloggedDay() {
        RegisteredUser user = registerUser("mark-unlogged");
        LocalDate d = LocalDate.now().minusYears(1);

        putForBody("/api/goals/expenditure/days/" + d + "/mark",
            IntakeDayMarkRequest.builder().status(IntakeDayMarkRequest.StatusEnum.COMPLETE).build(),
            user.headers(), HttpStatus.CONFLICT, String.class);
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private LocalDate lastReviewedWeek() {
        return LocalDate.now().with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
            .minusWeeks(1);
    }

    private ExpenditureEstimateEntity estimate(UUID user, LocalDate weekStart, int stepKcal) {
        ExpenditureEstimateEntity e = new ExpenditureEstimateEntity();
        e.setCreatedBy(user);
        e.setWeekStart(weekStart);
        e.setStatus("LEARNING");
        e.setFormulaBaseKcal(2200);
        e.setPosteriorBaseKcal(2150);
        e.setPosteriorSdKcal(120);
        e.setAppliedBaseKcal(2180);
        e.setStepKcal(stepKcal);
        e.setDirection(stepKcal >= 0 ? 1 : -1);
        e.setConfidence("LOW");
        e.setUsableDays(20);
        e.setWeighInDays(15);
        e.setExcludedDays(List.of());
        return e;
    }
}
