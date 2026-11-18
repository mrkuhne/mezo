package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
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

    /**
     * The history reference of one exercise (mezo-r36n9.79, plan §6.7.1): the working sets of the newest
     * completed instance of the identity trained at the CURRENT rep range if it is at most
     * {@code sameRangeMaxAgeDays} old, else of the newest instance overall. {@code refRepMin/Max} is the
     * chosen instance's trained range; {@code sameRange} is whether it equals the current exercise's range.
     * No history: empty sets, the current range, {@code sameRange = false}.
     */
    public record Reference(List<ExerciseSetEntity> sets, int refRepMin, int refRepMax, boolean sameRange) { }

    public Reference reference(UUID createdBy, ExerciseEntity ex, LocalDate today, int sameRangeMaxAgeDays) {
        String key = identityKey(ex);
        Map<UUID, int[]> rangeByRow = new HashMap<>();
        rangeByRow.put(ex.getId(), new int[] {ex.getRepMin(), ex.getRepMax()});
        for (ExerciseRepository.ExerciseIdentityRow r : exerciseRepository.findIdentityRowsIncludingDeleted(createdBy)) {
            if (key.equals(identityKey(r.getCatalogId(), r.getName()))) {
                rangeByRow.put(r.getId(), new int[] {r.getRepMin(), r.getRepMax()});
            }
        }
        // Query order = newest instance first; sets of one instance are contiguous.
        Map<UUID, List<ExerciseSetEntity>> byInstance = new LinkedHashMap<>();
        Map<UUID, LocalDate> dateByInstance = new HashMap<>();
        for (ExerciseSetRepository.DatedSet d : exerciseSetRepository
                .findCompletedWorkingHistoryDated(createdBy, List.copyOf(rangeByRow.keySet()))) {
            byInstance.computeIfAbsent(d.set().getWorkoutSessionId(), x -> new ArrayList<>()).add(d.set());
            dateByInstance.put(d.set().getWorkoutSessionId(), d.date());
        }
        if (byInstance.isEmpty()) {
            return new Reference(List.of(), ex.getRepMin(), ex.getRepMax(), false);
        }
        List<ExerciseSetEntity> newest = null;
        int[] newestRange = null;
        for (Map.Entry<UUID, List<ExerciseSetEntity>> e : byInstance.entrySet()) {
            int[] range = instanceRange(e.getValue(), rangeByRow);
            if (newest == null) {
                newest = e.getValue();
                newestRange = range;
            }
            boolean same = range[0] == ex.getRepMin() && range[1] == ex.getRepMax();
            LocalDate date = dateByInstance.get(e.getKey());
            if (same && date != null && ChronoUnit.DAYS.between(date, today) <= sameRangeMaxAgeDays) {
                return new Reference(e.getValue(), range[0], range[1], true);
            }
        }
        boolean same = newestRange[0] == ex.getRepMin() && newestRange[1] == ex.getRepMax();
        return new Reference(newest, newestRange[0], newestRange[1], same);
    }

    /** The trained range of an instance: its top working set's snapshot, else the range of the row it was logged on. */
    private static int[] instanceRange(List<ExerciseSetEntity> sets, Map<UUID, int[]> rangeByRow) {
        ExerciseSetEntity top = sets.stream()
            .max(Comparator
                .comparing((ExerciseSetEntity s) -> s.getWeightKg() != null ? s.getWeightKg() : BigDecimal.valueOf(-1))
                .thenComparing(ExerciseSetEntity::getReps))
            .orElseThrow();
        if (top.getTargetRepMin() != null && top.getTargetRepMax() != null) {
            return new int[] {top.getTargetRepMin(), top.getTargetRepMax()};
        }
        return rangeByRow.get(top.getExerciseId());
    }

    /** Records/challenge identity idiom: catalog id when linked, else the exact name. */
    static String identityKey(UUID catalogId, String name) {
        return catalogId != null ? "c:" + catalogId : "n:" + name;
    }

    /** The identity key of one template exercise (per-machine weight memory keys on it, mezo-bk7l2). */
    public static String identityKey(ExerciseEntity ex) {
        return identityKey(ex.getCatalogId(), ex.getName());
    }

    /**
     * Every weight ever logged on this exercise's IDENTITY in a completed instance's working sets
     * (mezo-bk7l2) — proof those weights exist on the machine. Empty when never trained.
     */
    public Set<BigDecimal> workingWeightsEverLogged(UUID createdBy, ExerciseEntity ex) {
        String key = identityKey(ex);
        List<UUID> rows = new ArrayList<>();
        rows.add(ex.getId());
        for (ExerciseRepository.ExerciseIdentityRow r : exerciseRepository.findIdentityRowsIncludingDeleted(createdBy)) {
            if (key.equals(identityKey(r.getCatalogId(), r.getName()))) {
                rows.add(r.getId());
            }
        }
        Set<BigDecimal> out = new HashSet<>();
        for (ExerciseSetEntity s : exerciseSetRepository.findCompletedWorkingHistory(createdBy, rows)) {
            if (s.getWeightKg() != null) {
                out.add(s.getWeightKg());
            }
        }
        return out;
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
