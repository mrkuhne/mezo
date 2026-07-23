package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.TrainApi;
import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
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
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesocycleCreateRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.RunSessionLogRequest;
import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockUpsertRequest;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.SportSessionCreateRequest;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.WorkoutDetailResponse;
import io.mrkuhne.mezo.api.dto.WorkoutFeedbackInput;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutSkipRequest;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.api.dto.WorkoutSummaryResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.service.ExerciseCatalogService;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.service.RunningService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings come from {@link TrainApi}. */
@RestController
@RequiredArgsConstructor
public class TrainController implements TrainApi {

    private final TrainService service;
    private final WorkoutService workoutService;
    private final SportService sportService;
    private final GymScheduleService gymScheduleService;
    private final ExerciseCatalogService exerciseCatalogService;
    private final ExerciseRecordService exerciseRecordService;
    private final RunningService runningService;
    private final CurrentUserId currentUserId;

    @Override
    public List<MesocycleResponse> listMesocycles() {
        return service.listMesocycles(currentUserId.get());
    }

    @Override
    public List<ExerciseCatalogItem> getExerciseCatalog() {
        return exerciseCatalogService.list(currentUserId.get());
    }

    @Override
    public ExerciseCatalogItem createExercise(CatalogExerciseCreateRequest catalogExerciseCreateRequest) {
        return exerciseCatalogService.create(currentUserId.get(), catalogExerciseCreateRequest);
    }

    @Override
    public ExerciseCatalogItem updateExercise(UUID id, CatalogExerciseCreateRequest catalogExerciseCreateRequest) {
        return exerciseCatalogService.update(currentUserId.get(), id, catalogExerciseCreateRequest);
    }

    @Override
    public void deleteExercise(UUID id) {
        exerciseCatalogService.delete(currentUserId.get(), id);
    }

    @Override
    public ExerciseCatalogItem setExerciseVideo(UUID id, CatalogVideoRequest catalogVideoRequest) {
        return exerciseCatalogService.setVideo(currentUserId.get(), id, catalogVideoRequest.getVideoUrl());
    }

    @Override
    public List<ExerciseRecordResponse> getExerciseRecords() {
        return exerciseRecordService.list(currentUserId.get());
    }

    @Override
    public List<SportSessionResponse> listSportSessions() {
        return service.listSportSessions(currentUserId.get());
    }

    @Override
    public MesocycleResponse createMesocycle(MesocycleCreateRequest mesocycleCreateRequest) {
        return service.createMesocycle(currentUserId.get(), mesocycleCreateRequest);
    }

    @Override
    public MesocycleResponse activateMesocycle(UUID id) {
        return service.activateMesocycle(currentUserId.get(), id);
    }

    @Override
    public MesocycleResponse closeMesocycle(UUID id) {
        return service.closeMesocycle(currentUserId.get(), id);
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
    public WorkoutInstanceResponse finishWorkout(UUID id) {
        return workoutService.finishWorkout(currentUserId.get(), id);
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
}
