package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.WorkoutExerciseChangeRequest;
import io.mrkuhne.mezo.api.dto.WorkoutExerciseChangeResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mid-workout exercise swap / add (mezo-mobji). Every change creates an INSTANCE-scoped exercise
 * row — today's reality, visible on reload and in the review. "Mezociklusra is" ({@code MESO})
 * additionally writes the template day <em>id-stably</em>: one inserted row tagged
 * {@code addedInWorkoutId} (hidden in this instance) and, for a swap, only the replaced row
 * soft-deleted — never the full-list replace that re-mints every id under a running session.
 * {@link SessionExerciseAssembler} turns the rows into the instance's list.
 */
@Service
@RequiredArgsConstructor
public class WorkoutExerciseChangeService {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;
    private final ClosingBlockService closingBlockService;
    private final WorkoutService workoutService;

    @Transactional
    public WorkoutExerciseChangeResponse change(UUID createdBy, UUID workoutId, WorkoutExerciseChangeRequest req) {
        WorkoutSessionEntity instance = activeInstanceOrThrow(createdBy, workoutId);
        UUID templateId = instance.getTemplateSessionId();
        if (req.getCatalogId() != null && !exerciseCatalogRepository.existsById(req.getCatalogId())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "catalogId").build(), HttpStatus.BAD_REQUEST);
        }
        ExerciseEntity replaced = null;
        if (req.getReplacesExerciseId() != null) {
            replaced = exerciseRepository.findById(req.getReplacesExerciseId())
                .filter(e -> createdBy.equals(e.getCreatedBy())
                    && (templateId.equals(e.getWorkoutSessionId()) || instance.getId().equals(e.getWorkoutSessionId())))
                .orElseThrow(OwnershipGuard::notFound);
        }
        boolean meso = req.getScope() == WorkoutExerciseChangeRequest.ScopeEnum.MESO;
        Set<UUID> closing = closingBlockService.closingCatalogIds();
        if (meso && replaced != null && !hasPlanSlot(replaced, templateId, closing)) {
            throw noPlanSlot();
        }

        List<ExerciseEntity> instanceRows = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(instance.getId()));
        ExerciseEntity row = fromRequest(createdBy, instance.getId(), req);
        row.setReplacesExerciseId(replaced == null ? null : replaced.getId());
        row.setSavedToPlan(meso);
        row.setOrderIndex(instanceRows.size());
        ExerciseEntity saved = exerciseRepository.save(row);

        if (meso) {
            writePlan(createdBy, instance, templateId, req, replaced, closing);
        }
        exerciseRepository.flush(); // the refreshed today payload below reads through native SQL too
        return WorkoutExerciseChangeResponse.builder()
            .exerciseId(saved.getId())
            .today(workoutService.getToday(createdBy, templateId))
            .build();
    }

    /**
     * "Szett hozzáadása → Minden hétre" without the full-list day replace (mezo-mobji): bumps the
     * one template row's working sets, so no id under the running session changes.
     */
    @Transactional
    public void addPlanWorkingSets(UUID createdBy, UUID workoutId, UUID exerciseId, int delta) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        ExerciseEntity e = exerciseRepository.findById(exerciseId)
            .filter(x -> createdBy.equals(x.getCreatedBy()))
            .orElseThrow(OwnershipGuard::notFound);
        if (instance.getId().equals(e.getWorkoutSessionId())) {
            throw noPlanSlot();
        }
        if (!instance.getTemplateSessionId().equals(e.getWorkoutSessionId())) {
            throw OwnershipGuard.notFound();
        }
        if (!hasPlanSlot(e, instance.getTemplateSessionId(), closingBlockService.closingCatalogIds())) {
            throw noPlanSlot();
        }
        e.setWorkingSets(e.getWorkingSets() + delta);
        exerciseRepository.save(e);
    }

    private void writePlan(UUID createdBy, WorkoutSessionEntity instance, UUID templateId,
            WorkoutExerciseChangeRequest req, ExerciseEntity replaced, Set<UUID> closing) {
        ExerciseEntity plan = fromRequest(createdBy, templateId, req);
        plan.setAddedInWorkoutId(instance.getId());
        if (replaced != null) {
            // The plan keeps the slot's prescription shape; only the movement changes.
            plan.setWarmupSets(replaced.getWarmupSets());
            plan.setWorkingSets(replaced.getWorkingSets());
            plan.setRepMin(replaced.getRepMin());
            plan.setRepMax(replaced.getRepMax());
            plan.setTargetRir(replaced.getTargetRir());
            plan.setOrderIndex(replaced.getOrderIndex());
            exerciseRepository.delete(replaced); // soft delete (@SQLDelete) — its logged sets stay
            exerciseRepository.save(plan);
            return;
        }
        List<ExerciseEntity> day = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(templateId));
        Integer at = day.stream()
            .filter(r -> r.getCatalogId() != null && closing.contains(r.getCatalogId()))
            .map(ExerciseEntity::getOrderIndex)
            .findFirst().orElse(null);
        if (at == null) {
            plan.setOrderIndex(day.stream().mapToInt(ExerciseEntity::getOrderIndex).max().orElse(-1) + 1);
        } else {
            // Keep the closing block last: shift it down by one (ids untouched).
            day.stream().filter(r -> r.getOrderIndex() >= at).forEach(r -> r.setOrderIndex(r.getOrderIndex() + 1));
            exerciseRepository.saveAll(day);
            plan.setOrderIndex(at);
        }
        exerciseRepository.save(plan);
    }

    private static boolean hasPlanSlot(ExerciseEntity e, UUID templateId, Set<UUID> closing) {
        return templateId.equals(e.getWorkoutSessionId())
            && (e.getCatalogId() == null || !closing.contains(e.getCatalogId()));
    }

    private static ExerciseEntity fromRequest(UUID createdBy, UUID sessionId, WorkoutExerciseChangeRequest req) {
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(createdBy); // server-side ownership — never from the client
        e.setWorkoutSessionId(sessionId);
        e.setName(req.getName());
        e.setMuscle(req.getMuscle() != null ? req.getMuscle() : "");
        e.setType(req.getType().getValue());
        e.setCatalogId(req.getCatalogId());
        e.setWarmupSets(req.getWarmupSets());
        e.setWorkingSets(req.getWorkingSets());
        e.setRepMin(req.getRepMin());
        e.setRepMax(req.getRepMax());
        e.setTargetRir(req.getTargetRIR());
        e.setCountsTowardVolume(!"plyo".equals(req.getType().getValue())); // mezo-gbo7
        return e;
    }

    private WorkoutSessionEntity ownedInstanceOrThrow(UUID createdBy, UUID workoutId) {
        return workoutSessionRepository.findById(workoutId)
            .filter(s -> createdBy.equals(s.getCreatedBy()) && s.getTemplateSessionId() != null)
            .orElseThrow(OwnershipGuard::notFound);
    }

    private WorkoutSessionEntity activeInstanceOrThrow(UUID createdBy, UUID workoutId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if (!"active".equals(instance.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE").build(), HttpStatus.CONFLICT);
        }
        return instance;
    }

    private static SystemRuntimeErrorException noPlanSlot() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("TRAIN_EXERCISE_NO_PLAN_SLOT").build(), HttpStatus.CONFLICT);
    }
}
