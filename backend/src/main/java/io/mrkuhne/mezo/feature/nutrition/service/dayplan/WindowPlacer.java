package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Places the day's meal windows — the server-side port of the web planner's {@code placeWindows}
 * ({@code frontend/src/features/fuel/logic/buildDayPlan.ts} :189), {@code compileTemplate}
 * ({@code compileTemplate.ts} :67) and {@code widenWindows} ({@code mealWindow.ts} :57). Pure and
 * deterministic: no ambient clock, no randomness, every input is a parameter.
 *
 * <p><b>Default rhythm (owner decision 21).</b> Three mains spread over the eating span
 * ({@code wake+45} … {@code bed−90}) at fractions 0 / 0.5 / 1, plus snacks between them, then ONE
 * snap around the whole training envelope: the main nearest the LATEST session end moves to
 * {@code end+45} and is weighted up, and the nearest window before that end is pulled out to
 * {@code earliest start−75} as pre-fuel. Everything is clamped into the span and forward-pushed to
 * keep {@value #MIN_SLOT_GAP_MIN} minutes between windows.
 *
 * <p><b>Times.</b> Minutes since midnight in the OWNER's zone; the caller resolves that zone. The
 * web planner's midnight-crossing axis is NOT ported — see the class's package note in
 * {@code DayPlanService}.
 */
public final class WindowPlacer {

    public static final int EATING_START_OFFSET_MIN = 45;
    public static final int KITCHEN_CLOSE_OFFSET_MIN = 90;
    public static final int MIN_SLOT_GAP_MIN = 90;
    static final int PRE_WORKOUT_SNAP_MIN = 75;
    static final int POST_WORKOUT_SNAP_MIN = 45;
    /** A session at least this long earns its own light pre-session window. */
    static final int PERI_SNACK_MIN_DURATION = 90;
    static final double WEIGHT_MAIN = 2;
    static final double WEIGHT_SNACK = 1;
    static final double WEIGHT_POST_WORKOUT_MAIN = 2.5;
    private static final int WINDOW_MIN_WIDTH_MIN = 30;
    private static final int MINUTES_PER_DAY = 1440;
    private static final int NOON_MIN = 720;

    /** Hungarian window names — Boop speaks one language (the web app keeps its own catalog). */
    static final String LABEL_BREAKFAST = "Reggeli";
    static final String LABEL_LUNCH = "Ebéd";
    static final String LABEL_DINNER = "Vacsora";
    static final String LABEL_SNACK = "Uzsonna";
    static final String LABEL_MORNING_SNACK = "Tízórai";
    static final String LABEL_EVENING_SNACK = "Esti uzsonna";
    static final String LABEL_PRE_WORKOUT_SNACK = "Edzés előtti uzsonna";

    private WindowPlacer() {
    }

    /** Mutable while the rules argue about it; frozen into a {@link PlannedWindow} at the end. */
    private static final class Draft {
        private final SlotKey slotKey;
        private final WindowKind kind;
        private final String label;
        private final Integer budgetPct;
        private final String role;
        private double time;
        private double weight;
        private WindowRule rule;

        private Draft(SlotKey slotKey, WindowKind kind, String label, double time, double weight,
                Integer budgetPct, String role, WindowRule rule) {
            this.slotKey = slotKey;
            this.kind = kind;
            this.label = label;
            this.time = time;
            this.weight = weight;
            this.budgetPct = budgetPct;
            this.role = role;
            this.rule = rule;
        }
    }

    /**
     * The default rhythm. {@code mealsPerDay} is clamped to 3..6: 3 mains, +1 snack after lunch at
     * 4, +1 mid-morning at 5 (owner decision 21's 3 meals + 2 snacks), +1 evening at 6.
     */
    public static List<PlannedWindow> place(String wake, String bed, int mealsPerDay, List<TrainingBlock> blocks) {
        int eatingStart = toMin(wake) + EATING_START_OFFSET_MIN;
        int kitchenClose = toMin(bed) - KITCHEN_CLOSE_OFFSET_MIN;
        int span = kitchenClose - eatingStart;

        Draft breakfast = new Draft(SlotKey.BREAKFAST, WindowKind.MEAL, LABEL_BREAKFAST,
            eatingStart, WEIGHT_MAIN, null, null, WindowRule.BREAKFAST);
        Draft lunch = new Draft(SlotKey.LUNCH, WindowKind.MEAL, LABEL_LUNCH,
            eatingStart + 0.5 * span, WEIGHT_MAIN, null, null, WindowRule.MAIN);
        Draft dinner = new Draft(SlotKey.DINNER, WindowKind.MEAL, LABEL_DINNER,
            kitchenClose, WEIGHT_MAIN, null, null, WindowRule.MAIN);
        List<Draft> drafts = new ArrayList<>(List.of(breakfast, lunch, dinner));

        int meals = Math.max(3, Math.min(6, mealsPerDay));
        if (meals >= 4) {
            drafts.add(snack((lunch.time + dinner.time) / 2, LABEL_SNACK, WindowRule.SNACK));
        }
        if (meals >= 5) {
            drafts.add(snack((breakfast.time + lunch.time) / 2, LABEL_MORNING_SNACK, WindowRule.SNACK));
        }
        if (meals >= 6) {
            drafts.add(snack(dinner.time - MIN_SLOT_GAP_MIN, LABEL_EVENING_SNACK, WindowRule.SNACK));
        }

        // A long session earns its own light pre-session window, unless a window already sits there.
        for (TrainingBlock b : blocks) {
            if (b.durationMin() < PERI_SNACK_MIN_DURATION) {
                continue;
            }
            double t = clamp(b.startMin() - 60.0, eatingStart, kitchenClose);
            if (drafts.stream().anyMatch(w -> Math.abs(w.time - t) < MIN_SLOT_GAP_MIN)) {
                continue;
            }
            drafts.add(snack(t, LABEL_PRE_WORKOUT_SNACK, WindowRule.PRE_TRAINING_SNACK));
        }

        // ONE snap around the whole training envelope, so two concurrent sessions cannot each drag
        // their own nearest main into the other's.
        if (!blocks.isEmpty()) {
            int earliestStart = blocks.stream().mapToInt(TrainingBlock::startMin).min().orElseThrow();
            int latestEnd = blocks.stream().mapToInt(TrainingBlock::endMin).max().orElseThrow();
            Draft post = drafts.stream()
                .filter(w -> w.kind == WindowKind.MEAL)
                .min(Comparator.comparingDouble(w -> Math.abs(w.time - latestEnd)))
                .orElse(null);
            if (post != null) {
                post.time = clamp(latestEnd + (double) POST_WORKOUT_SNAP_MIN, eatingStart, kitchenClose);
                post.weight = WEIGHT_POST_WORKOUT_MAIN;
                post.rule = WindowRule.POST_TRAINING;
            }
            Draft pre = drafts.stream()
                .filter(w -> w != post && w.time < latestEnd)
                .max(Comparator.comparingDouble(w -> w.time))
                .orElse(null);
            if (pre != null) {
                pre.time = clamp(earliestStart - (double) PRE_WORKOUT_SNAP_MIN, eatingStart, kitchenClose);
                pre.rule = pre.kind == WindowKind.MEAL
                    ? WindowRule.PRE_TRAINING_MAIN : WindowRule.PRE_TRAINING_SNACK;
            }
        }

        for (Draft w : drafts) {
            w.time = clamp(w.time, eatingStart, kitchenClose);
        }
        return finish(drafts, eatingStart, kitchenClose, toMin(bed));
    }

    /**
     * Replays a saved {@code meal_slot_template} onto this day's rhythm and sessions. A
     * training-relative row on a day with no session resolves to nothing and is DROPPED — never
     * placed at a guessed time.
     */
    public static List<PlannedWindow> fromTemplate(
            List<TemplateRow> rows, String wake, String bed, List<TrainingBlock> blocks) {
        int wakeMin = toMin(wake);
        int bedMin = toMin(bed);
        int eatingStart = wakeMin + EATING_START_OFFSET_MIN;
        int kitchenClose = bedMin - KITCHEN_CLOSE_OFFSET_MIN;

        List<Draft> drafts = new ArrayList<>();
        for (TemplateRow row : rows) {
            Integer anchored = anchorMinute(row, wakeMin, bedMin, blocks);
            if (anchored == null) {
                continue;
            }
            WindowKind kind = row.slotKind() == SlotKey.SNACK ? WindowKind.SNACK : WindowKind.MEAL;
            drafts.add(new Draft(row.slotKind(), kind, row.label(),
                clamp(anchored, eatingStart, kitchenClose), row.budgetPct(), row.budgetPct(), row.role(),
                ruleOf(row.anchorType())));
        }
        return finish(drafts, eatingStart, kitchenClose, bedMin);
    }

    /** {@code rest} on a day with no session, else {@code training_am}/{@code training_pm} by the earliest start. */
    public static String dayType(List<TrainingBlock> blocks) {
        if (blocks.isEmpty()) {
            return "rest";
        }
        return blocks.stream().mapToInt(TrainingBlock::startMin).min().orElseThrow() < NOON_MIN
            ? "training_am" : "training_pm";
    }

    /** Minutes since midnight → zero-padded {@code HH:mm}, clamped to 00:00..23:59. */
    public static String hhmm(int minutes) {
        int clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, minutes));
        return String.format(Locale.ROOT, "%02d:%02d", clamped / 60, clamped % 60);
    }

    /** {@code HH:mm} → minutes since midnight. */
    public static int toMin(String hhmm) {
        String[] parts = hhmm.split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    // --- internals -------------------------------------------------------------------------------

    private static Draft snack(double time, String label, WindowRule rule) {
        return new Draft(SlotKey.SNACK, WindowKind.SNACK, label, time, WEIGHT_SNACK, null, null, rule);
    }

    private static Integer anchorMinute(TemplateRow row, int wakeMin, int bedMin, List<TrainingBlock> blocks) {
        int offset = row.offsetMin() == null ? 0 : row.offsetMin();
        return switch (row.anchorType() == null ? "" : row.anchorType()) {
            case "fixed" -> row.time() == null ? null : toMin(row.time());
            case "wake" -> wakeMin + offset;
            case "bed" -> bedMin + offset;
            case "training_start" -> blocks.isEmpty() ? null
                : blocks.stream().mapToInt(TrainingBlock::startMin).min().orElseThrow() + offset;
            case "training_end" -> blocks.isEmpty() ? null
                : blocks.stream().mapToInt(TrainingBlock::endMin).max().orElseThrow() + offset;
            default -> null;
        };
    }

    private static WindowRule ruleOf(String anchorType) {
        return switch (anchorType == null ? "" : anchorType) {
            case "wake" -> WindowRule.TEMPLATE_WAKE;
            case "bed" -> WindowRule.TEMPLATE_BED;
            case "training_start" -> WindowRule.TEMPLATE_TRAINING_START;
            case "training_end" -> WindowRule.TEMPLATE_TRAINING_END;
            default -> WindowRule.TEMPLATE_FIXED;
        };
    }

    /** Sort by time, forward-push for the minimum gap, widen into ranges, freeze. */
    private static List<PlannedWindow> finish(List<Draft> drafts, int eatingStart, int kitchenClose, int bedMin) {
        drafts.sort(Comparator.comparingDouble(w -> w.time));
        for (int i = 1; i < drafts.size(); i++) {
            double wanted = drafts.get(i - 1).time + MIN_SLOT_GAP_MIN;
            if (drafts.get(i).time < wanted) {
                drafts.get(i).time = Math.min(kitchenClose, wanted);
            }
        }
        List<int[]> ranges = widen(drafts, eatingStart, kitchenClose);
        List<PlannedWindow> out = new ArrayList<>(drafts.size());
        for (int i = 0; i < drafts.size(); i++) {
            Draft w = drafts.get(i);
            out.add(new PlannedWindow(w.slotKey, w.kind, w.label, (int) Math.round(w.time), w.weight,
                w.budgetPct, w.role, w.rule, ranges.get(i)[0], ranges.get(i)[1]));
        }
        return List.copyOf(out);
    }

    /**
     * One anchored time → a range, by the rule's own offsets; overlapping neighbours are cut at the
     * midpoint of their anchored times and no range is ever narrower than
     * {@value #WINDOW_MIN_WIDTH_MIN} minutes. {@code drafts} must already be time-sorted.
     */
    private static List<int[]> widen(List<Draft> drafts, int eatingStart, int kitchenClose) {
        boolean spanOk = eatingStart < kitchenClose;
        List<double[]> out = new ArrayList<>(drafts.size());
        for (Draft w : drafts) {
            int[] offsets = offsetsOf(w);
            double from = w.time - offsets[0];
            double to = w.time + offsets[1];
            if (spanOk) {
                from = Math.max(eatingStart, from);
                to = Math.min(kitchenClose, to);
            }
            if (to - from < WINDOW_MIN_WIDTH_MIN) {
                from = to - WINDOW_MIN_WIDTH_MIN;
            }
            out.add(new double[] {from, to});
        }
        for (int i = 1; i < out.size(); i++) {
            double[] previous = out.get(i - 1);
            double[] current = out.get(i);
            if (previous[1] > current[0]) {
                double mid = (drafts.get(i - 1).time + drafts.get(i).time) / 2;
                previous[1] = Math.min(previous[1], mid);
                current[0] = Math.max(current[0], mid);
            }
        }
        List<int[]> rounded = new ArrayList<>(out.size());
        for (double[] r : out) {
            int to = (int) Math.round(r[1]);
            int from = (int) Math.round(r[0]);
            if (to - from < WINDOW_MIN_WIDTH_MIN) {
                from = to - WINDOW_MIN_WIDTH_MIN;
            }
            rounded.add(new int[] {from, to});
        }
        return rounded;
    }

    /** {@code [before, after]} minutes a rule opens around its anchored time. */
    private static int[] offsetsOf(Draft w) {
        return switch (w.rule) {
            case BREAKFAST -> new int[] {40, 80};
            case MAIN -> new int[] {45, 45};
            case SNACK, PRE_TRAINING_MAIN -> new int[] {30, 30};
            case PRE_TRAINING_SNACK, TEMPLATE_TRAINING_START ->
                w.kind == WindowKind.MEAL ? new int[] {30, 30} : new int[] {30, 15};
            case POST_TRAINING, TEMPLATE_TRAINING_END -> new int[] {30, 60};
            default -> w.kind == WindowKind.MEAL ? new int[] {45, 45} : new int[] {30, 30};
        };
    }

    private static double clamp(double t, int low, int high) {
        return Math.min(high, Math.max(low, t));
    }
}
