package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What actually happened last week, per coarse muscle group (volume engine v2, spec §6.4): the
 * working sets logged over the previous week's COMPLETED sessions of the run, a grind flag, the
 * feedback flags and whether soreness was still high on the day of the group's next session.
 *
 * <p>Each logged set's exercise is looked up BY THE SET'S {@code exerciseId} (owner-scoped, soft-deleted
 * rows included), whatever session row it hangs on — so a today-only swap or addition, whose row hangs off
 * the instance rather than the template day, counts with its own muscle (the old template-day lookup
 * dropped them, spec §5 defect 6). Exempt exercises ({@code counts_toward_volume = false}) are outside
 * everything here. A group with neither a counted set nor feedback is simply absent.
 *
 * <p>The grind ({@link GrindRule}, mezo-r36n9.115): an unstyled run compares the newest reserve with the row's
 * stored target; a styled run with that week's effective (ramped) reserve — {@link ExerciseStyler#context}, the
 * same inputs the session's prescription uses — and, at a reserve of 0–1, also reads a set two reps short.
 */
@Service
@RequiredArgsConstructor
public class WeeklySignalReader {

    /** {@code logged} counting working sets; the four flags are the decider's inputs. */
    public record GroupSignals(int logged, boolean grind, boolean tooMuch, boolean jointPain, boolean sorenessHigh) {}

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseFeedbackRepository exerciseFeedbackRepository;
    private final DayCheckInPort dayCheckInPort;
    private final ExerciseStyler exerciseStyler;
    private final VolumeProperties props;

    /** The week BEFORE {@code week} (1-based, {@link MesoWeeks}); empty for week 1. */
    @Transactional(readOnly = true)
    public Map<String, GroupSignals> read(UUID createdBy, MesocycleEntity meso, int week) {
        if (week <= 1) {
            return Map.of();
        }
        MesoWeeks.Window window = MesoWeeks.weekWindow(meso.getStartDate(), week - 1);

        // Completed instances of THIS run from the previous week on, oldest first.
        List<WorkoutSessionEntity> instances = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(meso.getId())).stream()
            .filter(s -> s.getTemplateSessionId() != null && "completed".equals(s.getStatus())
                && s.getDate() != null && !s.getDate().isBefore(window.from()))
            .sorted(Comparator.comparing(WorkoutSessionEntity::getDate)
                .thenComparing(WorkoutSessionEntity::getCreatedAt))
            .toList();
        if (instances.isEmpty()) {
            return Map.of();
        }
        List<WorkoutSessionEntity> lastWeek = instances.stream()
            .filter(s -> !s.getDate().isAfter(window.to())).toList();

