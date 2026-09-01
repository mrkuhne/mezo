package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Decision outcome profile (round 3, spec §5.3): how the decisions the user actually went back and
 * reviewed turned out, on the journal's own 1..5 {@code outcomeRating} scale. The window is 42 days
 * rather than 14 because reviews are episodic — a fortnight rarely holds enough of them to say
 * anything, and a detector that can never reach its own gate is dead code.
 *
 * <p>The decision texts are passed through as EVIDENCE only (the best- and worst-rated entry), never
 * parsed. The rating itself carries the whole computation.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class DecisionProfileDetector implements CharacterDetector {

    private static final int WINDOW_DAYS = 42;
    private static final int MIN_REVIEWS = 4;
    private static final double JO_MIN = 3.75;
    private static final double VEGYES_MIN = 2.25;

    @Override
    public String key() {
        return "decision-profile";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newDecisionData(in)) {
            return List.of();
        }
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String phrase = switch (today.band()) {
            case "jo" -> "a visszanézett döntéseinek átlagos utólagos megítélése a skála felső részén van";
            case "vegyes" -> "a visszanézett döntéseinek átlagos utólagos megítélése vegyes képet mutat";
            default -> "a visszanézett döntéseinek átlagos utólagos megítélése a skála alsó részén van";
        };
        StringBuilder sb = new StringBuilder("A döntésnapló szerint ").append(phrase)
                .append(" (").append(today.reviews()).append(" értékelt döntés, hat hét).");
        if (today.best() != null) {
            sb.append(" A legjobbra értékelt: „").append(today.best()).append("”.");
        }
        if (today.worst() != null) {
            sb.append(" A legrosszabbra értékelt: „").append(today.worst()).append("”.");
        }
        int salience = "gyenge".equals(today.band()) ? 4 : 3;
        return List.of(new DetectorSignal(key(), "pszichologus", sb.toString(), salience));
    }

    private record State(String key, String band, int reviews, String best, String worst) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.DecisionPoint> reviewed = new ArrayList<>();
        for (DetectorInput.DecisionPoint d : in.trend().decisions()) {
            if (d.reviewedOn() != null && d.outcomeRating() != null
                    && !d.reviewedOn().isAfter(asOf)
                    && TrailingWindow.inWindow(d.reviewedOn(), asOf, WINDOW_DAYS)) {
                reviewed.add(d);
            }
        }
        if (reviewed.size() < MIN_REVIEWS) {
            return null;
        }
        double sum = 0;
        for (DetectorInput.DecisionPoint d : reviewed) {
            sum += d.outcomeRating();
        }
        double mean = sum / reviewed.size();
        String band = mean >= JO_MIN ? "jo" : mean >= VEGYES_MIN ? "vegyes" : "gyenge";

        List<DetectorInput.DecisionPoint> sorted = reviewed.stream()
                .sorted(Comparator.comparing(DetectorInput.DecisionPoint::outcomeRating))
                .toList();
        String best = sorted.getLast().textPreview();
        String worst = sorted.size() > 1 ? sorted.getFirst().textPreview() : null;
        return new State("kimenet:" + band, band, reviewed.size(), best, worst);
    }
}
