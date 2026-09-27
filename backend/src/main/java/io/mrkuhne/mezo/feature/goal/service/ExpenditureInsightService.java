package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.DietPreferencesPort;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureLearningService;
import io.mrkuhne.mezo.feature.goal.engine.service.WeeklyCardPolicy;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * The read side of the learned-expenditure weekly summary, its history and the live day statuses
 * (mezo-3n2so, spec §5.1, §5.3, §6.3): the "does today's dot show?" rule, the dismiss action and
 * the last-26-weeks chart. All computation stays in the engine ({@link ExpenditureLearningService},
 * {@link WeeklyCardPolicy}); this service only resolves what the owner is allowed to see and turns
 * missing/owner-scoped lookups into the right HTTP outcome.
 */
@Service
@RequiredArgsConstructor
public class ExpenditureInsightService {

    private static final int MAX_DAYS_RANGE = 56;

    /** The current weekly-summary card, when there is one — the row plus the holding-copy thresholds. */
    public record WeeklyCard(ExpenditureEstimateEntity row, int minUsableDays, int minWeighInDays) {
    }

    /** Up to the caller's last {@code limit} reviewed weeks, oldest first, plus the learning switch. */
    public record History(boolean learningEnabled, List<ExpenditureEstimateEntity> weeks) {
    }

    private final ExpenditureEstimateRepository estimates;
    private final ExpenditureLearningService learning;
    private final DietPreferencesPort dietPreferences;
    private final GoalEngineProperties props;

    /**
     * Spec §5.1: shown only when the switch is on, a row exists for last week (this Monday − 7), it
     * is worth saying ({@link WeeklyCardPolicy#worthSaying}) and it has not been dismissed.
     */
    @Transactional(readOnly = true)
    public Optional<WeeklyCard> weeklyCard(UUID userId) {
        if (!dietPreferences.resolve(userId).learningEnabled()) {
            return Optional.empty();
        }
        LocalDate lastWeek = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        Optional<ExpenditureEstimateEntity> row = estimates.findByCreatedByAndWeekStartAndDeletedFalse(userId, lastWeek);
        if (row.isEmpty() || row.get().getDismissedAt() != null || !WeeklyCardPolicy.worthSaying(row.get())) {
            return Optional.empty();
        }
        GoalEngineProperties.Expenditure e = props.expenditure();
        return Optional.of(new WeeklyCard(row.get(), e.minUsableDaysPerWeek(), e.minWeighInDaysPerWeek()));
    }

    /** Server-side, per week, cross-device (spec §5.1) — owner-scoped by the lookup itself. */
    @Transactional
    public void dismiss(UUID userId, LocalDate weekStart) {
        ExpenditureEstimateEntity row = estimates.findByCreatedByAndWeekStartAndDeletedFalse(userId, weekStart)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "no reviewed week " + weekStart));
        row.setDismissedAt(OffsetDateTime.now());
        estimates.save(row);
    }

    /** Up to the last {@code limit} reviewed weeks, ascending. */
    @Transactional(readOnly = true)
    public History history(UUID userId, int limit) {
        List<ExpenditureEstimateEntity> newestFirst =
            estimates.findByCreatedByAndDeletedFalseOrderByWeekStartDesc(userId, PageRequest.of(0, limit));
        List<ExpenditureEstimateEntity> weeks = new ArrayList<>(newestFirst);
        Collections.reverse(weeks);
        return new History(dietPreferences.resolve(userId).learningEnabled(), weeks);
    }

    /** Live day statuses for {@code [from, to]} (spec §6.3): max {@value #MAX_DAYS_RANGE} days, never past today. */
    @Transactional(readOnly = true)
    public List<ExpenditureLearningService.DayStatus> days(UUID userId, LocalDate from, LocalDate to) {
        if (to.isAfter(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "to must not be after today");
        }
        if (ChronoUnit.DAYS.between(from, to) >= MAX_DAYS_RANGE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "range must not exceed " + MAX_DAYS_RANGE + " days");
        }
        return learning.dayStatuses(userId, from, to);
    }
}
