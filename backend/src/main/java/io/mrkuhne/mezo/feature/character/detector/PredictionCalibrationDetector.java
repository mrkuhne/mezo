package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Prediction calibration (round 4, spec §5.6) — a claim ABOUT THE SYSTEM: of the companion's
 * predictions that closed in the trailing 49 days, how many were right, against the confidence
 * it stated. Small-N calibration in the Brier tradition without the decomposition: hit rate vs.
 * mean stated confidence, three bands. A prediction closes on {@code validTo + 1} (there is no
 * resolvedAt); an expired {@code pending} row is "no data" and counted separately, never as a
 * miss. Owned by the Szkeptikus. No new-data pre-filter (spec §4.3).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class PredictionCalibrationDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 49;
    static final int MIN_RESOLVED = 4;
    static final double CALIBRATION_DELTA = 0.20;

    @Override
    public String key() {
        return "prediction-calibration";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.band().equals(yesterday == null ? "" : yesterday.band())) {
            return List.of();
        }
        String head = "Az elmúlt 7 hétben " + today.resolved() + " predikcióm zárult: " + today.hits() + " talált, "
                + today.misses() + " nem (" + TrailingWindow.pct((double) today.hits() / today.resolved()) + "%)";
        String body;
        if ("nincs-konfidencia".equals(today.band())) {
            body = ", de a többségükhöz nem mondtam magabiztosságot, így kalibrációt nem tudok mérni.";
        } else {
            String bandHu = switch (today.band()) {
                case "tulbiztos" -> "túlbiztos voltam";
                case "alulbiztos" -> "alulbiztos voltam";
                default -> "nagyjából kalibrált voltam";
            };
            body = ", miközben átlagosan " + TrailingWindow.pct(today.meanConfidence().doubleValue())
                    + "% magabiztosságot mondtam — " + bandHu + ".";
        }
        String tail = " " + today.expiredNoData() + " további lejárt adat nélkül, azokat nem számolom. Zárás napja az "
                + "érvényesség vége utáni nap.";
        return List.of(new DetectorSignal(key(), "szkeptikus", head + body + tail, "tulbiztos".equals(today.band()) ? 4 : 3));
    }

    record State(String band, int resolved, int hits, int misses, int expiredNoData, BigDecimal meanConfidence) {}

    static State state(DetectorInput in, LocalDate asOf) {
        int hits = 0;
        int misses = 0;
        int expired = 0;
        BigDecimal confidenceSum = BigDecimal.ZERO;
        int withConfidence = 0;
        for (DetectorInput.PredictionPoint p : in.trend().meta().predictions()) {
            if (p.validTo() == null || !TrailingWindow.inWindow(p.validTo(), asOf, WINDOW_DAYS)
                    || !p.validTo().isBefore(asOf)) {
                continue;   // outside the window, or still open as of asOf (closes on validTo + 1)
            }
            switch (p.status()) {
                case "validated" -> hits++;
                case "missed" -> misses++;
                default -> {
                    expired++;
                    continue;
                }
            }
            if (p.confidence() != null) {
                withConfidence++;
                confidenceSum = confidenceSum.add(p.confidence());
            }
        }
        int resolved = hits + misses;
        if (resolved < MIN_RESOLVED) {
            return null;
        }
        if (withConfidence * 2 < resolved) {
            return new State("nincs-konfidencia", resolved, hits, misses, expired, null);
        }
        BigDecimal meanConfidence = confidenceSum.divide(BigDecimal.valueOf(withConfidence), 4, RoundingMode.HALF_UP);
        double delta = meanConfidence.doubleValue() - (double) hits / resolved;
        String band = delta >= CALIBRATION_DELTA ? "tulbiztos" : delta <= -CALIBRATION_DELTA ? "alulbiztos" : "kalibralt";
        return new State(band, resolved, hits, misses, expired, meanConfidence);
    }
}
