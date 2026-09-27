package io.mrkuhne.mezo.feature.goal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureLearningService;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.IntakeDayMarkEntity;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.IntakeDayMarkRepository;
import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * The weekly summary, learning-page history and live day-status reads (mezo-3n2so, spec §5.1,
 * §5.3, §6.3). Dates anchor to {@code LocalDate.now()}'s Monday — the card's target week is
 * {@code this Monday − 7} (w3 below), never a hardcoded calendar date.
 */
@Transactional
class ExpenditureInsightServiceIT extends AbstractIntegrationTest {

    @Autowired private ExpenditureInsightService service;
    @Autowired private ExpenditureLearningService learning;
    @Autowired private ExpenditureEstimateRepository estimates;
    @Autowired private IntakeDayMarkRepository marks;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private DietSettingsRepository dietSettings;
    @Autowired private GoalEngineProperties props;

    private LocalDate today;
    private LocalDate current;
    private LocalDate w1;
    private LocalDate w2;
    private LocalDate w3;
    private UUID userId;

    @BeforeEach
    void anchor() {
        today = LocalDate.now();
        current = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        w3 = current.minusWeeks(1);
        w2 = current.minusWeeks(2);
        w1 = current.minusWeeks(3);
        userId = databasePopulator.populateUser("insight-" + UUID.randomUUID() + "@test.local");
    }

    // ── weeklyCard ──────────────────────────────────────────────────────────

    @Test
    void cardPresentForLastWeeksWorthSayingRow() {
        seedRow(w3, "UPDATED", 60, List.of());

        Optional<ExpenditureInsightService.WeeklyCard> card = service.weeklyCard(userId);

        assertThat(card).isPresent();
        assertThat(card.get().row().getWeekStart()).isEqualTo(w3);
        assertThat(card.get().minUsableDays()).isEqualTo(props.expenditure().minUsableDaysPerWeek());
        assertThat(card.get().minWeighInDays()).isEqualTo(props.expenditure().minWeighInDaysPerWeek());
    }

    @Test
    void cardAbsentWhenDismissed() {
        ExpenditureEstimateEntity row = seedRow(w3, "UPDATED", 60, List.of());
        row.setDismissedAt(OffsetDateTime.now());
        estimates.saveAndFlush(row);

        assertThat(service.weeklyCard(userId)).isEmpty();
    }

    @Test
    void cardAbsentWhenQuiet() {
        seedRow(w3, "STABLE", 0, List.of());

        assertThat(service.weeklyCard(userId)).isEmpty();
    }

    @Test
    void cardAbsentWhenSwitchOff() {
        seedRow(w3, "UPDATED", 60, List.of());
        setLearning(false);

        assertThat(service.weeklyCard(userId)).isEmpty();
    }

    @Test
    void cardAbsentWhenOnlyRowIsOlder() {
        seedRow(w1, "UPDATED", 60, List.of());

        assertThat(service.weeklyCard(userId)).isEmpty();
    }

    @Test
    void holdingWeekIsWorthSayingEvenWithNoStepOrExcluded() {
        seedRow(w3, "HOLDING", 0, List.of());

        assertThat(service.weeklyCard(userId)).isPresent();
    }

    // ── dismiss ─────────────────────────────────────────────────────────────

    @Test
    void dismissSetsDismissedAt() {
        seedRow(w3, "UPDATED", 60, List.of());

        service.dismiss(userId, w3);

        assertThat(estimates.findByCreatedByAndWeekStartAndDeletedFalse(userId, w3).orElseThrow().getDismissedAt())
            .isNotNull();
    }

    @Test
    void dismissOfAnotherUsersWeekIsNotFound() {
        seedRow(w3, "UPDATED", 60, List.of());
        UUID otherUser = databasePopulator.populateUser("insight-other-" + UUID.randomUUID() + "@test.local");

        assertThatThrownBy(() -> service.dismiss(otherUser, w3))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThat(estimates.findByCreatedByAndWeekStartAndDeletedFalse(userId, w3).orElseThrow().getDismissedAt())
            .isNull();
    }

