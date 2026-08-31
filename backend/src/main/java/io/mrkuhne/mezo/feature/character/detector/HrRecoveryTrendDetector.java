package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 8-week HR-recovery trend (round 1, spec §4-5). hrRecoverySec: LOWER = better recovery
 * (RunningPage's pulzus-megnyugvás chart is built on the same field). Weekly averages over
 * trend.runsEightWeeks; band = JAVUL (first-half avg - last-half avg >= 10s), ROMLIK (<= -10s),
 * KOZOMBOS otherwise; needs >= 4 weeks with data. Fires ONLY when a run was logged on the
 * observed day AND the band as-of day differs from the band as-of day-1 (stateless band-change
 * gate — the same trend is never re-announced).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class HrRecoveryTrendDetector implements CharacterDetector {

    private static final int MIN_WEEKS = 4;
    private static final double BAND_DELTA_SEC = 10.0;

    private enum Band { JAVUL, ROMLIK, KOZOMBOS, NINCS_ADAT }

    @Override
    public String key() {
        return "hr-recovery-trend";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!RoundOneGates.newRunData(in)) {
            return List.of();
        }
        Band today = band(in.trend().runsEightWeeks(), in.day());
        Band yesterday = band(in.trend().runsEightWeeks(), in.day().minusDays(1));
        if (today == Band.NINCS_ADAT || today == yesterday) {
            return List.of();
        }
        String direction = today == Band.JAVUL ? "javul" : today == Band.ROMLIK ? "romlik" : "kiegyenlítődött";
        String summary = "A futás utáni pulzus-megnyugvás trendje " + direction
                + " (8 hetes heti átlagok alapján).";
        return List.of(new DetectorSignal(key(), "doki", summary, today == Band.ROMLIK ? 4 : 3));
    }

    private static Band band(List<DetectorInput.RunPoint> runs, LocalDate asOf) {
        Map<LocalDate, double[]> weekly = new TreeMap<>(); // weekStart -> [sum, count]
        for (DetectorInput.RunPoint r : runs) {
            if (r.hrRecoverySec() == null || r.date().isAfter(asOf)) {
                continue;
            }
            LocalDate weekStart = r.date().minusDays(r.date().getDayOfWeek().getValue() - 1L);
            weekly.computeIfAbsent(weekStart, k -> new double[2]);
            weekly.get(weekStart)[0] += r.hrRecoverySec();
            weekly.get(weekStart)[1]++;
        }
        if (weekly.size() < MIN_WEEKS) {
            return Band.NINCS_ADAT;
        }
        List<Double> avgs = weekly.values().stream().map(a -> a[0] / a[1]).toList();
        int half = avgs.size() / 2;
        double firstHalf = avgs.subList(0, half).stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double lastHalf = avgs.subList(avgs.size() - half, avgs.size()).stream()
                .mapToDouble(Double::doubleValue).average().orElse(0);
        double delta = firstHalf - lastHalf; // positive = getting faster to recover = improving
        if (delta >= BAND_DELTA_SEC) {
            return Band.JAVUL;
        }
        if (delta <= -BAND_DELTA_SEC) {
            return Band.ROMLIK;
        }
        return Band.KOZOMBOS;
    }
}
