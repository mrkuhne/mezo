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
 *
 * <p><b>Check-in 2.0 (mezo-ck2, spec §3.5):</b> "low mood" is now {@code mood <= 4 OR
 * stress >= 7}, with {@code mental <= 4} only as the fallback for a day without a mood answer.
 * A second, <b>direct craving arm</b> compares the NOVA-4 share on strong-craving days
 * ({@code craving >= 7}) with the other answered days, under the Whoop guard (≥ 5 per group).
 * Either arm alone can fire; the state is the set of arms present.
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
    private static final int LOW_MOOD_MAX = 4;     // mood (fallback mental): higher = better
    private static final int CRAVING_MIN = 7;
    /** Whoop guard (Check-in 2.0 spec §6): the rotating craving item needs this many per group. */
    private static final int MIN_CRAVING_DAYS_PER_GROUP = 5;
    private static final double CRAVING_SHARE_DELTA = 0.10;

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
        List<String> sentences = new ArrayList<>();
        if (today.moodArm()) {
            // The spike test is a DISJUNCTION (NOVA-4 share above baseline OR kcal above baseline),
            // so the summary must name both clauses: attributing the whole count to processed-food
            // share alone would state a number the detector never computed.
            sentences.add("Rossz közérzetű napokon gyakrabban ugrik meg a bevitel — feljebb megy a "
                    + "feldolgozott étel aránya vagy a napi kalória a saját 8 hetes átlagához képest: "
                    + today.cooccurrences() + " ilyen nap a " + today.pairedDays()
                    + " összepárosított napból.");
        }
        if (today.craving() != null) {
            Craving c = today.craving();
            sentences.add("Azokon a napokon, amikor erős sóvárgást jeleztél (7 vagy fölötte), az "
                    + "ultrafeldolgozott étel a kalóriád " + TrailingWindow.pct(c.cravingShare())
                    + "%-át adta, a többi napon " + TrailingWindow.pct(c.otherShare()) + "%-át ("
                    + c.cravingDays() + " és " + c.otherDays() + " nap).");
        }
        return List.of(new DetectorSignal(key(), "taplalkozo", String.join(" ", sentences), 3));
    }

    /** {@code state} is the presence of each arm joined; {@code craving} null when that arm is silent. */
    private record Finding(String state, boolean moodArm, int cooccurrences, int pairedDays, Craving craving) {}

    private record Craving(int cravingDays, int otherDays, double cravingShare, double otherShare) {}

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
        boolean moodArm = lowMoodDays >= MIN_DAYS_PER_GROUP && otherDays >= MIN_DAYS_PER_GROUP
                && lowMoodSpikes >= MIN_COOCCURRENCES;
        if (moodArm) {
            double lowMoodRate = (double) lowMoodSpikes / lowMoodDays;
            double otherRate = (double) otherSpikes / otherDays;
            moodArm = otherRate == 0 || lowMoodRate >= otherRate * RATE_RATIO;
        }
        Craving craving = cravingArm(paired, checkins);
        if (!moodArm && craving == null) {
            return null;
        }
        String state = (moodArm ? "cooc" : "") + (craving != null ? "|craving" : "");
        return new Finding(state, moodArm, lowMoodSpikes, paired.size(), craving);
    }

    /**
     * The direct craving arm (Check-in 2.0, spec §3.5): the NOVA-4 kcal share on days with a
     * strong craving answer (day mean {@code >= }{@link #CRAVING_MIN}) vs days whose craving answer
     * was lower. Days without a craving answer are in neither group — never "no craving". Craving
     * is a rotating slot item, so the Whoop guard applies: {@link #MIN_CRAVING_DAYS_PER_GROUP} in
     * EACH group, and the craving days must run {@link #CRAVING_SHARE_DELTA} above the others.
     */
    private static Craving cravingArm(List<DetectorInput.MealDayPoint> paired,
                                      Map<LocalDate, DetectorInput.CheckinDayPoint> checkins) {
        double cravingSum = 0;
        double otherSum = 0;
        int cravingDays = 0;
        int otherDays = 0;
        for (DetectorInput.MealDayPoint m : paired) {
            BigDecimal craving = checkins.get(m.date()).craving();
            if (craving == null) {
                continue;
            }
            if (craving.doubleValue() >= CRAVING_MIN) {
                cravingDays++;
                cravingSum += m.nova4KcalShare().doubleValue();
            } else {
                otherDays++;
                otherSum += m.nova4KcalShare().doubleValue();
            }
        }
        if (cravingDays < MIN_CRAVING_DAYS_PER_GROUP || otherDays < MIN_CRAVING_DAYS_PER_GROUP) {
            return null;
        }
        double cravingShare = cravingSum / cravingDays;
        double otherShare = otherSum / otherDays;
        if (cravingShare - otherShare < CRAVING_SHARE_DELTA) {
            return null;
        }
        return new Craving(cravingDays, otherDays, cravingShare, otherShare);
    }

    /**
     * Check-in 2.0 (spec §3.5): low mood = {@code mood <= 4 OR stress >= 7}. {@code mental}
     * (fejtisztaság) is no longer a mood scale — it is only the FALLBACK on a day without a mood
     * answer, so pre-2.0 history keeps working. Energy no longer counts as mood.
     */
    private static boolean lowMood(DetectorInput.CheckinDayPoint c) {
        if (c.stress() != null && c.stress().doubleValue() >= HIGH_STRESS_MIN) {
            return true;
        }
        BigDecimal mood = c.mood() != null ? c.mood() : c.mental();
        return mood != null && mood.doubleValue() <= LOW_MOOD_MAX;
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
