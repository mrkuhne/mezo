package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Pain map (Check-in 2.0, mezo-ck2, spec §3.7) — the self-reported counterpart of
 * {@code NiggleMapDetector}: which body region does the user's own "Fáj valami?" answer keep
 * naming? A region is RECURRING when it was reported on at least {@link #MIN_DAYS} distinct days
 * of the trailing {@link TrailingWindow#WINDOW_DAYS}-day window.
 *
 * <p>For the most frequent recurring region the summary adds ONE easily-checked context when it
 * is clear-cut: whether those days were gym days or the day after one ({@link #CONTEXT_SHARE} of
 * them or none of them), or whether they fell only on weekdays / only on the weekend. Nothing
 * else is inferred — the Doki mirrors, it does not diagnose.
 *
 * <p>No new-data pre-filter (check-ins arrive daily): the state-change gate alone. State = the
 * sorted set of recurring regions, so the signal fires when a region first becomes recurring
 * (or a new one joins), not every night while it stays.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class PainMapDetector implements CharacterDetector {

    static final int MIN_DAYS = 3;
    static final double CONTEXT_SHARE = 0.75;
    static final double HIGH_INTENSITY = 6.0;
    static final int LONG_RUN_DAYS = 7;

    @Override
    public String key() {
        return "pain-map";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        PainRegion top = today.top();
        List<LocalDate> topDays = today.days().get(top);
        StringBuilder sb = new StringBuilder("Visszatérő, saját jelzésű fájdalom az elmúlt 2 hétben: ");
        List<String> parts = new ArrayList<>();
        for (Map.Entry<PainRegion, List<LocalDate>> e : today.days().entrySet()) {
            parts.add(e.getKey().label().toLowerCase(java.util.Locale.ROOT) + " " + e.getValue().size() + " napon");
        }
        sb.append(String.join(", ", parts)).append('.');
        BigDecimal intensity = meanIntensity(in, topDays);
        if (intensity != null) {
            sb.append(" A leggyakoribb helyen (").append(top.label().toLowerCase(java.util.Locale.ROOT))
                    .append(") ezeken a napokon a jelzett fájdalom átlagos erőssége ")
                    .append(TrailingWindow.hu(intensity, 1)).append("/10.");
        }
        String context = context(in, topDays);
        if (context != null) {
            sb.append(" ").append(context);
        }
        sb.append(" Ez a saját jelzésed összesítése, nem diagnózis.");
        boolean serious = topDays.size() >= LONG_RUN_DAYS
                || (intensity != null && intensity.doubleValue() >= HIGH_INTENSITY);
        return List.of(new DetectorSignal(key(), "doki", sb.toString(), serious ? 4 : 3));
    }

    /** {@code days}: every recurring region → its report days, ordered by count desc then enum order. */
    record State(String key, Map<PainRegion, List<LocalDate>> days, PainRegion top) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<PainRegion, List<LocalDate>> byRegion = new EnumMap<>(PainRegion.class);
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (!TrailingWindow.inWindow(c.date(), asOf) || c.painRegions() == null) {
                continue;
            }
            for (PainRegion r : c.painRegions()) {
                byRegion.computeIfAbsent(r, k -> new ArrayList<>()).add(c.date());
            }
        }
        byRegion.values().removeIf(d -> d.size() < MIN_DAYS);
        if (byRegion.isEmpty()) {
            return null;
        }
        Map<PainRegion, List<LocalDate>> ordered = new java.util.LinkedHashMap<>();
        byRegion.entrySet().stream()
                .sorted((a, b) -> a.getValue().size() != b.getValue().size()
                        ? Integer.compare(b.getValue().size(), a.getValue().size())
                        : a.getKey().compareTo(b.getKey()))
                .forEach(e -> ordered.put(e.getKey(), e.getValue()));
        String key = String.join(",", byRegion.keySet().stream().map(Enum::name).toList());
        return new State(key, ordered, ordered.keySet().iterator().next());
    }

    /** The day-mean pain intensity over the region's days; null when no intensity was given. */
    private static BigDecimal meanIntensity(DetectorInput in, List<LocalDate> days) {
        Set<LocalDate> wanted = new HashSet<>(days);
        BigDecimal sum = BigDecimal.ZERO;
        int n = 0;
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (wanted.contains(c.date()) && c.painIntensity() != null) {
                sum = sum.add(c.painIntensity());
                n++;
            }
        }
        return n == 0 ? null : sum.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
    }

    /** One clear-cut co-occurring context, or null when nothing is clear-cut. */
    private static String context(DetectorInput in, List<LocalDate> days) {
        Set<LocalDate> gymDates = new HashSet<>();
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            gymDates.add(g.date());
        }
        int afterGym = 0;
        int weekend = 0;
        for (LocalDate d : days) {
            if (gymDates.contains(d) || gymDates.contains(d.minusDays(1))) {
                afterGym++;
            }
            if (d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY) {
                weekend++;
            }
        }
        if (!gymDates.isEmpty() && (double) afterGym / days.size() >= CONTEXT_SHARE) {
            return "Főleg edzésnapon vagy az azt követő napon jelentkezett (" + afterGym + "/" + days.size() + ").";
        }
        if (!gymDates.isEmpty() && afterGym == 0) {
            return "Egyik alkalom sem edzésnapra vagy edzés utáni napra esett.";
        }
        if (weekend == 0) {
            return "Mind hétköznapra esett.";
        }
        if (weekend == days.size()) {
            return "Mind hétvégére esett.";
        }
        return null;
    }
}
