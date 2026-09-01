package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Quest completion calibration (round 4, spec §5.7) — a claim ABOUT THE SYSTEM: per slot, what
 * share of the companion's offered quests completed over the trailing 28 days, read against the
 * quest engine's OWN adaptive bands (0,85 / 0,50, min sample 5 — {@code QuestProperties.Adaptive}).
 * A low band is the engine's difficulty miscalibration, not the user's diligence. Only
 * status/slot/date are read — the quest text never (it is LLM-rewritten in place). The observed
 * day's quests are still open (the finalize cron closes yesterday at 00:05) and are excluded;
 * rerolled quests are excluded. Owned by the Szkeptikus. No new-data pre-filter (spec §4.3).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class QuestCompletionCalibrationDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 28;
    static final int MIN_PER_SLOT = 5;
    static final double HIGH_MIN = 0.85;
    static final double MID_MIN = 0.50;
    static final List<String> SLOTS = List.of("BODY", "FUELBIO", "GROWTH");

    @Override
    public String key() {
        return "quest-completion-calibration";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        List<String> parts = new ArrayList<>();
        List<String> low = new ArrayList<>();
        for (String slot : SLOTS) {
            SlotStat s = today.slots().get(slot);
            if ("keves".equals(s.band())) {
                parts.add(slot + ": kevés quest (" + s.n() + ")");
            } else {
                parts.add(slot + " " + s.completed() + "/" + s.n() + " (" + TrailingWindow.pct((double) s.completed() / s.n()) + "%)");
                if ("alacsony".equals(s.band())) {
                    low.add(slot);
                }
            }
        }
        String summary = "A questkínálatom 4 heti mérlege: " + String.join(", ", parts)
                + (low.isEmpty() ? "" : " — a(z) " + String.join(" és ", low) + " slotban a nehézség-kalibrációm túllőtt")
                + ". A motor saját sávjai (85% / 50%) szerint; a quest szövegét nem olvasom.";
        return List.of(new DetectorSignal(key(), "szkeptikus", summary, low.isEmpty() ? 3 : 4));
    }

    record SlotStat(int n, int completed, String band) {}

    record State(String key, Map<String, SlotStat> slots) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<String, int[]> counts = new LinkedHashMap<>();
        for (String slot : SLOTS) {
            counts.put(slot, new int[2]);
        }
        for (DetectorInput.QuestPoint q : in.trend().meta().quests()) {
            if (!TrailingWindow.inWindow(q.questDate(), asOf, WINDOW_DAYS) || !q.questDate().isBefore(asOf)
                    || "rerolled".equals(q.status()) || !counts.containsKey(q.slot())) {
                continue;
            }
            int[] c = counts.get(q.slot());
            c[0]++;
            if ("completed".equals(q.status())) {
                c[1]++;
            }
        }
        Map<String, SlotStat> slots = new LinkedHashMap<>();
        StringBuilder key = new StringBuilder();
        boolean any = false;
        for (String slot : SLOTS) {
            int[] c = counts.get(slot);
            String band;
            if (c[0] < MIN_PER_SLOT) {
                band = "keves";
            } else {
                any = true;
                double ratio = (double) c[1] / c[0];
                band = ratio >= HIGH_MIN ? "magas" : ratio >= MID_MIN ? "kozep" : "alacsony";
            }
            slots.put(slot, new SlotStat(c[0], c[1], band));
            if (key.length() > 0) {
                key.append('|');
            }
            key.append(slot).append(':').append(band);
        }
        return any ? new State(key.toString(), slots) : null;
    }
}
