package io.mrkuhne.mezo.feature.companion.eval;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.TreeSet;

/**
 * The blind half of the Hungarian tone comparison (mezo-ozri.3, spec §S3 gate 4): which model's
 * answer reads better in Hungarian, judged without knowing which is which.
 *
 * <p>Two things make the number trustworthy and both live here, unit-tested and network-free: the
 * A/B sides are swapped by a SEEDED shuffle (position bias is real in LLM judges, and a fixed seed
 * makes the run reproducible), and the verdict parser refuses to guess — an answer it cannot read
 * is {@link Verdict#UNPARSEABLE}, never silently a tie.
 */
public final class ToneJudgePairing {

    private ToneJudgePairing() {
    }

    public enum Verdict { A, B, TIE, UNPARSEABLE }

    public record Pair(String caseId, String optionA, String optionB, boolean aIsBaseline) {}

    public record Tally(int candidateWins, int baselineWins, int ties, int unparseable) {}

    /** Pairs the two runs' answers on their shared case ids, in id order, sides seeded-swapped. */
    public static List<Pair> pair(Map<String, String> baseline, Map<String, String> candidate, long seed) {
        Random random = new Random(seed);
        List<Pair> pairs = new ArrayList<>();
        for (String caseId : new TreeSet<>(baseline.keySet())) {
            String candidateAnswer = candidate.get(caseId);
            if (candidateAnswer == null) {
                continue;
            }
            boolean aIsBaseline = random.nextBoolean();
            String baselineAnswer = baseline.get(caseId);
            pairs.add(aIsBaseline
                ? new Pair(caseId, baselineAnswer, candidateAnswer, true)
                : new Pair(caseId, candidateAnswer, baselineAnswer, false));
        }
        return List.copyOf(pairs);
    }

    /** Reads the LAST {@code VERDICT: …} line; anything else is {@link Verdict#UNPARSEABLE}. */
    public static Verdict parseVerdict(String raw) {
        if (raw == null) {
            return Verdict.UNPARSEABLE;
        }
        String[] lines = raw.strip().split("\\R");
        for (int i = lines.length - 1; i >= 0; i--) {
            String line = lines[i].strip().toLowerCase(Locale.ROOT);
            if (!line.startsWith("verdict:")) {
                continue;
            }
            String value = line.substring("verdict:".length()).strip();
            return switch (value) {
                case "a" -> Verdict.A;
                case "b" -> Verdict.B;
                case "tie" -> Verdict.TIE;
                default -> Verdict.UNPARSEABLE;
            };
        }
        return Verdict.UNPARSEABLE;
    }

    /** Translates label verdicts back into candidate/baseline wins, undoing the blinding. */
    public static Tally tally(List<Pair> pairs, List<Verdict> verdicts) {
        if (pairs.size() != verdicts.size()) {
            throw new IllegalArgumentException(
                "pairs=" + pairs.size() + " but verdicts=" + verdicts.size());
        }
        int candidateWins = 0;
        int baselineWins = 0;
        int ties = 0;
        int unparseable = 0;
        for (int i = 0; i < pairs.size(); i++) {
            Pair pair = pairs.get(i);
            switch (verdicts.get(i)) {
                case TIE -> ties++;
                case UNPARSEABLE -> unparseable++;
                case A -> {
                    if (pair.aIsBaseline()) {
                        baselineWins++;
                    } else {
                        candidateWins++;
                    }
                }
                case B -> {
                    if (pair.aIsBaseline()) {
                        candidateWins++;
                    } else {
                        baselineWins++;
                    }
                }
            }
        }
        return new Tally(candidateWins, baselineWins, ties, unparseable);
    }
}
