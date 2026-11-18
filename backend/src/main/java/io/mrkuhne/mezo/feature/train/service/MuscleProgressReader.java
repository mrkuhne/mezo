package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.MuscleStallDetector.TopSet;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Which coarse muscle groups of a STYLED run have stalled (mezo-r36n9.79, spec §6.7.4): the logged top
 * set per exercise identity per start-date-anchored week, over the run's completed instances, counting
 * working sets of volume-counting exercises only (each set resolved through its own {@code exerciseId},
 * soft-deleted rows included — same reading as {@link WeeklySignalReader}). Detection only. An unstyled
 * run is never queried.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MuscleProgressReader {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final TrainStyleProperties props;

    /** Coarse groups stalled as of run week {@code uptoWeek} (inclusive, 1-based). */
    @Transactional(readOnly = true)
    public Set<String> stalledGroups(UUID createdBy, MesocycleEntity run, int uptoWeek) {
        // Audit-only signal: a failure here must never abort the week's proposal. Caught INSIDE the
        // transactional method so no exception leaves the proxy (which would mark the caller's tx rollback-only).
        try {
            return read(createdBy, run, uptoWeek);
        } catch (RuntimeException e) {
            log.warn("stall detection failed for run {} (ignored): {}", run.getId(), e.toString());
            return Set.of();
        }
    }

    private Set<String> read(UUID createdBy, MesocycleEntity run, int uptoWeek) {
        if (run.getTrainingStyle() == null) {
            return Set.of();
        }
        int stallWeeks = props.stallWeeks();
        if (uptoWeek <= stallWeeks) {
            return Set.of(); // needs stallWeeks + 1 weeks of data
        }
        Map<UUID, Integer> weekOfInstance = new HashMap<>();
        for (WorkoutSessionEntity s : workoutSessionRepository
                .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(run.getId()))) {
            if (s.getTemplateSessionId() == null || !"completed".equals(s.getStatus()) || s.getDate() == null) {
                continue;
            }
            int week = MesoWeeks.weekOf(run.getStartDate(), s.getDate(), Integer.MAX_VALUE);
            if (week >= 1 && week <= uptoWeek && !s.getDate().isBefore(run.getStartDate())) {
                weekOfInstance.put(s.getId(), week);
            }
        }
        if (weekOfInstance.isEmpty()) {
            return Set.of();
        }
        List<ExerciseSetEntity> sets = exerciseSetRepository
            .findWorkingSetsInSessions(createdBy, List.copyOf(weekOfInstance.keySet()));
        Set<UUID> ids = new HashSet<>();
        sets.forEach(x -> ids.add(x.getExerciseId()));
        Map<UUID, ExerciseEntity> exercises = ids.isEmpty() ? Map.of() : exerciseRepository
            .findOwnedByIdIncludingDeleted(createdBy, ids).stream()
            .collect(Collectors.toMap(ExerciseEntity::getId, Function.identity(), (a, b) -> a));

        // group -> identity -> week -> top set (heaviest, then most reps)
        Map<String, Map<String, Map<Integer, TopSet>>> top = new TreeMap<>();
        for (ExerciseSetEntity set : sets) {
            ExerciseEntity e = exercises.get(set.getExerciseId());
            if (e == null || !e.isCountsTowardVolume() || e.getMuscle() == null || e.getMuscle().isBlank()
                    || set.getReps() == null) {
                continue;
            }
            int week = weekOfInstance.get(set.getWorkoutSessionId());
            TopSet cand = new TopSet(week, set.getWeightKg() == null ? BigDecimal.ZERO : set.getWeightKg(), set.getReps());
            top.computeIfAbsent(MuscleGroup.of(e.getMuscle()), k -> new HashMap<>())
                .computeIfAbsent(ExerciseHistoryResolver.identityKey(e), k -> new HashMap<>())
                .merge(week, cand, (a, b) -> better(b, a) ? b : a);
        }
        Set<String> stalled = new HashSet<>();
        top.forEach((group, byIdentity) -> {
            Map<String, List<TopSet>> series = new HashMap<>();
            byIdentity.forEach((k, byWeek) -> series.put(k, List.copyOf(byWeek.values())));
            if (MuscleStallDetector.stalled(series, stallWeeks, uptoWeek)) {
                stalled.add(group);
            }
        });
        return stalled;
    }

    private static boolean better(TopSet a, TopSet b) {
        int c = a.kg().compareTo(b.kg());
        return c > 0 || (c == 0 && a.reps() > b.reps());
    }
}
