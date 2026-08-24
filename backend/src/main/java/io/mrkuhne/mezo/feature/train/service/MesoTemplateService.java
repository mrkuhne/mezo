package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.MesoRerunResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.MesoDayJson;
import io.mrkuhne.mezo.feature.train.entity.json.VolumeBaselineJson;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoTemplateRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Meso TEMPLATE (plan document) service — the write half of the template/run split (mezo-meyc.1).
 * A {@code meso_template} row is the reusable blueprint the wizard saves; a {@code mesocycle} is
 * one RUN stamped from it, so:
 *
 * <ul>
 *   <li>{@link #create}/{@link #update} persist the whole plan as typed jsonb ({@code days},
 *       {@code volumePerMuscle}) — an update is a FULL replace, like the day-exercise PUT;</li>
 *   <li>{@link #delete} soft-deletes, so runs already started from the template survive intact;</li>
 *   <li>{@link #start} hands the plan to {@link TrainService#stampRun} to materialize a run;</li>
 *   <li>{@link #rerun} is the legacy bridge: a run born before the split has no template, so its
 *       own rows are folded back into one, linked onto the run and returned for a fresh start.</li>
 * </ul>
 *
 * <p>All finders are scoped by {@code createdBy}; a missing and a foreign template are both a 404
 * ({@code TRAIN_MESO_TEMPLATE_NOT_FOUND}). Per house rule only the write methods carry
 * method-level {@code @Transactional}.
 */
@Service
@RequiredArgsConstructor
public class MesoTemplateService {

    /** Baseline label for a materialized landmark whose run row carried no provenance baseline. */
    private static final String INHERITED_BASELINE_NAME = "Örökölt kiindulás";

    private final MesoTemplateRepository templateRepository;
    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final TrainService trainService;
    private final TrainMapper mapper;

    /** The owner's templates, oldest first, each carrying how many runs were started from it. */
    public List<MesoTemplateResponse> list(UUID createdBy) {
        return templateRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtAsc(createdBy)
            .stream().map(this::toResponse).toList();
    }

    @Transactional
    public MesoTemplateResponse create(UUID createdBy, MesoTemplateUpsertRequest req) {
        MesoTemplateEntity template = new MesoTemplateEntity();
        template.setCreatedBy(createdBy); // server-side ownership — never from the client
        applyUpsert(template, req);
        return toResponse(templateRepository.save(template));
    }

    @Transactional
    public MesoTemplateResponse update(UUID createdBy, UUID id, MesoTemplateUpsertRequest req) {
        MesoTemplateEntity template = ownedTemplateOrThrow(createdBy, id);
        applyUpsert(template, req);
        return toResponse(templateRepository.save(template));
    }

    @Transactional
    public void delete(UUID createdBy, UUID id) {
        // Soft delete (@SQLDelete): runs stamped from this template keep pointing at a real row.
        templateRepository.delete(ownedTemplateOrThrow(createdBy, id));
    }

    /** Stamps a mesocycle RUN from the stored plan on the requested date/status. */
    @Transactional
    public MesocycleResponse start(UUID createdBy, UUID templateId, MesoTemplateStartRequest req) {
        MesoTemplateEntity t = ownedTemplateOrThrow(createdBy, templateId);
        return trainService.stampRun(createdBy, new TrainService.StampSource(
            t.getId(), t.getTitle(), t.getShortTitle(), t.getGoal(), t.getGoalPreset(), req.getStartDate(),
            t.getWeeks(), t.getSplit(), t.getStyle(), t.getPhaseCurve(), t.getNotes(), req.getStatus().getValue(),
            mapper.toDayInputs(t.getDays()), mapper.toBaselines(t.getVolumePerMuscle())));
    }

    /**
     * The template a run can be re-started from. A run created since the split already carries its
     * {@code templateId}; a legacy one gets a template materialized out of its own rows (metadata +
     * template days/exercises + volume-log landmarks) and linked back, so the answer is stable
     * across repeated calls.
     */
    @Transactional
    public MesoRerunResponse rerun(UUID createdBy, UUID mesocycleId) {
        MesocycleEntity run = OwnershipGuard.ownedOrThrow(
            mesocycleRepository.findById(mesocycleId), createdBy);
        if (run.getTemplateId() != null) {
            return MesoRerunResponse.builder().templateId(run.getTemplateId()).build();
        }

        MesoTemplateEntity template = new MesoTemplateEntity();
        template.setCreatedBy(createdBy);
        template.setTitle(run.getTitle());
        template.setShortTitle(run.getShortTitle());
        template.setGoal(run.getGoal());
        template.setGoalPreset(run.getGoalPreset());
        template.setWeeks(run.getWeeks());
        template.setSplit(run.getSplit());
        template.setStyle(run.getStyle());
        template.setPhaseCurve(List.copyOf(run.getPhaseCurve()));
        template.setNotes(run.getNotes());
        template.setDays(daysOf(createdBy, run.getId()));
        template.setVolumePerMuscle(baselinesOf(createdBy, run.getId()));
        MesoTemplateEntity saved = templateRepository.save(template);

        run.setTemplateId(saved.getId()); // dirty-checked link-back — one legacy run, one template
        return MesoRerunResponse.builder().templateId(saved.getId()).build();
    }

    /** Ownership gate: a missing row and a foreign row are indistinguishable to the caller (404). */
    MesoTemplateEntity ownedTemplateOrThrow(UUID createdBy, UUID id) {
        return templateRepository.findByIdAndCreatedByAndDeletedFalse(id, createdBy)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_MESO_TEMPLATE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    /** Full replace of the plan document — every field comes from the request, nothing is merged. */
    private void applyUpsert(MesoTemplateEntity template, MesoTemplateUpsertRequest req) {
        template.setTitle(req.getTitle());
        template.setShortTitle(req.getShortTitle());
        template.setGoal(req.getGoal());
        template.setGoalPreset(req.getGoalPreset());
        template.setWeeks(req.getWeeks());
        template.setSplit(req.getSplit());
        template.setStyle(req.getStyle());
        template.setPhaseCurve(req.getPhaseCurve().stream()
            .map(MesoTemplateUpsertRequest.PhaseCurveEnum::getValue).toList());
        template.setNotes(req.getNotes());
        template.setDays(mapper.toDaysJson(req.getDays() != null ? req.getDays() : List.of()));
        template.setVolumePerMuscle(mapper.toBaselinesJson(req.getVolumePerMuscle()));
    }

    private MesoTemplateResponse toResponse(MesoTemplateEntity template) {
        MesoTemplateResponse response = mapper.toTemplateResponse(template);
        response.setRunCount((int) mesocycleRepository
            .countByTemplateIdAndCreatedByAndDeletedFalse(template.getId(), template.getCreatedBy()));
        return response;
    }

    /** The run's TEMPLATE days (instances carry a templateSessionId) folded back into the plan jsonb. */
    private List<MesoDayJson> daysOf(UUID createdBy, UUID mesocycleId) {
        List<WorkoutSessionEntity> days = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesocycleId))
            .stream().filter(s -> s.getTemplateSessionId() == null).toList();
        if (days.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<ExerciseEntity>> exercisesByDay = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, days.stream().map(WorkoutSessionEntity::getId).toList())
            .stream().collect(Collectors.groupingBy(ExerciseEntity::getWorkoutSessionId));
        return days.stream()
            .map(d -> new MesoDayJson(d.getDayLabel(), d.getType(), d.getMuscle(), d.isMuscleAccent(),
                d.getNote(), mapper.toExercisesJson(exercisesByDay.getOrDefault(d.getId(), List.of()))))
            .toList();
    }

    /**
     * The run's per-muscle landmarks as the plan's baseline: the CURRENT MEV/MAV/MRV of each
     * volume-log row (what the run actually trained on), named after its provenance baseline —
     * or {@link #INHERITED_BASELINE_NAME} when that row carries none, since {@code VolumeBaseline
     * .name} is contract-required and the name is copied on into every future run's provenance.
     */
    private Map<String, VolumeBaselineJson> baselinesOf(UUID createdBy, UUID mesocycleId) {
        Map<String, VolumeBaselineJson> baselines = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(mesocycleId))
            .stream()
            .collect(Collectors.toMap(MuscleGroupVolumeLogEntity::getMuscle,
                v -> new VolumeBaselineJson(baselineName(v), v.getMev(), v.getMav(), v.getMrv()),
                (a, b) -> a, LinkedHashMap::new));
        return baselines.isEmpty() ? null : baselines;
    }

    private String baselineName(MuscleGroupVolumeLogEntity row) {
        ProvenanceEnvelope source = row.getSource();
        String name = source != null && source.baseline() != null ? source.baseline().name() : null;
        return name != null ? name : INHERITED_BASELINE_NAME;
    }
}
