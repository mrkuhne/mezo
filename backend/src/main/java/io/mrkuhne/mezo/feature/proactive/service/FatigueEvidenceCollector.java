package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.proactive.config.DiagnosisProperties;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Diagnosis evidence gather (mezo-hqfi.2, recipe-parameterised since mezo-po3y) — PURE CODE, no
 * LLM. For each of the RECIPE's {@link MetricKey}s: the window mean vs the preceding baseline
 * mean, dropped entirely when the window has fewer than {@code minCoverageDays} measured days (a
 * two-day average is not a finding). Confirmed patterns and prompt-included knowledge facts join
 * the same list as non-metric evidence.
 *
 * <p>Ordering is the FIXED enum order, then patterns, then facts. The index IS the contract the
 * model answers with, so a reordering is a breaking change to already-persisted rows.
 *
 * <p>Every candidate is rendered EXACTLY ONCE, in the single numbered list — unlike the weekly
 * gather, which renders labels twice. That keeps the payload small and makes any label a safe
 * {@code FakeCompanionLlm} sentinel channel.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class FatigueEvidenceCollector {

    private static final int MAX_PATTERNS = 5;
    private static final int MAX_FACTS = 5;
    private static final int MAX_PRIOR_EXPERIMENTS = 5;
    private static final int FACT_LABEL_LEN = 80;

    private final MetricSeriesService metricSeriesService;
    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final ExperimentRepository experimentRepository;
    private final DiagnosisProperties properties;

    public record FatigueGather(String payload, List<EvidenceItem> candidates, int domainCount) {
    }

    /** The pre-recipe entry point — the fatigue recipe, kept so existing callers read unchanged. */
    @Transactional(readOnly = true)
    public FatigueGather gather(UUID userId, LocalDate today) {
        return gather(userId, today, DiagnosisRecipe.FATIGUE);
    }

    /** Null when fewer than {@code minDomains} domains clear the coverage threshold. */
    @Transactional(readOnly = true)
    public FatigueGather gather(UUID userId, LocalDate today, DiagnosisRecipe recipe) {
        LocalDate windowFrom = today.minusDays(properties.windowDays() - 1L);
        LocalDate baselineTo = windowFrom.minusDays(1);
        LocalDate baselineFrom = baselineTo.minusDays(properties.baselineDays() - 1L);

        List<EvidenceItem> candidates = new ArrayList<>();
        Set<String> domains = new LinkedHashSet<>();

        for (MetricKey metric : recipe.metrics()) {
            Map<LocalDate, Double> window = metricSeriesService.series(userId, metric, windowFrom, today);
            if (window.size() < properties.minCoverageDays()) {
                continue;
            }
            double value = round(mean(window.values()));
            Map<LocalDate, Double> baseline =
                    metricSeriesService.series(userId, metric, baselineFrom, baselineTo);
            Double baselineValue = baseline.isEmpty() ? null : round(mean(baseline.values()));
            Double delta = baselineValue == null ? null : round(value - baselineValue);

            domains.add(metric.domain().name());
            candidates.add(new EvidenceItem(
                    "metric",
                    metric.labelHu(),
                    detailLine(value, baselineValue, delta, window.size()),
                    metric.sourceHu(),
                    metric.name(),
                    value,
                    baselineValue,
                    delta,
                    window.size()));
        }

        if (domains.size() < properties.minDomains()) {
            return null;
        }

        patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
                        userId, PatternEntity.STATUS_CONFIRMED)
                .stream().limit(MAX_PATTERNS)
                .forEach(pattern -> candidates.add(new EvidenceItem(
                        "pattern", pattern.getTitle(), pattern.getMechanism(), "Minták",
                        null, null, null, null, null)));

        knowledgeFactRepository
                .findByCreatedByAndIncludeInPromptTrueAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
                        userId, PageRequest.of(0, MAX_FACTS))
                .forEach(fact -> candidates.add(new EvidenceItem(
                        "fact", truncate(fact.getFactText()), null, "Tudástár",
                        null, null, null, null, null)));

        return new FatigueGather(
                render(userId, recipe, candidates, windowFrom, today, baselineFrom, baselineTo),
                candidates, domains.size());
    }

    private String render(UUID userId, DiagnosisRecipe recipe, List<EvidenceItem> candidates,
            LocalDate windowFrom, LocalDate today, LocalDate baselineFrom, LocalDate baselineTo) {
        StringBuilder payload = new StringBuilder();
        payload.append("JELENSÉG: ").append(recipe.labelHu()).append('\n')
                .append("ABLAK: ").append(windowFrom).append(" – ").append(today)
                .append(" (").append(properties.windowDays()).append(" nap)\n")
                .append("BÁZIS: ").append(baselineFrom).append(" – ").append(baselineTo)
                .append(" (").append(properties.baselineDays()).append(" nap)\n\n")
                .append("EVIDENCIA-JELÖLTEK (az evidenceIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            EvidenceItem item = candidates.get(i);
            payload.append(i).append(": [").append(item.kind()).append("] ").append(item.label());
            if (item.detail() != null) {
                payload.append(" — ").append(item.detail());
            }
            if (item.metricKey() != null) {
                payload.append(" · metricKey=").append(item.metricKey());
            }
            payload.append('\n');
        }
        appendPriorExperiments(userId, payload);
        return payload.toString();
    }

    /**
     * What the user already tried on an earlier diagnosis, and how it went — CONTEXT ONLY. It
     * produces no candidates on purpose: a prior experiment is something to avoid repeating, not
     * evidence a suspect may cite. This is what makes the second run non-blind (spec §4).
     */
    private void appendPriorExperiments(UUID userId, StringBuilder payload) {
        List<ExperimentEntity> prior = experimentRepository
                .findByCreatedByAndSourceAndDeletedFalseOrderByGeneratedAtDesc(
                        userId, ExperimentEntity.SOURCE_DIAGNOSIS);
        if (prior.isEmpty()) {
            return;
        }
        payload.append("\nKORÁBBI KÍSÉRLETEK (amit már kipróbált — ne javasold újra ugyanazt):\n");
        for (ExperimentEntity experiment : prior.stream().limit(MAX_PRIOR_EXPERIMENTS).toList()) {
            payload.append("- ").append(experiment.getTitle())
                    .append(" [").append(experiment.getStatus()).append("]");
            if (experiment.getOutcome() != null) {
                payload.append(" — ").append(experiment.getOutcome());
            }
            payload.append('\n');
        }
    }

    private static String detailLine(double value, Double baselineValue, Double delta, int coverage) {
        StringBuilder line = new StringBuilder("átlag ").append(value);
        if (baselineValue != null) {
            line.append(" (bázis ").append(baselineValue)
                    .append(", eltérés ").append(delta >= 0 ? "+" : "").append(delta).append(")");
        }
        return line.append(" · ").append(coverage).append(" mért nap").toString();
    }

    private static double mean(Collection<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static String truncate(String text) {
        if (text == null) {
            return "";
        }
        return text.length() <= FACT_LABEL_LEN ? text : text.substring(0, FACT_LABEL_LEN);
    }
}
