package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalOverviewDiet;
import io.mrkuhne.mezo.api.dto.GoalOverviewGuards;
import io.mrkuhne.mezo.api.dto.GoalOverviewPlans;
import io.mrkuhne.mezo.api.dto.GoalOverviewResponse;
import io.mrkuhne.mezo.api.dto.GoalOverviewSegment;
import io.mrkuhne.mezo.api.dto.GoalPlanRef;
import io.mrkuhne.mezo.api.dto.GoalSuggestionResponse;
import io.mrkuhne.mezo.api.dto.GoalTimelineResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.mapper.GoalMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.query.WeightTrendQuery;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Read-only composition root for the state-led Goal hub. */
@Service
@RequiredArgsConstructor
public class GoalOverviewService {

    private final GoalRepository goalRepository;
    private final WeightTrendQuery weightTrendQuery;
    private final GoalOverviewCourseService courseService;
    private final GoalTimelineService timelineService;
    private final GoalSuggestionService suggestionService;
    private final SportService sportService;
    private final WeeklyScheduledActivityService weeklyActivityService;
    private final GoalMapper goalMapper;

    public GoalOverviewResponse getOverview(UUID userId, UUID goalId) {
        GoalEntity goal = requireGoal(userId, goalId);
        WeightTrendResponse trend = weightTrendQuery.computeTrend(userId);
        GoalOverviewCourseService.Course course = courseService.classify(goal, trend);
        GoalTimelineResponse timeline = timelineService.getTimeline(userId, goalId);
        List<GoalSuggestionResponse> suggestions = suggestionService.listOpen(userId, goalId);
        Set<Integer> trainingDays = weeklyActivityService.scheduledTrainingDayOfWeeks(userId);
        LocalDate today = LocalDate.now();
        int totalWeeks = Math.max(1, timeline.getWeeks());
        int currentWeek = currentWeek(goal, today, totalWeeks);
        BigDecimal currentWeight = currentWeight(goal, trend);

        return GoalOverviewResponse.builder()
            .goalId(goal.getId())
            .title(goal.getTitle())
            .trajectory(GoalOverviewResponse.TrajectoryEnum.fromValue(goal.getTrajectory()))
            .status(GoalOverviewResponse.StatusEnum.fromValue(goal.getStatus()))
            .currentWeek(currentWeek)
            .totalWeeks(totalWeeks)
            .completionPct(completionPct(goal, currentWeight, today))
            .currentWeightKg(currentWeight)
            .targetWeightKg(goal.getTargetWeightKg())
            .remainingKg(remainingKg(goal, currentWeight))
            .courseStatus(GoalOverviewResponse.CourseStatusEnum.fromValue(course.status()))
            .courseReasonCode(course.reasonCode())
            .observedRateKgPerWeek(course.signedObservedRate())
            .targetRateKgPerWeek(course.signedTargetRate())
            .projectedTargetDate(course.projectedTargetDate())
            .dataSufficiency(GoalOverviewResponse.DataSufficiencyEnum.fromValue(
                trend.getDataSufficiency().getValue()))
            .diet(diet(goal, currentWeek, today, trainingDays, course.status()))
            .segment(segment(goal, currentWeek, today))
            .plans(plans(timeline, userId))
            .guards(guards(goal))
            .openSuggestionCount(suggestions.size())
            .latestSuggestionId(suggestions.isEmpty() ? null : suggestions.get(0).getId())
            .build();
    }

    private GoalOverviewDiet diet(
            GoalEntity goal, int currentWeek, LocalDate today, Set<Integer> trainingDays,
            String courseStatus) {
        GoalPrescriptionJson prescription = goal.getPrescription();
        GoalPrescriptionJson.Segment current = GoalPrescriptionJson.currentSegment(prescription, currentWeek);
        if ("invalid".equals(courseStatus) || prescription == null || current == null) {
            return GoalOverviewDiet.builder()
                .todayDayType(GoalOverviewDiet.TodayDayTypeEnum.UNAVAILABLE)
                .basis(GoalOverviewDiet.BasisEnum.UNAVAILABLE)
                .explanationCode("invalid".equals(courseStatus)
                    ? "goal_invalid" : "prescription_unavailable")
                .build();
        }
        boolean split = current.trainingDayKcal() != null && current.restDayKcal() != null;
        boolean trainingToday = trainingDays.contains(today.getDayOfWeek().getValue() - 1);
        return GoalOverviewDiet.builder()
            .weekAverageKcal(current.kcal())
            .todayDayType(split
                ? (trainingToday ? GoalOverviewDiet.TodayDayTypeEnum.TRAINING
                    : GoalOverviewDiet.TodayDayTypeEnum.REST)
                : GoalOverviewDiet.TodayDayTypeEnum.UNIFORM)
            .todayKcal(split
                ? (trainingToday ? current.trainingDayKcal() : current.restDayKcal())
                : current.kcal())
            .trainingDayKcal(current.trainingDayKcal())
            .restDayKcal(current.restDayKcal())
            .proteinG(current.proteinG()).carbsG(current.carbsG()).fatG(current.fatG())
            .basis(GoalOverviewDiet.BasisEnum.fromValue(prescription.basis()))
            .explanationCode(split ? "day_type_split" : "uniform_kcal")
            .build();
    }

