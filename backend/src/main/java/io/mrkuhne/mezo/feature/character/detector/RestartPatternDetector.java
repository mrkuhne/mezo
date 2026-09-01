package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Restart pattern (round 3, spec §5.7): how long it took to get back to a complete Életjel day after
 * the most recent break, over a 28-day window.
 *
 * <p><b>These bands are an admitted heuristic.</b> The streak literature has no validated cut-off for
 * "healthy" restart latency — the only real empirical data point is a small qualitative study of
 * broken run streaks, and the popular "missing twice starts a new pattern" rule is a loose paraphrase
 * of a habit-automaticity finding, not a result (spec §2). The summary therefore states the elapsed
 * days as a fact and does not grade them, and this caveat is repeated in the Gépterem catalog entry.
 *
 * <p>No new-data pre-filter, for the same reason as {@code streak-break-response}: an open restart is
 * precisely the state in which nothing is being written.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class RestartPatternDetector implements CharacterDetector {

    private static final int WINDOW_DAYS = 28;
    private static final int ROVID_MAX = 3;
    private static final int HOSSZU_MAX = 7;

    @Override
    public String key() {
        return "restart-pattern";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().needs() == null) {
            return List.of();
        }
        RestartState today = state(in, in.day());
        RestartState yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.band().equals(yesterday == null ? null : yesterday.band())) {
            return List.of();
        }
        String summary = switch (today.band()) {
            case "azonnal" -> "A legutóbbi megszakadás után már a következő nap ismét teljes Életjel-nap lett.";
            case "rovid" -> "A legutóbbi megszakadás után néhány napon belül lett újra teljes Életjel-nap.";
            case "hosszu" -> "A legutóbbi megszakadás után több mint három nap telt el az első újra teljes Életjel-napig.";
            case "elhuzodo" -> "A legutóbbi megszakadás után " + today.gapDays()
                    + " nap telt el az első újra teljes Életjel-napig.";
            default -> "A legutóbbi megszakadás óta még nem volt újra teljes Életjel-nap.";
        };
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }

    private record RestartState(String band, Long gapDays) {}

    private static RestartState state(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.NeedsDayPoint> days = StreakBreakResponseDetector.byDate(in);
        LocalDate broke = StreakBreakResponseDetector.lastBreak(days, asOf, WINDOW_DAYS);
        if (broke == null) {
            return null;
        }
        for (LocalDate d = broke; !d.isAfter(asOf); d = d.plusDays(1)) {
            if (StreakBreakResponseDetector.allGreen(days, d)) {
                long gap = java.time.temporal.ChronoUnit.DAYS.between(broke, d);
                String band = gap <= 1 ? "azonnal" : gap <= ROVID_MAX ? "rovid"
                        : gap <= HOSSZU_MAX ? "hosszu" : "elhuzodo";
                return new RestartState(band, gap);
            }
        }
        return new RestartState("nyitott", null);
    }
}
