package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.TrainApi;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesocycleCreateRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.feature.train.service.TrainService;
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
    private final CurrentUserId currentUserId;

    @Override
    public List<MesocycleResponse> listMesocycles() {
        return service.listMesocycles(currentUserId.get());
    }

    @Override
    public List<SportSessionResponse> listSportSessions() {
        return service.listSportSessions(currentUserId.get());
    }

    // Contract-first stubs: the interface landed with the T1 contract commit; the
    // real service delegations replace these in the create/lifecycle/replace tasks
    // of the same branch (mezo-696). Nothing calls them until the FE is wired.
    @Override
    public MesocycleResponse createMesocycle(MesocycleCreateRequest mesocycleCreateRequest) {
        throw new UnsupportedOperationException("mezo-696: implemented in the create task");
    }

    @Override
    public MesocycleResponse activateMesocycle(UUID id) {
        throw new UnsupportedOperationException("mezo-696: implemented in the lifecycle task");
    }

    @Override
    public MesocycleResponse closeMesocycle(UUID id) {
        throw new UnsupportedOperationException("mezo-696: implemented in the lifecycle task");
    }

    @Override
    public MesoDay replaceDayExercises(UUID id, UUID dayId, List<GymExerciseInput> gymExerciseInput) {
        throw new UnsupportedOperationException("mezo-696: implemented in the replace task");
    }
}
