package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Sleep need (Check-in 2.0, mezo-ck2, spec §3.6) — the user's PERSONAL sleep need, read off their
 * own answers: the morning {@code rested} day mean paired with the logged duration of the night
 * leading into that day (the companion "last night" convention), over the whole 8-week series.
 *
 * <p>Method (deliberately simple and explainable): bin the nights into 30-minute duration buckets;
 * only buckets with {@link #MIN_NIGHTS_PER_BUCKET} nights count (the Whoop guard — every compared
 * group needs 5 answers). The need is the lower edge of the SHORTEST counted bucket whose mean
 * rested is within {@link #PLATEAU_TOLERANCE} of the best bucket's mean — "above this, you do not
 * feel more rested". Honesty guards: at least {@link #MIN_PAIRED_NIGHTS} paired nights, at least
 * two counted buckets, a real spread ({@link #MIN_SPREAD}) between the worst and best bucket, and
 * at least one counted bucket ABOVE the chosen one — without a longer bucket there is no evidence
 * of a plateau, only "the longest nights so far were the best".
 *
 * <p>When the estimate differs from the sleep goal's target by {@link #GOAL_DIFF_MINUTES} or more,
 * the summary PROPOSES updating the goal. The detector never writes the goal (spec §3.6: no silent
 * change) — it has no write path at all.
 *
 * <p>State-change gate: state = the need in minutes plus whether a goal proposal is attached.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class SleepNeedDetector implements CharacterDetector {

    static final int MIN_PAIRED_NIGHTS = 14;
    static final int MIN_NIGHTS_PER_BUCKET = 5;
    static final double PLATEAU_TOLERANCE = 0.5;
    static final double MIN_SPREAD = 1.0;
    static final int GOAL_DIFF_MINUTES = 30;
    static final int BUCKET_MINUTES = 30;

    @Override
    public String key() {
        return "sleep-need";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        StringBuilder sb = new StringBuilder("A saját reggeli kipihentség-válaszaid és az előző éjszakai alvás hossza alapján (")
                .append(today.pairedNights()).append(" összepárosított éjszaka, 8 hét) neked kb. ")
                .append(hours(today.needMinutes()))
                .append(" óra alvás elég: e fölött már nem érzed magad érdemben kipihentebbnek (")
                .append(hours(today.needMinutes())).append("–").append(hours(today.needMinutes() + BUCKET_MINUTES))
                .append(" órás éjszakák után átlagosan ").append(one(today.needMean())).append("/10, a legjobb sávban ")
                .append(one(today.bestMean())).append("/10; a legrövidebb számolt sávban ")
                .append(one(today.worstMean())).append("/10).");
        if (today.goalMinutes() != null && today.proposeGoal()) {
            sb.append(" Az alváscélod most ").append(hours(today.goalMinutes()))
                    .append(" óra — érdemes lehet ").append(hours(today.needMinutes()))
                    .append(" órára igazítani. Ez csak javaslat: a cél magától nem változik.");
        }
        return List.of(new DetectorSignal(key(), "szomnologus", sb.toString(), today.proposeGoal() ? 4 : 3));
    }

    record State(String key, int pairedNights, int needMinutes, double needMean, double bestMean,
                 double worstMean, Integer goalMinutes, boolean proposeGoal) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, Double> rested = new HashMap<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (c.rested() != null && !c.date().isAfter(asOf)) {
                rested.put(c.date(), c.rested().doubleValue());
            }
        }
        TreeMap<Integer, List<Double>> buckets = new TreeMap<>();
        int paired = 0;
        for (DetectorInput.SleepPoint s : in.trend().sleepEightWeeks()) {
            Double r = rested.get(s.date());
            if (r == null || s.durationH() == null || s.date().isAfter(asOf)) {
                continue;
            }
            int minutes = (int) Math.round(s.durationH().doubleValue() * 60);
            int bucket = Math.floorDiv(minutes, BUCKET_MINUTES) * BUCKET_MINUTES;
            buckets.computeIfAbsent(bucket, k -> new ArrayList<>()).add(r);
            paired++;
        }
        if (paired < MIN_PAIRED_NIGHTS) {
            return null;
        }
        TreeMap<Integer, Double> means = new TreeMap<>();
        buckets.forEach((b, values) -> {
            if (values.size() >= MIN_NIGHTS_PER_BUCKET) {
                means.put(b, values.stream().mapToDouble(Double::doubleValue).average().orElseThrow());
            }
        });
        if (means.size() < 2) {
            return null;
        }
        double best = means.values().stream().mapToDouble(Double::doubleValue).max().orElseThrow();
        double worst = means.firstEntry().getValue();
        if (best - worst < MIN_SPREAD) {
            return null;
        }
        Map.Entry<Integer, Double> need = null;
        for (Map.Entry<Integer, Double> e : means.entrySet()) {
            if (e.getValue() >= best - PLATEAU_TOLERANCE) {
                need = e;
                break;
            }
        }
        if (need == null || means.higherKey(need.getKey()) == null) {
            return null; // no longer bucket: no evidence of a plateau
        }
        Integer goal = in.trend().sleepGoalMinutes();
        boolean propose = goal != null && Math.abs(goal - need.getKey()) >= GOAL_DIFF_MINUTES;
        return new State(need.getKey() + (propose ? "|javaslat" : ""), paired, need.getKey(), need.getValue(),
                best, worst, goal, propose);
    }

    /** Minutes → Hungarian hours: 450 → "7,5", 420 → "7", 435 → "7,3" (rounded to one decimal). */
    static String hours(int minutes) {
        if (minutes % 60 == 0) {
            return String.valueOf(minutes / 60);
        }
        return TrailingWindow.hu(java.math.BigDecimal.valueOf(minutes / 60.0), 1);
    }

    private static String one(double v) {
        return TrailingWindow.hu(java.math.BigDecimal.valueOf(v), 1);
    }
}