        Map<UUID, List<ExerciseSetEntity>> setsBySession = new HashMap<>();
        Set<UUID> exerciseIds = new HashSet<>();
        for (WorkoutSessionEntity s : instances) {
            List<ExerciseSetEntity> sets = exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, s.getId());
            setsBySession.put(s.getId(), sets);
            sets.forEach(x -> exerciseIds.add(x.getExerciseId()));
        }
        List<ExerciseFeedbackEntity> feedback = lastWeek.isEmpty() ? List.of()
            : exerciseFeedbackRepository.findByCreatedByAndWorkoutSessionIdIn(
                createdBy, lastWeek.stream().map(WorkoutSessionEntity::getId).toList());
        feedback.forEach(f -> exerciseIds.add(f.getExerciseId()));
        if (exerciseIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, ExerciseEntity> exercises = exerciseRepository
            .findOwnedByIdIncludingDeleted(createdBy, exerciseIds).stream()
            .collect(Collectors.toMap(ExerciseEntity::getId, Function.identity(), (a, b) -> a));

        // Per session: the counting groups it trained (a logged counting working set).
        Map<UUID, Set<String>> groupsOfSession = new HashMap<>();
        Map<String, Integer> logged = new LinkedHashMap<>();
        Map<UUID, ExerciseSetEntity> latestSet = new LinkedHashMap<>();
        Map<String, LocalDate> lastTrained = new HashMap<>();
        for (WorkoutSessionEntity s : instances) {
            boolean inWeek = !s.getDate().isAfter(window.to());
            for (ExerciseSetEntity set : setsBySession.get(s.getId())) {
                String group = countingGroup(exercises.get(set.getExerciseId()));
                if (group == null || !isLoggedWorking(set)) {
                    continue;
                }
                groupsOfSession.computeIfAbsent(s.getId(), k -> new HashSet<>()).add(group);
                if (inWeek) {
                    logged.merge(group, 1, Integer::sum);
                    lastTrained.merge(group, s.getDate(), (a, b) -> a.isAfter(b) ? a : b);
                    // A technique set's reserve of 0 is deliberate, not a grind (mezo-r36n9.80, spec §6.4):
                    // the newest NON-technique working set carries the signal; it still counts as one set.
                    if (set.getRir() != null && set.getTechnique() == null) {
                        latestSet.put(set.getExerciseId(), set); // oldest-first: last write wins
                    }
                }
            }
        }

        TrainingStyle runStyle = TrainingStyle.fromWire(meso.getTrainingStyle());
        CatalogAttributes.Lookup stability = runStyle == null ? CatalogAttributes.Lookup.EMPTY
            : exerciseStyler.lookupRows(latestSet.keySet().stream().map(exercises::get).toList(), true);
        Set<String> grind = new HashSet<>();
        latestSet.forEach((exerciseId, set) -> {
            ExerciseEntity e = exercises.get(exerciseId);
            StyleContext style = runStyle == null ? StyleContext.NONE
                : exerciseStyler.context(e, runStyle, week - 1, meso.getPhaseCurve(), stability);
            boolean grinding = style.styled()
                ? GrindRule.styled(set.getRir(), set.getReps(), set.getTargetReps(), style.effectiveReserve(),
                    props.grindRirGap())
                : GrindRule.unstyled(set.getRir(), e.getTargetRir(), props.grindRirGap());
            if (grinding) {
                grind.add(countingGroup(e));
            }
        });

        Set<String> tooMuch = new HashSet<>();
        Set<String> jointPain = new HashSet<>();
        Set<String> withFeedback = new HashSet<>();
        for (ExerciseFeedbackEntity f : feedback) {
            String group = countingGroup(exercises.get(f.getExerciseId()));
            if (group == null) {
                continue;
            }
            withFeedback.add(group);
            if (f.getWorkload() >= props.signals().workloadTooMuch()) {
                tooMuch.add(group);
            }
            if (f.getJointPain() >= props.signals().jointPainHold()) {
                jointPain.add(group);
            }
        }

        Set<String> groups = new HashSet<>(logged.keySet());
        groups.addAll(withFeedback);
        Map<String, GroupSignals> result = new LinkedHashMap<>();
        for (String group : new ArrayList<>(groups).stream().sorted().toList()) {
            result.put(group, new GroupSignals(logged.getOrDefault(group, 0), grind.contains(group),
                tooMuch.contains(group), jointPain.contains(group),
                sorenessHigh(createdBy, group, lastTrained.get(group), instances, groupsOfSession)));
        }
        return result;
    }

    /** High soreness on the day of the run's next completed session that trained the group. */
    private boolean sorenessHigh(UUID createdBy, String group, LocalDate lastDate,
                                 List<WorkoutSessionEntity> instances, Map<UUID, Set<String>> groupsOfSession) {
        if (lastDate == null) {
            return false;
        }
        LocalDate next = instances.stream()
            .filter(s -> s.getDate().isAfter(lastDate)
                && groupsOfSession.getOrDefault(s.getId(), Set.of()).contains(group))
            .map(WorkoutSessionEntity::getDate)
            .min(Comparator.naturalOrder()).orElse(null);
        if (next == null) {
            return false;
        }
        return dayCheckInPort.checkIns(createdBy, next).stream()
            .map(DayCheckInPort.DayCheckIn::soreness)
            .filter(Objects::nonNull)
            .anyMatch(v -> v >= props.signals().sorenessHigh());
    }

    private static boolean isLoggedWorking(ExerciseSetEntity set) {
        return "working".equals(set.getKind()) && !set.isSkipped() && set.getReps() != null;
    }

    /** The coarse group of a counting exercise; null for an unknown, blank-muscle or exempt exercise. */
    private static String countingGroup(ExerciseEntity e) {
        if (e == null || !e.isCountsTowardVolume() || e.getMuscle() == null || e.getMuscle().isBlank()) {
            return null;
        }
        return MuscleGroup.of(e.getMuscle());
    }
}
