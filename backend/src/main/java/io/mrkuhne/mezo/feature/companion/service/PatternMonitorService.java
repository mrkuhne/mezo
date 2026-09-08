package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.PatternMetricCoverage;
import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternMonitorResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.DerivedSeriesService;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Élő kapu-diagnosztika (mezo-viqs): a katalógus minden párjára ugyanazt a {@link PatternGate}-et
 * futtatja, amit az éjszakai {@code PatternDetectionService} — de semmit nem ír. A szériákat
 * metrikánként EGYSZER kéri le egy kérés-szintű cache-be, így a pár-verdiktek és a
 * metrika-lefedettség garantáltan ugyanabból a pillanatképből származnak.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PatternMonitorService {

    static final String VERDICT_LIVE = "live";
    static final String VERDICT_FEW_DAYS = "few_days";
    static final String VERDICT_NO_DATA = "no_data";
    static final String VERDICT_DEGENERATE = "degenerate";
    static final String VERDICT_IMBALANCED_GROUPS = "imbalanced_groups";
    static final String VERDICT_FROZEN = "frozen";

    /** S6 (mezo-eq85.6): a self-proposed hypothesis has no hand-written direction reading — the
     *  catalog's per-pair prose does not exist for a plan the engine invented last night. These
     *  keep the {@code {erősség}} slot the FE substitutes, and say only what the number says. */
    private static final String WHEN_POSITIVE_HU = "{erősség} pozitív együttjárás";
    private static final String WHEN_NEGATIVE_HU = "{erősség} fordított együttjárás";

    private static final Set<String> FROZEN_STATUSES =
            Set.of(PatternEntity.STATUS_CONFIRMED, PatternEntity.STATUS_REJECTED);

    private final MetricSeriesService metricSeriesService;
    private final PatternRepository patternRepository;
    private final CompanionProperties properties;

    @Transactional(readOnly = true)
    public PatternMonitorResponse monitor(UUID userId) {
        CompanionProperties.Patterns config = properties.patterns();
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(config.lookbackDays() - 1L);
        int maxLag = config.pairs().stream()
                .mapToInt(CompanionProperties.PatternPair::lagDays).max().orElse(0);

        Map<MetricKey, Map<LocalDate, Double>> cache = new EnumMap<>(MetricKey.class);
        for (MetricKey metric : MetricKey.values()) {
            cache.put(metric, metricSeriesService.series(userId, metric, from, to.plusDays(maxLag)));
        }
        Map<String, PatternEntity> rows = statisticalRowsByPairKey(userId);

        List<PatternMonitorPair> pairs = new ArrayList<>();
        for (CompanionProperties.PatternPair pair : config.pairs()) {
            pairs.add(toPair(pair, cache, rows.get(pair.key()), config.minN(), config.minGroupN(),
                    from, to));
        }

        return PatternMonitorResponse.builder()
                .windowFrom(from)
                .windowTo(to)
                .lookbackDays(config.lookbackDays())
                .minN(config.minN())
                .cron(config.cron())
                .lastRunAt(lastRunAt(rows))
                .pairs(pairs)
                .metrics(coverage(cache, config.pairs(), from, to, config.lookbackDays()))
                .build();
    }

    private Map<String, PatternEntity> statisticalRowsByPairKey(UUID userId) {
        Map<String, PatternEntity> rows = new LinkedHashMap<>();
        for (PatternEntity row : patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)) {
            if (PatternEntity.KIND_STATISTICAL.equals(row.getKind())) {
                rows.putIfAbsent(row.getPairKey(), row); // a legfrissebb detektálás nyer
            }
        }
        return rows;
    }

    private OffsetDateTime lastRunAt(Map<String, PatternEntity> rows) {
        Instant latest = rows.values().stream()
                .map(PatternEntity::getLastDetectedAt)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
        return latest == null ? null : latest.atOffset(ZoneOffset.UTC);
    }

    /** Package-private (mezo-tk88.3): {@link PatternPairDetailService} reuses this EXACT math. */
    PatternMonitorPair toPair(CompanionProperties.PatternPair pair,
                              Map<MetricKey, Map<LocalDate, Double>> cache,
                              PatternEntity row, int minN, int minGroupN,
                              LocalDate from, LocalDate to) {
        PatternMonitorPair.PatternMonitorPairBuilder builder = PatternMonitorPair.builder()
                .key(pair.key())
                .title(pair.title())
                .category(pair.category())
                .categoryLabel(pair.label())
                .lagDays(pair.lagDays())
                .metricAKey(pair.metricA().wireKey())
                .metricALabel(pair.metricA().labelHu())
                .metricAValueKind(pair.metricA().valueKind().wireKey())
                .metricBKey(pair.metricB().wireKey())
                .metricBLabel(pair.metricB().labelHu())
                .metricBValueKind(pair.metricB().valueKind().wireKey())
                .mechanismHu(pair.mechanism())
                .questionHu(pair.question())
                .expectedDirection(pair.expectedDirection())
                .whenPositiveHu(pair.whenPositiveHu())
                .whenNegativeHu(pair.whenNegativeHu())
                .metricADomain(pair.metricA().domain().wireKey())
                .metricBDomain(pair.metricB().domain().wireKey());

        if (row != null && FROZEN_STATUSES.contains(row.getStatus())) {
            // A user megítélte EZT a korrelációt — a job nem nyúl hozzá, így mi sem számolunk újra.
            return builder.verdict(VERDICT_FROZEN)
                    .status(row.getStatus())
                    .alignedDays(row.getN() == null ? 0 : row.getN())
                    .n(row.getN())
                    .r(row.getR() == null ? null : row.getR().doubleValue())
                    .p(row.getP() == null ? null : row.getP().doubleValue())
                    .build();
        }

        // Pontosan a job ablakai: A a [from,to]-n, B lagDays-szel eltolva.
        Map<LocalDate, Double> seriesA = PatternGate.window(cache.get(pair.metricA()), from, to);
        Map<LocalDate, Double> seriesB = PatternGate.window(cache.get(pair.metricB()),
                from.plusDays(pair.lagDays()), to.plusDays(pair.lagDays()));
        PatternGate.Outcome outcome = PatternGate.evaluate(seriesA, seriesB, pair.lagDays(),
                minN, minGroupN, pair.metricA().valueKind());
        builder.alignedDays(outcome.alignedDays());
        if (outcome.groupZeroDays() != null) {
            builder.groupZeroDays(outcome.groupZeroDays())
                    .groupOneDays(outcome.groupOneDays())
                    .requiredPerGroup(minGroupN);
        }

        // Switch EXPRESSION, nem statement: az enum feletti kifejezést a fordító teljességre
        // ellenőrzi, így egy jövőbeli Verdict konstans fordítási hiba lesz — nem pedig egy csendben
        // `verdict: null`-t kiadó válasz (a séma szerint required). Ezért nincs `default` ág sem:
        // az elnyelné a teljesség-ellenőrzést, és a ház szabálya (ArchitectureTest
        // `no_raw_generic_exceptions_outside_techcore`) amúgy is tiltja a nyers RuntimeException-t.
        PatternMonitorPair.PatternMonitorPairBuilder verdicted = switch (outcome.verdict()) {
            case LIVE -> builder.verdict(VERDICT_LIVE)
                    .r(outcome.result().r())
                    .n(outcome.result().n())
                    .p(outcome.result().p());
            case FEW_DAYS -> builder.verdict(VERDICT_FEW_DAYS)
                    .missingDays(minN - outcome.alignedDays())
                    .bottleneckMetricKey(thinnerMetric(pair, cache, from, to).wireKey());
            case NO_DATA -> builder.verdict(VERDICT_NO_DATA)
                    .bottleneckMetricKey(thinnerMetric(pair, cache, from, to).wireKey());
            case DEGENERATE -> builder.verdict(VERDICT_DEGENERATE)
                    .bottleneckMetricKey(constantMetric(pair, outcome.constantSide()).wireKey());
            case IMBALANCED_GROUPS -> builder.verdict(VERDICT_IMBALANCED_GROUPS);
        };
        return verdicted.build();
    }

    /**
     * Reflexió S6 (mezo-eq85.6): the SAME pair shape for a row that has no catalog pair at all —
     * a {@code reflection} hypothesis, described by its own {@link TestPlanEnvelope}. The detail
     * page must be able to render it exactly like a catalog pair, so the gate math, the verdict
     * vocabulary and the bottleneck naming stay here rather than growing a second copy next door.
     *
     * <p>Two deliberate differences from the catalog overload:
     * <ul>
     *   <li>the series are STRINGS, not {@link MetricKey}s — a {@code people:Anna} presence series
     *       is a real series for this user but will never be an enum constant; label, value kind
     *       and domain are therefore resolved through {@link DerivedSeriesService}, passed in as a
     *       parameter because that bean only exists while the Reflexió switch is on;</li>
     *   <li>there is no {@code frozen} short-circuit. A statistical row's {@code r}/{@code n}/
     *       {@code p} columns are the frozen statistic the Pearson job wrote; a reflection row's
     *       are not maintained at all (its evidence lives in {@code evidence} events), so freezing
     *       would serve an empty gate. A user-judged hypothesis still shows today's honest days.</li>
     * </ul>
     */
    PatternMonitorPair toPair(TestPlanEnvelope plan, String key, String title,
                              Map<String, Map<LocalDate, Double>> seriesByKey,
                              PatternEntity row, LocalDate from, LocalDate to,
                              DerivedSeriesService labels) {
        MetricValueKind valueKindA = labels.valueKindOf(plan.seriesA());
        PatternMonitorPair.PatternMonitorPairBuilder builder = PatternMonitorPair.builder()
                .key(key)
                .title(title)
                .category(row.getCategory())
                .categoryLabel(row.getCategoryLabel())
                .lagDays(plan.lagDays())
                .metricAKey(plan.seriesA())
                .metricALabel(labels.labelOf(plan.seriesA()))
                .metricAValueKind(valueKindA.wireKey())
                .metricBKey(plan.seriesB())
                .metricBLabel(labels.labelOf(plan.seriesB()))
                .metricBValueKind(labels.valueKindOf(plan.seriesB()).wireKey())
                .mechanismHu(row.getMechanism() == null ? title : row.getMechanism())
                .questionHu(title)
                .expectedDirection(plan.expectedDirection())
                .whenPositiveHu(WHEN_POSITIVE_HU)
                .whenNegativeHu(WHEN_NEGATIVE_HU)
                .metricADomain(domainOf(plan.seriesA()))
                .metricBDomain(domainOf(plan.seriesB()));

        Map<LocalDate, Double> seriesA = PatternGate.window(
                seriesByKey.getOrDefault(plan.seriesA(), Map.of()), from, to);
        Map<LocalDate, Double> seriesB = PatternGate.window(
                seriesByKey.getOrDefault(plan.seriesB(), Map.of()),
                from.plusDays(plan.lagDays()), to.plusDays(plan.lagDays()));
        PatternGate.Outcome outcome = PatternGate.evaluate(seriesA, seriesB, plan.lagDays(),
                plan.minN(), plan.minGroupN(), valueKindA);
        builder.alignedDays(outcome.alignedDays());
        if (outcome.groupZeroDays() != null) {
            builder.groupZeroDays(outcome.groupZeroDays())
                    .groupOneDays(outcome.groupOneDays())
                    .requiredPerGroup(plan.minGroupN());
        }

        // Switch EXPRESSION for the same reason as the catalog overload: a future Verdict constant
        // must be a compile error, not a silently null `verdict` on a schema-required field.
        PatternMonitorPair.PatternMonitorPairBuilder verdicted = switch (outcome.verdict()) {
            case LIVE -> builder.verdict(VERDICT_LIVE)
                    .r(outcome.result().r())
                    .n(outcome.result().n())
                    .p(outcome.result().p());
            case FEW_DAYS -> builder.verdict(VERDICT_FEW_DAYS)
                    .missingDays(plan.minN() - outcome.alignedDays())
                    .bottleneckMetricKey(seriesA.size() <= seriesB.size() ? plan.seriesA() : plan.seriesB());
            case NO_DATA -> builder.verdict(VERDICT_NO_DATA)
                    .bottleneckMetricKey(seriesA.size() <= seriesB.size() ? plan.seriesA() : plan.seriesB());
            case DEGENERATE -> builder.verdict(VERDICT_DEGENERATE)
                    .bottleneckMetricKey(outcome.constantSide() == PatternGate.Side.B
                            ? plan.seriesB() : plan.seriesA());
            case IMBALANCED_GROUPS -> builder.verdict(VERDICT_IMBALANCED_GROUPS);
        };
        return verdicted.build();
    }

    /** A metric key carries its own life domain; a {@code people:}/{@code topic:} presence series
     *  is about the user's inner and social life, so it lands in {@code MIND}. */
    private static String domainOf(String seriesKey) {
        return DerivedSeriesService.metricKey(seriesKey)
                .map(metric -> metric.domain().wireKey())
                .orElse(MetricDomain.MIND.wireKey());
    }

    /** A pár kevesebb lefedett nappal rendelkező metrikája (döntetlen → A) — a „mit logolj" alanya. */
    private MetricKey thinnerMetric(CompanionProperties.PatternPair pair,
                                    Map<MetricKey, Map<LocalDate, Double>> cache,
                                    LocalDate from, LocalDate to) {
        int a = PatternGate.window(cache.get(pair.metricA()), from, to).size();
        int b = PatternGate.window(cache.get(pair.metricB()), from, to).size();
        return b < a ? pair.metricB() : pair.metricA();
    }

    private MetricKey constantMetric(CompanionProperties.PatternPair pair, PatternGate.Side side) {
        return side == PatternGate.Side.B ? pair.metricB() : pair.metricA();
    }

    private List<PatternMetricCoverage> coverage(Map<MetricKey, Map<LocalDate, Double>> cache,
                                                 List<CompanionProperties.PatternPair> pairs,
                                                 LocalDate from, LocalDate to, int lookbackDays) {
        Map<MetricKey, Integer> pairCounts = new EnumMap<>(MetricKey.class);
        for (CompanionProperties.PatternPair pair : pairs) {
            pairCounts.merge(pair.metricA(), 1, Integer::sum);
            pairCounts.merge(pair.metricB(), 1, Integer::sum);
        }
        List<PatternMetricCoverage> out = new ArrayList<>();
        for (MetricKey metric : MetricKey.values()) {
            if (!metric.correlatable()) {
                continue; // bd mezo-dqzm: belső jel, nem katalógus-sor
            }
            Map<LocalDate, Double> windowed = PatternGate.window(cache.get(metric), from, to);
            out.add(PatternMetricCoverage.builder()
                    .key(metric.wireKey())
                    .label(metric.labelHu())
                    .sourceHu(metric.sourceHu())
                    .domain(metric.domain().wireKey())
                    .coveredDays(windowed.size())
                    .windowDays(lookbackDays)
                    .lastDayWithData(windowed.keySet().stream().max(Comparator.naturalOrder()).orElse(null))
                    .pairCount(pairCounts.getOrDefault(metric, 0))
                    .build());
        }
        return out;
    }

}
