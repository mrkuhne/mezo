package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.WorkoutExerciseChangeRequest;
import io.mrkuhne.mezo.api.dto.WorkoutExerciseChangeResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.ArrayList;
import java.util.Collections;
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
    private final VolumeLedger volumeLedger;
    private final MesocycleRepository mesocycleRepository;
    private final ExerciseStyler styler;
    private final CatalogAttributes catalogAttributes;

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
        UUID mesoId = mesoIdOf(templateId);
        TrainingStyle block = runStyleOf(mesoId);
        ExerciseEntity row = fromRequest(createdBy, instance.getId(), req);
        row.setReplacesExerciseId(replaced == null ? null : replaced.getId());
        row.setSavedToPlan(meso);
        row.setOrderIndex(instanceRows.size());
        style(row, replaced, block);
        ExerciseEntity saved = exerciseRepository.save(row);

        if (meso) {
            writePlan(createdBy, instance, templateId, req, replaced, closing, block);
            volumeLedger.sync(createdBy, mesoId);
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
        volumeLedger.sync(createdBy, mesoIdOf(instance.getTemplateSessionId()));
    }

    /** The run a template day belongs to (null for a custom, meso-less template: sync is then a no-op). */
    private UUID mesoIdOf(UUID templateId) {
        return workoutSessionRepository.findById(templateId)
            .map(WorkoutSessionEntity::getMesocycleId).orElse(null);
    }

    private void writePlan(UUID createdBy, WorkoutSessionEntity instance, UUID templateId,
            WorkoutExerciseChangeRequest req, ExerciseEntity replaced, Set<UUID> closing, TrainingStyle block) {
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
            style(plan, replaced, block);
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
        style(plan, null, block);
        exerciseRepository.save(plan);
    }

    /**
     * Training style on a swapped / added row (mezo-r36n9.79): a swap keeps the slot's style and
     * rest; its overrides only when the movement keeps its identity (same catalog id, else same
     * name) — a different movement drops them. Then the row is re-stamped under the run's style
     * (a no-op for an unstyled run and an unstyled slot).
     */
    private void style(ExerciseEntity row, ExerciseEntity replaced, TrainingStyle block) {
        if (replaced != null) {
            row.setTrainingStyle(replaced.getTrainingStyle());
            row.setRestSec(replaced.getRestSec());
            boolean sameMovement = row.getCatalogId() != null
                ? row.getCatalogId().equals(replaced.getCatalogId())
                : replaced.getCatalogId() == null && row.getName().equals(replaced.getName());
            row.setOverrides(sameMovement && replaced.getOverrides() != null
                ? new ArrayList<>(replaced.getOverrides()) : null);
            keepTechniqueIfAllowed(row, replaced);
        }
        styler.styleRows(List.of(row), List.of(), block);
    }

    /**
     * Technique / challenge on a swapped row (mezo-r36n9.80): kept only when the new movement passes the
     * same {@link TechniqueRules} as a save, otherwise both are cleared (a free movement never inherits
     * the machine-only pick of the one it replaced).
     */
    private void keepTechniqueIfAllowed(ExerciseEntity row, ExerciseEntity replaced) {
        boolean tech = replaced.getTechnique() != null && !"none".equals(replaced.getTechnique());
        if (!tech && !replaced.isChallenge()) {
            return;
        }
        CatalogAttributes.Attrs attrs = catalogAttributes.loadAttrs(Collections.singletonList(row.getCatalogId()))
            .of(row.getCatalogId());
        if (TechniqueRules.check(Technique.fromWire(replaced.getTechnique()), replaced.isChallenge(), attrs).isEmpty()) {
            row.setTechnique(replaced.getTechnique());
            row.setTechniqueSource(replaced.getTechniqueSource());
            row.setChallenge(replaced.isChallenge());
        } else {
            row.setTechnique(null);
            row.setTechniqueSource(null);
            row.setChallenge(false);
        }
    }

    /** The training style of a run; null for a custom template (no run) or an unstyled run. */
    private TrainingStyle runStyleOf(UUID mesoId) {
        return mesoId == null ? null : mesocycleRepository.findById(mesoId)
            .map(m -> TrainingStyle.fromWire(m.getTrainingStyle())).orElse(null);
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
