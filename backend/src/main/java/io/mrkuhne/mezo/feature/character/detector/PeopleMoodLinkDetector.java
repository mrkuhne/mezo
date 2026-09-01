package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * People × mood link (round 4, spec §5.1) — a WITHIN-PERSON covariance in the comfort-eating
 * shape: is the user's own MENTAL check-in scale different on days with a people mention than on
 * days without one? Mention presence is the tag (any person, any context); the mood side is the
 * user's own scale, never the mention's LLM-filled tone. Exist.io's discipline: the sentence names
 * the difference AND an N-driven confidence tier separately, states co-occurrence, never
 * direction, and names no person.
 *
 * <p>No new-data pre-filter (spec §4.3): the state-change gate alone. State = the band or null,
 * so the signal fires when a band first appears or flips sign — a fading band is silent, exactly
 * like {@code ComfortEatingDetector}.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class PeopleMoodLinkDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 42;
    static final int MIN_PAIRED_DAYS = 14;
    static final int MIN_DAYS_PER_GROUP = 3;
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
        if (today == null || today.band().equals(yesterday == null ? "" : yesterday.band())) {
            return List.of();
        }
        String summary = "Az elmúlt 6 hét " + today.mentionDays() + " napján, amikor embert említettél, a mentális "
                + "check-in átlaga " + TrailingWindow.hu(today.mentionMean(), 1) + " volt, a " + today.otherDays()
                + " említés nélküli napon " + TrailingWindow.hu(today.otherMean(), 1) + " — " + today.band()
                + " együttjárás, " + today.tier() + " bizonyossággal (" + today.mentionDays()
                + " nap). Együttjárás, nem irány; embert nem nevez.";
        return List.of(new DetectorSignal(key(), "antropologus", summary, "erős".equals(today.tier()) ? 4 : 3));
    }

    record State(String band, int mentionDays, int otherDays, BigDecimal mentionMean, BigDecimal otherMean,
                 String tier) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Set<LocalDate> mentionDates = new HashSet<>();
        for (DetectorInput.MentionPoint m : in.trend().mentions()) {
            if (TrailingWindow.inWindow(m.date(), asOf, WINDOW_DAYS)) {
                mentionDates.add(m.date());
            }
        }
        BigDecimal mentionSum = BigDecimal.ZERO;
        BigDecimal otherSum = BigDecimal.ZERO;
        int mentionDays = 0;
        int otherDays = 0;
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (c.mental() == null || !TrailingWindow.inWindow(c.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            if (mentionDates.contains(c.date())) {
                mentionDays++;
                mentionSum = mentionSum.add(c.mental());
            } else {
                otherDays++;
                otherSum = otherSum.add(c.mental());
            }
        }
        if (mentionDays + otherDays < MIN_PAIRED_DAYS || mentionDays < MIN_DAYS_PER_GROUP
                || otherDays < MIN_DAYS_PER_GROUP) {
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
        return new State(band, mentionDays, otherDays, mentionMean, otherMean, tier);
    }
}
