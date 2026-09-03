package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.TrainApi;
import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.CatalogImagesRequest;
import io.mrkuhne.mezo.api.dto.CatalogVideoRequest;
import io.mrkuhne.mezo.api.dto.CustomWorkoutResponse;
import io.mrkuhne.mezo.api.dto.CustomWorkoutUpsertRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.api.dto.ExerciseNoteRequest;
import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.GymScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.GymScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.MedalListResponse;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.api.dto.MesoRerunResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleCloseRequest;
import io.mrkuhne.mezo.api.dto.MesocycleReportResponse;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.MesocycleVolumeArcResponse;
import io.mrkuhne.mezo.api.dto.MusclePrioritiesUpdateRequest;
import io.mrkuhne.mezo.api.dto.RunSessionLogRequest;
import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockUpsertRequest;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.SetUpdateRequest;
import io.mrkuhne.mezo.api.dto.SportEventCreateRequest;
import io.mrkuhne.mezo.api.dto.SportEventResponse;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.SportSessionCreateRequest;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.TimingProfileResponse;
import io.mrkuhne.mezo.api.dto.TimingProfileSamples;
import io.mrkuhne.mezo.api.dto.WorkoutDetailResponse;
import io.mrkuhne.mezo.api.dto.WorkoutFeedbackInput;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutNoteRequest;
import io.mrkuhne.mezo.api.dto.WorkoutSkipRequest;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.api.dto.WorkoutSummaryResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.feature.train.service.EwmaEstimator;
import io.mrkuhne.mezo.feature.train.service.ExerciseCatalogService;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.service.MedalService;
import io.mrkuhne.mezo.feature.train.service.MesoPlanGeneratorService;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateService;
import io.mrkuhne.mezo.feature.train.service.MesocycleReportService;
import io.mrkuhne.mezo.feature.train.service.RunningService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.feature.train.service.TimingObservationExtractor;
import io.mrkuhne.mezo.feature.train.service.TimingProfileService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.VolumeArcService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings come from {@link TrainApi}. */
@RestController
@RequiredArgsConstructor
public class TrainController implements TrainApi {

    private final TrainService service;
    private final MesoTemplateService mesoTemplateService;
    private final MesocycleReportService mesocycleReportService;
    private final WorkoutService workoutService;
    private final SportService sportService;
    private final GymScheduleService gymScheduleService;
    private final ExerciseCatalogService exerciseCatalogService;
    private final ExerciseRecordService exerciseRecordService;
    private final MedalService medalService;
    private final RunningService runningService;
    private final VolumeArcService volumeArcService;
    private final CurrentUserId currentUserId;
    private final CurrentUser currentUser;
    private final MesoPlanGeneratorService mesoPlanGeneratorService;
    private final TimingProfileService timingProfileService;

    @Override
    public List<MesocycleResponse> listMesocycles() {
        return service.listMesocycles(currentUserId.get());
    }

    @Override
    public List<ExerciseCatalogItem> getExerciseCatalog() {
        return exerciseCatalogService.list(currentUser.get());
    }

    @Override
    public ExerciseCatalogItem createExercise(CatalogExerciseCreateRequest catalogExerciseCreateRequest) {
        return exerciseCatalogService.create(currentUser.get(), catalogExerciseCreateRequest);
    }

    @Override
    public ExerciseCatalogItem updateExercise(UUID id, CatalogExerciseCreateRequest catalogExerciseCreateRequest) {
        return exerciseCatalogService.update(currentUser.get(), id, catalogExerciseCreateRequest);
    }

    @Override
    public void deleteExercise(UUID id) {
        exerciseCatalogService.delete(currentUser.get(), id);
    }

    @Override
    public ExerciseCatalogItem setExerciseVideo(UUID id, CatalogVideoRequest catalogVideoRequest) {
        return exerciseCatalogService.setVideo(currentUser.get(), id, catalogVideoRequest.getVideoUrl());
    }

    @Override
    public ExerciseCatalogItem setExerciseImages(UUID id, CatalogImagesRequest catalogImagesRequest) {
        return exerciseCatalogService.setImages(currentUser.get(), id,
            catalogImagesRequest.getImageStartUrl(), catalogImagesRequest.getImageEndUrl());
    }

    @Override
    public List<ExerciseRecordResponse> getExerciseRecords() {
        return exerciseRecordService.list(currentUserId.get());
    }

    @Override
    public MedalListResponse getMedals() {
        return MedalListResponse.builder().medals(medalService.list(currentUserId.get())).build();
    }

    @Override
    public List<SportSessionResponse> listSportSessions(LocalDate from, LocalDate to) {
        return service.listSportSessions(currentUserId.get(), from, to);
    }

    @Override
    public List<MesoTemplateResponse> listMesoTemplates() {
        return mesoTemplateService.list(currentUserId.get());
    }

    @Override
    public MesoPlanGenerateResponse generateMesoPlan(MesoPlanGenerateRequest mesoPlanGenerateRequest) {
        return mesoPlanGeneratorService.generate(currentUserId.get(), mesoPlanGenerateRequest);
    }

