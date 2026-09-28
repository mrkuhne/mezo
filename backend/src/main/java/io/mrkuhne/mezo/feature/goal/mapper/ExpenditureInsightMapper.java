package io.mrkuhne.mezo.feature.goal.mapper;

import io.mrkuhne.mezo.api.dto.ExpenditureExcludedDay;
import io.mrkuhne.mezo.api.dto.ExpenditureHistoryResponse;
import io.mrkuhne.mezo.api.dto.ExpenditureWeek;
import io.mrkuhne.mezo.api.dto.ExpenditureWeeklyCardResponse;
import io.mrkuhne.mezo.api.dto.IntakeDayMarkResult;
import io.mrkuhne.mezo.api.dto.IntakeDayStatus;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureLearningService;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.service.ExpenditureInsightService;
import io.mrkuhne.mezo.feature.goal.service.IntakeDayMarkService;
import java.util.List;
import java.util.Locale;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * The learned-expenditure read/write surface (mezo-3n2so, controller Task 5) -&gt; contract DTOs:
 * the weekly-history chart, the weekly-summary card, live day statuses and day-mark results. Rows
 * store {@code status}/{@code confidence} upper-case (DB CHECK, like {@link ExpenditureEstimateEntity}
 * everywhere else), so each is lower-cased through the enum's {@code fromValue(String)} — mirrors
 * {@link ExpenditureExplanationMapper}. {@link ExpenditureLearningService.DayStatus} is already
 * contract-native lower-case, so its fields pass straight through.
 */
@Mapper(componentModel = "spring")
public interface ExpenditureInsightMapper {

    @Mapping(target = "status",
        expression = "java(ExpenditureWeek.StatusEnum.fromValue(entity.getStatus().toLowerCase(java.util.Locale.ROOT)))")
    @Mapping(target = "confidence",
        expression = "java(ExpenditureWeek.ConfidenceEnum.fromValue(entity.getConfidence().toLowerCase(java.util.Locale.ROOT)))")
    ExpenditureWeek toWeek(ExpenditureEstimateEntity entity);

    List<ExpenditureWeek> toWeeks(List<ExpenditureEstimateEntity> entities);

    default ExpenditureHistoryResponse toHistoryResponse(ExpenditureInsightService.History history) {
        return ExpenditureHistoryResponse.builder()
            .learningEnabled(history.learningEnabled())
            .weeks(toWeeks(history.weeks()))
            .build();
    }

    default ExpenditureWeeklyCardResponse toWeeklyCardResponse(ExpenditureInsightService.WeeklyCard card) {
        ExpenditureEstimateEntity row = card.row();
        return ExpenditureWeeklyCardResponse.builder()
            .weekStart(row.getWeekStart())
            .weekEnd(row.getWeekStart().plusDays(6))
            .status(ExpenditureWeeklyCardResponse.StatusEnum.fromValue(row.getStatus().toLowerCase(Locale.ROOT)))
            .confidence(ExpenditureWeeklyCardResponse.ConfidenceEnum.fromValue(
                row.getConfidence().toLowerCase(Locale.ROOT)))
            .appliedBaseKcal(row.getAppliedBaseKcal())
            .posteriorSdKcal(row.getPosteriorSdKcal())
            .stepKcal(row.getStepKcal())
            .usableDays(row.getUsableDays())
            .weighInDays(row.getWeighInDays())
            .minUsableDays(card.minUsableDays())
            .minWeighInDays(card.minWeighInDays())
            .excludedDays(toExcludedDays(row.getExcludedDays()))
            .build();
    }

    default List<ExpenditureExcludedDay> toExcludedDays(List<ExcludedIntakeDayJson> days) {
        if (days == null) {
            return List.of();
        }
        return days.stream().map(d -> ExpenditureExcludedDay.builder()
            .date(d.date())
            .kcal(d.kcal())
            .reason(ExpenditureExcludedDay.ReasonEnum.fromValue(d.reason().toLowerCase(Locale.ROOT)))
            .build()).toList();
    }

    default IntakeDayStatus toDayStatus(ExpenditureLearningService.DayStatus status) {
        return IntakeDayStatus.builder()
            .date(status.date())
            .kcal(status.kcal())
            .status(IntakeDayStatus.StatusEnum.fromValue(status.status()))
            .mark(status.mark() == null ? null : IntakeDayStatus.MarkEnum.fromValue(status.mark()))
            .build();
    }

    default List<IntakeDayStatus> toDayStatuses(List<ExpenditureLearningService.DayStatus> statuses) {
        return statuses.stream().map(this::toDayStatus).toList();
    }

    default IntakeDayMarkResult toMarkResult(IntakeDayMarkService.MarkResult result, IntakeDayStatus day) {
        return IntakeDayMarkResult.builder()
            .day(day)
            .appliedBaseBeforeKcal(result.appliedBaseBeforeKcal())
            .appliedBaseAfterKcal(result.appliedBaseAfterKcal())
            .recomputed(result.recomputed())
            .build();
    }
}
