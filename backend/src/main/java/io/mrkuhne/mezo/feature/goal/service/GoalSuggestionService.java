package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalSuggestionResponse;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalFeasibilityService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSegmentOverrideJson;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.mapper.GoalSuggestionMapper;
import io.mrkuhne.mezo.feature.goal.mapper.GoalMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The suggest + approve backbone (spec §6.5/§6.8): the engine PROPOSES diet changes, the owner
 * decides. Invariants: one open (proposed) row per (goal, kind) — a newer proposal supersedes it;
 * a dedupKey the owner already decided (dismissed or accepted) is never re-proposed, so a
 * recurring trigger (every evaluate) stays quiet after a decision until its input changes.
 * Slice 5 reuses propose/list/dismiss verbatim with {@code KIND_WEEKLY_CORRECTION}.
 *
 * <p>{@link #accept} re-derives the goal exactly like {@code GoalService.applyUpsert} (trajectory
 * change) or appends a {@code segmentOverrides} entry (deload), then calls back into
 * {@link GoalEngineService#evaluate}. The {@code GoalEngineService} constructor param is
 * {@code @Lazy}: a future slice has the engine call back INTO this service (auto-propose during
 * evaluate), which would otherwise be a genuine constructor-injection cycle — broken here ahead
 * of that need since Lombok's {@code @RequiredArgsConstructor} cannot target a single parameter.
 */
@Service
public class GoalSuggestionService {

    public static final String KIND_PHASE_CHANGE = "phase_change";
    public static final String KIND_WEEKLY_CORRECTION = "weekly_correction";

    static final String STATUS_PROPOSED = "proposed";
    static final String STATUS_ACCEPTED = "accepted";
    static final String STATUS_DISMISSED = "dismissed";
    static final String STATUS_SUPERSEDED = "superseded";

    private final GoalSuggestionRepository suggestionRepository;
    private final GoalRepository goalRepository;
    private final GoalSuggestionMapper mapper;
    private final GoalFeasibilityService feasibilityService;
    private final GoalEngineService goalEngineService;
    private final GoalMapper goalMapper;
    private final GoalSuggestionSupersedeWriter supersedeWriter;

    public GoalSuggestionService(
        GoalSuggestionRepository suggestionRepository,
        GoalRepository goalRepository,
        GoalSuggestionMapper mapper,
        GoalFeasibilityService feasibilityService,
        @Lazy GoalEngineService goalEngineService,
        GoalMapper goalMapper,
        GoalSuggestionSupersedeWriter supersedeWriter) {
        this.suggestionRepository = suggestionRepository;
        this.goalRepository = goalRepository;
        this.mapper = mapper;
        this.feasibilityService = feasibilityService;
        this.goalEngineService = goalEngineService;
        this.goalMapper = goalMapper;
        this.supersedeWriter = supersedeWriter;
    }

    /**
     * Propose a suggestion. Returns the open row (created, or the existing one when the same
     * dedupKey is already open — idempotent re-trigger), or {@code null} when the owner already
     * decided this exact input (dedup: never nag twice about the same thing).
     *
     * <p><b>Concurrency assumption:</b> single-owner app; this runs on the engine-evaluate/trigger
     * path inside one user's own transaction. A genuine concurrent double-propose for the same
     * (goal, kind) is not a supported path — {@code uq_goal_suggestion_open_per_kind} is the
     * last-resort DB guard, not something this method catches and recovers from.
     */
    @Transactional
    public GoalSuggestionEntity propose(
        UUID userId, UUID goalId, String kind, String dedupKey, GoalSuggestionPayloadJson payload) {

        if (suggestionRepository.existsByGoalIdAndDedupKeyAndStatusInAndDeletedFalse(
                goalId, dedupKey, List.of(STATUS_DISMISSED, STATUS_ACCEPTED))) {
            return null;
        }
        var open = suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(goalId, kind, STATUS_PROPOSED);
        if (open.isPresent()) {
            if (dedupKey.equals(open.get().getDedupKey())) {
                return open.get(); // same input, already on the table — idempotent
            }
            // Newer input wins: the stale open proposal is superseded, never silently replaced.
            // Flushed BEFORE the new row is even constructed: Hibernate orders a flush's writes by
            // action type (inserts before updates) regardless of code order, so without this explicit
            // flush the new 'proposed' INSERT would hit the wire before this row's UPDATE to
            // 'superseded' — two 'proposed' rows for the same (goal, kind) would momentarily exist,
            // violating uq_goal_suggestion_open_per_kind.
            GoalSuggestionEntity stale = open.get();
            stale.setStatus(STATUS_SUPERSEDED);
            stale.setDecidedAt(Instant.now());
            suggestionRepository.saveAndFlush(stale);
        }
        GoalSuggestionEntity e = new GoalSuggestionEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setGoalId(goalId);
        e.setKind(kind);
        e.setStatus(STATUS_PROPOSED);
        e.setDedupKey(dedupKey);
        e.setPayload(payload);
        return suggestionRepository.save(e);
    }

    /** The goal's open proposals (newest first), ownership-gated through the goal. */
    public List<GoalSuggestionResponse> listOpen(UUID userId, UUID goalId) {
        requireGoal(userId, goalId);
        return suggestionRepository
            .findByGoalIdAndCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(goalId, userId, STATUS_PROPOSED)
            .stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public void dismiss(UUID userId, UUID goalId, UUID suggestionId) {
        GoalSuggestionEntity e = requireOwnedProposed(userId, goalId, suggestionId);
        e.setStatus(STATUS_DISMISSED);
        e.setDecidedAt(Instant.now());
    }

    /**
     * Accept: apply the payload through the normal goal paths, per kind — a {@code phase_change}
     * trajectory change re-derives the weekly rate exactly like {@code GoalService.applyUpsert} (or
     * a deload override appends to {@code goal.segmentOverrides}); a {@code weekly_correction}
     * (slice 5) accumulates {@code deltaKcal} onto {@code goal.balanceAdjustmentKcal} — then
     * re-evaluate either way. Each kind carries its own accept-time race guard (spec §6.8):
     * {@code phase_change} on {@code snapshotTrajectory}, {@code weekly_correction} on
     * {@code prescriptionGeneratedAt}; a mismatch supersedes the suggestion and returns 409 so the
     * UI can offer a regenerate.
     */
    @Transactional
    public GoalResponse accept(UUID userId, UUID goalId, UUID suggestionId) {
        GoalSuggestionEntity s = requireOwnedProposed(userId, goalId, suggestionId);
        GoalEntity goal = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId)
            .orElseThrow(this::notFound);
        GoalSuggestionPayloadJson p = s.getPayload();

        if (KIND_WEEKLY_CORRECTION.equals(s.getKind())) {
            applyWeeklyCorrection(goal, p, suggestionId);
        } else {
            applyPhaseChange(goal, p, suggestionId);
        }

        s.setStatus(STATUS_ACCEPTED);
        s.setDecidedAt(Instant.now());
        goalEngineService.evaluate(userId, goalId);
        return goalMapper.toResponse(goal);
    }

    /** {@code phase_change}: race guard on {@code snapshotTrajectory}, then trajectory/override apply. */
    private void applyPhaseChange(GoalEntity goal, GoalSuggestionPayloadJson p, UUID suggestionId) {
        if (!goal.getTrajectory().equals(p.snapshotTrajectory())) {
            // Deliberately do NOT touch `s` in THIS (outer) transaction — see
            // GoalSuggestionSupersedeWriter's javadoc: the 409 below rolls this transaction back,
            // so the supersede must persist through a REQUIRES_NEW write on a row this transaction
            // never dirtied (mezo-ktg8 final-review finding 1).
            supersedeWriter.markSuperseded(suggestionId);
            throw new SystemRuntimeErrorException(
                SystemMessage.error("GOAL_SUGGESTION_STALE").build(), HttpStatus.CONFLICT);
        }

        if (p.suggestedTrajectory() != null) {
            goal.setTrajectory(p.suggestedTrajectory());
            // Same derivation applyUpsert runs — the rate magnitude follows the new trajectory.
            goal.setRateTargetPctPerWeek(feasibilityService.deriveRatePctPerWeek(
                p.suggestedTrajectory(), goal.getStartWeightKg(), goal.getTargetWeightKg(),
                goal.getStartDate(), goal.getTargetDate()));
        }
        if (p.balanceOverrideKcal() != null && p.fromWeek() != null && p.toWeek() != null) {
            List<GoalSegmentOverrideJson> overrides = new ArrayList<>(
                goal.getSegmentOverrides() == null ? List.of() : goal.getSegmentOverrides());
            overrides.add(new GoalSegmentOverrideJson(p.fromWeek(), p.toWeek(), p.balanceOverrideKcal()));
            goal.setSegmentOverrides(overrides);
        }
    }

    /**
     * {@code weekly_correction} (slice 5): race guard on {@code prescriptionGeneratedAt} — every
     * material goal change re-evaluates, so a differing prescription timestamp means the numbers
     * this suggestion was computed from are gone — then accumulate {@code deltaKcal} onto the
     * goal's running {@code balanceAdjustmentKcal} (the fresh evaluate below then carries
     * {@code basis="adaptive"}, Task 3).
     */
    private void applyWeeklyCorrection(GoalEntity goal, GoalSuggestionPayloadJson p, UUID suggestionId) {
        OffsetDateTime rxAt = goal.getPrescription() == null ? null : goal.getPrescription().generatedAt();
        if (p.prescriptionGeneratedAt() == null || rxAt == null || !p.prescriptionGeneratedAt().isEqual(rxAt)) {
            supersedeWriter.markSuperseded(suggestionId); // same REQUIRES_NEW guard as applyPhaseChange
            throw new SystemRuntimeErrorException(
                SystemMessage.error("GOAL_SUGGESTION_STALE").build(), HttpStatus.CONFLICT);
        }
        int current = goal.getBalanceAdjustmentKcal() == null ? 0 : goal.getBalanceAdjustmentKcal();
        goal.setBalanceAdjustmentKcal(current + p.deltaKcal());
    }

    GoalSuggestionEntity requireOwnedProposed(UUID userId, UUID goalId, UUID suggestionId) {
        return suggestionRepository.findByIdAndCreatedByAndDeletedFalse(suggestionId, userId)
            .filter(s -> s.getGoalId().equals(goalId))
            .filter(s -> STATUS_PROPOSED.equals(s.getStatus()))
            .orElseThrow(this::notFound);
    }

    private void requireGoal(UUID userId, UUID goalId) {
        goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId).orElseThrow(this::notFound);
    }

    /** Ownership gate: missing, foreign and already-decided rows are indistinguishable (404). */
    private SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