    @Override
    public MesoTemplateResponse createMesoTemplate(MesoTemplateUpsertRequest mesoTemplateUpsertRequest) {
        return mesoTemplateService.create(currentUserId.get(), mesoTemplateUpsertRequest);
    }

    @Override
    public MesoTemplateResponse updateMesoTemplate(UUID id, MesoTemplateUpsertRequest mesoTemplateUpsertRequest) {
        return mesoTemplateService.update(currentUserId.get(), id, mesoTemplateUpsertRequest);
    }

    @Override
    public void deleteMesoTemplate(UUID id) {
        mesoTemplateService.delete(currentUserId.get(), id);
    }

    @Override
    public MesocycleResponse startMesoTemplate(UUID id, MesoTemplateStartRequest mesoTemplateStartRequest) {
        return mesoTemplateService.start(currentUserId.get(), id, mesoTemplateStartRequest);
    }

    @Override
    public MesoRerunResponse rerunMesocycle(UUID id) {
        return mesoTemplateService.rerun(currentUserId.get(), id);
    }

    @Override
    public MesocycleResponse activateMesocycle(UUID id) {
        return service.activateMesocycle(currentUserId.get(), id);
    }

    @Override
    public MesocycleResponse updateMesocycleMusclePriorities(
            UUID id, MusclePrioritiesUpdateRequest musclePrioritiesUpdateRequest) {
        return service.updateMusclePriorities(currentUserId.get(), id,
            musclePrioritiesUpdateRequest.getMusclePriorities());
    }

    @Override
    public MesocycleResponse closeMesocycle(UUID id, MesocycleCloseRequest mesocycleCloseRequest) {
        // The body is optional (close without a self-eval note is the common case).
        return service.closeMesocycle(currentUserId.get(), id,
            mesocycleCloseRequest != null ? mesocycleCloseRequest.getSelfEval() : null);
    }

    @Override
    public MesocycleReportResponse getMesocycleReport(UUID id) {
        return mesocycleReportService.getReport(currentUserId.get(), id);
    }

    @Override
    public void regenerateMesocycleReport(UUID id) {
        mesocycleReportService.regenerate(currentUserId.get(), id);
    }

    @Override
    public MesocycleVolumeArcResponse getMesocycleVolumeArc(UUID id) {
        return volumeArcService.arc(currentUserId.get(), id);
    }

    @Override
    public MesoDay replaceDayExercises(UUID id, UUID dayId, List<GymExerciseInput> gymExerciseInput) {
        return service.replaceDayExercises(currentUserId.get(), id, dayId, gymExerciseInput);
    }

    @Override
    public List<CustomWorkoutResponse> listCustomWorkouts() {
        return service.listCustomWorkouts(currentUserId.get());
    }

    @Override
    public CustomWorkoutResponse createCustomWorkout(CustomWorkoutUpsertRequest customWorkoutUpsertRequest) {
        return service.createCustomWorkout(currentUserId.get(), customWorkoutUpsertRequest);
    }

    @Override
    public CustomWorkoutResponse updateCustomWorkout(UUID id, CustomWorkoutUpsertRequest customWorkoutUpsertRequest) {
        return service.updateCustomWorkout(currentUserId.get(), id, customWorkoutUpsertRequest);
    }

    @Override
    public void deleteCustomWorkout(UUID id) {
        service.deleteCustomWorkout(currentUserId.get(), id);
    }

    @Override
    public SportSessionResponse logSportSession(SportSessionCreateRequest sportSessionCreateRequest) {
        return sportService.logSportSession(currentUserId.get(), sportSessionCreateRequest);
    }

    @Override
    public List<SportScheduleSlotResponse> getSportSchedule() {
        return sportService.getSchedule(currentUserId.get());
    }

    @Override
    public List<SportScheduleSlotResponse> replaceSportSchedule(List<SportScheduleSlotInput> sportScheduleSlotInput) {
        return sportService.replaceSchedule(currentUserId.get(), sportScheduleSlotInput);
    }

    @Override
    public List<SportEventResponse> listSportEvents(LocalDate from, LocalDate to) {
        return sportService.listEvents(currentUserId.get(), from, to);
    }

    @Override
    public SportEventResponse createSportEvent(SportEventCreateRequest sportEventCreateRequest) {
        return sportService.createEvent(currentUserId.get(), sportEventCreateRequest);
    }

    @Override
    public void deleteSportEvent(UUID id) {
        sportService.deleteEvent(currentUserId.get(), id);
    }

    @Override
    public List<GymScheduleSlotResponse> getGymSchedule() {
        return gymScheduleService.getSchedule(currentUserId.get());
    }

    @Override
    public List<GymScheduleSlotResponse> putGymSchedule(List<GymScheduleSlotInput> gymScheduleSlotInput) {
        return gymScheduleService.replaceSchedule(currentUserId.get(), gymScheduleSlotInput);
    }

    @Override
    public WorkoutTodayResponse getTodayWorkout(UUID templateSessionId) {
        return workoutService.getToday(currentUserId.get(), templateSessionId);
    }

