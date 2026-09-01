package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Self-calibration (round 3, spec §5.1) — ÉRZÉKENY. Does the user's own rating move together with
 * the measurable counterpart of the same thing? Two pairs are evaluated over the trailing 14 days:
 * the energy scale against the previous night's sleep quality, and the body scale against the
 * day's worst joint pain (inverted, so higher is better on both sides).
 *
 * <p>The mental and stress scales are DELIBERATELY excluded: nothing in the system measures them
 * objectively, and inventing a composite index to compare them against would put an arbitrary
 * number into a sensitive claim (spec §4.3). The detector says so in its own summary.
 *
 * <p>Method: split the window's days at the MEDIAN of the self-rating, then compare the objective
 * mean of the high-rating group with the low-rating group. A direction is claimed only when the
 * groups are {@link #MIN_SEPARATION} apart — below that the honest answer is "no direction".
 * Days sitting exactly on the median belong to neither group, so a flat self-rating simply fails
 * the {@link #MIN_DAYS_PER_GROUP} contrast gate rather than producing a fake verdict.
 *
 * <p>Sensitivity is enforced at CLAIM level, so the wording here is the safeguard: this reports a
 * relationship, never a verdict on whether the user "knows themselves", and states outright that
 * one 14-day window shows a direction rather than a trait (spec §2 — the validating literature
 * measures over weeks-to-months against instrumented ground truth).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class SelfCalibrationDetector implements CharacterDetector {

    private static final int MIN_PAIRED_DAYS = 8;
    private static final int MIN_DAYS_PER_GROUP = 3;
    private static final double MIN_SEPARATION = 1.0;
    private static final int MAX_NOTES = 2;
    private static final int PAIN_SCALE_TOP = 11;

    private static final String EGYEZIK = "egyezik";
    private static final String FORDITOTT = "forditott";
    private static final String NINCS_JEL = "nincs-jel";

    @Override
    public String key() {
        return "self-calibration";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newCheckinData(in)) {
            return List.of();
        }
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        StringBuilder sb = new StringBuilder("Az önértékelés és a mérhető adat viszonya az elmúlt két hétben: ")
                .append(String.join("; ", today.phrases()))
                .append(". A mentális és a stressz skálának nincs objektív párja a rendszerben, ezért kimaradt, és egy kéthetes ablak irányt mutat, nem jellemvonást.");
        for (String note : today.notes()) {
            sb.append(" Aznapi jegyzet: „").append(note).append("”.");
        }
        int salience = today.key().contains(FORDITOTT) ? 4 : 2;
        return List.of(new DetectorSignal(key(), "pszichologus", sb.toString(), salience));
    }

    private record State(String key, List<String> phrases, List<String> notes) {}

    private record Pair(LocalDate date, double self, double objective) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        String energia = verdict(energyPairs(in, asOf));
        String testi = verdict(bodyPairs(in, asOf));
        List<String> keyParts = new ArrayList<>();
        List<String> phrases = new ArrayList<>();
        if (energia != null) {
            keyParts.add("energia:" + energia);
            phrases.add(switch (energia) {
                case EGYEZIK -> "az energia-értékelés együtt mozog az előző éjszakai alvásminőséggel";
                case FORDITOTT -> "az energia-értékelés az előző éjszakai alvásminőséggel ellentétesen mozog";
                default -> "az energia-értékelés és az előző éjszakai alvásminőség között nem látszik irány";
            });
        }
        if (testi != null) {
            keyParts.add("testi:" + testi);
            phrases.add(switch (testi) {
                case EGYEZIK -> "a testi értékelés együtt mozog az aznapi ízületi terheltséggel";
                case FORDITOTT -> "a testi értékelés az aznapi ízületi terheltséggel ellentétesen mozog";
                default -> "a testi értékelés és az aznapi ízületi terheltség között nem látszik irány";
            });
        }
        if (keyParts.isEmpty()) {
            return null;
        }
        return new State(String.join("|", keyParts), phrases, notes(in, asOf));
    }

    /** Energy scale vs the sleep of the night leading into the SAME day (the companion convention). */
    private static List<Pair> energyPairs(DetectorInput in, LocalDate asOf) {
        List<Pair> pairs = new ArrayList<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (!TrailingWindow.inWindow(c.date(), asOf) || c.energy() == null) {
                continue;
            }
            for (DetectorInput.SleepPoint s : in.trend().sleepEightWeeks()) {
                if (s.date().equals(c.date()) && s.quality() != null) {
                    pairs.add(new Pair(c.date(), c.energy().doubleValue(), s.quality()));
                    break;
                }
            }
        }
        return pairs;
    }

    /** Body scale vs the day's worst joint pain, inverted so that higher means "better" on both. */
    private static List<Pair> bodyPairs(DetectorInput in, LocalDate asOf) {
        List<Pair> pairs = new ArrayList<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (!TrailingWindow.inWindow(c.date(), asOf) || c.body() == null) {
                continue;
            }
            Integer worst = worstPain(in, c.date());
            if (worst != null) {
                pairs.add(new Pair(c.date(), c.body().doubleValue(), PAIN_SCALE_TOP - worst));
            }
        }
        return pairs;
    }

    private static Integer worstPain(DetectorInput in, LocalDate date) {
        Integer worst = null;
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            if (!g.date().equals(date)) {
                continue;
            }
            for (DetectorInput.ExerciseWork e : g.exercises()) {
                if (e.worstJointPain() != null && (worst == null || e.worstJointPain() > worst)) {
                    worst = e.worstJointPain();
                }
            }
        }
        return worst;
    }

    /** null when the pair is not evaluable at all — an unevaluable pair is omitted, not guessed. */
    private static String verdict(List<Pair> pairs) {
        if (pairs.size() < MIN_PAIRED_DAYS) {
            return null;
        }
        double median = median(pairs.stream().map(Pair::self).sorted().toList());
        List<Double> high = pairs.stream().filter(p -> p.self() > median).map(Pair::objective).toList();
        List<Double> low = pairs.stream().filter(p -> p.self() < median).map(Pair::objective).toList();
        if (high.size() < MIN_DAYS_PER_GROUP || low.size() < MIN_DAYS_PER_GROUP) {
            return null;
        }
        double diff = mean(high) - mean(low);
        if (diff >= MIN_SEPARATION) {
            return EGYEZIK;
        }
        return diff <= -MIN_SEPARATION ? FORDITOTT : NINCS_JEL;
    }

    private static double median(List<Double> sorted) {
        int n = sorted.size();
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private static double mean(List<Double> values) {
        double sum = 0;
        for (double v : values) {
            sum += v;
        }
        return sum / values.size();
    }

    /**
     * Raw check-in notes from the window's highest- and lowest-rated energy day, passed through as
     * EVIDENCE for the expert persona. Deterministic selection, zero interpretation — the shipped
     * {@code JournalNoteDetector} precedent (spec §4.1).
     */
    private static List<String> notes(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.CheckinDayPoint> rated = in.trend().checkinDays().stream()
                .filter(c -> TrailingWindow.inWindow(c.date(), asOf) && c.energy() != null)
                .sorted(Comparator.comparing(DetectorInput.CheckinDayPoint::energy))
                .toList();
        if (rated.isEmpty()) {
            return List.of();
        }
        List<LocalDate> wanted = new ArrayList<>();
        wanted.add(rated.getLast().date());
        if (rated.size() > 1) {
            wanted.add(rated.getFirst().date());
        }
        List<String> notes = new ArrayList<>();
        for (LocalDate d : wanted) {
            for (DetectorInput.CheckinSlotPoint s : in.trend().checkinSlots()) {
                if (s.date().equals(d) && s.notePreview() != null && notes.size() < MAX_NOTES) {
                    notes.add(s.notePreview());
                    break;
                }
            }
        }
        return List.copyOf(notes);
    }
}
