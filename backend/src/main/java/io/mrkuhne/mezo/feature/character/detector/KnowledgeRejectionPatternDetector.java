package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Knowledge rejection pattern (round 4, spec §5.5) — SENSITIVE, and a claim ABOUT THE SYSTEM: what
 * share of the companion's proposed facts and patterns the user kept over the trailing 28 days.
 * Acceptance rate is a weak trust proxy (a rejection can mean "wrong", "redundant" or "not
 * needed"), so the sentence reads as the system's hit rate, never as a trait of the user, and
 * names the proxy it uses for the fact decision date. Owned by the Szkeptikus (META dimension).
 * No new-data pre-filter (spec §4.3).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class KnowledgeRejectionPatternDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 28;
    static final int MIN_DECISIONS = 5;
    static final double KEPT_HIGH_MIN = 0.70;
    static final double KEPT_LOW_MIN = 0.40;
    static final int MIN_REJECTS_FOR_CATEGORY = 3;
    static final double CATEGORY_SHARE_MIN = 0.50;

    private static final Map<String, String> CATEGORY_HU = Map.of(
            "train", "edzés", "fuel", "fuel", "health", "egészség", "life", "élet", "minta", "minta");

    @Override
    public String key() {
        return "knowledge-rejection-pattern";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String summary = "Az elmúlt 4 hétben " + today.n() + " javaslatomról született döntés: " + today.kept() + " maradt meg ("
                + today.refined() + " finomítva), " + today.rejected() + " esett ki — "
                + TrailingWindow.pct((double) today.kept() / today.n()) + "% találati arány"
                + ("-".equals(today.category()) ? "" : ", a kiesettek főleg "
                        + CATEGORY_HU.getOrDefault(today.category(), today.category()) + " kategóriából")
                + ". Ez az én javaslataim minőségéről szól, nem a te tulajdonságodról. A tény-jelöltek döntésnapját "
                + "a jelölt keletkezési napjával közelítem.";
        return List.of(new DetectorSignal(key(), "szkeptikus", summary, "elutasito".equals(today.band()) ? 4 : 3));
    }

    record State(String key, String band, String category, int n, int kept, int refined, int rejected) {}

    static State state(DetectorInput in, LocalDate asOf) {
        int kept = 0;
        int refined = 0;
        int rejected = 0;
        Map<String, Integer> rejectedByCategory = new LinkedHashMap<>();
        for (DetectorInput.TriageDecisionPoint t : in.trend().meta().triageDecisions()) {
            if (!TrailingWindow.inWindow(t.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            if ("rejected".equals(t.decision())) {
                rejected++;
                rejectedByCategory.merge(t.category() == null ? "-" : t.category(), 1, Integer::sum);
            } else {
                kept++;
                if (t.refined()) {
                    refined++;
                }
            }
        }
        int n = kept + rejected;
        if (n < MIN_DECISIONS) {
            return null;
        }
        double keptShare = (double) kept / n;
        String band = keptShare >= KEPT_HIGH_MIN ? "megtarto" : keptShare >= KEPT_LOW_MIN ? "vegyes" : "elutasito";
        String category = "-";
        if (rejected >= MIN_REJECTS_FOR_CATEGORY) {
            String best = null;
            int bestCount = 0;
            for (Map.Entry<String, Integer> e : rejectedByCategory.entrySet()) {
                if (e.getValue() > bestCount || (e.getValue() == bestCount && best != null && e.getKey().compareTo(best) < 0)) {
                    bestCount = e.getValue();
                    best = e.getKey();
                }
            }
            if (best != null && (double) bestCount / rejected >= CATEGORY_SHARE_MIN) {
                category = best;
            }
        }
        return new State(band + "|" + category, band, category, n, kept, refined, rejected);
    }
}
