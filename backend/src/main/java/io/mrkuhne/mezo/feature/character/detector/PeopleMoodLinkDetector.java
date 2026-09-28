package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * People × mood link (round 4, spec §5.1) — a WITHIN-PERSON covariance in the comfort-eating
 * shape: is the user's own mood check-in scale different on days with a people mention than on
 * days without one? Mention presence is the tag (any person, any context); the mood side is the
 * user's own scale, never the mention's LLM-filled tone. Exist.io's discipline: the sentence names
 * the difference AND an N-driven confidence tier separately, states co-occurrence, never
 * direction, and names no person.
 *
 * <p><b>Check-in 2.0 (mezo-ck2, spec §3.7/§3.8b):</b> the mood arm reads the new {@code mood}
 * item and falls back to {@code mental} (fejtisztaság — the pre-2.0 proxy) only on days without a
 * mood answer, so history keeps working. A second, <b>connection</b> arm compares the evening
 * {@code connection} answer on mention vs no-mention days. Connection is a rotating slot item, so
 * that arm carries the Whoop guard: no finding until {@link #MIN_CONNECTION_DAYS_PER_GROUP}
 * answers in EACH group.
 *
 * <p>No new-data pre-filter (spec §4.3): the state-change gate alone. State = the arms' bands
 * joined (or null), so the signal fires when a band first appears or flips sign — a fading band
 * is silent, exactly like {@code ComfortEatingDetector}.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class PeopleMoodLinkDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 42;
    static final int MIN_PAIRED_DAYS = 14;
    static final int MIN_DAYS_PER_GROUP = 3;
    /** Whoop guard for the rotating connection item (spec §6). */
    static final int MIN_CONNECTION_DAYS_PER_GROUP = 5;
    static final double BAND_DELTA = 1.0;
    static final int TIER_MEDIUM_MIN = 8;
    static final int TIER_STRONG_MIN = 16;

    @Override
    public String key() {
        return "people-mood-link";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        List<String> sentences = new ArrayList<>();
        Arm mood = today.mood();
        if (mood != null) {
            sentences.add("Az elmúlt 6 hét " + mood.mentionDays() + " olyan napján, amikor embert említettél és "
                    + "check-int is írtál, a hangulat check-in átlaga (ahol nem volt hangulat-válasz, a "
                    + "fejtisztaságé) " + TrailingWindow.hu(mood.mentionMean(), 1)
                    + " volt, a " + mood.otherDays() + " ilyen, említés nélküli napon "
                    + TrailingWindow.hu(mood.otherMean(), 1) + " — " + mood.band()
                    + " együttjárás, " + mood.tier() + " bizonyossággal (" + mood.mentionDays() + " nap).");
        }
        Arm conn = today.connection();
        if (conn != null) {
            sentences.add("A kapcsolódás-érzésed (esti kérdés) az említéses napokon átlagosan "
                    + TrailingWindow.hu(conn.mentionMean(), 1) + ", a többin "
                    + TrailingWindow.hu(conn.otherMean(), 1) + " (" + conn.mentionDays() + " és "
                    + conn.otherDays() + " nap) — " + conn.band() + " együttjárás, " + conn.tier()
                    + " bizonyossággal.");
        }
        String summary = String.join(" ", sentences) + " Együttjárás, nem irány; embert nem nevez.";
        boolean strong = (mood != null && "erős".equals(mood.tier()))
                || (conn != null && "erős".equals(conn.tier()));
        return List.of(new DetectorSignal(key(), "antropologus", summary, strong ? 4 : 3));
    }

    record Arm(String band, int mentionDays, int otherDays, BigDecimal mentionMean, BigDecimal otherMean,
               String tier) {}

    record State(String key, Arm mood, Arm connection) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Set<LocalDate> mentionDates = new HashSet<>();
        for (DetectorInput.MentionPoint m : in.trend().mentions()) {
            if (TrailingWindow.inWindow(m.date(), asOf, WINDOW_DAYS)) {
                mentionDates.add(m.date());
            }
        }
        Arm mood = arm(in, asOf, mentionDates, PeopleMoodLinkDetector::moodScale,
                MIN_PAIRED_DAYS, MIN_DAYS_PER_GROUP);
        Arm connection = arm(in, asOf, mentionDates, DetectorInput.CheckinDayPoint::connection,
                2 * MIN_CONNECTION_DAYS_PER_GROUP, MIN_CONNECTION_DAYS_PER_GROUP);
        if (mood == null && connection == null) {
            return null;
        }
        List<String> key = new ArrayList<>();
        if (mood != null) {
            key.add("hangulat:" + mood.band());
        }
        if (connection != null) {
            key.add("kapcsolodas:" + connection.band());
        }
        return new State(String.join("|", key), mood, connection);
    }

    /** The mood arm's value: {@code mood}, or {@code mental} on a day without a mood answer. */
    private static BigDecimal moodScale(DetectorInput.CheckinDayPoint c) {
        return c.mood() != null ? c.mood() : c.mental();
    }

    private static Arm arm(DetectorInput in, LocalDate asOf, Set<LocalDate> mentionDates,
                           Function<DetectorInput.CheckinDayPoint, BigDecimal> scale,
                           int minPaired, int minPerGroup) {
        BigDecimal mentionSum = BigDecimal.ZERO;
        BigDecimal otherSum = BigDecimal.ZERO;
        int mentionDays = 0;
        int otherDays = 0;
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            BigDecimal v = scale.apply(c);
            if (v == null || !TrailingWindow.inWindow(c.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            if (mentionDates.contains(c.date())) {
                mentionDays++;
                mentionSum = mentionSum.add(v);
            } else {
                otherDays++;
                otherSum = otherSum.add(v);
            }
        }
        if (mentionDays + otherDays < minPaired || mentionDays < minPerGroup || otherDays < minPerGroup) {
            return null;
        }
        BigDecimal mentionMean = mentionSum.divide(BigDecimal.valueOf(mentionDays), 2, RoundingMode.HALF_UP);
        BigDecimal otherMean = otherSum.divide(BigDecimal.valueOf(otherDays), 2, RoundingMode.HALF_UP);
        double delta = mentionMean.doubleValue() - otherMean.doubleValue();
        String band;
        if (delta >= BAND_DELTA) {
            band = "magasabb";
        } else if (delta <= -BAND_DELTA) {
            band = "alacsonyabb";
        } else {
            return null;
        }
        String tier = mentionDays >= TIER_STRONG_MIN ? "erős" : mentionDays >= TIER_MEDIUM_MIN ? "közepes" : "gyenge";
        return new Arm(band, mentionDays, otherDays, mentionMean, otherMean, tier);
    }
}
