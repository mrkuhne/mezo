package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepGoalService;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableSet;
import java.util.Set;
import java.util.TreeSet;
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
    /** mezo-8z79: the RAW daily weigh-ins behind get_weight_log — the trend service only exposes
     *  the smoothed EWMA series, which is precisely what hides the day-to-day fluctuation. */
    private final WeightLogRepository weightLogRepository;
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

    // mezo-a64t: get_weight_trend / get_weight_log / get_recovery hand the model the SAME body
    // weights, weekly rates and sleep hours the context snapshot renders, inside the SAME
    // conversation — so "83.694 kg" from a tool beside "83,7 kg" from the snapshot is one number
    // arriving two ways, which IS the defect. Precision belongs to the QUANTITY, not the call site.
    // NOTE for a follow-up: the same three precisions are now declared privately here, in GoalTools,
    // ContextSnapshotAssembler and DailySummaryService; their real home is beside ToolText.huNum,
    // whose javadoc already states the per-quantity rule.
    private static final int WEIGHT_DECIMALS = 1;
    private static final int RATE_DECIMALS = 2;
    private static final int SLEEP_HOURS_DECIMALS = 1;

    @Tool(name = "get_weight_trend", description = "Súlytrend az elmúlt hetekre: EWMA trendsúly, "
            + "heti ütem (kg és %), 4 hetes ütem, heti trendpontok. Használd, amikor a user a súlyáról, "
            + "súlyváltozásáról, fogyásról vagy annak üteméről kérdez.")
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
                .append(ToolText.huNum(trend.getLatestTrendKg(), WEIGHT_DECIMALS)).append(" kg");
        if (trend.getWeeklyRateKgPerWeek() != null) {
            b.append(", heti ütem ")
                    .append(ToolText.huNum(trend.getWeeklyRateKgPerWeek(), RATE_DECIMALS)).append(" kg");
        }
        if (trend.getWeeklyRatePctPerWeek() != null) {
            b.append(" (")
                    .append(ToolText.huNum(trend.getWeeklyRatePctPerWeek(), RATE_DECIMALS)).append("%/hét)");
        }
        if (trend.getLast4wRateKgPerWeek() != null) {
            b.append(", 4 hetes ütem ")
                    .append(ToolText.huNum(trend.getLast4wRateKgPerWeek(), RATE_DECIMALS)).append(" kg/hét");
        }
        LocalDate from = LocalDate.now().minusWeeks(w);
        // one point per ISO week (the last EWMA point of each week) — token budget by construction
        Map<Integer, String> weekly = new LinkedHashMap<>();
        trend.getEwmaSeries().stream()
                .filter(p -> !p.getDate().isBefore(from))
                .forEach(p -> weekly.put(
                        p.getDate().get(WeekFields.ISO.weekBasedYear()) * 100
                                + p.getDate().get(WeekFields.ISO.weekOfWeekBasedYear()),
                        p.getDate() + ": "
                                + ToolText.huNum(p.getTrendKg(), WEIGHT_DECIMALS) + " kg"));
        if (!weekly.isEmpty()) {
            b.append("\nHeti trendpontok: ").append(String.join("; ", weekly.values()));
        }
        ToolContexts.audit(toolContext).addRef("WeightTrend", w + "h");
        return b.toString();
    }

    @Tool(name = "get_weight_log", description = "Napi NYERS súlymérések egy időablakban: dátum, "
            + "mért kg, és az előző méréshez képesti változás. Ezt használd, amikor a user a napi "
            + "súlyokról, a mérések INGADOZÁSÁRÓL, kilengéséről vagy egy-egy konkrét nap súlyáról "
            + "kérdez — a get_weight_trend simított trendsúlyt ad, amiből a napi kilengés nem látszik.")
    public String getWeightLog(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate from = LocalDate.now().minusDays(d - 1L);
        List<WeightLogEntity> rows =
                weightLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from);
        String header = "Napi súlymérések (utolsó " + d + " nap):";
        if (rows.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        for (int i = 0; i < rows.size(); i++) {
            WeightLogEntity row = rows.get(i);
            b.append('\n').append(row.getDate()).append(": ")
                    .append(ToolText.huNum(row.getWeightKg(), WEIGHT_DECIMALS)).append(" kg");
            // Day-over-day delta against the NEXT row (the list is newest-first), i.e. the previous
            // weigh-in — this is the fluctuation the trend tool smooths away. The oldest row in the
            // window has no predecessor here, so it gets no delta rather than a fabricated zero.
            if (i + 1 < rows.size()) {
                BigDecimal delta = row.getWeightKg().subtract(rows.get(i + 1).getWeightKg());
                // a weight DELTA is still a body weight — same precision; huNum renders the minus
                // itself, so only the positive sign needs the explicit prefix it always had
                b.append(" (").append(delta.signum() > 0 ? "+" : "")
                        .append(ToolText.huNum(delta, WEIGHT_DECIMALS)).append(" kg)");
            }
            if (row.getNote() != null && !row.getNote().isBlank()) {
                b.append(" — ").append(row.getNote());
            }
        }
        rows.stream().limit(5).forEach(r ->
                ToolContexts.audit(toolContext).addRef("Weight", r.getDate().toString()));
        return b.toString();
    }

    @Tool(name = "get_recovery", description = "Regeneráció: alvás, alvási cél és napi közérzet. "
            + "scope=sleep (alapértelmezés) — alvásnapló az elmúlt napokra: dátum, óra, minőség (1-5), "
            + "ébredések. scope=sleep részletes nézet — a date (max 3 nap) vagy from/to paraméterekkel "
            + "a kért napok teljes adatai: lefekvés/ébredés időpont, alvási idő, ágyban/ébren/könnyű/REM/"
            + "mély percek, minőség, ébredések, forrás (minőséggel), hypnogram, megjegyzés. scope=sleep-goal "
            + "— az alvási cél: cél alvásidő (óra/perc), ébredés/lefekvés időpontja, szabályossági sáv "
            + "(± perc). scope=checkins — bejelentkezések az elmúlt napokra: energia/stressz/testi/mentális "
            + "állapot (1-10) minden rögzített időpontra. Használd, amikor a user alvásról, alvás-céljáról/"
            + "ritmusáról, vagy közérzetéről (energia/stressz) kérdez — vagy amikor a user konkrét nap "
            + "alvási adatait / fázisait kérdezi (akkor a date vagy from/to paraméterrel). "
            + "scope: sleep (alapértelmezés), sleep-goal, checkins.")
    public String getRecovery(
            @ToolParam(required = false, description = "sleep|sleep-goal|checkins (alapértelmezés: sleep).")
            String scope,
            @ToolParam(required = false, description = "Hány napra visszamenőleg — scope=sleep/checkins "
                    + "esetén (alapértelmezés 7); scope=sleep-goal esetén nincs hatása.") Integer days,
            @ToolParam(required = false, description = "Konkrét alvásnapok teljes részlete "
                    + "(YYYY-MM-DD), maximum 3 nap — csak scope=sleep, más scope-on nincs hatása. "
                    + "pl. [\"2026-08-23\"].")
            List<LocalDate> date,
            @ToolParam(required = false, description = "Részletes nézet kezdő napja (YYYY-MM-DD), "
                    + "bezárólag; ha a 'to' hiányzik, a mai napig — csak scope=sleep, más "
                    + "scope-on nincs hatása.")
            LocalDate from,
            @ToolParam(required = false, description = "Részletes nézet záró napja (YYYY-MM-DD), "
                    + "bezárólag; elhagyva: mai nap — csak scope=sleep, más scope-on nincs hatása.")
            LocalDate to,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeRecoveryScope(scope);
        if ("sleep-goal".equals(s)) {
            return renderSleepGoal(userId, toolContext);
        }
        if ("checkins".equals(s)) {
            return renderCheckIns(userId, days, toolContext);
        }
        boolean detail = date != null && !date.isEmpty() || from != null || to != null;
        return detail ? renderSleepDetail(userId, date, from, to, toolContext)
                : renderSleep(userId, days, toolContext);
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
            b.append('\n').append(row.getDate()).append(": ")
                    .append(ToolText.huNum(row.getDurationH(), SLEEP_HOURS_DECIMALS)).append(" h");
            // mezo-b6zt: the scale's ceiling is 10 (sleep.yml SleepLogRequest.quality), not the "/5"
            // this line hardcoded — the shared fragment owns the denominator now.
            String quality = ToolText.sleepQuality(row.getQuality());
            if (quality != null) {
                b.append(", minőség ").append(quality);
            }
            if (row.getAwakenings() != null) {
                b.append(", ébredés: ").append(row.getAwakenings());
            }
        }
        rows.stream().limit(5).forEach(r ->
                ToolContexts.audit(toolContext).addRef("Sleep", r.getDate().toString()));
        return b.toString();
    }

    /** scope=sleep detail mode (mezo-ohce) — full sleep_log rows for explicitly requested days.
     *  One read over the clamped window, in-memory filter; every field null-guarded (absent =
     *  omitted, never fabricated); a requested day without a row says "nincs rögzített alvás". */
    private String renderSleepDetail(UUID userId, List<LocalDate> date, LocalDate from, LocalDate to,
            ToolContext toolContext) {
        LocalDate today = LocalDate.now();
        LocalDate windowFrom = today.minusDays(properties.tools().maxWindowDays() - 1L);
        boolean clamped = false;

        Set<LocalDate> requested = new TreeSet<>();
        if (date != null) {
            requested.addAll(date);
        }
        if (from != null || to != null) {
            LocalDate lo = from != null ? from : windowFrom;
            LocalDate hi = to == null ? today : to;
            if (hi.isAfter(today)) {
                clamped = true;
                hi = today;
            }
            if (lo.isBefore(windowFrom)) {
                clamped = true;
                lo = windowFrom;
            }
            if (!lo.isAfter(hi)) {
                for (LocalDate d = lo; !d.isAfter(hi); d = d.plusDays(1)) {
                    requested.add(d);
                }
            }
        }

        NavigableSet<LocalDate> days = new TreeSet<>();
        for (LocalDate d : requested) {
            if (d.isBefore(windowFrom) || d.isAfter(today)) {
                clamped = true;
            } else {
                days.add(d);
            }
        }

        String header = "Alvás — részletes nézet"
                + (clamped ? ", visszavágva " + days.size() + " napra" : "") + ":";
        if (days.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }

        List<SleepLogEntity> rows = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
                        userId, days.first(), days.last());
        Map<LocalDate, SleepLogEntity> byDate = new HashMap<>();
        for (SleepLogEntity r : rows) {
            byDate.putIfAbsent(r.getDate(), r);
        }

        StringBuilder b = new StringBuilder(header);
        for (LocalDate d : days.descendingSet()) {
            SleepLogEntity row = byDate.get(d);
            b.append('\n').append(d)
                    .append(row == null ? ": nincs rögzített alvás" : ": " + renderDetailLine(row));
        }
        days.descendingSet().stream().limit(5)
                .forEach(d -> ToolContexts.audit(toolContext).addRef("Sleep", d.toString()));
        return b.toString();
    }

    /** One detail line for a populated row — fixed field order, every field null-guarded
     *  (absent fields omitted; spec §3). Clocks render as stored HH:MM strings. */
    private String renderDetailLine(SleepLogEntity row) {
        StringBuilder b = new StringBuilder();
        if (row.getBedtime() != null) {
            b.append("lefekvés ").append(row.getBedtime());
        }
        if (row.getWakeup() != null) {
            if (b.length() > 0) {
                b.append(", ");
            }
            b.append("ébredés ").append(row.getWakeup());
        }
        if (b.length() > 0) {
            b.append("; ");
        }
        if (row.getDurationH() != null) {
            b.append(hm(row.getDurationH()));
        }
        if (row.getInBedMin() != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("ágyban ").append(row.getInBedMin()).append("p");
        }
        List<String> stages = new ArrayList<>();
        if (row.getAwakeMin() != null) {
            stages.add("ébren " + row.getAwakeMin() + "p");
        }
        if (row.getLightMin() != null) {
            stages.add("könnyű " + row.getLightMin() + "p");
        }
        if (row.getRemMin() != null) {
            stages.add("REM " + row.getRemMin() + "p");
        }
        if (row.getDeepMin() != null) {
            stages.add("mély " + row.getDeepMin() + "p");
        }
        if (!stages.isEmpty()) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append(String.join(" · ", stages));
        }
        // mezo-b6zt: same fix as renderSleep above — one denominator, owned by ToolText.
        String quality = ToolText.sleepQuality(row.getQuality());
        if (quality != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("minőség ").append(quality);
        }
        if (row.getAwakenings() != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("ébredések ").append(row.getAwakenings());
        }
        if (row.getSource() != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("forrás: ").append(row.getSource());
            if (row.getSourceQualityPct() != null) {
                b.append(" (").append(row.getSourceQualityPct()).append("%)");
            }
        }
        if (row.getHypnogram() != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("hypnogram: ").append(row.getHypnogram().bucketMin()).append(' ')
                    .append(row.getHypnogram().stages());
        }
        if (row.getNotes() != null && !row.getNotes().isBlank()) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("megjegyzés: ").append(row.getNotes());
        }
        return b.toString();
    }

    /** 7.5 -> "7h 30p", 7.0 -> "7h" (house Hungarian compact hours). */
    private static String hm(BigDecimal hours) {
        int h = hours.intValue();
        int p = (int) Math.round((hours.doubleValue() - h) * 60);
        if (p == 60) {
            return (h + 1) + "h";
        }
        return p == 0 ? h + "h" : h + "h " + p + "p";
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
            // mezo-b6zt siblings: all four sliders are 1..10 (api/feature/checkin/checkin.yml) and
            // were already correct — but as four separate literals. Referenced once now, so this
            // renderer cannot drift from the day narrative the way the sleep denominator did.
            List<String> parts = new ArrayList<>();
            addRating(parts, "energia", c.getEnergy());
            addRating(parts, "stressz", c.getStress());
            addRating(parts, "testi", c.getBody());
            addRating(parts, "mentális", c.getMental());
            b.append(parts.isEmpty() ? ToolText.NO_DATA : String.join(", ", parts));
        }
        rows.stream().limit(5).forEach(c ->
                ToolContexts.audit(toolContext).addRef("CheckIn", c.getDate().toString()));
        return b.toString();
    }

    /** One "{label} {n}/10" slider reading, or nothing at all when the slot was left unanswered —
     *  a fabricated default (or the literal "null/10") in a tool payload is worse than silence. */
    private static void addRating(List<String> parts, String label, Integer value) {
        String rendered = ToolText.rating(value);
        if (rendered != null) {
            parts.add(label + " " + rendered);
        }
    }
}
