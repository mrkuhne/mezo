package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseTechniqueUpdateRequest;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The owner's mid-run technique / challenge pick on one run exercise (mezo-r36n9.80): owned run, the
 * exercise belongs to it, the run's block flag is on, then {@link TechniqueRules}. A challenge clears
 * itself from the day's other rows (at most one a day); none + no challenge clears the pick.
 */
@Service
@RequiredArgsConstructor
public class ExerciseTechniqueService {

    public static final String RUN_NOT_EDITABLE = "TRAIN_RUN_NOT_EDITABLE";
    public static final String TECHNIQUES_DISABLED = "TRAIN_TECHNIQUES_DISABLED";

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final CatalogAttributes catalogAttributes;
    private final TrainMapper mapper;

    @Transactional
    public GymExercise update(UUID createdBy, UUID mesoId, UUID exerciseId, ExerciseTechniqueUpdateRequest request) {
        MesocycleEntity meso = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(mesoId), createdBy);
        ExerciseEntity row = exerciseRepository.findById(exerciseId)
            .filter(e -> createdBy.equals(e.getCreatedBy()))
            // Template-day rows only: a row added mid-workout hangs off an instance session (templateSessionId set).
            .filter(e -> workoutSessionRepository.findById(e.getWorkoutSessionId())
                .filter(s -> mesoId.equals(s.getMesocycleId()) && s.getTemplateSessionId() == null).isPresent())
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if ("archived".equals(meso.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error(RUN_NOT_EDITABLE).build(), HttpStatus.CONFLICT);
        }
        if (!meso.isTechniquesEnabled()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error(TECHNIQUES_DISABLED).build(), HttpStatus.CONFLICT);
        }
        Technique technique = Technique.fromWire(mapper.techniqueWire(request.getTechnique()));
        boolean challenge = Boolean.TRUE.equals(request.getChallenge());
        Optional<String> error = TechniqueRules.check(technique, challenge,
            catalogAttributes.loadAttrs(java.util.Collections.singletonList(row.getCatalogId()))
                .of(row.getCatalogId()));
        if (error.isPresent()) {
            throw TechniqueGuard.fail(error.get(), row.getName());
        }
        boolean active = technique != Technique.NONE || challenge;
        row.setTechnique(technique == Technique.NONE ? null : technique.wire());
        row.setTechniqueSource(active ? "owner" : null);
        row.setChallenge(challenge);
        exerciseRepository.save(row);
        if (challenge) {
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                    createdBy, List.of(row.getWorkoutSessionId())).stream()
                .filter(o -> !o.getId().equals(row.getId()) && o.isChallenge())
                .forEach(o -> {
                    o.setChallenge(false);
                    if (o.getTechnique() == null) {
                        o.setTechniqueSource(null);
                    }
                    exerciseRepository.save(o);
                });
        }
        return mapper.toGymExercise(row);
    }
}
