package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Splits the day's budget over its windows — the server-side port of {@code splitBudget}
 * ({@code frontend/src/features/fuel/logic/buildDayPlan.ts} :267) and {@code splitBudgetPct}
 * (:290). Pure arithmetic, no clock, no I/O.
 *
 * <p>Two invariants the web planner also holds:
 * <ul>
 *   <li>Σ of the window shares equals the daily budget EXACTLY, per macro — the rounding drift is
 *       absorbed by the dinner window (or, for a template, by the largest-percentage row).</li>
 *   <li>The split runs over ALL windows, skipped ones included (Kihagyás S3): a skipped meal's
 *       share stays with it and is never handed to the others.</li>
 * </ul>
 */
public final class BudgetSplitter {

    /** Role skew applied to a template row's P/C/F share before the column is renormalized. */
    private static final Map<String, double[]> ROLE_MULTIPLIERS = Map.of(
        "standard", new double[] {1, 1, 1},
        "pre_workout", new double[] {0.5, 1.6, 0.4},
        "post_workout", new double[] {1.7, 1.1, 0.7});

    private BudgetSplitter() {
    }

    /**
     * One share per window, in the windows' own order. {@code budgeted} is false on a kímélő
     * (GUIDANCE) day, whose kcal is not judged at all — then every entry is {@code null}, which is
     * "no budget", not a budget of zero.
     *
     * <p>Windows that all carry a {@code budgetPct} (a saved template) split by that percentage
     * with the role skew; otherwise the split goes by weight.
     */
    public static List<Macros4> split(Macros4 budget, List<PlannedWindow> windows, boolean budgeted) {
        if (!budgeted) {
            return Collections.nCopies(windows.size(), null);
        }
        if (windows.isEmpty()) {
            return List.of();
        }
        boolean byPct = windows.stream().allMatch(w -> w.budgetPct() != null);
        return byPct ? splitByPct(budget, windows) : splitByWeight(budget, windows);
    }

    private static List<Macros4> splitByWeight(Macros4 budget, List<PlannedWindow> windows) {
        double total = windows.stream().mapToDouble(PlannedWindow::weight).sum();
        if (total == 0) {
            total = 1;
        }
        int[][] out = new int[windows.size()][4];
        for (int i = 0; i < windows.size(); i++) {
            double share = windows.get(i).weight() / total;
            out[i] = new int[] {
                round(budget.kcal() * share), round(budget.p() * share),
                round(budget.c() * share), round(budget.f() * share)};
        }
        int absorb = indexOf(windows, SlotKey.DINNER);
        return freeze(out, budget, absorb < 0 ? windows.size() - 1 : absorb);
    }

    private static List<Macros4> splitByPct(Macros4 budget, List<PlannedWindow> windows) {
        double totalPct = windows.stream().mapToInt(PlannedWindow::budgetPct).sum();
        if (totalPct == 0) {
            totalPct = 1;
        }
        int[][] out = new int[windows.size()][4];
        for (int i = 0; i < windows.size(); i++) {
            out[i][0] = round(budget.kcal() * (windows.get(i).budgetPct() / totalPct));
        }
        // P/C/F: the percentage share skewed by the row's role, then the column is renormalized so
        // it still sums to the daily budget for that macro.
        int[] macroBudget = {0, budget.p(), budget.c(), budget.f()};
        for (int macro = 1; macro <= 3; macro++) {
            double[] raw = new double[windows.size()];
            double rawSum = 0;
            for (int i = 0; i < windows.size(); i++) {
                raw[i] = windows.get(i).budgetPct() / totalPct * multipliersOf(windows.get(i))[macro - 1];
                rawSum += raw[i];
            }
            if (rawSum == 0) {
                rawSum = 1;
            }
            for (int i = 0; i < windows.size(); i++) {
                out[i][macro] = round(macroBudget[macro] * raw[i] / rawSum);
            }
        }
        int absorb = 0;
        for (int i = 1; i < windows.size(); i++) {
            if (windows.get(i).budgetPct() > windows.get(absorb).budgetPct()) {
                absorb = i;
            }
        }
        return freeze(out, budget, absorb);
    }

    private static double[] multipliersOf(PlannedWindow window) {
        String role = window.role() == null ? "standard" : window.role().toLowerCase(Locale.ROOT);
        return ROLE_MULTIPLIERS.getOrDefault(role, ROLE_MULTIPLIERS.get("standard"));
    }

    /** Drops the per-macro rounding drift on one window so Σ === the budget, then freezes. */
    private static List<Macros4> freeze(int[][] out, Macros4 budget, int absorb) {
        int[] totals = {budget.kcal(), budget.p(), budget.c(), budget.f()};
        for (int macro = 0; macro < 4; macro++) {
            int sum = 0;
            for (int[] row : out) {
                sum += row[macro];
            }
            out[absorb][macro] += totals[macro] - sum;
        }
        List<Macros4> frozen = new ArrayList<>(out.length);
        for (int[] row : out) {
            frozen.add(new Macros4(row[0], row[1], row[2], row[3]));
        }
        return List.copyOf(frozen);
    }

    private static int indexOf(List<PlannedWindow> windows, SlotKey slot) {
        for (int i = 0; i < windows.size(); i++) {
            if (windows.get(i).slotKey() == slot) {
                return i;
            }
        }
        return -1;
    }

    /** JavaScript's {@code Math.round} — half away from zero upwards, i.e. {@code floor(x + 0.5)}. */
    private static int round(double value) {
        return (int) Math.floor(value + 0.5);
    }
}
