package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalStatus;
import io.mrkuhne.mezo.api.dto.LifeGoalUpsertRequest;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.mapper.LifeGoalMapper;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Life-goal CRUD + lifecycle (spec §4, D7): draft→active, active⇄parked, active/parked→done|archived,
 * done→archived. NO active-count cap. Ownership from the principal; foreign/missing rows are 404.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalService {

    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
        "draft", Set.of("active", "archived"),
        "active", Set.of("parked", "done", "archived"),
        "parked", Set.of("active", "done", "archived"),
        "done", Set.of("archived"),
        "archived", Set.of());

    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;
    private final LifeGoalPillarService pillarService;
    private final LifeGoalMapper mapper;

    @Transactional(readOnly = true)
    public List<LifeGoalResponse> list(UUID userId) {
        List<LifeGoalEntity> goals = goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId);
        Map<UUID, List<LifeGoalPillarEntity>> byGoal = goals.isEmpty() ? Map.of()
            : pillarRepository.findByGoalIdInAndDeletedFalseOrderByPositionAsc(goals.stream().map(LifeGoalEntity::getId).toList())
                .stream().collect(Collectors.groupingBy(LifeGoalPillarEntity::getGoalId));
        return goals.stream().map(g -> mapper.toResponse(g, byGoal.getOrDefault(g.getId(), List.of()))).toList();
    }

    @Transactional(readOnly = true)
    public LifeGoalResponse get(UUID userId, UUID id) {
        LifeGoalEntity g = requireOwned(userId, id);
        return mapper.toResponse(g, pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(id));
    }

    @Transactional
    public LifeGoalResponse create(UUID userId, LifeGoalUpsertRequest req) {
        validateWindow(req);
        LifeGoalEntity g = new LifeGoalEntity();
        g.setCreatedBy(userId);   // server-side ownership — never from the client
        g.setStatus("draft");
        apply(g, req);
        LifeGoalEntity saved = goalRepository.saveAndFlush(g);
        List<LifeGoalPillarEntity> pillars = pillarService.replace(saved, req.getPillars());
        return mapper.toResponse(saved, pillars);
    }

    @Transactional
    public LifeGoalResponse update(UUID userId, UUID id, LifeGoalUpsertRequest req) {
        validateWindow(req);
        LifeGoalEntity g = requireOwned(userId, id);
        apply(g, req);   // status + pillars are NOT touched here (their endpoints own them)
        return mapper.toResponse(g, pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(id));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        LifeGoalEntity g = requireOwned(userId, id);
        pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(id).forEach(pillarRepository::delete);
        goalRepository.delete(g);
    }

    @Transactional
    public LifeGoalResponse changeStatus(UUID userId, UUID id, LifeGoalStatus target) {
        LifeGoalEntity g = requireOwned(userId, id);
        String to = target.getValue();
        if (!TRANSITIONS.getOrDefault(g.getStatus(), Set.of()).contains(to)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("LIFE_GOAL_INVALID_STATUS_TRANSITION").build(), HttpStatus.CONFLICT);
        }
        g.setStatus(to);
        if ("active".equals(to) && g.getActivatedAt() == null) g.setActivatedAt(Instant.now());
        if ("done".equals(to) || "archived".equals(to)) g.setClosedAt(Instant.now());
        return mapper.toResponse(g, pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(id));
    }

    @Transactional
    public LifeGoalResponse replacePillars(UUID userId, UUID id, List<LifeGoalPillarInput> inputs) {
        LifeGoalEntity g = requireOwned(userId, id);
        return mapper.toResponse(g, pillarService.replace(g, inputs));
    }

    private void apply(LifeGoalEntity g, LifeGoalUpsertRequest req) {
        g.setTitle(req.getTitle());
        g.setWhyText(req.getWhyText());
        g.setFrame(req.getFrame() == null ? "unset" : req.getFrame().getValue());
        g.setDimension(req.getDimension().getValue());
        g.setSecondaryDimension(req.getSecondaryDimension() == null ? null : req.getSecondaryDimension().getValue());
        g.setStartDate(req.getStartDate());
        g.setTargetDate(req.getTargetDate());
        g.setObstacleText(req.getObstacleText());
        g.setIfThenPlans(req.getIfThenPlans() == null ? List.of()
            : req.getIfThenPlans().stream().map(mapper::toPlanJson).toList());
    }

    private static void validateWindow(LifeGoalUpsertRequest req) {
        if (req.getTargetDate() != null && req.getTargetDate().isBefore(req.getStartDate())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "targetDate").build(), HttpStatus.BAD_REQUEST);
        }
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    LifeGoalEntity requireOwned(UUID userId, UUID id) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
