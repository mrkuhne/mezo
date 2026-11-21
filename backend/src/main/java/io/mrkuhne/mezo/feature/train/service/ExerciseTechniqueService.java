package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseTechniqueUpdateRequest;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
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
 * itself from the day's other rows (at most one a day); none + no challenge clears the pick. Clearing or replacing
 * a planner technique (mezo-r36n9.81) gives back the straight set it replaced while the caps allow.
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
    private final ExerciseStyler styler;
    private final VolumeProperties volumeProps;
    private final TrainTechniqueProperties techniqueProps;
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
        CatalogAttributes.AttrsLookup attrs =
            catalogAttributes.loadAttrs(java.util.Collections.singletonList(row.getCatalogId()));
        Optional<String> error = TechniqueRules.check(technique, challenge, attrs.of(row.getCatalogId()));
        if (error.isPresent()) {
            throw TechniqueGuard.fail(error.get(), row.getName());
        }
        // T2/T3 seam (mezo-r36n9.81): a planner technique replaced one straight set; when he clears or replaces it,
        // the set comes back while the caps allow (as the weekly proposal's removal line does)
        Technique stored = Technique.fromWire(row.getTechnique());
        boolean plannerTechniqueGoes = TechniqueLines.machine(row.getTechniqueSource())
            && stored != Technique.NONE && technique != stored;
        if (plannerTechniqueGoes && givesSetBack(createdBy, meso, row, attrs, technique, challenge)) {
            row.setWorkingSets(row.getWorkingSets() + 1);
        }
        boolean active = technique != Technique.NONE || challenge;
        row.setTechnique(technique == Technique.NONE ? null : technique.wire());
        row.setTechniqueSource(active ? "owner" : null);
        row.setChallenge(challenge);
        styler.pinRestPause(row); // rest-pause makes the whole exercise 20 reps (mezo-r36n9.125)
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

    /**
     * The straight set a planner technique replaced may come back: never on an all-out row; the row's cap weight
     * after (one more set, plus the technique set's extra while it still carries a technique or challenge) within
     * the exercise cap, and with the day's other counting rows of its group within the session cap.
     */
    private boolean givesSetBack(UUID createdBy, MesocycleEntity meso, ExerciseEntity row,
                                 CatalogAttributes.AttrsLookup attrs, Technique technique, boolean challenge) {
        if (row.getWorkingSets() == null) {
            return false;
        }
        io.mrkuhne.mezo.api.dto.TrainingStyle style = styler.effective(row.getTrainingStyle(), row.getType(),
            row.getCatalogId(), TrainingStyle.fromWire(meso.getTrainingStyle()),
            TechniquePlanService.stabilityOf(attrs), row.isCountsTowardVolume());
        if (style != null && TrainingStyle.fromWire(style.getValue()) == TrainingStyle.ALLOUT) {
            return false;
        }
        int capWeight = techniqueProps.capWeight();
        int weightAfter = row.getWorkingSets() + 1
            + TechniqueRules.capExtra(technique, challenge, true, capWeight);
        if (weightAfter > volumeProps.bands().exerciseCap()) {
            return false;
        }
        String group = row.getMuscle() == null || row.getMuscle().isBlank() ? null : MuscleGroup.of(row.getMuscle());
        if (group == null) {
            return true;
        }
        int dayWeight = weightAfter;
        for (ExerciseEntity o : exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, List.of(row.getWorkoutSessionId()))) {
            if (o.getId().equals(row.getId()) || !o.isCountsTowardVolume() || o.getMuscle() == null
                    || o.getMuscle().isBlank() || !group.equals(MuscleGroup.of(o.getMuscle()))) {
                continue;
            }
            // a challenge moving here leaves its old row this same request
            boolean otherChallenge = o.isChallenge() && !challenge;
            dayWeight += (o.getWorkingSets() == null ? 0 : o.getWorkingSets())
                + TechniqueRules.capExtra(Technique.fromWire(o.getTechnique()), otherChallenge, true, capWeight);
        }
        return dayWeight <= volumeProps.bands().sessionCap();
    }
}
