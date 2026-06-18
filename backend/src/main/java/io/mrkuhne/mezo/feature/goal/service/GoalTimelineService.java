package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalGap;
import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalPlanRef;
import io.mrkuhne.mezo.api.dto.GoalTimelineResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.mapper.GoalPlanLinkMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Read-only assembly of a goal's timeline: its mapped plan links plus the uncovered GYM-lane week
 * gaps. The gym lane (the {@code mesocycle}-type links) SHOULD tile the goal window; weeks no
 * mesocycle spans are reported as soft, non-blocking {@link GoalGap}s. Running-block links are
 * episodic and do NOT count toward coverage; volleyball is ambient and is never a link at all.
 *
 * <p>The goal window length ({@code weeks}) is derived from the goal's {@code startDate..targetDate}
 * span — the {@link GoalEntity} carries dates, not a stored week count. Link weeks are clamped to
 * {@code [1, weeks]} for the coverage scan, so a link extending past the window covers only up to
 * the goal's end. Reuses {@link GoalPlanLinkService} (ownership-checked goal resolution, link
 * listing ordered by {@code start_week}, and plan-ref resolution) plus the {@link GoalPlanLinkMapper}
 * for the link DTOs. Pure read — no {@code @Transactional}.
 */
@Service
@RequiredArgsConstructor
public class GoalTimelineService {

    private final GoalRepository goalRepository;
    private final GoalPlanLinkService linkService;
    private final GoalPlanLinkMapper mapper;

    /** Assemble the goal's timeline: mapped links (ordered by start_week) + uncovered gym gaps. */
    public GoalTimelineResponse getTimeline(UUID userId, UUID goalId) {
        GoalEntity goal = requireGoal(userId, goalId);
        int weeks = goalWeeks(goal);
        List<GoalPlanLinkEntity> links = linkService.listLinks(userId, goalId);

        boolean[] covered = new boolean[weeks + 1]; // 1-based; index 0 unused
        List<GoalPlanLinkResponse> linkDtos = new ArrayList<>();
        for (GoalPlanLinkEntity l : links) {
            GoalPlanRef ref = linkService.resolvePlan(userId, l.getPlanType(), l.getPlanId());
            linkDtos.add(mapper.toResponse(l, ref));
            if ("mesocycle".equals(l.getPlanType())) { // only the gym lane tiles coverage
                int from = Math.max(1, l.getStartWeek());
                int to = Math.min(weeks, l.getEndWeek());
                for (int w = from; w <= to; w++) {
                    covered[w] = true;
                }
            }
        }

        List<GoalGap> gaps = new ArrayList<>();
        int run = -1; // start week of the current uncovered run, or -1 when not in a run
        for (int w = 1; w <= weeks; w++) {
            if (!covered[w] && run < 0) {
                run = w;
            }
            if ((covered[w] || w == weeks) && run >= 0) {
                int end = covered[w] ? w - 1 : w; // a covered week ends the run just before it
                gaps.add(GoalGap.builder().fromWeek(run).toWeek(end).build());
                run = -1;
            }
        }

        return GoalTimelineResponse.builder()
            .goalId(goalId)
            .weeks(weeks)
            .links(linkDtos)
            .gaps(gaps)
            .build();
    }

    /** Goal-window length in whole weeks, derived from the start..target span. */
    private int goalWeeks(GoalEntity goal) {
        return (int) ChronoUnit.WEEKS.between(goal.getStartDate(), goal.getTargetDate());
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
