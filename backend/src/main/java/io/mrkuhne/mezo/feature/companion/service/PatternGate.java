package io.mrkuhne.mezo.feature.companion.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * A V3.1 felszínre-engedő kapu tiszta függvényként (a {@link PearsonCorrelation} precedense: se
 * Spring, se DB, se LLM). Ugyanezt futtatja az éjszakai {@code PatternDetectionService} és az élő
 * {@code PatternMonitorService} — ez garantálja, hogy a monitor nem tud mást mondani, mint amit a
 * job tenne. A {@code FROZEN} szándékosan NEM verdikt: az a perzisztált sor státuszának
 * következménye, nem a matematikáé.
 */
final class PatternGate {

    enum Verdict { LIVE, FEW_DAYS, NO_DATA, DEGENERATE }

    /** Melyik illesztett széria konstans — csak {@code DEGENERATE} esetén értelmezett. */
    enum Side { A, B, BOTH }

    /** {@code result} csak LIVE-nál, {@code constantSide} csak DEGENERATE-nél nem null. */
    record Outcome(Verdict verdict, int alignedDays, PearsonCorrelation.Result result, Side constantSide) {
    }

    private PatternGate() {
    }

    /**
     * {@code seriesB} a {@code seriesA} napjához képest {@code lagDays} nappal KÉSŐBB olvasódik.
     * A hívó felelőssége, hogy a két térképet a saját ablakára vágja (a job ezt teszi).
     */
    static Outcome evaluate(Map<LocalDate, Double> seriesA, Map<LocalDate, Double> seriesB,
                            int lagDays, int minN) {
        List<double[]> aligned = new ArrayList<>();
        seriesA.forEach((day, a) -> {
            Double b = seriesB.get(day.plusDays(lagDays));
            if (b != null) {
                aligned.add(new double[] {a, b});
            }
        });
        int n = aligned.size();
        if (n == 0) {
            return new Outcome(Verdict.NO_DATA, 0, null, null);
        }
        if (n < minN) {
            return new Outcome(Verdict.FEW_DAYS, n, null, null);
        }
        double[] xs = aligned.stream().mapToDouble(v -> v[0]).toArray();
        double[] ys = aligned.stream().mapToDouble(v -> v[1]).toArray();
        return PearsonCorrelation.correlate(xs, ys)
                .map(result -> new Outcome(Verdict.LIVE, n, result, null))
                .orElseGet(() -> new Outcome(Verdict.DEGENERATE, n, null, constantSide(xs, ys)));
    }

    /**
     * A {@code correlate()} csak üres Optionalt ad — a DEGENERATE verdiktnek viszont meg kell
     * tudnia nevezni a hibás metrikát, ezért a varianciát itt nézzük meg még egyszer. (A
     * {@code n < 3} miatti üres Optional nem érhet ide: a config {@code min-n}-je legalább 3.)
     */
    private static Side constantSide(double[] xs, double[] ys) {
        boolean a = isConstant(xs);
        boolean b = isConstant(ys);
        return a && b ? Side.BOTH : a ? Side.A : Side.B;
    }

    private static boolean isConstant(double[] values) {
        for (double value : values) {
            if (value != values[0]) {
                return false;
            }
        }
        return true;
    }
}