    @Test
    void dismissOfANonexistentWeekIsNotFound() {
        assertThatThrownBy(() -> service.dismiss(userId, w3))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ── history ─────────────────────────────────────────────────────────────

    @Test
    void historyIsAscendingCappedAndCarriesTheSwitch() {
        seedRow(w1, "UPDATED", -40, List.of());
        seedRow(w2, "UPDATED", -30, List.of());
        seedRow(w3, "UPDATED", 60, List.of());
        setLearning(false);

        ExpenditureInsightService.History history = service.history(userId, 2);

        assertThat(history.learningEnabled()).isFalse();
        assertThat(history.weeks()).hasSize(2);
        assertThat(history.weeks().get(0).getWeekStart()).isEqualTo(w2);
        assertThat(history.weeks().get(1).getWeekStart()).isEqualTo(w3);
        assertThat(history.weeks().get(0).getWeekStart()).isBefore(history.weeks().get(1).getWeekStart());
    }

    // ── days (live) ─────────────────────────────────────────────────────────

    @Test
    void daysReturnsLiveStatusesForTheRange() {
        LocalDate suspicious = w3;
        LocalDate confirmedComplete = w3.plusDays(1);
        LocalDate markedIncomplete = w3.plusDays(2);
        LocalDate unlogged = w3.plusDays(3);
        LocalDate usable = w3.plusDays(4);
        // Enough own history (≥ minReferenceDays) at normal kcal so the median-based check has teeth.
        for (int i = 1; i <= 10; i++) {
            mealPopulator.createMealWithItems(userId, w3.minusDays(i), "lunch",
                List.of(new MealPopulator.Line("History day", "2000", "150", "200", "70", (short) 1)));
        }
        mealPopulator.createMealWithItems(userId, suspicious, "lunch",
            List.of(new MealPopulator.Line("Suspicious day", "400", "150", "200", "70", (short) 1)));
        mealPopulator.createMealWithItems(userId, confirmedComplete, "lunch",
            List.of(new MealPopulator.Line("Confirmed complete day", "2000", "150", "200", "70", (short) 1)));
        mealPopulator.createMealWithItems(userId, markedIncomplete, "lunch",
            List.of(new MealPopulator.Line("Marked incomplete day", "2000", "150", "200", "70", (short) 1)));
        mealPopulator.createMealWithItems(userId, usable, "lunch",
            List.of(new MealPopulator.Line("Usable day", "2000", "150", "200", "70", (short) 1)));
        mark(confirmedComplete, "COMPLETE");
        mark(markedIncomplete, "INCOMPLETE");

        List<ExpenditureLearningService.DayStatus> days = service.days(userId, suspicious, usable);

        assertThat(byDate(days, suspicious).status()).isEqualTo("suspicious");
        assertThat(byDate(days, suspicious).mark()).isNull();
        assertThat(byDate(days, confirmedComplete).status()).isEqualTo("confirmed_complete");
        assertThat(byDate(days, confirmedComplete).mark()).isEqualTo("complete");
        assertThat(byDate(days, markedIncomplete).status()).isEqualTo("marked_incomplete");
        assertThat(byDate(days, markedIncomplete).mark()).isEqualTo("incomplete");
        assertThat(byDate(days, unlogged).status()).isEqualTo("unlogged");
        assertThat(byDate(days, unlogged).kcal()).isNull();
        assertThat(byDate(days, usable).status()).isEqualTo("usable");
    }

    @Test
    void daysWithoutEnoughHistoryTreatsLowIntakeAsUsable() {
        // No active goal and fewer than minReferenceDays of own history — nothing to invent a
        // reference from, so a low-kcal day is NOT flagged suspicious (decision, task-4 brief).
        LocalDate day = today.minusDays(1);
        mealPopulator.createMealWithItems(userId, day, "lunch",
            List.of(new MealPopulator.Line("Lone day", "500", "50", "50", "20", (short) 1)));

        List<ExpenditureLearningService.DayStatus> days = service.days(userId, day, day);

        assertThat(days).hasSize(1);
        assertThat(days.get(0).status()).isEqualTo("usable");
    }

    @Test
    void daysRejectsARangeOverFiftySixDays() {
        LocalDate from = today.minusDays(60);

        assertThatThrownBy(() -> service.days(userId, from, today))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void daysRejectsToAfterToday() {
        assertThatThrownBy(() -> service.days(userId, today, today.plusDays(1)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static ExpenditureLearningService.DayStatus byDate(List<ExpenditureLearningService.DayStatus> days, LocalDate d) {
        return days.stream().filter(x -> x.date().equals(d)).findFirst()
            .orElseThrow(() -> new AssertionError("no day-status for " + d));
    }

    private void mark(LocalDate day, String status) {
        IntakeDayMarkEntity m = new IntakeDayMarkEntity();
        m.setCreatedBy(userId);
        m.setDay(day);
        m.setStatus(status);
        marks.saveAndFlush(m);
    }

    private void setLearning(boolean enabled) {
        DietSettingsEntity row = dietSettings.findByCreatedByAndDeletedFalse(userId).orElseGet(() -> {
            DietSettingsEntity r = new DietSettingsEntity();
            r.setCreatedBy(userId);
            r.setSplitPreset("balanced");
            r.setProteinTier("moderate");
            r.setWaterMl(3000);
            r.setFiberG(30);
            r.setDayTypeShiftKcal(0);
            return r;
        });
        row.setLearningEnabled(enabled);
        dietSettings.saveAndFlush(row);
    }

    /** Persists a fully-formed row directly (bypasses the engine) — the insight service only reads. */
    private ExpenditureEstimateEntity seedRow(LocalDate week, String status, int step, List<ExcludedIntakeDayJson> excluded) {
        ExpenditureEstimateEntity e = new ExpenditureEstimateEntity();
        e.setCreatedBy(userId);
        e.setWeekStart(week);
        e.setStatus(status);
        e.setFormulaBaseKcal(2600);
        e.setPosteriorBaseKcal(2600 + step);
        e.setPosteriorSdKcal(150);
        e.setAppliedBaseKcal(2600 + step);
        e.setStepKcal(step);
        e.setDirection(Integer.signum(step));
        e.setConfidence("MEDIUM");
        e.setUsableDays(7);
        e.setWeighInDays(7);
        e.setExcludedDays(excluded);
        return estimates.saveAndFlush(e);
    }
}
