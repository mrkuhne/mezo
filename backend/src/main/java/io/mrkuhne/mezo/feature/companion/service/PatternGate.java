package io.mrkuhne.mezo.feature.companion.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A V3.1 felszínre-engedő kapu tiszta függvényként (a {@link PearsonCorrelation} precedense: se
 * Spring, se DB, se LLM). Ugyanezt futtatja az éjszakai {@code PatternDetectionService} és az élő
 * {@code PatternMonitorService} — ez garantálja, hogy a monitor nem tud mást mondani, mint amit a
 * job tenne. A teljes mintaméret után a bináris A metrikák mindkét csoportját külön is kapuzza,
 * mielőtt Pearsont számolna. A {@code FROZEN} szándékosan NEM verdikt: az a perzisztált sor
 * státuszának következménye, nem a matematikáé.
 */
final class PatternGate {

    enum Verdict { LIVE, FEW_DAYS, NO_DATA, DEGENERATE, IMBALANCED_GROUPS }

    /** Melyik illesztett széria konstans — csak {@code DEGENERATE} esetén értelmezett. */
    enum Side { A, B, BOTH }

    /**
     * {@code result} only exists for LIVE, {@code constantSide} only for DEGENERATE, while the
     * group counts exist only when metric A is binary and has reached the total-size gate.
     */
    record Outcome(Verdict verdict, int alignedDays, PearsonCorrelation.Result result,
                   Side constantSide, Integer groupZeroDays, Integer groupOneDays) {
    }

    private PatternGate() {
    }

    /** [from,to] szűkítés — a futás-szintű cache uniós ablakából a pár PONTOS ablaka. */
    static Map<LocalDate, Double> window(Map<LocalDate, Double> series, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> out = new LinkedHashMap<>();
        series.forEach((day, value) -> {
            if (!day.isBefore(from) && !day.isAfter(to)) {
                out.put(day, value);
            }
        });
        return out;
    }

    /**
     * {@code seriesB} a {@code seriesA} napjához képest {@code lagDays} nappal KÉSŐBB olvasódik.
     * A hívó felelőssége, hogy a két térképet a saját ablakára vágja (a job ezt teszi).
     */
    static Outcome evaluate(Map<LocalDate, Double> seriesA, Map<LocalDate, Double> seriesB,
                            int lagDays, int minN, int minGroupN,
                            MetricValueKind metricAValueKind) {
        List<double[]> aligned = new ArrayList<>();
        seriesA.forEach((day, a) -> {
            Double b = seriesB.get(day.plusDays(lagDays));
            if (b != null) {
                aligned.add(new double[] {a, b});
            }
        });
        int n = aligned.size();
        if (n == 0) {
            return new Outcome(Verdict.NO_DATA, 0, null, null, null, null);
        }
        if (n < minN) {
            return new Outcome(Verdict.FEW_DAYS, n, null, null, null, null);
        }
        Integer groupZeroDays = null;
        Integer groupOneDays = null;
        if (metricAValueKind == MetricValueKind.BINARY) {
            groupZeroDays = (int) aligned.stream().filter(values -> values[0] == 0.0).count();
            groupOneDays = (int) aligned.stream().filter(values -> values[0] == 1.0).count();
            if (groupZeroDays < minGroupN || groupOneDays < minGroupN) {
                return new Outcome(Verdict.IMBALANCED_GROUPS, n, null, null,
                        groupZeroDays, groupOneDays);
            }
        }
        double[] xs = aligned.stream().mapToDouble(v -> v[0]).toArray();
        double[] ys = aligned.stream().mapToDouble(v -> v[1]).toArray();
        Integer finalGroupZeroDays = groupZeroDays;
        Integer finalGroupOneDays = groupOneDays;
        return PearsonCorrelation.correlate(xs, ys)
                .map(result -> new Outcome(Verdict.LIVE, n, result, null,
                        finalGroupZeroDays, finalGroupOneDays))
                .orElseGet(() -> new Outcome(Verdict.DEGENERATE, n, null, constantSide(xs, ys),
                        finalGroupZeroDays, finalGroupOneDays));
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
