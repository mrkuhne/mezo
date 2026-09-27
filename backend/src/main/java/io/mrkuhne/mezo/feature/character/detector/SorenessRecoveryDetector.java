package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Soreness recovery (Check-in 2.0, mezo-ck2, spec §3.7) — per session type, how many days until
 * the user's self-reported soreness returns to THEIR OWN baseline after a gym session?
 *
 * <p>Baseline = the median soreness day mean over the 8-week series on days with no gym session
 * on that day or the {@link #QUIET_DAYS} days before it (needs {@link #MIN_BASELINE_DAYS} such
 * days). An episode starts at a completed gym session; recovery = the first following day
 * (1..{@link #MAX_FOLLOW_DAYS}) whose soreness is back within {@link #BASELINE_TOLERANCE} of the
 * baseline. Not back by then counts as {@code MAX_FOLLOW_DAYS + 1} ("more than 4 days"). An
 * episode is dropped (censored) when another gym session falls before the return, or when no
 * soreness answer exists in the follow-up days — missing answers are absent, never "recovered".
 *
 * <p>Grouped by the session's own type ({@code workout_session.type}; unknown → "edzés").
 * Whoop guard: a type is reported only with {@link #MIN_EPISODES} episodes. State = each reported
 * type with its mean rounded to whole days, so a drift of a fraction of a day stays silent.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class SorenessRecoveryDetector implements CharacterDetector {

    static final int QUIET_DAYS = 2;
    static final int MIN_BASELINE_DAYS = 5;
    static final int MAX_FOLLOW_DAYS = 4;
    static final double BASELINE_TOLERANCE = 0.5;
    static final int MIN_EPISODES = 5;
    static final String UNKNOWN_TYPE = "edzés";

    @Override
    public String key() {
        return "soreness-recovery";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        List<String> parts = new ArrayList<>();
        boolean slow = false;
        for (Map.Entry<String, double[]> e : today.byType().entrySet()) {
            double mean = e.getValue()[0];
            slow |= mean > MAX_FOLLOW_DAYS - 1;
            parts.add(e.getKey() + ": átlagosan " + TrailingWindow.hu(BigDecimal.valueOf(mean), 1) + " nap ("
                    + (int) e.getValue()[1] + " edzés)");
        }
        String summary = "Az izomlázad a saját alapszintedre (" + TrailingWindow.hu(today.baseline(), 1)
                + "/10) edzés után így áll vissza — " + String.join("; ", parts)
                + ". A 4 napon túli visszaállás 5 napnak számít; ahol közben újabb edzés jött, az kimaradt.";
        return List.of(new DetectorSignal(key(), "edzo", summary, slow ? 4 : 3));
    }

    /** {@code byType}: session type → {mean recovery days, episode count}, type order alphabetical. */
    record State(String key, BigDecimal baseline, Map<String, double[]> byType) {}

    static State state(DetectorInput in, LocalDate asOf) {
        TreeMap<LocalDate, Double> soreness = new TreeMap<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (c.soreness() != null && !c.date().isAfter(asOf)) {
                soreness.put(c.date(), c.soreness().doubleValue());
            }
        }
        Set<LocalDate> gymDates = new HashSet<>();
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            if (!g.date().isAfter(asOf)) {
                gymDates.add(g.date());
            }
        }
        List<Double> quiet = new ArrayList<>();
        for (Map.Entry<LocalDate, Double> e : soreness.entrySet()) {
            boolean nearGym = false;
            for (int i = 0; i <= QUIET_DAYS; i++) {
                nearGym |= gymDates.contains(e.getKey().minusDays(i));
            }
            if (!nearGym) {
                quiet.add(e.getValue());
            }
        }
        if (quiet.size() < MIN_BASELINE_DAYS) {
            return null;
        }
        quiet.sort(Double::compare);
        int n = quiet.size();
        double baseline = n % 2 == 1 ? quiet.get(n / 2) : (quiet.get(n / 2 - 1) + quiet.get(n / 2)) / 2.0;

        Map<String, List<Integer>> episodes = new TreeMap<>();
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            if (g.date().isAfter(asOf)) {
                continue;
            }
            Integer days = recovery(g.date(), asOf, soreness, gymDates, baseline);
            if (days != null) {
                String type = g.sessionType() == null || g.sessionType().isBlank() ? UNKNOWN_TYPE : g.sessionType().strip();
                episodes.computeIfAbsent(type, k -> new ArrayList<>()).add(days);
            }
        }
        Map<String, double[]> byType = new TreeMap<>();
        List<String> key = new ArrayList<>();
        for (Map.Entry<String, List<Integer>> e : episodes.entrySet()) {
            if (e.getValue().size() < MIN_EPISODES) {
                continue;
            }
            double mean = e.getValue().stream().mapToInt(Integer::intValue).average().orElseThrow();
            byType.put(e.getKey(), new double[] {mean, e.getValue().size()});
            key.add(e.getKey() + ":" + Math.round(mean));
        }
        if (byType.isEmpty()) {
            return null;
        }
        return new State(String.join("|", key), BigDecimal.valueOf(baseline), byType);
    }

    /** Days until soreness is back at baseline after a session on {@code gym}; null = censored. */
    private static Integer recovery(LocalDate gym, LocalDate asOf, TreeMap<LocalDate, Double> soreness,
                                    Set<LocalDate> gymDates, double baseline) {
        boolean answered = false;
        for (int k = 1; k <= MAX_FOLLOW_DAYS; k++) {
            LocalDate d = gym.plusDays(k);
            if (d.isAfter(asOf)) {
                return null; // the follow-up has not finished yet
            }
            Double s = soreness.get(d);
            if (s != null) {
                answered = true;
                if (s <= baseline + BASELINE_TOLERANCE) {
                    return k;
                }
            }
            if (gymDates.contains(d)) {
                return null; // a new session before the return — the episodes overlap
            }
        }
        return answered ? MAX_FOLLOW_DAYS + 1 : null;
    }
}
