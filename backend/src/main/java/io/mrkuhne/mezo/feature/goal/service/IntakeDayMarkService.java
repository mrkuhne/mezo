package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.goal.engine.port.DailyIntakePort;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureLearningService;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.IntakeDayMarkEntity;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.IntakeDayMarkRepository;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * The owner's "was this day's log complete?" mark (mezo-3n2so, spec §7). Setting or clearing a mark
 * immediately re-chains the learned expenditure from the marked day's week onward and recomputes the
 * goal once ({@link ExpenditureLearningService#rechainFrom}); the mark and the re-chain are one
 * transaction, so a failing re-chain rolls the mark back. Only a logged, non-future day takes a mark.
 */
@Service
@RequiredArgsConstructor
public class IntakeDayMarkService {

    public static final String COMPLETE = "COMPLETE";
    public static final String INCOMPLETE = "INCOMPLETE";

    /** The day marked and the latest served (applied) base before/after the re-chain; null when not a learner. */
    public record MarkResult(LocalDate day, Integer appliedBaseBeforeKcal, Integer appliedBaseAfterKcal,
                             boolean recomputed) {
    }

    private final IntakeDayMarkRepository marks;
    private final ExpenditureEstimateRepository estimates;
    private final DailyIntakePort dailyIntake;
    private final ExpenditureLearningService learning;

    /** Marks {@code day} COMPLETE or INCOMPLETE (re-marking with the same status just re-runs the re-chain). */
    @Transactional
    public MarkResult mark(UUID userId, LocalDate day, String status) {
        if (!COMPLETE.equals(status) && !INCOMPLETE.equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status must be COMPLETE or INCOMPLETE");
        }
        rejectFuture(day);
        boolean logged = dailyIntake.between(userId, day, day).stream()
            .anyMatch(d -> day.equals(d.date()) && d.kcal() > 0);
        if (!logged) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "no logged intake on " + day);
        }
        IntakeDayMarkEntity mark = marks.findByCreatedByAndDayAndDeletedFalse(userId, day).orElseGet(() -> {
            IntakeDayMarkEntity m = new IntakeDayMarkEntity();
            m.setCreatedBy(userId);
            m.setDay(day);
            return m;
        });
        mark.setStatus(status);
        try {
            marks.saveAndFlush(mark);
        } catch (DataIntegrityViolationException raced) {
            // A concurrent mark on the same day won the (created_by, day) unique index — a
            // conflict for the caller to retry, never a 500. The transaction rolls back.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "concurrent mark on " + day, raced);
        }
        return rechain(userId, day);
    }

    /** Removes the day's mark so the classifier's rule decides again; a day without a mark is a no-op. */
    @Transactional
    public MarkResult clear(UUID userId, LocalDate day) {
        rejectFuture(day);
        Optional<IntakeDayMarkEntity> mark = marks.findByCreatedByAndDayAndDeletedFalse(userId, day);
        if (mark.isEmpty()) {
            Integer served = estimates.findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(userId)
                .map(ExpenditureEstimateEntity::getAppliedBaseKcal).orElse(null);
            return new MarkResult(day, served, served, false);
        }
        marks.delete(mark.get()); // soft delete (@SQLDelete)
        marks.flush();
        return rechain(userId, day);
    }

    private MarkResult rechain(UUID userId, LocalDate day) {
        ExpenditureLearningService.Rechain r = learning.rechainFrom(userId, day);
        return new MarkResult(day, r.appliedBefore(), r.appliedAfter(), r.recomputed());
    }

    private static void rejectFuture(LocalDate day) {
        if (day.isAfter(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot mark a future day");
        }
    }
}
