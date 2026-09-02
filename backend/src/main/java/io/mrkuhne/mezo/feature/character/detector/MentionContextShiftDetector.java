package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Mention context shift (round 4, spec §5.2): which context the people mentions cluster in over
 * the trailing 28 days, and how large the conflict share is. Runs entirely on
 * {@code contextLabel} — the people feature's nightly classifier output, a closed DB-CHECK set —
 * never on the mention excerpt. The label is the SYSTEM's, so the sentence says so.
 *
 * <p>No new-data pre-filter (spec §4.3): a context can fade out of the window on a quiet day.
 * State = {@code <dominant>|<konfliktus band>}, both label-valued.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class MentionContextShiftDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 28;
    static final int MIN_LABELLED = 6;
    static final double KONFLIKTUS_PRESENT_MIN = 0.10;
    static final double KONFLIKTUS_HIGH_MIN = 0.30;   // strictly above → "magas"
    static final String KONFLIKTUS = "konfliktus";

    private static final Map<String, String> LABEL_HU = Map.of(
            "munka", "munka", "csalad", "család", "baratok", "barátok", "edzes", "edzés",
            "konfliktus", "konfliktus", "kozos_program", "közös program", "segitseg", "segítség", "egyeb", "egyéb");

    @Override
    public String key() {
        return "mention-context-shift";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String previous = yesterday == null
                ? "korábban ehhez még kevés volt a címkézett említés"
                : "korábban " + hu(yesterday.dominant()) + "/" + yesterday.band() + " volt";
        String summary = "Az elmúlt 4 hét " + today.labelled() + " címkézett említéséből a legtöbb " + hu(today.dominant())
                + "-kontextusú (" + TrailingWindow.pct(today.dominantShare()) + "%), a konfliktus-részarány "
                + TrailingWindow.pct(today.konfliktusShare()) + "% (" + today.band() + "); " + previous + ". "
                + today.unlabelled() + " említés még címkézetlen — a címkét a rendszer éjszakai osztályozója adja, nem te.";
        boolean roseToHigh = "magas".equals(today.band()) && (yesterday == null || !"magas".equals(yesterday.band()));
        return List.of(new DetectorSignal(key(), "antropologus", summary, roseToHigh ? 4 : 3));
    }

    private static String hu(String label) {
        return LABEL_HU.getOrDefault(label, label);
    }

    record State(String key, String dominant, double dominantShare, double konfliktusShare, String band,
                 int labelled, int unlabelled) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        int labelled = 0;
        int unlabelled = 0;
        for (DetectorInput.MentionPoint m : in.trend().mentions()) {
            if (!TrailingWindow.inWindow(m.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            if (m.contextLabel() == null) {
                unlabelled++;
            } else {
                labelled++;
                counts.merge(m.contextLabel(), 1, Integer::sum);
            }
        }
        if (labelled < MIN_LABELLED) {
            return null;
        }
        String dominant = null;
        int best = 0;
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            // Ties resolve to the alphabetically first label so the state is stable across runs.
            if (e.getValue() > best || (e.getValue() == best && dominant != null && e.getKey().compareTo(dominant) < 0)) {
                best = e.getValue();
                dominant = e.getKey();
            }
        }
        double konfliktusShare = (double) counts.getOrDefault(KONFLIKTUS, 0) / labelled;
        String band = konfliktusShare > KONFLIKTUS_HIGH_MIN ? "magas"
                : konfliktusShare >= KONFLIKTUS_PRESENT_MIN ? "jelen" : "nincs";
        return new State(dominant + "|" + band, dominant, (double) best / labelled, konfliktusShare, band,
                labelled, unlabelled);
    }
}
