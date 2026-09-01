package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Check-in slot drift (round 3, spec §5.11): which time-of-day slot the user has stopped filling.
 * "How late" ({@code checkin-latency}) and "which one dies out" are different behaviours from the
 * same rows, so they are different detectors.
 *
 * <p>Compares two adjacent 14-day windows: a slot that had at least {@link #MIN_BASELINE_ROWS} rows
 * in the earlier one and none in the recent one has dropped out. The state carries the slot LABELS,
 * which are stable identifiers rather than moving counts.
 *
 * <p>No new-data pre-filter: a slot dies out precisely by nobody writing it (spec §4.2).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CheckinSlotDriftDetector implements CharacterDetector {

    private static final int MIN_BASELINE_ROWS = 3;

    @Override
    public String key() {
        return "checkin-slot-drift";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        String today = state(in, in.day());
        String yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = "slot:stabil".equals(today)
                ? "A check-in idősávok használata visszaállt: mindegyik korábban rendszeres sáv újra kap kitöltést."
                : "A korábban rendszeres check-in idősávok közül kiesett: "
                        + today.substring("slot:kikopott:".length()).replace(",", ", ") + ".";
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }

    private static String state(DetectorInput in, LocalDate asOf) {
        LocalDate recentFrom = asOf.minusDays(TrailingWindow.WINDOW_DAYS - 1L);
        LocalDate baselineFrom = recentFrom.minusDays(TrailingWindow.WINDOW_DAYS);

        Map<String, Integer> baseline = new HashMap<>();
        Map<String, Integer> recent = new HashMap<>();
        for (DetectorInput.CheckinSlotPoint p : in.trend().checkinSlots()) {
            if (p.slotTime() == null || p.date().isAfter(asOf)) {
                continue;
            }
            if (!p.date().isBefore(recentFrom)) {
                recent.merge(p.slotTime(), 1, Integer::sum);
            } else if (!p.date().isBefore(baselineFrom)) {
                baseline.merge(p.slotTime(), 1, Integer::sum);
            }
        }
        TreeSet<String> established = new TreeSet<>();
        for (Map.Entry<String, Integer> e : baseline.entrySet()) {
            if (e.getValue() >= MIN_BASELINE_ROWS) {
                established.add(e.getKey());
            }
        }
        if (established.isEmpty()) {
            return null;   // no established habit to have drifted from
        }
        List<String> dropped = new ArrayList<>();
        for (String slot : established) {
            if (!recent.containsKey(slot)) {
                dropped.add(slot);
            }
        }
        return dropped.isEmpty() ? "slot:stabil" : "slot:kikopott:" + String.join(",", dropped);
    }
}
