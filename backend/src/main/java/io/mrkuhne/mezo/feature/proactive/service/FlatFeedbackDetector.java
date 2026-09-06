package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.config.QuestionProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec 2026-09-05 §(18)): zero variance in {@code workload} AND
 * {@code jointPain} across the last {@code windowWorkouts} feedback-carrying workouts — the shape of
 * a debrief that is being reflex-clicked rather than answered.
 *
 * <p><b>"Workout" means a workout, not a row.</b> {@code exercise_feedback} is one row per
 * (instance, exercise), so the rows are grouped by {@code workout_session_id} first and the window
 * is counted in GROUPS. Every row inside those groups then has to carry the same pair: a single
 * differing exercise inside an otherwise flat workout is variance, and variance is an answer.
 *
 * <p><b>The cap can cut a workout in half.</b> The scan reads the newest {@code maxFeedbackRows}
 * rows, so the OLDEST group in that read may be missing its earlier rows — and a missing row could
 * be the one that differs. That group is discarded whenever the cap was actually hit, before the
 * window is taken.
 *
 * <p><b>Honesty gate:</b> fewer than {@code windowWorkouts} usable groups ⇒ {@link Optional#empty()}.
 * Too little data is never a finding.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class FlatFeedbackDetector {

    /**
     * @param workload  the single workload value every row carried (the card's evidence)
     * @param jointPain the single joint-pain value every row carried
     * @param workouts  how many workouts that held for
     */
    public record FlatFeedback(int workload, int jointPain, int workouts) {
    }

    private final ExerciseFeedbackRepository exerciseFeedbackRepository;
    private final QuestionProperties properties;

    @Transactional(readOnly = true)
    public Optional<FlatFeedback> detect(UUID userId) {
        QuestionProperties.FlatFeedback cfg = properties.flatFeedback();
        List<ExerciseFeedbackEntity> rows = exerciseFeedbackRepository
            .findByCreatedByOrderByCreatedAtDesc(userId, Limit.of(cfg.maxFeedbackRows()));

        Map<UUID, List<ExerciseFeedbackEntity>> byWorkout = new LinkedHashMap<>();
        for (ExerciseFeedbackEntity row : rows) {
            byWorkout.computeIfAbsent(row.getWorkoutSessionId(), key -> new ArrayList<>()).add(row);
        }
        List<UUID> workouts = new ArrayList<>(byWorkout.keySet());
        if (rows.size() >= cfg.maxFeedbackRows() && !workouts.isEmpty()) {
            // The oldest group inside the cap may be truncated — drop it rather than judge it.
            workouts.remove(workouts.size() - 1);
        }
        if (workouts.size() < cfg.windowWorkouts()) {
            return Optional.empty();
        }
        List<ExerciseFeedbackEntity> window = workouts.subList(0, cfg.windowWorkouts()).stream()
            .flatMap(id -> byWorkout.get(id).stream()).toList();
        int workload = window.get(0).getWorkload();
        int jointPain = window.get(0).getJointPain();
        boolean flat = window.stream()
            .allMatch(row -> row.getWorkload() == workload && row.getJointPain() == jointPain);
        return flat
            ? Optional.of(new FlatFeedback(workload, jointPain, cfg.windowWorkouts()))
            : Optional.empty();
    }
}
