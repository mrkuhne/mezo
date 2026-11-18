package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.json.RestoreEntryJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * What "the plan" of a run is, for every volume engine reader (volume engine v2): the counting exercises
 * of its template days, in day then order, each with its landmark group — and how a deload's restore
 * entries find their current rows. {@link WeekProposalService} and {@link VolumeArcService} both read
 * it here, so the weekly proposal and the arc's planned line never disagree on the plan.
 */
@Component
@RequiredArgsConstructor
class TemplatePlan {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final VolumeProperties props;

    /**
     * A counting exercise of a template day; {@code group} null when the group has no landmark entry;
     * {@code dayName} the template day's label.
     */
    record Row(ExerciseEntity exercise, int dayIndex, String group, String dayName) {}

    /** The run's counting template-day exercises, sorted by day index then order index. */
    List<Row> rows(UUID createdBy, UUID mesoId) {
        Map<UUID, Integer> dayIndex = new HashMap<>();
        Map<UUID, String> dayName = new HashMap<>();
        workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesoId))
            .stream().filter(s -> s.getTemplateSessionId() == null)
            .forEach(s -> {
                dayIndex.put(s.getId(), s.getOrderIndex() == null ? 0 : s.getOrderIndex());
                dayName.put(s.getId(), s.getDayLabel());
            });
        if (dayIndex.isEmpty()) {
            return List.of();
        }
        return exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.copyOf(dayIndex.keySet()))
            .stream()
            .filter(ExerciseEntity::isCountsTowardVolume)
            .map(e -> new Row(e, dayIndex.get(e.getWorkoutSessionId()), groupOf(e),
                dayName.get(e.getWorkoutSessionId())))
            .sorted((a, b) -> a.dayIndex() != b.dayIndex() ? Integer.compare(a.dayIndex(), b.dayIndex())
                : Integer.compare(orderIndex(a.exercise()), orderIndex(b.exercise())))
            .toList();
    }

    /** The exercise's coarse group when it counts and has a landmark entry, else null (never judged, never pathed). */
    String groupOf(ExerciseEntity e) {
        if (!e.isCountsTowardVolume() || e.getMuscle() == null || e.getMuscle().isBlank()) {
            return null;
        }
        String group = MuscleGroup.of(e.getMuscle());
        return props.baselines().containsKey(group) ? group : null;
    }

    /**
     * Two passes, so an entry whose row was replaced never claims by identity a row another entry
     * still owns by id: first every entry whose {@code exerciseId} still exists, then — for the
     * remaining entries only — identity (catalog id / name) on the same template day among rows
     * not yet matched. Each row is matched at most once; an entry with nothing left is dropped.
     */
    static Map<RestoreEntryJson, Row> matchEntries(List<RestoreEntryJson> entries, List<Row> plan) {
        Map<RestoreEntryJson, Row> pairs = new LinkedHashMap<>();
        Set<UUID> matched = new HashSet<>();
        List<RestoreEntryJson> rest = new ArrayList<>();
        for (RestoreEntryJson entry : entries) {
            Optional<Row> byId = plan.stream()
                .filter(r -> r.group() != null && r.exercise().getId().equals(entry.exerciseId())).findFirst();
            if (byId.isEmpty()) {
                rest.add(entry);
            } else if (matched.add(byId.get().exercise().getId())) {
                pairs.put(entry, byId.get());
            }
        }
        for (RestoreEntryJson entry : rest) {
            String key = ExerciseHistoryResolver.identityKey(entry.catalogId(), entry.exerciseName());
            plan.stream()
                .filter(r -> r.group() != null && r.dayIndex() == entry.dayIndex()
                    && !matched.contains(r.exercise().getId())
                    && key.equals(ExerciseHistoryResolver.identityKey(r.exercise())))
                .findFirst()
                .ifPresent(r -> {
                    matched.add(r.exercise().getId());
                    pairs.put(entry, r);
                });
        }
        return pairs;
    }

    private static int orderIndex(ExerciseEntity e) {
        return e.getOrderIndex() == null ? 0 : e.getOrderIndex();
    }
}
