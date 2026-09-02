package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Experiment outcome ledger (round 4, spec §5.8) — a claim ABOUT THE SYSTEM: of the experiments
 * and workout challenges the companion proposed in the trailing 49 days, how many closed with a
 * good outcome, and how many the user dismissed before they started. An inconclusive challenge
 * counts as closed but not judged. Owned by the Szkeptikus. No new-data pre-filter (spec §4.3).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class ExperimentOutcomeLedgerDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 49;
    static final int MIN_JUDGED = 3;
    static final double GOOD_HIGH_MIN = 0.67;
    static final double GOOD_MID_MIN = 0.34;
    static final int MIN_DISMISSED = 3;
    static final double DISMISSED_SHARE_MIN = 0.5;

    @Override
    public String key() {
        return "experiment-outcome-ledger";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        int closed = today.good() + today.bad() + today.inconclusive();
        String summary;
        if ("keves".equals(today.band())) {
            summary = "Az elmúlt 7 hétben " + closed + " javaslatom zárult, ebből " + today.good()
                    + " jó kimenettel — még kevés az ítélethez; " + today.dismissed()
                    + " javaslatom el sem indult (elvetve indulás előtt). Ez a javaslataim minősége, nem a te vállalkozó kedved.";
        } else {
            summary = "Az elmúlt 7 hét " + closed + " lezárt javaslatomból (" + today.experiments() + " kísérlet, "
                    + today.challenges() + " kihívás) " + today.good() + " járt jó kimenettel"
                    + (today.inconclusive() > 0 ? ", " + today.inconclusive() + " eldönthetetlen" : "") + "; "
                    + today.dismissed() + " javaslatom el sem indult (elvetve indulás előtt). Ez a javaslataim minősége, nem a te "
                    + "vállalkozó kedved.";
        }
        boolean loud = "gyenge".equals(today.band()) || "tobbseg-elvetve".equals(today.flag());
        return List.of(new DetectorSignal(key(), "szkeptikus", summary, loud ? 4 : 3));
    }

    record State(String key, String band, String flag, int good, int bad, int inconclusive, int dismissed,
                 int experiments, int challenges) {}

    static State state(DetectorInput in, LocalDate asOf) {
        int good = 0;
        int bad = 0;
        int inconclusive = 0;
        int dismissed = 0;
        int experiments = 0;
        int challenges = 0;
        for (DetectorInput.ProposalOutcomePoint p : in.trend().meta().proposalOutcomes()) {
            if (!TrailingWindow.inWindow(p.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            String verdict = classify(p);
            if (verdict == null) {
                continue;
            }
            switch (verdict) {
                case "good" -> good++;
                case "bad" -> bad++;
                case "inconclusive" -> inconclusive++;
                default -> dismissed++;
            }
            if (!"dismissed".equals(verdict)) {
                if ("experiment".equals(p.kind())) {
                    experiments++;
                } else {
                    challenges++;
                }
            }
        }
        int judged = good + bad;
        String band = judged < MIN_JUDGED ? "keves"
                : (double) good / judged >= GOOD_HIGH_MIN ? "jo"
                : (double) good / judged >= GOOD_MID_MIN ? "vegyes" : "gyenge";
        int considered = dismissed + judged + inconclusive;
        String flag = dismissed >= MIN_DISMISSED && considered > 0 && (double) dismissed / considered >= DISMISSED_SHARE_MIN
                ? "tobbseg-elvetve" : "-";
        if ("keves".equals(band) && "-".equals(flag)) {
            return null;
        }
        return new State(band + "|" + flag, band, flag, good, bad, inconclusive, dismissed, experiments, challenges);
    }

    /** "good" | "bad" | "inconclusive" | "dismissed", or null for a still-open row. */
    private static String classify(DetectorInput.ProposalOutcomePoint p) {
        if ("dismissed".equals(p.status())) {
            return "dismissed";
        }
        if ("experiment".equals(p.kind())) {
            if (!"completed".equals(p.status())) {
                return null;
            }
            return p.outcomeGood() == null ? "inconclusive" : p.outcomeGood() ? "good" : "bad";
        }
        return switch (p.status()) {
            case "hit" -> "good";
            case "miss" -> "bad";
            case "inconclusive" -> "inconclusive";
            default -> null;
        };
    }
}