    private GoalOverviewSegment segment(GoalEntity goal, int currentWeek, LocalDate today) {
        GoalPrescriptionJson prescription = goal.getPrescription();
        GoalPrescriptionJson.Segment current = GoalPrescriptionJson.currentSegment(prescription, currentWeek);
        if (current == null) {
            return GoalOverviewSegment.builder()
                .available(false).explanationCode("segment_unavailable").build();
        }
        GoalPrescriptionJson.Segment next = prescription.segments().stream()
            .filter(item -> item.fromWeek() != null && item.fromWeek() > currentWeek)
            .min(Comparator.comparingInt(GoalPrescriptionJson.Segment::fromWeek))
            .orElse(null);
        LocalDate boundary = next == null
            ? goal.getTargetDate()
            : goal.getStartDate().plusWeeks(next.fromWeek() - 1L);
        int remainingDays = (int) Math.max(0, ChronoUnit.DAYS.between(today, boundary));
        return GoalOverviewSegment.builder()
            .available(true)
            .label(current.label()).fromWeek(current.fromWeek()).toWeek(current.toWeek())
            .remainingDays(remainingDays)
            .nextLabel(next == null ? null : next.label())
            .nextFromWeek(next == null ? null : next.fromWeek())
            .nextChangeDate(next == null ? null : boundary)
            .explanationCode(next == null ? "final_segment" : "next_segment_scheduled")
            .build();
    }

    private GoalOverviewPlans plans(GoalTimelineResponse timeline, UUID userId) {
        int uncoveredWeeks = timeline.getGaps().stream()
            .mapToInt(gap -> gap.getToWeek() - gap.getFromWeek() + 1).sum();
        int activeLinks = (int) timeline.getLinks().stream()
            .filter(link -> link.getPlan() != null
                && link.getPlan().getStatus() == GoalPlanRef.StatusEnum.ACTIVE)
            .count();
        return GoalOverviewPlans.builder()
            .links(timeline.getLinks())
            .gaps(timeline.getGaps())
            .sportSchedule(sportService.getSchedule(userId))
            .activeLinkCount(activeLinks)
            .uncoveredWeekCount(uncoveredWeeks)
            .topIssueCode(uncoveredWeeks > 0 ? "gym_coverage_gap" : null)
            .build();
    }

    private GoalOverviewGuards guards(GoalEntity goal) {
        GoalPrescriptionJson.GuardStatus status = goal.getPrescription() == null
            ? null : goal.getPrescription().guardStatus();
        if (status == null) {
            return GoalOverviewGuards.builder().healthyCount(0).totalCount(0).build();
        }
        int total = 0;
        int healthy = 0;
        String issue = null;
        if (status.strength() != null && Boolean.TRUE.equals(status.strength().active())) {
            total++;
            if (!Boolean.TRUE.equals(status.strength().breached())) {
                healthy++;
            } else {
                issue = "strength_breached";
            }
        }
        if (status.muscle() != null && Boolean.TRUE.equals(status.muscle().active())) {
            total++;
            boolean volumeOk = status.muscle().belowMaintenanceMuscles() == null
                || status.muscle().belowMaintenanceMuscles().isEmpty();
            boolean rateOk = Boolean.TRUE.equals(status.muscle().rateWithinCap());
            boolean proteinOk = Boolean.TRUE.equals(status.muscle().proteinMonitored());
            if (volumeOk && rateOk && proteinOk) {
                healthy++;
            } else if (issue == null) {
                issue = !volumeOk ? "muscle_volume_low"
                    : (!rateOk ? "rate_cap_exceeded" : "protein_unmonitored");
            }
        }
        return GoalOverviewGuards.builder()
            .status(goalMapper.toGuardStatus(status))
            .healthyCount(healthy).totalCount(total).topIssueCode(issue).build();
    }

    private int currentWeek(GoalEntity goal, LocalDate today, int totalWeeks) {
        long elapsedWeeks = ChronoUnit.WEEKS.between(goal.getStartDate(), today);
        return (int) Math.max(1, Math.min(totalWeeks, elapsedWeeks + 1));
    }

    private BigDecimal currentWeight(GoalEntity goal, WeightTrendResponse trend) {
        return trend.getLatestTrendKg() == null || trend.getLatestTrendKg().signum() <= 0
            ? goal.getStartWeightKg() : trend.getLatestTrendKg();
    }

    private BigDecimal remainingKg(GoalEntity goal, BigDecimal currentWeight) {
        if (goal.getTargetWeightKg() == null) {
            return null;
        }
        BigDecimal remaining = "cut".equals(goal.getTrajectory())
            ? currentWeight.subtract(goal.getTargetWeightKg())
            : goal.getTargetWeightKg().subtract(currentWeight);
        return remaining.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private int completionPct(GoalEntity goal, BigDecimal currentWeight, LocalDate today) {
        if (goal.getTargetWeightKg() == null) {
            long allDays = ChronoUnit.DAYS.between(goal.getStartDate(), goal.getTargetDate());
            long elapsed = ChronoUnit.DAYS.between(goal.getStartDate(), today);
            return clampPercent(BigDecimal.valueOf(elapsed)
                .multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(allDays), 0, RoundingMode.HALF_UP));
        }
        BigDecimal total = goal.getTargetWeightKg().subtract(goal.getStartWeightKg());
        BigDecimal covered = currentWeight.subtract(goal.getStartWeightKg());
        return clampPercent(covered.multiply(BigDecimal.valueOf(100))
            .divide(total, 0, RoundingMode.HALF_UP));
    }

    private int clampPercent(BigDecimal value) {
        return Math.max(0, Math.min(100, value.intValue()));
    }

    private GoalEntity requireGoal(UUID userId, UUID goalId) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
