package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalFeasibilityService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.mapper.GoalMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Goal CRUD + lifecycle. {@code createGoal} fixes {@code status=planned} and {@code updateGoal}
 * deliberately never touches {@code status}; status transitions go through the dedicated
 * {@link #activateGoal} / {@link #archiveGoal} methods, which own the single-active invariant.
 */
@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final GoalPlanLinkRepository linkRepository;
    private final GoalMapper goalMapper;
    private final GoalEngineService goalEngineService;
    private final GoalFeasibilityService goalFeasibilityService;
    private final ApplicationEventPublisher eventPublisher;

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
        GoalEntity saved = goalRepository.save(e);
        // W2.2 (mezo-b3pp.7): a freshly-created goal is never active, so syncGoal(...) is a no-op
        // today — publishing anyway keeps the "every write publishes" invariant simple and future-proof.
        eventPublisher.publishEvent(new GoalSavedEvent(userId, saved.getId()));
        return goalMapper.toResponse(saved);
    }

    @Transactional
    public GoalResponse updateGoal(UUID userId, UUID id, GoalUpsertRequest req) {
        GoalEntity e = requireOwned(userId, id);
        applyUpsert(e, req);   // status is NOT touched here (lifecycle endpoints own it)
        // W2.2 (mezo-b3pp.7): title can change here, so re-sync the graph node (idempotent UPSERT).
        eventPublisher.publishEvent(new GoalSavedEvent(userId, id));
        return goalMapper.toResponse(e);
    }

    @Transactional
    public void deleteGoal(UUID userId, UUID id) {
        GoalEntity goal = requireOwned(userId, id);
        // Cascade: soft-delete the goal's plan links first, so a re-used goal id never
        // inherits ghost links (the DB FK only cascades the physical delete path).
        linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(id, userId)
            .forEach(linkRepository::delete); // @SQLDelete soft-deletes
        goalRepository.delete(goal); // @SQLDelete soft-deletes
        // mezo-b3pp.31: the graph shadows a goal's lifecycle, and a soft-deleted goal is invisible
        // to GoalSavedEvent's consumer (syncGoal's finder is ...AndDeletedFalse), so the delete
        // gets its own event. Published INSIDE the transaction; the consumer's AFTER_COMMIT phase
        // is what makes the commit boundary its problem, not ours (the JournalService idiom).
        eventPublisher.publishEvent(new GoalDeletedEvent(userId, id));
    }

    @Transactional
    public GoalResponse activateGoal(UUID userId, UUID id) {
        GoalEntity target = requireOwned(userId, id);
        // Single-active invariant: activating archives every other active goal (dirty-checking flushes).
        for (GoalEntity other : goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")) {
            if (!other.getId().equals(id)) {
                other.setStatus("archived");
                // W2.2 (mezo-b3pp.7): each goal the invariant demotes needs its own event, otherwise
                // its GOAL node would stay active in the graph after this goal is no longer active.
                eventPublisher.publishEvent(new GoalSavedEvent(userId, other.getId()));
            }
        }
        if (!"active".equals(target.getStatus())) {
            target.setStatus("active");
        }
        // Recompute the prescription at birth (G5 trigger): the just-activated goal becomes the
        // owner's spine. Graceful on a missing profile — evaluate returns the "profile required"
        // note rather than throwing, so the activation never breaks (same tx, cheap, synchronous).
        goalEngineService.evaluate(userId, id);
        // W2.2 (mezo-b3pp.7): the newly-active goal gets (or re-syncs) its GOAL node.
        eventPublisher.publishEvent(new GoalSavedEvent(userId, id));
        return goalMapper.toResponse(target);
    }

    @Transactional
    public GoalResponse archiveGoal(UUID userId, UUID id) {
        GoalEntity e = requireOwned(userId, id);
        if (!"archived".equals(e.getStatus())) {
            e.setStatus("archived");
        }
        // W2.2 (mezo-b3pp.7): archiving demotes the GOAL node too (idempotent — a re-archive is a no-op UPSERT).
        eventPublisher.publishEvent(new GoalSavedEvent(userId, id));
        return goalMapper.toResponse(e);
    }

    private void applyUpsert(GoalEntity e, GoalUpsertRequest req) {
        // Reject an inverted window (targetDate < startDate) up front so it never reaches
        // GoalTimelineService, where a negative window length would blow up with a 500.
        if (req.getStartDate() != null && req.getTargetDate() != null
                && req.getTargetDate().isBefore(req.getStartDate())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "targetDate").build(), HttpStatus.BAD_REQUEST);
        }
        // segmentOverrides (deload accepts, slice 4) are keyed by 1-based GOAL week, derived from
        // startDate. A startDate change renumbers every week, so an override left in place would
        // silently retarget the wrong week — clear it here rather than carry stale weeks forward
        // (spec §6.8, mezo-ktg8 final-review finding 2). Compared BEFORE the new value is applied.
        if (e.getStartDate() != null && !e.getStartDate().equals(req.getStartDate())) {
            e.setSegmentOverrides(null);
        }
        e.setTitle(req.getTitle());
        e.setTrajectory(req.getTrajectory());
        e.setGuards(req.getGuards() == null ? List.of() : req.getGuards());
        e.setStartDate(req.getStartDate());
        e.setTargetDate(req.getTargetDate());
        e.setStartWeightKg(req.getStartWeightKg());
        e.setTargetWeightKg(req.getTargetWeightKg());
        // G6 (mezo-06n): the weekly rate is server-DERIVED from the window + weights, no longer a
        // client input. Stored as an UNSIGNED magnitude — the G5 engine applies the trajectory sign
        // downstream. Re-runs on every upsert, so editing target weight/date re-derives it. Delegates
        // to GoalFeasibilityService so the persisted rate is exactly what the feasibility preview reports.
        e.setRateTargetPctPerWeek(
            goalFeasibilityService.deriveRatePctPerWeek(
                req.getTrajectory(), req.getStartWeightKg(), req.getTargetWeightKg(),
                req.getStartDate(), req.getTargetDate()));
        e.setIdentityFrame(req.getIdentityFrame());
        // Fuel P5 day-planner settings (mezo-9ys) — optional; omitted values round-trip to null.
        // The HH:mm shape + 3..6 range are enforced by bean validation on the request DTO.
        e.setMealsPerDay(req.getMealsPerDay());
        e.setWakeTime(req.getWakeTime());
        e.setBedTime(req.getBedTime());
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private GoalEntity requireOwned(UUID userId, UUID id) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
