package io.mrkuhne.mezo.feature.dayclose.mapper;

import io.mrkuhne.mezo.api.dto.DayClosePlanGoal;
import io.mrkuhne.mezo.api.dto.DayCloseResponse;
import io.mrkuhne.mezo.feature.dayclose.entity.DayCloseEntity;
import java.time.ZoneOffset;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** {@code day_close} ↔ the API shapes; the plan goals travel as a JSON array in {@code plan_goals}. */
@Component
@RequiredArgsConstructor
public class DayCloseMapper {

    private static final TypeReference<List<DayClosePlanGoal>> PLAN_GOALS = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public DayCloseResponse toResponse(DayCloseEntity e, String journalText) {
        return new DayCloseResponse()
            .date(e.getCloseDate())
            .closedAt(e.getClosedAt().atOffset(ZoneOffset.UTC))
            .eveningEnergy(e.getEveningEnergy())
            .dayRating(e.getDayRating())
            .goalText(e.getGoalText())
            .goalOutcome(e.getGoalOutcome() == null ? null
                : DayCloseResponse.GoalOutcomeEnum.fromValue(e.getGoalOutcome()))
            .planGoals(readPlanGoals(e.getPlanGoals()))
            .journalText(journalText)
            .boopLine(e.getBoopLine())
            .source(DayCloseResponse.SourceEnum.BOOP);
    }

    public String writePlanGoals(List<DayClosePlanGoal> goals) {
        return objectMapper.writeValueAsString(goals == null ? List.of() : goals);
    }

    public List<DayClosePlanGoal> readPlanGoals(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        return objectMapper.readValue(json, PLAN_GOALS);
    }
}
