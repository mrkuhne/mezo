package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.mapper.GoalMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Goal CRUD. Lifecycle (activate/archive + the single-active invariant) is owned by a separate
 * service/endpoint, so {@code createGoal} fixes {@code status=planned} and {@code updateGoal}
 * deliberately never touches {@code status}.
 */
@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final GoalMapper goalMapper;

    /** Active goal first, then by start date desc (DB ordering, service hoists active). */
    public List<GoalResponse> listGoals(UUID userId) {
        return goalRepository.findByCreatedByAndDeletedFalseOrderByStartDateDesc(userId).stream()
            .sorted(Comparator.comparing((GoalEntity g) -> !"active".equals(g.getStatus())))
            .map(goalMapper::toResponse)
            .toList();
    }

    public GoalResponse getGoal(UUID userId, UUID id) {
        return goalMapper.toResponse(requireOwned(userId, id));
    }

    @Transactional
    public GoalResponse createGoal(UUID userId, GoalUpsertRequest req) {
        GoalEntity e = new GoalEntity();
        e.setCreatedBy(userId);   // server-side ownership — never from the client
        e.setStatus("planned");
        applyUpsert(e, req);
        return goalMapper.toResponse(goalRepository.save(e));
    }

    @Transactional
    public GoalResponse updateGoal(UUID userId, UUID id, GoalUpsertRequest req) {
        GoalEntity e = requireOwned(userId, id);
        applyUpsert(e, req);   // status is NOT touched here (lifecycle endpoints own it)
        return goalMapper.toResponse(e);
    }

    @Transactional
    public void deleteGoal(UUID userId, UUID id) {
        goalRepository.delete(requireOwned(userId, id)); // @SQLDelete soft-deletes
    }

    private void applyUpsert(GoalEntity e, GoalUpsertRequest req) {
        e.setTitle(req.getTitle());
        e.setTrajectory(req.getTrajectory());
        e.setGuards(req.getGuards() == null ? List.of() : req.getGuards());
        e.setStartDate(req.getStartDate());
        e.setTargetDate(req.getTargetDate());
        e.setStartWeightKg(req.getStartWeightKg());
        e.setTargetWeightKg(req.getTargetWeightKg());
        e.setRateTargetPctPerWeek(req.getRateTargetPctPerWeek());
        e.setIdentityFrame(req.getIdentityFrame());
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private GoalEntity requireOwned(UUID userId, UUID id) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
