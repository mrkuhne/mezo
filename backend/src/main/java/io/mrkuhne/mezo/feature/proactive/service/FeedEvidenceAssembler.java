package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.proactive.config.ContextualFeedProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Fresh dated evidence; this renderer deliberately does not change the goal engine's math. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CONTEXTUAL_FEED_SWITCH,
        FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.COMPANION_SWITCH}, havingValue = "true")
public class FeedEvidenceAssembler {
    private final WeightLogRepository weights;
    private final SleepLogRepository sleeps;
    private final WeightTrendService trends;
    private final GoalRepository goals;
    private final ContextSnapshotAssembler snapshot;
    private final ContextualFeedProperties properties;

    public String render(UUID userId, LocalDate date, String kind) {
        return switch (kind) {
            case "weight" -> weight(userId, date);
            case "sleep" -> sleep(userId, date);
            default -> "";
        };
    }

    private String weight(UUID userId, LocalDate date) {
        LocalDate from = date.minusDays(properties.weightDays() - 1L);
        var rows = weights.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(userId, from, date);
        var text = new StringBuilder("[FRISS SÚLYADATOK — ").append(from).append(" – ").append(date)
                .append("; ").append(properties.weightDays()).append(" nap]\n");
        Map<LocalDate, List<WeightLogEntity>> days = rows.stream().collect(Collectors.groupingBy(
                WeightLogEntity::getDate, TreeMap::new, Collectors.toList()));
        days.forEach((day, values) -> {
            BigDecimal mean = values.stream().map(WeightLogEntity::getWeightKg).reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(BigDecimal.valueOf(values.size()), 3, RoundingMode.HALF_UP);
            text.append(day).append("; nyers mérések: ");
            for (var value : values) {
                text.append(ToolText.huWeight(value.getWeightKg())).append(" kg")
                        .append(" [source=weight_log;id=").append(value.getId()).append("] ");
                if (value.getNote() != null && !value.getNote().isBlank()) {
                    text.append("megjegyzés: ").append(value.getNote()).append(' ');
                }
            }
            text.append("; napi átlag: ").append(ToolText.huWeight(mean)).append(" kg\n");
        });
        text.append("Mérési napok: ").append(days.size()).append("; utolsó 7 nap mérési napjai: ")
                .append(days.keySet().stream().filter(d -> !d.isBefore(date.minusDays(6))).count()).append('\n');
        if (!rows.isEmpty()) {
            var latest = rows.getLast();
            text.append("legutóbbi mérés: ").append(ToolText.huWeight(latest.getWeightKg())).append(" kg (")
                    .append(latest.getDate()).append(")\n");
            rows.stream().filter(r -> r.getDate().isBefore(latest.getDate())).reduce((a, b) -> b).ifPresent(previous ->
                    text.append("Változás az előző mért nap utolsó méréséhez: ")
                            .append(ToolText.huWeight(latest.getWeightKg().subtract(previous.getWeightKg())))
                            .append(" kg; előző nap: ").append(previous.getDate()).append('\n'));
        }
        if (days.size() < 2) text.append("irány: nincs elég mérési nap ebben az ablakban\n");
        var trend = trends.computeTrend(userId);
        var series = trend.getEwmaSeries();
        if (series != null && series.size() >= 2 && !series.getLast().getDate().isAfter(date)) {
            var first = series.getFirst().getDate();
            var last = series.getLast().getDate();
            text.append("Simított érték (EWMA): ").append(ToolText.huWeight(trend.getLatestTrendKg())).append(" kg\n")
                    .append("teljes mérési időszak: ").append(first).append(" – ").append(last)
                    .append("; hétre átszámított meredekség: ").append(ToolText.huRate(trend.getWeeklyRateKgPerWeek()))
                    .append(" kg/hét; NEM az utolsó hét változása\n");
            var cutoff = last.minusDays(28);
            var recent = series.stream().filter(p -> !p.getDate().isBefore(cutoff)).toList();
            if (recent.size() >= 2) text.append("Utolsó 28 nap trendpontjai: ")
                    .append(recent.getFirst().getDate()).append(" – ").append(last)
                    .append("; meredekség: ").append(ToolText.huRate(trend.getLast4wRateKgPerWeek())).append(" kg/hét\n");
        }
        goals.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(userId, "active").stream().findFirst()
                .ifPresent(g -> text.append("Aktív cél: ").append(g.getTitle()).append("; ")
                        .append(ToolText.huTrajectory(g.getTrajectory())).append("; ").append(g.getStartDate())
                        .append(" – ").append(g.getTargetDate()).append("; célérték: ")
                        .append(ToolText.huWeight(g.getTargetWeightKg())).append(" kg\n"));
        return text.toString();
    }

    private String sleep(UUID userId, LocalDate date) {
        var from = date.minusDays(properties.sleepDays() - 1L);
        var rows = sleeps.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(userId, from, date);
        var text = new StringBuilder("[FRISS ALVÁSADATOK — ").append(from).append(" – ").append(date).append("]\n");
        for (var row : rows) {
            text.append(row.getDate()).append("; időtartam: ").append(ToolText.huHours(row.getDurationH()))
                    .append(" h; minőség: ").append(ToolText.sleepQuality(row.getQuality()))
                    .append("; ébredések: ").append(row.getAwakenings() == null ? "nincs adat" : row.getAwakenings())
                    .append(" [source=sleep_log;id=").append(row.getId()).append("]\n");
            if (row.getNotes() != null) text.append("Megjegyzés: ").append(row.getNotes()).append('\n');
        }
        long nights = rows.stream().map(r -> r.getDate()).distinct().count();
        text.append("hiányzó éjszakák: ").append(properties.sleepDays() - nights)
                .append("; hiányzó napló nem jelent alvás nélkül töltött éjszakát.\n");
        snapshot.render(userId, date).lines().filter(line -> line.startsWith("[Cél]") || line.startsWith("[Edzés]"))
                .forEach(line -> text.append(line).append('\n'));
        return text.toString();
    }
}
