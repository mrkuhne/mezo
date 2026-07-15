package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lazily settles abandoned workout instances (spec 2026-07-15): an 'active' instance whose
 * calendar day has passed closes as 'completed' when it carries >=1 non-skipped logged set
 * (the work counts — feeds done-dates, lastWeek refs and the prescription engine), else as
 * 'skipped' (a started-but-empty session never counts as done). Invoked from getToday; a
 * SEPARATE bean because getToday is a plain read and a same-class @Transactional
 * self-invocation would bypass the proxy (mirrors ClosingBlockService). Idempotent.
 */
@Service
@RequiredArgsConstructor
public class WorkoutAutoCloseService {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;

    @Transactional
    public void autoCloseStale(UUID createdBy) {
        List<WorkoutSessionEntity> stale = workoutSessionRepository
            .findByCreatedByAndStatusAndDateBeforeAndTemplateSessionIdIsNotNull(
                createdBy, "active", LocalDate.now());
        if (stale.isEmpty()) {
            return;
        }
        for (WorkoutSessionEntity instance : stale) {
            boolean hasLoggedSet = exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId())
                .stream().anyMatch(s -> !s.isSkipped());
            instance.setStatus(hasLoggedSet ? "completed" : "skipped");
        }
        workoutSessionRepository.saveAll(stale);
    }
}
