package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Identity-based exercise history (mezo-eq4w): a day edit ({@code replaceDayExercises})
 * soft-deletes and re-inserts the template rows, so ROW-scoped history reads saw a
 * "first session" after every edit — the recommendation engine lost its double-progression
 * base and the "múlt hét" reference vanished. This resolver applies the records/challenge
 * identity idiom (catalog id, else exact name; soft-deleted rows included via
 * {@link ExerciseRepository#findIdentityRowsIncludingDeleted}) to find each CURRENT
 * exercise's most recent COMPLETED-instance working sets, wherever its identity was
 * trained (pre-edit rows, other meso days, custom/saját workouts).
 */
@Service
@RequiredArgsConstructor
public class ExerciseHistoryResolver {

    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;

    /** Records/challenge identity idiom: catalog id when linked, else the exact name. */
    private static String identityKey(UUID catalogId, String name) {
        return catalogId != null ? "c:" + catalogId : "n:" + name;
    }

    /**
     * Per CURRENT template exercise row id: the WORKING sets (non-skipped, reps logged) of the
     * most recent COMPLETED instance in which the exercise's identity was trained. Exercises
     * with no history anywhere map to an empty list — never null.
     */
    public Map<UUID, List<ExerciseSetEntity>> latestCompletedWorkingSets(
            UUID createdBy, List<ExerciseEntity> exercises) {
        if (exercises.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> keyByRow = exerciseRepository.findIdentityRowsIncludingDeleted(createdBy)
            .stream()
            .collect(Collectors.toMap(ExerciseRepository.ExerciseIdentityRow::getId,
                r -> identityKey(r.getCatalogId(), r.getName())));
        Map<String, List<UUID>> rowsByKey = new HashMap<>();
        keyByRow.forEach((id, k) -> rowsByKey.computeIfAbsent(k, x -> new ArrayList<>()).add(id));

        Set<UUID> wanted = new HashSet<>();
        for (ExerciseEntity ex : exercises) {
            wanted.add(ex.getId());
            wanted.addAll(rowsByKey.getOrDefault(identityKey(ex.getCatalogId(), ex.getName()), List.of()));
        }
        // Newest instance first (query order) — keep only each identity's FIRST instance's sets.
        Map<String, UUID> newestInstanceByKey = new HashMap<>();
        Map<String, List<ExerciseSetEntity>> setsByKey = new HashMap<>();
        for (ExerciseSetEntity s : exerciseSetRepository
                .findCompletedWorkingHistory(createdBy, List.copyOf(wanted))) {
            String k = keyByRow.get(s.getExerciseId());
            if (k == null) {
                continue;
            }
            UUID newest = newestInstanceByKey.computeIfAbsent(k, x -> s.getWorkoutSessionId());
            if (newest.equals(s.getWorkoutSessionId())) {
                setsByKey.computeIfAbsent(k, x -> new ArrayList<>()).add(s);
            }
        }
        Map<UUID, List<ExerciseSetEntity>> out = new HashMap<>();
        for (ExerciseEntity ex : exercises) {
            out.put(ex.getId(),
                setsByKey.getOrDefault(identityKey(ex.getCatalogId(), ex.getName()), List.of()));
        }
        return out;
    }
}
