package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalProjectionService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Slice-4 trigger probe (spec §6.5): after every engine evaluate and on meso lifecycle events,
 * check whether the training plan disagrees with the diet — (a) a linked meso's goalPreset maps
 * (config {@code mezo.goal.suggestion.preset-trajectory}) to a trajectory other than the goal's;
 * (b) the CURRENT goal-week's meso phase is a deload with no accepted override yet. Both emit a
 * {@code phase_change} suggestion through {@link GoalSuggestionService#propose} — dedup + the
 * one-open-per-kind invariant make this probe idempotent and nag-free, so calling it on every
 * evaluate (weigh-in cadence) is safe. Never throws on missing/neutral data.
 */
@Service
@RequiredArgsConstructor
public class GoalSuggestionTriggerService {

    private static final String PLAN_MESOCYCLE = "mesocycle";
    private static final String PHASE_DELOAD = "DELOAD";

    private final GoalRepository goalRepository;
    private final GoalPlanLinkRepository linkRepository;
    private final MesocycleRepository mesocycleRepository;
    private final GoalProjectionService projectionService;
    private final GoalSuggestionService suggestionService;
    private final GoalEngineProperties props;

    /** Meso lifecycle entry point (Task 7 listeners): resolve the active goal, then check. */
    @Transactional
    public void onMesoLifecycle(UUID userId) {
        goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream()
            .findFirst()
            .ifPresent(g -> checkPhaseSuggestions(userId, g.getId()));
    }

    @Transactional
    public void checkPhaseSuggestions(UUID userId, UUID goalId) {
        GoalEntity goal = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId).orElse(null);
        if (goal == null || !"active".equals(goal.getStatus())) {
            return; // suggestions only advise the live spine
        }
        boolean proposedMismatch = checkPresetMismatch(userId, goal);
        if (!proposedMismatch) {
            checkDeloadWeek(userId, goal); // one probe per check — mismatch outranks deload
        }
    }

    /** (a) linked meso preset ↔ goal trajectory mismatch → suggest the preset's trajectory. */
    private boolean checkPresetMismatch(UUID userId, GoalEntity goal) {
        List<GoalPlanLinkEntity> links =
            linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goal.getId(), userId);
        for (GoalPlanLinkEntity l : links) {
            if (!PLAN_MESOCYCLE.equals(l.getPlanType())) {
                continue;
            }
            MesocycleEntity m =
                mesocycleRepository.findByIdAndCreatedByAndDeletedFalse(l.getPlanId(), userId).orElse(null);
            if (m == null || m.getGoalPreset() == null || "archived".equals(m.getStatus())) {
                continue;
            }
            String wanted = props.suggestion().presetTrajectory().get(m.getGoalPreset());
            if (wanted == null || wanted.equals(goal.getTrajectory())) {
                continue;
            }
            String dedupKey = "preset:" + m.getGoalPreset() + ":meso:" + m.getId()
                + ":traj:" + goal.getTrajectory();
            var proposed = suggestionService.propose(
                userId, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, dedupKey,
                new GoalSuggestionPayloadJson(
                    "A(z) „" + m.getTitle() + "” mezociklus " + m.getGoalPreset()
                        + " presetje " + huTrajectory(wanted) + " irányt javasol, a cél most "
                        + huTrajectory(goal.getTrajectory()) + ".",
                    wanted, null, null, null, m.getId(), m.getTitle(), goal.getTrajectory(),
                    null, null, null, null, null, null, null, null, null, null, null));
            if (proposed != null) {
                return true;
            }
        }
        return false;
    }

    /** (b) the current goal-week's phase class is Deload and no accepted override covers it. */
    private void checkDeloadWeek(UUID userId, GoalEntity goal) {
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), LocalDate.now()) / 7 + 1;
        long totalWeeks = ChronoUnit.WEEKS.between(goal.getStartDate(), goal.getTargetDate());
        if (week < 1 || week > totalWeeks) {
            return;
        }
        String phase = projectionService.phaseForWeek(goal, userId, (int) week);
        if (!PHASE_DELOAD.equalsIgnoreCase(phase)) {
            return;
        }
        boolean covered = goal.getSegmentOverrides() != null && goal.getSegmentOverrides().stream()
            .anyMatch(o -> week >= o.fromWeek() && week <= o.toWeek());
        if (covered) {
            return;
        }
        // The dedup key MUST carry the covering meso's id (mezo-ktg8 final-review finding 3):
        // without it, "deload:goal:{id}:w:{week}" is shared by every mesocycle that ever occupies
        // this goal-week, so dismissing meso A's deload silences meso B's same-week deload too, even
        // though they are unrelated decisions. coveringMesoId resolves the SAME link
        // activeMesoPhase(...) above just walked (phaseForWeek doesn't expose it, so it is
        // re-resolved here rather than threading a return-type change through a shared read path).
        UUID mesoId = coveringMesoId(userId, goal, week);
        String dedupKey = "deload:goal:" + goal.getId() + ":meso:" + mesoId + ":w:" + week;
        suggestionService.propose(
            userId, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, dedupKey,
            new GoalSuggestionPayloadJson(
                "Deload hét (W" + week + ") — a regeneráció többet ér, ha ezen a héten tartáson eszel.",
                null, 0, (int) week, (int) week, null, null, goal.getTrajectory(),
                null, null, null, null, null, null, null, null, null, null, null));
    }

    /**
     * The mesocycle whose phaseCurve is active in goal-week {@code week} — the id half of
     * {@link GoalProjectionService#phaseForWeek}'s resolution (spec §6.5, mezo-ktg8 final-review
     * finding 3). Same first-covering-link-wins rule as {@code activeMesoPhase}; {@code null} only
     * when no meso link covers the week (should not happen here — the caller only reaches this
     * after confirming the week's phase class is DELOAD).
     */
    private UUID coveringMesoId(UUID userId, GoalEntity goal, long week) {
        return linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goal.getId(), userId)
            .stream()
            .filter(l -> PLAN_MESOCYCLE.equals(l.getPlanType()) && week >= l.getStartWeek() && week <= l.getEndWeek())
            .map(GoalPlanLinkEntity::getPlanId)
            .findFirst()
            .orElse(null);
    }

    private static String huTrajectory(String t) {
        return switch (t) {
            case "cut" -> "deficit (fogyás)";
            case "bulk" -> "szufficit (izomépítés)";
            default -> "tartás";
        };
    }
}
