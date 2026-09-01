package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Hydration consistency (round 2, spec §5): over the trailing 14 days with any water log, what
 * share of days reached 90% of the daily target? Bands: JO (>= 80%), INGADOZO (40-80%), ALACSONY
 * (< 40%). Deliberately NOT a streak/gamification signal (round-2 spec §2) — the analytically
 * useful half is the on-target day rate.
 *
 * <p>Days with no water log at all are ABSENT from the series, so they neither count as 0 ml nor
 * as an on-target day; the rate is computed over logged days only, and needs at least
 * {@link #MIN_LOGGED_DAYS} of them. Fires only on a band change (round-2 spec §6).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class HydrationConsistencyDetector implements CharacterDetector {

    private static final int MIN_LOGGED_DAYS = 7;
    private static final double ON_TARGET_FRACTION = 0.90;
    private static final double JO_MIN = 0.80;
    private static final double INGADOZO_MIN = 0.40;

    @Override
    public String key() {
        return "hydration-consistency";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newWaterData(in)) {
            return List.of();
        }
        Band today = band(in, in.day());
        Band yesterday = band(in, in.day().minusDays(1));
        if (today == null || today.name().equals(yesterday == null ? "" : yesterday.name())) {
            return List.of();
        }
        String phrase = switch (today.name()) {
            case "JO" -> "stabilan a napi vízcél közelében marad";
            case "INGADOZO" -> "ingadozik a napi vízcél körül";
            default -> "rendszeresen elmarad a napi vízcéltól";
        };
        // The bar is 90% OF the target, not the target itself: a 3600/4000 ml day counts as an
        // on-target day here, so the copy names the 90% bar rather than claiming "teljesült a cél".
        String summary = "A hidratáltság " + phrase + ": " + today.loggedDays()
                + " logolt napból " + today.onTargetDays()
                + " napon érte el a napi vízcél 90%-át (14 nap).";
        int salience = "ALACSONY".equals(today.name()) ? 4 : 3;
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, salience));
    }

    private record Band(String name, int loggedDays, int onTargetDays) {}

    private static Band band(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.WaterDayPoint> window = new ArrayList<>();
        for (DetectorInput.WaterDayPoint w : in.trend().waterDays()) {
            if (RoundTwoWindow.inWindow(w.date(), asOf)) {
                window.add(w);
            }
        }
        if (window.size() < MIN_LOGGED_DAYS) {
            return null;
        }
        int onTarget = 0;
        for (DetectorInput.WaterDayPoint w : window) {
            if (w.targetMl() > 0 && w.amountMl() >= w.targetMl() * ON_TARGET_FRACTION) {
                onTarget++;
            }
        }
        double rate = (double) onTarget / window.size();
        String name = rate >= JO_MIN ? "JO" : rate >= INGADOZO_MIN ? "INGADOZO" : "ALACSONY";
        return new Band(name, window.size(), onTarget);
    }
}
