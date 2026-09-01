package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Comfort eating (round 2, spec §2 and §5) — a WITHIN-PERSON covariance, never a population rule:
 * on days where both a check-in and NOVA-classified meals exist, does an intake spike (a NOVA-4
 * kcal share well above the user's OWN 8-week baseline, or a kcal spike above it) land
 * disproportionately on low-mood days?
 *
 * <p>The deterministic proxy is the NOVA-4 share of the day's kcal (nutrition epidemiology's
 * measure), computed at line level and null on days whose coverage was too thin to trust — such
 * days are simply not paired. Needs {@link #MIN_PAIRED_DAYS} paired days; below that the detector
 * is silent rather than noisy, which is the honest reading of a thin sample.
 *
 * <p>The read layer only nulls {@code nova4KcalShare} when ZERO of the day's kcal carries a NOVA
 * class, so a non-null share alone does not mean the day's coverage is trustworthy. This detector
 * additionally requires {@code novaCoveragePct >= }{@link #MIN_NOVA_COVERAGE} for a day to be
 * paired — a day with a non-null share but thin coverage is excluded just like a fully-null day.
 *
 * <p>Both sides of the comparison need {@link #MIN_DAYS_PER_GROUP} days. Without a floor on the
 * NON-low-mood group a chronically stressed user (every paired day low-mood) would receive a
 * covariance claim computed against an empty contrast group.
 *
 * <p>The summary states an observed co-occurrence and nothing more — no cause, no diagnosis — and
 * names BOTH halves of the spike test, because the test is a disjunction (share OR kcal).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class ComfortEatingDetector implements CharacterDetector {

    private static final int MIN_PAIRED_DAYS = 14;
    private static final int MIN_COOCCURRENCES = 3;
    /** Both groups need a floor, mirroring {@code ProteinTrainingMismatchDetector}: a covariance
     *  claim computed against an EMPTY contrast group is not a covariance at all. */
    private static final int MIN_DAYS_PER_GROUP = 3;
    private static final BigDecimal NOVA_SPIKE_OVER_BASELINE = new BigDecimal("0.15");
    private static final BigDecimal MIN_NOVA_COVERAGE = new BigDecimal("0.70");
    private static final double KCAL_SPIKE_FACTOR = 1.20;
    private static final double RATE_RATIO = 1.5;
    private static final int HIGH_STRESS_MIN = 7;  // stress: higher = worse
    private static final int LOW_MENTAL_MAX = 4;   // mental/energy: higher = better
    private static final int LOW_ENERGY_MAX = 4;

    @Override
    public String key() {
        return "comfort-eating";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newMealData(in) && !DetectorGates.newCheckinData(in)) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || today.state().equals(yesterday == null ? "" : yesterday.state())) {
            return List.of();
        }
        // The spike test is a DISJUNCTION (NOVA-4 share above baseline OR kcal above baseline), so
        // the summary must name both clauses: attributing the whole count to processed-food share
        // alone would state a number the detector never computed.
        String summary = "Rossz közérzetű napokon gyakrabban ugrik meg a bevitel — feljebb megy a "
                + "feldolgozott étel aránya vagy a napi kalória a saját 8 hetes átlagához képest: "
                + today.cooccurrences() + " ilyen nap a " + today.pairedDays()
                + " összepárosított napból.";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 3));
    }

    private record Finding(String state, int cooccurrences, int pairedDays) {}

    /**
     * Pairs the whole 8-week series (a covariance needs the long window). The STATE is a bare
     * PRESENCE marker ({@code "cooc"} or null): spec §6 wants a band/direction/bucket/offender
     * key, never a moving count. An earlier count-valued state re-announced nightly, because
     * {@code paired.size()} grows on every day a normal user logs both a meal and a check-in.
     * The exact counts still reach the user — in the summary, which is not the gate.
     */
    private static Finding finding(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.CheckinDayPoint> checkins = new HashMap<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (!c.date().isAfter(asOf)) {
                checkins.put(c.date(), c);
            }
        }
        List<DetectorInput.MealDayPoint> paired = new ArrayList<>();
        for (DetectorInput.MealDayPoint m : in.trend().mealDays()) {
            if (!m.date().isAfter(asOf) && m.nova4KcalShare() != null
                    && m.novaCoveragePct() != null
                    && m.novaCoveragePct().compareTo(MIN_NOVA_COVERAGE) >= 0
                    && checkins.containsKey(m.date())) {
                paired.add(m);
            }
        }
        if (paired.size() < MIN_PAIRED_DAYS) {
            return null;
        }
        BigDecimal shareBaseline = mean(paired, DetectorInput.MealDayPoint::nova4KcalShare);
        BigDecimal kcalBaseline = mean(paired, DetectorInput.MealDayPoint::kcal);
        BigDecimal spikeThreshold = shareBaseline.add(NOVA_SPIKE_OVER_BASELINE);

        int lowMoodDays = 0;
        int lowMoodSpikes = 0;
        int otherDays = 0;
        int otherSpikes = 0;
        for (DetectorInput.MealDayPoint m : paired) {
            boolean spike = m.nova4KcalShare().compareTo(spikeThreshold) >= 0
                    || m.kcal().doubleValue() >= kcalBaseline.doubleValue() * KCAL_SPIKE_FACTOR;
            if (lowMood(checkins.get(m.date()))) {
                lowMoodDays++;
                if (spike) {
                    lowMoodSpikes++;
                }
            } else {
                otherDays++;
                if (spike) {
                    otherSpikes++;
                }
            }
        }
        // BOTH groups need a floor: with no non-low-mood days there is nothing to covary AGAINST,
        // and the rate-ratio guard below would be skipped entirely — a chronically stressed user
        // (every paired day low-mood) would get a covariance claim computed against nothing.
        if (lowMoodDays < MIN_DAYS_PER_GROUP || otherDays < MIN_DAYS_PER_GROUP
                || lowMoodSpikes < MIN_COOCCURRENCES) {
            return null;
        }
        double lowMoodRate = (double) lowMoodSpikes / lowMoodDays;
        double otherRate = (double) otherSpikes / otherDays;
        if (otherRate > 0 && lowMoodRate < otherRate * RATE_RATIO) {
            return null;
        }
        return new Finding("cooc", lowMoodSpikes, paired.size());
    }

    private static boolean lowMood(DetectorInput.CheckinDayPoint c) {
        return (c.stress() != null && c.stress().doubleValue() >= HIGH_STRESS_MIN)
                || (c.mental() != null && c.mental().doubleValue() <= LOW_MENTAL_MAX)
                || (c.energy() != null && c.energy().doubleValue() <= LOW_ENERGY_MAX);
    }

    private static BigDecimal mean(List<DetectorInput.MealDayPoint> rows,
                                   java.util.function.Function<DetectorInput.MealDayPoint, BigDecimal> f) {
        BigDecimal sum = BigDecimal.ZERO;
        int n = 0;
        for (DetectorInput.MealDayPoint m : rows) {
            BigDecimal v = f.apply(m);
            if (v != null) {
                sum = sum.add(v);
                n++;
            }
        }
        return n == 0 ? BigDecimal.ZERO
                : sum.divide(BigDecimal.valueOf(n), 4, java.math.RoundingMode.HALF_UP);
    }
}
