package io.mrkuhne.mezo.feature.companion.eval;

import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.EvalReport;
import java.math.BigDecimal;
import java.util.Locale;

/**
 * Renders an {@link EvalReport} as the Markdown block that goes into
 * {@code docs/research/comparisons/} (mezo-ozri.3). Kept separate from the IT so the shape of the
 * evidence is unit-testable without spending a cent.
 */
public final class EvalReportWriter {

    private EvalReportWriter() {
    }

    public static String toMarkdown(EvalReport r) {
        StringBuilder sb = new StringBuilder();
        sb.append("# Tool-selection eval — ").append(r.model()).append("\n\n");
        sb.append("| metrika | érték |\n|---|---|\n");
        sb.append(row("cases", String.valueOf(r.cases())));
        sb.append(row("hit (bármely elfogadott tool)", percent(r.hitRate()) + " (" + r.hits() + ")"));
        sb.append(row("exact match", percent(r.exactMatchRate()) + " (" + r.exactMatches() + ")"));
        sb.append(row("critical wrong tool", String.valueOf(r.criticalWrongTools())));
        sb.append(row("JSON-érvényes turn", percent(r.jsonValidRate())));
        sb.append(row("hibára futott eset", String.valueOf(r.errors())));
        sb.append(row("latency p50 / p95", r.latencyP50() + " ms / " + r.latencyP95() + " ms"));
        sb.append(row("USD / sikeres akció p50 / p95",
            money(r.costPerSuccessP50()) + " / " + money(r.costPerSuccessP95())));
        sb.append(row("teljes futás költsége", money(r.totalCostUsd())));
        sb.append("\n## Misses\n\n");
        if (r.misses().isEmpty()) {
            sb.append("Zero misses.\n");
        } else {
            r.misses().forEach(m -> sb.append("- ").append(m).append('\n'));
        }
        sb.append("\n## Critical wrong tools\n\n");
        if (r.criticalDetails().isEmpty()) {
            sb.append("Zero critical wrong tools.\n");
        } else {
            r.criticalDetails().forEach(c -> sb.append("- ").append(c).append('\n'));
        }
        return sb.toString();
    }

    private static String row(String name, String value) {
        return "| " + name + " | " + value + " |\n";
    }

    private static String percent(double rate) {
        return String.format(Locale.ROOT, "%.1f%%", rate * 100);
    }

    private static String money(BigDecimal value) {
        return String.format(Locale.ROOT, "$%.6f", value);
    }
}
