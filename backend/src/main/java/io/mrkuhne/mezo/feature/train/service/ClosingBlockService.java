package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.ClosingBlockProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fix zárás (mezo-z2ul) — ensures the configured closing exercises ({@code mezo.closing-block})
 * exist at the END of every template day of a mesocycle. Lazy + idempotent: invoked from
 * {@code WorkoutService.getToday} when the {@code ClosingBlockGate} bean is present. A day already
 * containing a closing exercise (matched by catalog id OR case-insensitive name, so manually added
 * copies count) is left untouched; empty template days (rest days) are skipped so the closing block
 * never turns a rest day into a workout. The appended rows are ordinary template exercises —
 * logging, records and history work unchanged, and a day-edit that removes them self-heals on the
 * next getToday.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ClosingBlockService {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;
    private final ClosingBlockProperties properties;

    @Transactional
    public void ensureClosingExercises(UUID createdBy, UUID mesocycleId) {
        List<Resolved> resolved = resolveConfigured();
        if (resolved.isEmpty()) {
            return;
        }
        List<WorkoutSessionEntity> templateDays = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesocycleId))
            .stream()
            .filter(s -> s.getTemplateSessionId() == null)
            .toList();
        if (templateDays.isEmpty()) {
            return;
        }
        Map<UUID, List<ExerciseEntity>> bySession = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, templateDays.stream().map(WorkoutSessionEntity::getId).toList())
            .stream()
            .collect(Collectors.groupingBy(ExerciseEntity::getWorkoutSessionId));

        List<ExerciseEntity> toInsert = new ArrayList<>();
        for (WorkoutSessionEntity day : templateDays) {
            List<ExerciseEntity> existing = bySession.getOrDefault(day.getId(), List.of());
            if (existing.isEmpty()) {
                continue; // rest day — never turned into a workout by the closing block
            }
            Set<UUID> presentCatalogIds = existing.stream()
                .map(ExerciseEntity::getCatalogId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
            Set<String> presentNames = existing.stream()
                .map(e -> e.getName().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
            int next = existing.stream().mapToInt(ExerciseEntity::getOrderIndex).max().orElse(-1) + 1;
            for (Resolved r : resolved) {
                boolean present = presentCatalogIds.contains(r.catalog().getId())
                    || presentNames.contains(r.catalog().getName().toLowerCase(Locale.ROOT));
                if (!present) {
                    toInsert.add(closingExercise(createdBy, day.getId(), r, next++));
                }
            }
        }
        if (!toInsert.isEmpty()) {
            exerciseRepository.saveAll(toInsert);
            log.info("closing-block: appended {} closing exercise(s) across {} template day(s)",
                toInsert.size(), toInsert.stream().map(ExerciseEntity::getWorkoutSessionId).distinct().count());
        }
    }

    /** Config slugs → catalog rows; a missing slug is a content/config drift: warn + skip, never 500. */
    private List<Resolved> resolveConfigured() {
        List<Resolved> resolved = new ArrayList<>();
        for (ClosingBlockProperties.ClosingExercise c : properties.exercises()) {
            exerciseCatalogRepository.findBySlug(c.slug()).ifPresentOrElse(
                cat -> resolved.add(new Resolved(c, cat)),
                () -> log.warn("closing-block: catalog slug '{}' not found — skipping", c.slug()));
        }
        return resolved;
    }

    private ExerciseEntity closingExercise(UUID createdBy, UUID dayId, Resolved r, int orderIndex) {
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(createdBy); // server-side ownership — never from the client
        e.setWorkoutSessionId(dayId);
        e.setName(r.catalog().getName());
        e.setMuscle(r.catalog().getMuscle());
        e.setType(r.catalog().getType());
        e.setCatalogId(r.catalog().getId());
        e.setWarmupSets(0);
        e.setWorkingSets(r.config().workingSets());
        e.setRepMin(r.config().repMin());
        e.setRepMax(r.config().repMax());
        e.setTargetRir(r.config().targetRir());
        e.setOrderIndex(orderIndex);
        return e;
    }

    private record Resolved(ClosingBlockProperties.ClosingExercise config, ExerciseCatalogEntity catalog) {}
}
