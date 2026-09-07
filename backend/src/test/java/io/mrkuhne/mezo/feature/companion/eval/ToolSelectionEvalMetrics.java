package io.mrkuhne.mezo.feature.companion.eval;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pure metric calculator for the tool-selection re-baseline (mezo-ozri.3, spec §S3). Network-free
 * and Spring-free on purpose: the IT does the calling, this does the arithmetic, and the arithmetic
 * is what the model decision rests on.
 *
 * <p>Definitions, chosen so the numbers mean the same thing across providers:
 * <ul>
 *   <li><b>hit</b> — at least one selected tool is in the case's accepted set (the pre-S3 metric,
 *       kept so the new run is comparable to the old one).</li>
 *   <li><b>exact match</b> — something was selected AND nothing outside the accepted set was; this
 *       is the gate's metric, because a right tool dragged along by two wrong ones costs money and
 *       pollutes the answer.</li>
 *   <li><b>critical wrong tool</b> — a selected tool whose domain matches no accepted tool's domain
 *       (see {@link ToolDomains}). The gate demands zero.</li>
 *   <li><b>cost per successful action</b> — USD summed per case, over HIT cases only; a cheap model
 *       that misses is not cheap.</li>
 * </ul>
 */
public final class ToolSelectionEvalMetrics {

    private ToolSelectionEvalMetrics() {
    }

    /** One measured case. {@code costUsd} and {@code latencyMs} come from the llm_log rows. */
    public record CaseOutcome(String id, String question, List<String> expected, List<String> actual,
                              long latencyMs, BigDecimal costUsd, boolean jsonValid, boolean errored) {}

    public record EvalReport(String model, int cases, int hits, int exactMatches, int criticalWrongTools,
                             int errors, double hitRate, double exactMatchRate, double jsonValidRate,
                             long latencyP50, long latencyP95,
                             BigDecimal costPerSuccessP50, BigDecimal costPerSuccessP95, BigDecimal totalCostUsd,
                             List<String> misses, List<String> criticalDetails) {}

    public static EvalReport evaluate(String model, List<CaseOutcome> outcomes) {
        int hits = 0;
        int exact = 0;
        int critical = 0;
        int errors = 0;
        int jsonValid = 0;
        BigDecimal total = BigDecimal.ZERO;
        List<String> misses = new ArrayList<>();
        List<String> criticalDetails = new ArrayList<>();
        List<Long> latencies = new ArrayList<>();
        List<BigDecimal> successCosts = new ArrayList<>();

        for (CaseOutcome outcome : outcomes) {
            total = total.add(outcome.costUsd());
            latencies.add(outcome.latencyMs());
            if (outcome.errored()) {
                errors++;
            }
            if (outcome.jsonValid()) {
                jsonValid++;
            }
            Set<String> accepted = Set.copyOf(outcome.expected());
            boolean hit = outcome.actual().stream().anyMatch(accepted::contains);
            if (hit) {
                hits++;
                successCosts.add(outcome.costUsd());
            } else {
                misses.add("[%s] \"%s\" — expected %s, got %s"
                    .formatted(outcome.id(), outcome.question(), outcome.expected(), outcome.actual()));
            }
            if (!outcome.actual().isEmpty() && accepted.containsAll(outcome.actual())) {
                exact++;
            }
            Set<String> acceptedDomains = accepted.stream()
                .map(ToolDomains::domainOf).flatMap(Optional::stream).collect(Collectors.toSet());
            for (String selected : outcome.actual()) {
                Optional<String> domain = ToolDomains.domainOf(selected);
                if (domain.isEmpty() || !acceptedDomains.contains(domain.get())) {
                    critical++;
                    criticalDetails.add("[%s] %s (domain %s) is outside %s"
                        .formatted(outcome.id(), selected, domain.orElse("UNKNOWN"), acceptedDomains));
                }
            }
        }

        int n = outcomes.size();
        return new EvalReport(model, n, hits, exact, critical, errors,
            rate(hits, n), rate(exact, n), rate(jsonValid, n),
            percentileLong(latencies, 50), percentileLong(latencies, 95),
            percentileMoney(successCosts, 50), percentileMoney(successCosts, 95), total,
            List.copyOf(misses), List.copyOf(criticalDetails));
    }

    private static double rate(int count, int total) {
        return total == 0 ? 0.0 : (double) count / total;
    }

    /** Nearest-rank percentile: index = ceil(p/100 * n) - 1 on the sorted values. */
    private static int index(int size, int percentile) {
        return Math.min(size - 1, (int) Math.ceil(percentile / 100.0 * size) - 1);
    }

    private static long percentileLong(List<Long> values, int percentile) {
        if (values.isEmpty()) {
            return 0L;
        }
        List<Long> sorted = values.stream().sorted().toList();
        return sorted.get(index(sorted.size(), percentile));
    }

    private static BigDecimal percentileMoney(List<BigDecimal> values, int percentile) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }
        List<BigDecimal> sorted = values.stream().sorted().toList();
        return sorted.get(index(sorted.size(), percentile));
    }
}
