package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.TrainApi;
import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesocycleCreateRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.WorkoutFeedbackInput;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
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
    private final CurrentUserId currentUserId;

    @Override
    public List<MesocycleResponse> listMesocycles() {
        return service.listMesocycles(currentUserId.get());
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
    public WorkoutTodayResponse getTodayWorkout() {
        return workoutService.getToday(currentUserId.get());
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
    public WorkoutInstanceResponse finishWorkout(UUID id) {
        return workoutService.finishWorkout(currentUserId.get(), id);
    }
}
