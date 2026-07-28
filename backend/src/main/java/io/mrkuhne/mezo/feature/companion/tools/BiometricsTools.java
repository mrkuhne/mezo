package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepGoalService;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * V0.5 read tools over the biometrics feature (weight trend + {@code get_recovery}: sleep log /
 * sleep goal / check-ins, mezo-xixu). Read-only, ownership-scoped via ToolContext (never model
 * args), honest "nincs adat" absences — spec §5/§6.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class BiometricsTools {

    /** get_recovery's supported scope values; anything else (incl. null) falls back to "sleep". */
    private static final List<String> RECOVERY_SCOPES = List.of("sleep", "sleep-goal", "checkins");

    private final WeightTrendService weightTrendService;
    private final SleepLogRepository sleepLogRepository;
    /** The single wake/bed derivation (spec D1/D4) — ungated, the HabitTargets/RitualService/
     *  ContextSnapshotAssembler precedent — so scope=sleep-goal keeps resolving even if SleepGoalService
     *  itself is unavailable. */
    private final SleepAnchorPort sleepAnchorPort;
    /** SLEEP_GOAL_SWITCH-gated independent of COMPANION_SWITCH: read defensively via ObjectProvider
     *  (the ContextSnapshotAssembler habit/intention/ritual precedent) so a disabled sleep-goal feature
     *  degrades scope=sleep-goal to "nincs adat" rather than failing Spring context startup. */
    private final ObjectProvider<SleepGoalService> sleepGoalService;
    private final CheckInService checkInService;
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

    @Tool(name = "get_recovery", description = "Regeneráció: alvás, alvási cél és napi közérzet. "
            + "scope=sleep (alapértelmezés) — alvásnapló az elmúlt napokra: dátum, óra, minőség (1-5), "
            + "ébredések. scope=sleep-goal — az alvási cél: cél alvásidő (óra/perc), ébredés/lefekvés "
            + "időpontja, szabályossági sáv (± perc). scope=checkins — bejelentkezések az elmúlt napokra: "
            + "energia/stressz/testi/mentális állapot (1-10) minden rögzített időpontra. Használd, amikor "
            + "a user alvásról, alvás-céljáról/ritmusáról, vagy közérzetéről (energia/stressz) kérdez. "
            + "scope: sleep (alapértelmezés), sleep-goal, checkins.")
    public String getRecovery(
            @ToolParam(required = false, description = "sleep|sleep-goal|checkins (alapértelmezés: sleep).")
            String scope,
            @ToolParam(required = false, description = "Hány napra visszamenőleg — scope=sleep/checkins "
                    + "esetén (alapértelmezés 7); scope=sleep-goal esetén nincs hatása.") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeRecoveryScope(scope);
        if ("sleep-goal".equals(s)) {
            return renderSleepGoal(userId, toolContext);
        }
        if ("checkins".equals(s)) {
            return renderCheckIns(userId, days, toolContext);
        }
        return renderSleep(userId, days, toolContext);
    }

    private static String normalizeRecoveryScope(String scope) {
        if (scope == null) {
            return "sleep";
        }
        String s = scope.trim().toLowerCase();
        return RECOVERY_SCOPES.contains(s) ? s : "sleep";
    }

    /** scope=sleep (default) — the original get_sleep body, unchanged: last-N-days window, newest first. */
    private String renderSleep(UUID userId, Integer days, ToolContext toolContext) {
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

    /** scope=sleep-goal (mezo-xixu) — target + bed/wake anchor + regularity band. Bed/wake comes from
     *  {@link SleepAnchorPort#resolve} (the single wake/bed derivation, ungated); target minutes +
     *  regularity band only exist on the {@code SLEEP_GOAL_SWITCH}-gated {@link SleepGoalService},
     *  read defensively via the {@link #sleepGoalService} ObjectProvider — an absent bean degrades to
     *  "nincs adat" rather than a missing-bean Spring startup failure. Otherwise never "nincs adat":
     *  {@code getGoal} composes a config-default ghost when the user never set a goal row. */
    private String renderSleepGoal(UUID userId, ToolContext toolContext) {
        SleepGoalService goalService = sleepGoalService.getIfAvailable();
        if (goalService == null) {
            return "Alvási cél: " + ToolText.NO_DATA;
        }
        SleepGoalResponse goal = goalService.getGoal(userId);
        SleepAnchorPort.SleepAnchor anchor = sleepAnchorPort.resolve(userId);
        int hours = goal.getTargetMinutes() / 60;
        int minutes = goal.getTargetMinutes() % 60;
        StringBuilder b = new StringBuilder("Alvási cél: ").append(hours).append("ó");
        if (minutes > 0) {
            b.append(' ').append(minutes).append('p');
        }
        b.append(" alvás, ébredés ").append(anchor.wake()).append(", lefekvés ").append(anchor.bed())
                .append("; szabályosság ±").append(goal.getRegularityBandMin()).append(" perc");
        ToolContexts.audit(toolContext).addRef("SleepGoal", anchor.wake().toString());
        return b.toString();
    }

    /** scope=checkins (mezo-xixu) — energy/stress/body/mental readings across the day-window, over
     *  {@link CheckInService#listForDay} (one call per day — no since-date finder exists on this
     *  aggregate), newest day first; null-guarded per field (a skipped/pending slot with no readings
     *  still renders honestly, never a fabricated number). */
    private String renderCheckIns(UUID userId, Integer days, ToolContext toolContext) {
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        List<CheckInResponse> rows = new ArrayList<>();
        for (int i = 0; i < d; i++) {
            rows.addAll(checkInService.listForDay(userId, today.minusDays(i)));
        }
        String header = "Bejelentkezések (utolsó " + d + " nap):";
        if (rows.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        for (CheckInResponse c : rows) {
            b.append('\n').append(c.getDate()).append(' ').append(c.getSlotTime()).append(": ");
            List<String> parts = new ArrayList<>();
            if (c.getEnergy() != null) {
                parts.add("energia " + c.getEnergy() + "/10");
            }
            if (c.getStress() != null) {
                parts.add("stressz " + c.getStress() + "/10");
            }
            if (c.getBody() != null) {
                parts.add("testi " + c.getBody() + "/10");
            }
            if (c.getMental() != null) {
                parts.add("mentális " + c.getMental() + "/10");
            }
            b.append(parts.isEmpty() ? ToolText.NO_DATA : String.join(", ", parts));
        }
        rows.stream().limit(5).forEach(c ->
                ToolContexts.audit(toolContext).addRef("CheckIn", c.getDate().toString()));
        return b.toString();
    }
}
