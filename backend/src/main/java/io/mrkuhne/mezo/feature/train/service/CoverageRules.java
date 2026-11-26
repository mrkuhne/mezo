package io.mrkuhne.mezo.feature.train.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * The block builder's coverage hints (mezo-r36n9.114, spec 2026-11-25-boop-hianyjelzes-design §Rules): per coarse
 * muscle group ({@link MuscleGroup#of}) over the draft week's catalogue movement patterns, a fixed table names a
 * missing complementary movement. Pure — no Spring, no I/O.
 *
 * <p>Semantics: a row counts for the group of its primary muscle. A row with a null pattern (user-authored) is
 * unknown: it never stands in as the "has" side, and because it could be the missing movement itself it leaves its
 * group's verdict unknown — silent (spec: "custom rows count as unknown, never as a gap"). Bicepsz / Tricepsz fire
 * only when the group's ONLY work is as a secondary of pulls / presses (no primary row of the group at all, custom
 * included). A group at Tartás ({@link PriorityTier#MAINTAIN} in the block's stored priorities) and a group the week
 * does not train are silent. At most one finding per group (the first matching table row), at most
 * {@link #MAX_FINDINGS} overall, in table order.
 */
public final class CoverageRules {

    private CoverageRules() {}

    public static final int MAX_FINDINGS = 3;

    private static final Set<String> PULLS = Set.of("horizontal-pull", "vertical-pull");
    private static final Set<String> PRESSES = Set.of("horizontal-push", "vertical-push");

    /** One draft row: the catalogue's fine muscle token, pattern (null = unknown), secondary tokens and type. */
    public record Row(String muscle, String pattern, List<String> secondaryMuscles, String type) {}

    /** One draft training day, 0 = Monday. */
    public record Day(int dayIndex, List<Row> rows) {}

    /** {@code targetTokens} narrows the proposal to these fine tokens (the raise rule: shoulder-side); null = group. */
    public record Finding(String group, Code code, String missingPattern, List<String> targetTokens) {}

    /** The rules table, in priority order. Each code carries its fixed Hungarian verdict and why. */
    public enum Code {
        HAM_NO_KNEE_FLEXION("ham", "knee-flexion", null,
            "Hiányzik a lábhajlítás — a combhajlítót most csak csípőből hajlítással edzed.",
            "A combhajlító két ízületen dolgozik: a csípőből hajlítás a csípő felől, a lábhajlítás a térd felől "
                + "terheli. A kettő együtt adja a teljes munkát."),
        HAM_NO_HINGE("ham", "hinge", null,
            "Hiányzik a csípőből hajlítás — a combhajlítót most csak lábhajlítással edzed.",
            "A combhajlító két ízületen dolgozik: a lábhajlítás a térd felől, a csípőből hajlítás a csípő felől "
                + "terheli. A kettő együtt adja a teljes munkát."),
        QUAD_NO_KNEE_EXTENSION("quad", "knee-extension", null,
            "Hiányzik a lábnyújtás — a combod elejét most csak guggolással vagy kitöréssel edzed.",
            "A guggolásban a far és a comb osztozik a munkán. A lábnyújtás csak a comb elejét terheli, azt a részét "
                + "is, amelyik guggolásban keveset dolgozik."),
        BACK_NO_HORIZONTAL_PULL("back", "horizontal-pull", null,
            "Hiányzik az evezés — a hátadat most csak felülről húzással edzed.",
            "A felülről húzás inkább a hát szélességét, az evezés inkább a hát közepét építi. A kettő együtt adja "
                + "a teljes hátat."),
        BACK_NO_VERTICAL_PULL("back", "vertical-pull", null,
            "Hiányzik a felülről húzás — a hátadat most csak evezéssel edzed.",
            "Az evezés inkább a hát közepét, a felülről húzás inkább a hát szélességét építi. A kettő együtt adja "
                + "a teljes hátat."),
        BICEPS_NO_ELBOW_FLEXION("biceps", "elbow-flexion", null,
            "Hiányzik a bicepszhajlítás — a bicepszed most csak a húzásokban segít be.",
            "A húzásokban a bicepsz csak besegít, ritkán fárad el igazán. Egy külön hajlítás célzottan "
                + "dolgoztatja."),
        TRICEPS_NO_ELBOW_EXTENSION("triceps", "elbow-extension", null,
            "Hiányzik a tricepsznyújtás — a tricepszed most csak a nyomásokban segít be.",
            "A nyomásokban a tricepsz csak besegít, a hosszú feje alig nyúlik meg. Egy külön nyújtás célzottan "
                + "dolgoztatja."),
        SHOULDER_NO_SIDE_RAISE("shoulder", "raise", List.of("shoulder-side"),
            "Hiányzik az oldalemelés — a válladat most csak fej fölé nyomással edzed.",
            "A nyomás főleg a váll elejét terheli. A váll oldalsó része oldalemeléssel kap igazán munkát, ez adja "
                + "a váll szélességét."),
        CHEST_NO_FLY("chest", "fly", null,
            "Hiányzik a tárogatás — a mellizmodat most csak nyomással edzed.",
            "A nyomásban a váll és a tricepsz is dolgozik. A tárogatás megnyújtott helyzetben, csak a mellizmot "
                + "terheli, ezért jó kiegészítés.");

        private final String group;
        private final String missingPattern;
        private final List<String> targetTokens;
        private final String verdictText;
        private final String whyText;

        Code(String group, String missingPattern, List<String> targetTokens, String verdictText, String whyText) {
            this.group = group;
            this.missingPattern = missingPattern;
            this.targetTokens = targetTokens;
            this.verdictText = verdictText;
            this.whyText = whyText;
        }

        public String group() {
            return group;
        }

        public String missingPattern() {
            return missingPattern;
        }

        public List<String> targetTokens() {
            return targetTokens;
        }

        public String verdictText() {
            return verdictText;
        }

        public String whyText() {
            return whyText;
        }
    }

    /** The week's facts the table reads, per coarse group. */
    private static final class Week {
        private final Set<String> trained = new HashSet<>();
        private final Set<String> unknown = new HashSet<>();      // groups with a primary row of unknown pattern
        private final Set<String> primary = new HashSet<>();      // groups with any primary row
        private final Set<String> patternsByGroup = new HashSet<>(); // "group|pattern"
        private final Set<String> tokenPatterns = new HashSet<>();   // "token|pattern"
        private final Set<String> secondaryOfPulls = new HashSet<>();
        private final Set<String> secondaryOfPresses = new HashSet<>();

        boolean has(String group, String... patterns) {
            for (String p : patterns) {
                if (patternsByGroup.contains(group + "|" + p)) {
                    return true;
                }
            }
            return false;
        }
    }

    public static List<Finding> evaluate(List<Day> days, Map<String, String> priorities) {
        Week w = read(days);
        List<Finding> out = new ArrayList<>();
        Set<String> spoken = new HashSet<>();
        for (Code code : Code.values()) {
            if (out.size() >= MAX_FINDINGS) {
                break;
            }
            String g = code.group();
            if (spoken.contains(g) || !w.trained.contains(g) || PriorityTier.of(priorities, g) == PriorityTier.MAINTAIN
                || !fires(code, w)) {
                continue;
            }
            spoken.add(g);
            out.add(new Finding(g, code, code.missingPattern(), code.targetTokens()));
        }
        return List.copyOf(out);
    }

    private static boolean fires(Code code, Week w) {
        String g = code.group();
        return switch (code) {
            case BICEPS_NO_ELBOW_FLEXION -> !w.primary.contains(g) && w.secondaryOfPulls.contains(g);
            case TRICEPS_NO_ELBOW_EXTENSION -> !w.primary.contains(g) && w.secondaryOfPresses.contains(g);
            default -> !w.unknown.contains(g) && switch (code) {
                case HAM_NO_KNEE_FLEXION -> w.has(g, "hinge") && !w.has(g, "knee-flexion");
                case HAM_NO_HINGE -> w.has(g, "knee-flexion") && !w.has(g, "hinge");
                case QUAD_NO_KNEE_EXTENSION -> w.has(g, "squat", "lunge") && !w.has(g, "knee-extension");
                case BACK_NO_HORIZONTAL_PULL -> w.has(g, "vertical-pull") && !w.has(g, "horizontal-pull");
                case BACK_NO_VERTICAL_PULL -> w.has(g, "horizontal-pull") && !w.has(g, "vertical-pull");
                case SHOULDER_NO_SIDE_RAISE -> w.has(g, "vertical-push") && !w.tokenPatterns.contains("shoulder-side|raise");
                case CHEST_NO_FLY -> w.has(g, "horizontal-push", "vertical-push") && !w.has(g, "fly");
                default -> false;
            };
        };
    }

    private static Week read(List<Day> days) {
        Week w = new Week();
        if (days == null) {
            return w;
        }
        for (Day d : days) {
            if (d == null || d.rows() == null) {
                continue;
            }
            for (Row r : d.rows()) {
                if (r == null || r.muscle() == null || r.muscle().isBlank()) {
                    continue;
                }
                String g = MuscleGroup.of(r.muscle());
                w.trained.add(g);
                w.primary.add(g);
                if (r.pattern() == null) {
                    w.unknown.add(g);
                    continue;
                }
                w.patternsByGroup.add(g + "|" + r.pattern());
                w.tokenPatterns.add(r.muscle() + "|" + r.pattern());
                for (String s : r.secondaryMuscles() == null ? List.<String>of() : r.secondaryMuscles()) {
                    String sg = MuscleGroup.of(s);
                    if (sg == null || sg.isBlank() || Objects.equals(sg, g)) {
                        continue;
                    }
                    w.trained.add(sg);
                    if (PULLS.contains(r.pattern())) {
                        w.secondaryOfPulls.add(sg);
                    }
                    if (PRESSES.contains(r.pattern())) {
                        w.secondaryOfPresses.add(sg);
                    }
                }
            }
        }
        return w;
    }
}
