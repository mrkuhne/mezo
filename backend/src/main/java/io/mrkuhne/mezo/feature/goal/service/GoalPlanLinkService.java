package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalPlanAttachRequest;
import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalPlanRef;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.mapper.GoalPlanLinkMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Positions an owned plan ({@code mesocycle|running_block}) on a goal's timeline. {@code attachPlan}
 * derives {@code endWeek} from the referenced plan's own {@code weeks} (never trusted from the
 * request) and resolves a display {@link GoalPlanRef} after an ownership check; the train repos are
 * read READ-ONLY (validate + read weeks/status/dates), never mutated. Reads run outside a tx;
 * {@code attachPlan}/{@code detachPlan} are the only writes.
 */
@Service
@RequiredArgsConstructor
public class GoalPlanLinkService {

    private final GoalPlanLinkRepository linkRepository;
    private final GoalRepository goalRepository;
    private final MesocycleRepository mesocycleRepository;
    private final RunningBlockRepository runningBlockRepository;
    private final GoalPlanLinkMapper mapper;
    private final GoalEngineService goalEngineService;

    /** Owned links for the goal, ordered by start_week (the timeline service consumes these). */
    public List<GoalPlanLinkEntity> listLinks(UUID userId, UUID goalId) {
        requireGoal(userId, goalId);
        return linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goalId, userId);
    }

    @Transactional
    public GoalPlanLinkResponse attachPlan(UUID userId, UUID goalId, GoalPlanAttachRequest req) {
        requireGoal(userId, goalId);
        GoalPlanRef plan = resolvePlan(userId, req.getPlanType(), req.getPlanId());
        GoalPlanLinkEntity e = new GoalPlanLinkEntity();
        e.setCreatedBy(userId);   // server-side ownership — never from the client
        e.setGoalId(goalId);
        e.setPlanType(req.getPlanType());
        e.setPlanId(req.getPlanId());
        e.setStartWeek(req.getStartWeek());
        e.setEndWeek(req.getStartWeek() + plan.getWeeks() - 1); // derived — request never sets end_week
        GoalPlanLinkResponse resp = mapper.toResponse(linkRepository.save(e), plan);
        // The timeline changed → recompute the goal whose links changed (G5 trigger). Simplest
        // gate: recompute this goal regardless of its status — an inactive goal's prescription still
        // reflects its plan. Graceful on a missing profile (evaluate never throws).
        goalEngineService.evaluate(userId, goalId);
        return resp;
    }

    @Transactional
    public void detachPlan(UUID userId, UUID goalId, UUID linkId) {
        requireGoal(userId, goalId);
        GoalPlanLinkEntity link = linkRepository.findByIdAndCreatedByAndDeletedFalse(linkId, userId)
            .filter(l -> l.getGoalId().equals(goalId)) // the link must belong to THIS goal
            .orElseThrow(this::notFound);
        linkRepository.delete(link); // @SQLDelete soft-deletes
        // The timeline changed → recompute the goal whose link was removed (G5 trigger).
        goalEngineService.evaluate(userId, goalId);
    }

    /** Resolve + ownership-check the referenced plan, returning the display ref the response carries. */
    public GoalPlanRef resolvePlan(UUID userId, String planType, UUID planId) {
        if ("mesocycle".equals(planType)) {
            var m = mesocycleRepository.findByIdAndCreatedByAndDeletedFalse(planId, userId)
                .orElseThrow(this::notFound);
            return GoalPlanRef.builder().title(m.getTitle())
                .status(GoalPlanRef.StatusEnum.fromValue(m.getStatus()))
                .startDate(m.getStartDate()).endDate(m.getEndDate()).weeks(m.getWeeks()).build();
        }
        var b = runningBlockRepository.findByIdAndCreatedByAndDeletedFalse(planId, userId)
            .orElseThrow(this::notFound);
        return GoalPlanRef.builder().title(b.getTitle())
            .status(GoalPlanRef.StatusEnum.fromValue(b.getStatus()))
            .startDate(b.getStartDate()).endDate(b.getEndDate()).weeks(b.getWeeks()).build();
    }

    private GoalEntity requireGoal(UUID userId, UUID goalId) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId)
            .orElseThrow(this::notFound);
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
