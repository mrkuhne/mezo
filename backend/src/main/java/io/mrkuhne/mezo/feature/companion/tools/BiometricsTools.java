package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * V0.5 read tools over the biometrics feature (weight trend + sleep). Read-only, ownership-scoped
 * via ToolContext (never model args), honest "nincs adat" absences — spec §5/§6.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class BiometricsTools {

    private final WeightTrendService weightTrendService;
    private final SleepLogRepository sleepLogRepository;
    private final CompanionProperties properties;

    @Tool(name = "get_weight_trend", description = "Súlytrend az elmúlt hetekre: EWMA trendsúly, "
            + "heti ütem (kg és %), 4 hetes ütem, heti trendpontok. Kérdés súlyváltozásról, fogyásról, ütemről.")
    public String getWeightTrend(
            @ToolParam(required = false, description = "Hány hétre visszamenőleg (alapértelmezés 4).") Integer weeks,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int w = ToolText.clamp(weeks, 1, properties.tools().maxTrendWeeks(), 4);
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        // empty series / NONE sufficiency = no usable trend — zeros would read as fabricated numbers
        if (trend.getLatestTrendKg() == null || trend.getEwmaSeries().isEmpty()
                || trend.getDataSufficiency() == WeightTrendResponse.DataSufficiencyEnum.NONE) {
            return "Súlytrend (" + w + " hét): " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Súlytrend (").append(w).append(" hét): trendsúly ")
                .append(ToolText.num(trend.getLatestTrendKg())).append(" kg");
        if (trend.getWeeklyRateKgPerWeek() != null) {
            b.append(", heti ütem ").append(ToolText.num(trend.getWeeklyRateKgPerWeek())).append(" kg");
        }
        if (trend.getWeeklyRatePctPerWeek() != null) {
            b.append(" (").append(ToolText.num(trend.getWeeklyRatePctPerWeek())).append("%/hét)");
        }
        if (trend.getLast4wRateKgPerWeek() != null) {
            b.append(", 4 hetes ütem ").append(ToolText.num(trend.getLast4wRateKgPerWeek())).append(" kg/hét");
        }
        LocalDate from = LocalDate.now().minusWeeks(w);
        // one point per ISO week (the last EWMA point of each week) — token budget by construction
        Map<Integer, String> weekly = new LinkedHashMap<>();
        trend.getEwmaSeries().stream()
                .filter(p -> !p.getDate().isBefore(from))
                .forEach(p -> weekly.put(
                        p.getDate().get(WeekFields.ISO.weekBasedYear()) * 100
                                + p.getDate().get(WeekFields.ISO.weekOfWeekBasedYear()),
                        p.getDate() + ": " + ToolText.num(p.getTrendKg()) + " kg"));
        if (!weekly.isEmpty()) {
            b.append("\nHeti trendpontok: ").append(String.join("; ", weekly.values()));
        }
        ToolContexts.audit(toolContext).addRef("WeightTrend", w + "h");
        return b.toString();
    }

    @Tool(name = "get_sleep", description = "Alvásnapló az elmúlt napokra: dátum, óra, minőség (1-5), "
            + "ébredések. Kérdés alvásról, pihenésről, alvásminőségről.")
    public String getSleep(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate from = LocalDate.now().minusDays(d - 1L);
        List<SleepLogEntity> rows =
                sleepLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from);
        String header = "Alvás (utolsó " + d + " nap):";
        if (rows.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        for (SleepLogEntity row : rows) {
            b.append('\n').append(row.getDate()).append(": ").append(ToolText.num(row.getDurationH())).append(" h");
            if (row.getQuality() != null) {
                b.append(", minőség ").append(row.getQuality()).append("/5");
            }
            if (row.getAwakenings() != null) {
                b.append(", ébredés: ").append(row.getAwakenings());
            }
        }
        rows.stream().limit(5).forEach(r ->
                ToolContexts.audit(toolContext).addRef("Sleep", r.getDate().toString()));
        return b.toString();
    }
}
