package io.mrkuhne.mezo.feature.biometrics.weight.service;

import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.mapper.WeightLogMapper;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WeightLogService {

    private static final String STATUS_ACTIVE = "active";

    private final WeightLogRepository repository;
    private final WeightLogMapper mapper;
    private final GoalRepository goalRepository;
    private final GoalEngineService goalEngineService;

    public List<WeightLogResponse> list(UUID createdBy) {
        return repository.findAllOwned(createdBy).stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public WeightLogResponse log(UUID createdBy, LogWeightRequest req) {
        WeightLogEntity e = new WeightLogEntity();
        e.setCreatedBy(createdBy); // server-side from principal, never from client
        e.setDate(req.getDate());
        e.setWeightKg(req.getWeightKg());
        e.setNote(req.getNote());
        WeightLogResponse resp = mapper.toResponse(repository.save(e));
        // The spine moved (G5 trigger): recompute the owner's ACTIVE goal so its prescription
        // reflects the new weight trend. The G1 lifecycle enforces at most one active goal; if there
        // is none, skip gracefully — a weigh-in must never depend on having a goal.
        recomputeActiveGoal(createdBy);
        return resp;
    }

    /** Recompute the owner's single active goal (if any) — no-op when none is active. */
    private void recomputeActiveGoal(UUID createdBy) {
        List<GoalEntity> active =
            goalRepository.findByCreatedByAndStatusAndDeletedFalse(createdBy, STATUS_ACTIVE);
        if (active.isEmpty()) {
            return; // no relevant goal → nothing to recompute
        }
        goalEngineService.evaluate(createdBy, active.get(0).getId());
    }
}
