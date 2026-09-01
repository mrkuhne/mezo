package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Decision review backlog (round 3, spec §5.4): how many decisions are past their own review date
 * and still unreviewed. {@code decision-profile} is about OUTCOMES; this is about whether the user
 * goes back and looks at all — a different behaviour from the same table.
 *
 * <p>No window: an entry decided months ago is exactly what a backlog is made of. Catch-up honesty
 * is applied on both timestamps, so a review performed after the observed day still counts as
 * outstanding on that day. The band is qualitative — the count appears in the sentence, never in
 * the state key, or the state would change on every single entry and defeat the gate.
 *
 * <p>Deliberately NO new-data pre-filter. Every other detector here also requires its source to
 * have moved today, but a backlog grows because TIME passes, not because a row arrives: the day an
 * entry crosses its own review date, nothing is written anywhere. Gating on new decision data would
 * silence exactly the transition this detector exists to catch. The state-change gate alone is the
 * correct and sufficient protection.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class DecisionReviewBacklogDetector implements CharacterDetector {

    private static final int NEHANY_MAX = 2;

    @Override
    public String key() {
        return "decision-review-backlog";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String summary = switch (today.band()) {
            case "nincs" -> "A döntésnaplóban nincs lejárt, át nem nézett döntés.";
            case "nehany" -> "A döntésnaplóban " + today.overdue()
                    + " döntés van, aminek lejárt a visszanézési ideje.";
            default -> "A döntésnaplóban " + today.overdue()
                    + " döntés vár visszanézésre a saját határidején túl.";
        };
        int salience = "halmozodik".equals(today.band()) ? 4 : 2;
        return List.of(new DetectorSignal(key(), "drill", summary, salience));
    }

    private record State(String key, String band, int overdue) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        int existing = 0;
        int overdue = 0;
        for (DetectorInput.DecisionPoint d : in.trend().decisions()) {
            if (d.writtenOn() == null || d.writtenOn().isAfter(asOf)) {
                continue;   // did not exist yet on asOf
            }
            existing++;
            boolean reviewed = d.reviewedOn() != null && !d.reviewedOn().isAfter(asOf);
            if (!reviewed && !d.reviewDue().isAfter(asOf)) {
                overdue++;
            }
        }
        if (existing == 0) {
            return null;   // no decision journal at all — silence, not "zero backlog"
        }
        String band = overdue == 0 ? "nincs" : overdue <= NEHANY_MAX ? "nehany" : "halmozodik";
        return new State("backlog:" + band, band, overdue);
    }
}
