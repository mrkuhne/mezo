package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * V0.5 read tool over the goal feature. Pure composition (goal + weight trend + current segment) —
 * GoalEngineService.evaluate is a WRITE and must never be called from a tool.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class GoalTools {

    private final GoalRepository goalRepository;
    private final WeightTrendService weightTrendService;

    @Tool(name = "get_goal_progress", description = "Az aktív cél állása: kezdő/cél/aktuális trendsúly, "
            + "hét sorszáma, terv szerinti és tényleges heti ütem, e heti recept. Kérdés a cél haladásáról.")
    public String getGoalProgress(ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
                .stream().findFirst().orElse(null);
        if (goal == null) {
            return "Cél: nincs aktív cél";
        }
        LocalDate today = LocalDate.now();
        // week derived from startDate (the snapshot's idiom) — the stored week can lag
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), today) / 7 + 1;
        StringBuilder b = new StringBuilder("Cél: ").append(goal.getTitle())
                .append(" (").append(goal.getTrajectory()).append("), ").append(week).append(". hét; ")
                .append(ToolText.num(goal.getStartWeightKg())).append(" → ")
                .append(goal.getTargetWeightKg() != null ? ToolText.num(goal.getTargetWeightKg()) : "?")
                .append(" kg, ").append(goal.getStartDate()).append(" → ").append(goal.getTargetDate());
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        if (trend.getLatestTrendKg() != null && !trend.getEwmaSeries().isEmpty()
                && trend.getDataSufficiency() != WeightTrendResponse.DataSufficiencyEnum.NONE) {
            b.append("; trendsúly most ").append(ToolText.num(trend.getLatestTrendKg())).append(" kg");
            if (goal.getStartWeightKg() != null) {
                b.append(" (eddig ").append(ToolText.num(
                        trend.getLatestTrendKg().subtract(goal.getStartWeightKg()))).append(" kg)");
            }
            if (trend.getWeeklyRateKgPerWeek() != null) {
                b.append(", tényleges ütem ").append(ToolText.num(trend.getWeeklyRateKgPerWeek())).append(" kg/hét");
            }
        } else {
            b.append("; trendsúly: ").append(ToolText.NO_DATA);
        }
        if (goal.getRateTargetPctPerWeek() != null) {
            b.append(", terv-ütem ").append(ToolText.num(goal.getRateTargetPctPerWeek())).append("%/hét");
        }
        GoalPrescriptionJson.Segment seg = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        if (seg != null) {
            b.append("; e heti recept: ").append(seg.kcal()).append(" kcal, ")
                    .append(seg.proteinG()).append(" g fehérje");
        }
        ToolContexts.audit(toolContext).addRef("Goal", goal.getTitle());
        return b.toString();
    }
}
