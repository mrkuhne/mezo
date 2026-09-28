package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * The exercise list of ONE workout instance (mezo-mobji) — pure, shared by {@code getToday} and
 * the review. A mid-workout swap/add is an INSTANCE-scoped row ({@code workout_session_id} = the
 * instance); a "Mezociklusra is" change also writes a template row tagged
 * {@code addedInWorkoutId} = the instance. The rules:
 * <ol>
 *   <li>base = the live template rows minus those added in THIS instance, plus the soft-deleted
 *       rows this instance references (sets, or a swap's target), by {@code orderIndex} (a deleted row first on a
 *       tie — a MESO swap gives the new template row the replaced row's index);</li>
 *   <li>a swap row goes right after the row it replaces; an add goes before the first
 *       closing-block row, else last — instance rows in their own {@code orderIndex} order;</li>
 *   <li>a replaced row drops out when it has no logged working set in this instance, else it
 *       stays with {@code workingSetsOverride} = its logged count and the replacement's name.</li>
 * </ol>
 */
public final class SessionExerciseAssembler {

    /**
     * One exercise as the instance shows it. {@code workingSetsOverride} non-null ⇒ show that many
     * working sets (a swapped-out row keeps only what was logged). {@code changeScope} is
     * {@code TODAY}/{@code MESO} on a row changed in this instance, else null. {@code planSlot}:
     * whether a "Mezociklusra is" change may target it.
     */
    public record Entry(
        ExerciseEntity row,
        Integer workingSetsOverride,
        String replacesName,
        String replacedByName,
        String changeScope,
        boolean planSlot) {}

    private SessionExerciseAssembler() {}

    public static List<Entry> assemble(
            UUID instanceId,
            List<ExerciseEntity> templateRows,
            List<ExerciseEntity> instanceRows,
            List<ExerciseEntity> deletedReferenced,
            Map<UUID, Integer> loggedWorking,
            Set<UUID> closingCatalogIds) {
        List<ExerciseEntity> base = new ArrayList<>();
        for (ExerciseEntity r : templateRows) {
            if (instanceId == null || !instanceId.equals(r.getAddedInWorkoutId())) {
                base.add(r);
            }
        }
        base.addAll(deletedReferenced);
        base.sort(Comparator.comparingInt(ExerciseEntity::getOrderIndex)
            .thenComparing(r -> r.isDeleted() ? 0 : 1));

        List<ExerciseEntity> list = new ArrayList<>(base);
        List<ExerciseEntity> changes = instanceId == null ? List.of() : instanceRows.stream()
            .sorted(Comparator.comparingInt(ExerciseEntity::getOrderIndex))
            .toList();
        Map<UUID, ExerciseEntity> byId = new HashMap<>();
        list.forEach(r -> byId.put(r.getId(), r));
        changes.forEach(r -> byId.put(r.getId(), r));

        for (ExerciseEntity c : changes) {
            int at = indexOf(list, c.getReplacesExerciseId());
            if (at >= 0) {
                list.add(at + 1, c);
                continue;
            }
            int closing = firstClosing(list, closingCatalogIds, instanceId);
            if (closing >= 0) {
                list.add(closing, c);
            } else {
                list.add(c);
            }
        }

        Map<UUID, String> replacedBy = new HashMap<>();
        for (ExerciseEntity c : changes) {
            if (c.getReplacesExerciseId() != null) {
                replacedBy.put(c.getReplacesExerciseId(), c.getName());
            }
        }
        List<Entry> out = new ArrayList<>(list.size());
        for (ExerciseEntity r : list) {
            String by = replacedBy.get(r.getId());
            int logged = loggedWorking.getOrDefault(r.getId(), 0);
            if (by != null && logged == 0) {
                continue; // swapped out before any set — it simply is not part of this workout
            }
            boolean isChange = instanceId != null && instanceId.equals(r.getWorkoutSessionId());
            ExerciseEntity replaced = r.getReplacesExerciseId() == null ? null : byId.get(r.getReplacesExerciseId());
            boolean closing = r.getCatalogId() != null && closingCatalogIds.contains(r.getCatalogId());
            out.add(new Entry(
                r,
                by != null ? logged : null,
                isChange && replaced != null ? replaced.getName() : null,
                by,
                isChange ? (r.isSavedToPlan() ? "MESO" : "TODAY") : null,
                !isChange && !closing && !r.isDeleted() && by == null));
        }
        return out;
    }

    private static int indexOf(List<ExerciseEntity> list, UUID id) {
        if (id == null) {
            return -1;
        }
        for (int i = 0; i < list.size(); i++) {
            if (id.equals(list.get(i).getId())) {
                return i;
            }
        }
        return -1;
    }

    private static int firstClosing(List<ExerciseEntity> list, Set<UUID> closingCatalogIds, UUID instanceId) {
        for (int i = 0; i < list.size(); i++) {
            ExerciseEntity r = list.get(i);
            if (!Objects.equals(instanceId, r.getWorkoutSessionId())
                && r.getCatalogId() != null && closingCatalogIds.contains(r.getCatalogId())) {
                return i;
            }
        }
        return -1;
    }
}
