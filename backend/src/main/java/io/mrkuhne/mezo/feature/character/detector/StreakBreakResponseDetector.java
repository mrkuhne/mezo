package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Streak break response (round 3, spec §5.6): after the most recent break of the Életjel all-green
 * streak, did the next three days cascade or recover? This is the "what-the-hell effect" / abstinence
 * violation effect in the literature — a real construct, though the literature also says collapse is
 * a RISK, not the default outcome (spec §2), which is why the summary states the fact rather than
 * grading the response.
 *
 * <p>A day with NO closed row counts as a break. That is not a violation of "absent ≠ zero": it is a
 * deliberate mirror of {@code NeedsService.closeNew}, which resets the streak when the previous
 * calendar day has no row. The domain owns that rule; this detector follows it rather than inventing
 * a second, contradictory one.
 *
 * <p>No new-data pre-filter: a cascade means no rows are being written at all, so gating on new
 * needs data would silence precisely the case of interest (spec §4.2).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class StreakBreakResponseDetector implements CharacterDetector {

    private static final int RESPONSE_DAYS = 3;
    private static final int VISSZAALL_MIN = 2;

    @Override
    public String key() {
        return "streak-break-response";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().needs() == null) {
            return List.of();
        }
        String today = state(in, in.day());
        String yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = switch (today) {
            case "toresvalasz:kaszkad" -> "A legutóbbi megszakadt Életjel-sorozat után a következő három nap egyike sem lett teljes.";
            case "toresvalasz:vontatott" -> "A legutóbbi megszakadt Életjel-sorozat után a következő három napból egy lett teljes.";
            default -> "A legutóbbi megszakadt Életjel-sorozat után a következő három napból legalább kettő ismét teljes lett.";
        };
        int salience = "toresvalasz:kaszkad".equals(today) ? 4 : 3;
        return List.of(new DetectorSignal(key(), "pszichologus", summary, salience));
    }

    static Map<LocalDate, DetectorInput.NeedsDayPoint> byDate(DetectorInput in) {
        Map<LocalDate, DetectorInput.NeedsDayPoint> map = new HashMap<>();
        for (DetectorInput.NeedsDayPoint d : in.trend().needs().days()) {
            map.put(d.date(), d);
        }
        return map;
    }

    /** True when the streak was alive on {@code date}: a closed, all-green row exists for it. */
    static boolean allGreen(Map<LocalDate, DetectorInput.NeedsDayPoint> days, LocalDate date) {
        DetectorInput.NeedsDayPoint d = days.get(date);
        return d != null && d.allGreen();
    }

    /**
     * The most recent day in the trailing {@code windowDays} on which an alive streak broke, or
     * null when there was none. A break is: the previous day was all-green, this day is not (either
     * unclosed or closed without all six rings) — the {@code NeedsService.closeNew} rule.
     */
    static LocalDate lastBreak(Map<LocalDate, DetectorInput.NeedsDayPoint> days, LocalDate asOf,
                               int windowDays) {
        for (LocalDate d = asOf; !d.isBefore(asOf.minusDays(windowDays - 1L)); d = d.minusDays(1)) {
            if (allGreen(days, d.minusDays(1)) && !allGreen(days, d)) {
                return d;
            }
        }
        return null;
    }

    private static String state(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.NeedsDayPoint> days = byDate(in);
        LocalDate broke = lastBreak(days, asOf, TrailingWindow.WINDOW_DAYS);
        if (broke == null || broke.plusDays(RESPONSE_DAYS).isAfter(asOf)) {
            return null;   // no break, or the response window has not fully elapsed yet
        }
        int recovered = 0;
        for (int i = 1; i <= RESPONSE_DAYS; i++) {
            if (allGreen(days, broke.plusDays(i))) {
                recovered++;
            }
        }
        String band = recovered >= VISSZAALL_MIN ? "visszaall" : recovered == 1 ? "vontatott" : "kaszkad";
        return "toresvalasz:" + band;
    }
}
