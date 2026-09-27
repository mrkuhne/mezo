package io.mrkuhne.mezo.feature.goal.mapper;

import io.mrkuhne.mezo.api.dto.ExpenditureExcludedDay;
import io.mrkuhne.mezo.api.dto.ExpenditureExplanationResponse;
import io.mrkuhne.mezo.api.dto.ExpenditureSeriesPoint;
import io.mrkuhne.mezo.api.dto.ExpenditureWaterEvent;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * {@link ExpenditureEstimateEntity} + its {@link ExpenditureExplanationJson} -&gt;
 * {@link ExpenditureExplanationResponse} — the "Hogy tanultam?" endpoint (mezo-y72o3). The entity
 * stores {@code status}/{@code confidence} as plain {@code String} (DB CHECK, upper-case) and the
 * jsonb records' enum-shaped fields as plain {@code String} too (lower-case, contract-native), so
 * each is converted explicitly via the enum's {@code fromValue(String)}.
 */
@Mapper(componentModel = "spring")
public interface ExpenditureExplanationMapper {

    @Mapping(target = "status",
        expression = "java(ExpenditureExplanationResponse.StatusEnum.fromValue(entity.getStatus().toLowerCase()))")
    @Mapping(target = "confidence",
        expression = "java(ExpenditureExplanationResponse.ConfidenceEnum.fromValue(entity.getConfidence().toLowerCase()))")
    @Mapping(target = "windowStart", expression = "java(explanation.windowStart())")
    @Mapping(target = "windowEnd", expression = "java(explanation.windowEnd())")
    @Mapping(target = "dataStart", expression = "java(explanation.dataStart())")
    @Mapping(target = "usableDays", expression = "java(explanation.usableDays())")
    @Mapping(target = "weighInDays", expression = "java(explanation.weighInDays())")
    @Mapping(target = "unloggedDays", expression = "java(explanation.unloggedDays())")
    @Mapping(target = "historyWeeks", expression = "java(explanation.historyWeeks())")
    @Mapping(target = "avgIntakeKcal", expression = "java(explanation.avgIntakeKcal())")
    @Mapping(target = "avgMovementKcal", expression = "java(explanation.avgMovementKcal())")
    @Mapping(target = "tissueRateKgPerWeek", expression = "java(explanation.tissueRateKgPerWeek())")
    @Mapping(target = "tissueKcalPerDay", expression = "java(explanation.tissueKcalPerDay())")
    @Mapping(target = "simpleBaseKcal", expression = "java(explanation.simpleBaseKcal())")
    @Mapping(target = "startBaseKcal", expression = "java(explanation.startBaseKcal())")
    @Mapping(target = "excludedDays", expression = "java(toExcludedDays(explanation.excludedDays()))")
    @Mapping(target = "waterEvents", expression = "java(toWaterEvents(explanation.waterEvents()))")
    @Mapping(target = "series", expression = "java(toSeries(explanation.series()))")
    ExpenditureExplanationResponse toResponse(ExpenditureEstimateEntity entity, ExpenditureExplanationJson explanation);

    default List<ExpenditureExcludedDay> toExcludedDays(List<ExcludedIntakeDayJson> days) {
        if (days == null) {
            return List.of();
        }
        return days.stream().map(d -> ExpenditureExcludedDay.builder()
            .date(d.date())
            .kcal(d.kcal())
            .reason(ExpenditureExcludedDay.ReasonEnum.fromValue(d.reason().toLowerCase()))
            .build()).toList();
    }

    default List<ExpenditureWaterEvent> toWaterEvents(List<ExpenditureExplanationJson.WaterEvent> events) {
        if (events == null) {
            return List.of();
        }
        return events.stream().map(e -> ExpenditureWaterEvent.builder()
            .date(e.date())
            .kg(e.kg())
            .build()).toList();
    }

    default List<ExpenditureSeriesPoint> toSeries(List<ExpenditureExplanationJson.SeriesPoint> series) {
        if (series == null) {
            return List.of();
        }
        return series.stream().map(p -> ExpenditureSeriesPoint.builder()
            .date(p.date())
            .intakeKcal(p.intakeKcal())
            .status(ExpenditureSeriesPoint.StatusEnum.fromValue(p.status().toLowerCase()))
            .weightKg(p.weightKg())
            .trendKg(p.trendKg())
            .tissueKg(p.tissueKg())
            .build()).toList();
    }
}