    @Override
    public List<WorkoutSummaryResponse> listWorkouts(LocalDate from, LocalDate to) {
        return workoutService.listWorkouts(currentUserId.get(), from, to);
    }

    @Override
    public WorkoutDetailResponse getWorkoutDetail(UUID id) {
        return workoutService.getWorkoutDetail(currentUserId.get(), id);
    }

    @Override
    public WorkoutInstanceResponse startWorkout(WorkoutStartRequest workoutStartRequest) {
        return workoutService.startWorkout(currentUserId.get(), workoutStartRequest);
    }

    @Override
    public ExerciseSetResponse logWorkoutSet(UUID id, SetLogRequest setLogRequest) {
        return workoutService.logSet(currentUserId.get(), id, setLogRequest);
    }

    @Override
    public ExerciseSetResponse updateWorkoutSet(UUID id, UUID setId, SetUpdateRequest setUpdateRequest) {
        return workoutService.updateSet(currentUserId.get(), id, setId, setUpdateRequest);
    }

    @Override
    public void deleteWorkoutSet(UUID id, UUID setId) {
        workoutService.deleteSet(currentUserId.get(), id, setId);
    }

    @Override
    public void saveWorkoutFeedback(UUID id, List<WorkoutFeedbackInput> workoutFeedbackInput) {
        workoutService.saveFeedback(currentUserId.get(), id, workoutFeedbackInput);
    }

    @Override
    public void skipWorkoutExercise(UUID id, WorkoutSkipRequest workoutSkipRequest) {
        workoutService.skipExercise(currentUserId.get(), id, workoutSkipRequest.getExerciseId());
    }

    @Override
    public void saveExerciseNote(UUID exerciseId, ExerciseNoteRequest exerciseNoteRequest) {
        workoutService.saveExerciseNote(currentUserId.get(), exerciseId, exerciseNoteRequest.getNote());
    }

    @Override
    public void saveWorkoutNote(UUID id, WorkoutNoteRequest workoutNoteRequest) {
        workoutService.saveClosingNote(currentUserId.get(), id, workoutNoteRequest.getNote());
    }

    @Override
    public WorkoutInstanceResponse finishWorkout(UUID id, WorkoutNoteRequest workoutNoteRequest) {
        // The body is optional, so the generated signature hands us null when none was sent.
        return workoutService.finishWorkout(currentUserId.get(), id,
            workoutNoteRequest != null ? workoutNoteRequest.getNote() : null);
    }

    @Override
    public List<RunningBlockResponse> listRunningBlocks() {
        return runningService.listBlocks(currentUserId.get());
    }

    @Override
    public RunningBlockResponse createRunningBlock(RunningBlockUpsertRequest runningBlockUpsertRequest) {
        return runningService.createBlock(currentUserId.get(), runningBlockUpsertRequest);
    }

    @Override
    public RunningBlockResponse updateRunningBlock(UUID id, RunningBlockUpsertRequest runningBlockUpsertRequest) {
        return runningService.updateBlock(currentUserId.get(), id, runningBlockUpsertRequest);
    }

    @Override
    public void deleteRunningBlock(UUID id) {
        runningService.deleteBlock(currentUserId.get(), id);
    }

    @Override
    public RunningBlockResponse activateRunningBlock(UUID id) {
        return runningService.activateBlock(currentUserId.get(), id);
    }

    @Override
    public RunningBlockResponse closeRunningBlock(UUID id) {
        return runningService.closeBlock(currentUserId.get(), id);
    }

    @Override
    public List<RunSessionLogResponse> listRunSessions() {
        return runningService.listSessions(currentUserId.get());
    }

    @Override
    public RunSessionLogResponse logRunSession(RunSessionLogRequest runSessionLogRequest) {
        return runningService.logSession(currentUserId.get(), runSessionLogRequest);
    }

    @Override
    public TimingProfileResponse getTimingProfile() {
        Map<String, EwmaEstimator.Estimate> profile = timingProfileService.read(currentUserId.get());
        EwmaEstimator.Estimate setCycleCompound = profile.get(TimingObservationExtractor.SET_CYCLE_COMPOUND);
        EwmaEstimator.Estimate setCycleIsolation = profile.get(TimingObservationExtractor.SET_CYCLE_ISOLATION);
        EwmaEstimator.Estimate transition = profile.get(TimingObservationExtractor.TRANSITION);
        EwmaEstimator.Estimate leadIn = profile.get(TimingObservationExtractor.LEAD_IN);
        return TimingProfileResponse.builder()
            .leadInSeconds(BigDecimal.valueOf(leadIn.value()))
            .setCycleCompoundSeconds(BigDecimal.valueOf(setCycleCompound.value()))
            .setCycleIsolationSeconds(BigDecimal.valueOf(setCycleIsolation.value()))
            .transitionSeconds(BigDecimal.valueOf(transition.value()))
            .samples(TimingProfileSamples.builder()
                .leadIn(leadIn.samples())
                .setCycleCompound(setCycleCompound.samples())
                .setCycleIsolation(setCycleIsolation.samples())
                .transition(transition.samples())
                .build())
            .build();
    }
}
