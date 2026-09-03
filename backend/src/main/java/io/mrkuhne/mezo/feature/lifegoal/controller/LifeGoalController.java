package io.mrkuhne.mezo.feature.lifegoal.controller;

import io.mrkuhne.mezo.api.controller.LifeGoalApi;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarsRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalStatusRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalUpsertRequest;
import io.mrkuhne.mezo.api.dto.SignalCatalogResponse;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalProposeService;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalService;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalSignalService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/life-goals surface (bd mezo-iizd) — thin delegation, ownership from the principal; gated on LIFEGOAL_SWITCH. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalController implements LifeGoalApi {

    private final LifeGoalService lifeGoalService;
    private final LifeGoalProposeService proposeService;
    private final LifeGoalSignalService signalService;
    private final CurrentUserId currentUserId;

    @Override public List<LifeGoalResponse> listLifeGoals() { return lifeGoalService.list(currentUserId.get()); }
    @Override public LifeGoalResponse createLifeGoal(LifeGoalUpsertRequest req) { return lifeGoalService.create(currentUserId.get(), req); }
    @Override public LifeGoalResponse getLifeGoal(UUID id) { return lifeGoalService.get(currentUserId.get(), id); }
    @Override public LifeGoalResponse updateLifeGoal(UUID id, LifeGoalUpsertRequest req) { return lifeGoalService.update(currentUserId.get(), id, req); }
    @Override public void deleteLifeGoal(UUID id) { lifeGoalService.delete(currentUserId.get(), id); }
    @Override public LifeGoalResponse changeLifeGoalStatus(UUID id, LifeGoalStatusRequest req) { return lifeGoalService.changeStatus(currentUserId.get(), id, req.getStatus()); }
    @Override public LifeGoalResponse replaceLifeGoalPillars(UUID id, LifeGoalPillarsRequest req) { return lifeGoalService.replacePillars(currentUserId.get(), id, req.getPillars()); }
    @Override public LifeGoalProposeResponse proposeLifeGoal(LifeGoalProposeRequest req) { return proposeService.propose(currentUserId.get(), req); }
    @Override public SignalCatalogResponse listLifeGoalSignals() { return signalService.catalog(); }
}
