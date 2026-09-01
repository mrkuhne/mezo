package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Gratitude focus (round 3, spec §5.5): which life area the user's gratitude entries cluster in
 * over the trailing 28 days, and whether they cluster at all. Runs entirely on {@code lifeArea},
 * the journal's own closed tag — the entry TEXT is never read here.
 *
 * <p>{@code lifeArea} is optional, so a coverage gate is required: naming a "dominant area" from
 * two tagged entries out of twenty would be a fabrication. This mirrors round 2's
 * {@code MIN_NOVA_COVERAGE}, which exists for exactly the same reason.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class GratitudeFocusDetector implements CharacterDetector {

    private static final int WINDOW_DAYS = 28;
    private static final int MIN_ENTRIES = 6;
    private static final double MIN_AREA_COVERAGE = 0.60;
    private static final double CONCENTRATED_MIN = 0.50;

    private static final Map<String, String> AREA_HU = Map.ofEntries(
            Map.entry("mindfulness", "jelenlét"),
            Map.entry("mindset", "szemlélet"),
            Map.entry("cooking", "főzés"),
            Map.entry("financial", "pénzügyek"),
            Map.entry("productivity", "produktivitás"),
            Map.entry("learning", "tanulás"),
            Map.entry("connection", "kapcsolatok"),
            Map.entry("recovery", "regeneráció"));

    @Override
    public String key() {
        return "gratitude-focus";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newGratitudeData(in)) {
            return List.of();
        }
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String area = AREA_HU.getOrDefault(today.area(), today.area());
        String summary = "koncentralt".equals(today.spread())
                ? "A hála-bejegyzések négy hét alatt a(z) " + area
                        + " területre húznak (" + today.dominant() + " a " + today.tagged()
                        + " címkézett bejegyzésből)."
                : "A hála-bejegyzések négy hét alatt több terület között oszlanak meg, a leggyakoribb a(z) "
                        + area + " (" + today.dominant() + " a " + today.tagged() + " címkézettből).";
        return List.of(new DetectorSignal(key(), "antropologus", summary, 3));
    }

    private record State(String key, String area, String spread, int dominant, int tagged) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        int total = 0;
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (DetectorInput.GratitudePoint g : in.trend().gratitudes()) {
            if (!TrailingWindow.inWindow(g.occurredOn(), asOf, WINDOW_DAYS)) {
                continue;
            }
            total++;
            if (g.lifeArea() != null) {
                counts.merge(g.lifeArea(), 1, Integer::sum);
            }
        }
        if (total < MIN_ENTRIES) {
            return null;
        }
        int tagged = counts.values().stream().mapToInt(Integer::intValue).sum();
        if ((double) tagged / total < MIN_AREA_COVERAGE) {
            return null;   // too few tagged entries to name a dominant area honestly
        }
        String area = null;
        int best = 0;
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            // Ties resolve to the alphabetically first key so the state is stable across runs.
            if (e.getValue() > best || (e.getValue() == best && area != null
                    && e.getKey().compareTo(area) < 0)) {
                best = e.getValue();
                area = e.getKey();
            }
        }
        String spread = (double) best / tagged >= CONCENTRATED_MIN ? "koncentralt" : "szort";
        return new State("terulet:" + area + "|eloszlas:" + spread, area, spread, best, tagged);
    }
}
