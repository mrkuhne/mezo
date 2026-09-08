package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.AlignedDayResponse;
import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternPairDetailResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.DerivedSeriesService;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.mapper.PatternTestPlanMapper;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * mezo-tk88.3: the pattern detail page's single read. Reuses the monitor's EXACT pair math
 * ({@link PatternMonitorService#toPair}) so the detail can never disagree with the dashboard;
 * days are computed live from the current window (frozen rows honestly show today's data). The
 * downstream "what came of this" block is delegated behind {@link PatternImpactSource} — see its
 * javadoc for why (ArchitectureTest's companion↔proactive cycle-freeze rule).
 *
 * <p>Reflexió S6 (mezo-eq85.6): the same endpoint now also answers for a {@code reflection} row's
 * HYPOTHESIS key. Such a row has no catalog pair — the test plan it carries IS its pair — so a
 * key that misses the catalog falls through to {@link #reflectionDetail}, which builds a synthetic
 * pair from the plan. Both paths end in the same response shape, because the laborfüzet page and
 * the Motor page are one screen with two kinds of subject.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PatternPairDetailService {

    private final PatternMonitorService patternMonitorService;
    private final MetricSeriesService metricSeriesService;
    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    private final PatternImpactSource patternImpactSource;
    private final CompanionProperties properties;
    private final CompanionMapper mapper;
    /** S2 (mezo-eq85.2): the test plan's series labels need a bean — see PatternTestPlanMapper. */
    private final PatternTestPlanMapper testPlanMapper;
    /** S6 (mezo-eq85.6): the derived (person/topic) series resolver — behind an ObjectProvider
     *  because it only exists while the Reflexió switch is on (the PatternTestPlanMapper idiom).
     *  Absent ⇒ a non-catalog key can only be a 404: nothing can resolve its series. */
    private final ObjectProvider<DerivedSeriesService> derivedSeriesService;

    @Transactional(readOnly = true)
    public PatternPairDetailResponse detail(UUID userId, String pairKey) {
        CompanionProperties.Patterns config = properties.patterns();
        CompanionProperties.PatternPair pair = config.pairs().stream()
                .filter(p -> p.key().equals(pairKey))
                .findFirst()
                .orElse(null);
        if (pair == null) {
            // S6 (mezo-eq85.6): not a catalog pair — the only other thing this key can be is a
            // self-proposed hypothesis of THIS user, addressed by its hypothesis key.
            return reflectionDetail(userId, pairKey);
        }

        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(config.lookbackDays() - 1L);

        Map<MetricKey, Map<LocalDate, Double>> cache = new EnumMap<>(MetricKey.class);
        cache.put(pair.metricA(), metricSeriesService.series(userId, pair.metricA(), from, to.plusDays(pair.lagDays())));
        if (pair.metricA() != pair.metricB()) {
            cache.put(pair.metricB(), metricSeriesService.series(userId, pair.metricB(), from, to.plusDays(pair.lagDays())));
        }

        PatternEntity row = patternRepository
                .findByCreatedByAndKindAndPairKeyAndDeletedFalse(userId, PatternEntity.KIND_STATISTICAL, pairKey)
                .orElse(null);
        PatternMonitorPair monitorPair = patternMonitorService.toPair(pair, cache, row,
                config.minN(), config.minGroupN(), from, to);

        return PatternPairDetailResponse.builder()
                .pair(monitorPair)
                .pattern(row == null ? null
                        : mapper.toPatternResponse(row, null, testPlanMapper.toWire(row.getTestPlan())))
                .events(row == null ? List.of() : patternEventRepository
                        .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(userId, row.getId())
                        .stream().map(mapper::toPatternEventResponse).toList())
                .days(alignedDays(cache, pair, from, to))
                .impact(patternImpactSource.impact(userId, row))
                .build();
    }

    /**
     * S6 (mezo-eq85.6): the same page for a {@code reflection} row. The row IS the pair here — its
     * stored {@link TestPlanEnvelope} names the two series, the lag and the gates — so the window
     * comes from the plan (not from the catalog lookback) and the series come from
     * {@link DerivedSeriesService}, which resolves {@code people:}/{@code topic:} presence series
     * as well as the metric catalog. A row without a plan is not renderable as a pair, so it 404s
     * like any unknown key rather than being served half-built.
     */
    private PatternPairDetailResponse reflectionDetail(UUID userId, String pairKey) {
        DerivedSeriesService labels = derivedSeriesService.getIfAvailable();
        PatternEntity row = labels == null ? null
                : patternRepository.findByCreatedByAndHypothesisKeyAndDeletedFalse(userId, pairKey)
                        .orElse(null);
        if (row == null || row.getTestPlan() == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_PATTERN_PAIR_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }

        TestPlanEnvelope plan = row.getTestPlan();
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(plan.windowDays() - 1L);
        Map<String, Map<LocalDate, Double>> seriesByKey = new HashMap<>();
        seriesByKey.put(plan.seriesA(), labels.series(userId, plan.seriesA(), from, to));
        seriesByKey.put(plan.seriesB(), labels.series(userId, plan.seriesB(),
                from, to.plusDays(plan.lagDays())));

        PatternMonitorPair monitorPair = patternMonitorService.toPair(plan, pairKey, row.getTitle(),
                seriesByKey, row, from, to, labels);

        return PatternPairDetailResponse.builder()
                .pair(monitorPair)
                .pattern(mapper.toPatternResponse(row, null, testPlanMapper.toWire(plan)))
                .events(patternEventRepository
                        .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(userId, row.getId())
                        .stream().map(mapper::toPatternEventResponse).toList())
                .days(alignedDays(
                        PatternGate.window(seriesByKey.get(plan.seriesA()), from, to),
                        PatternGate.window(seriesByKey.get(plan.seriesB()),
                                from.plusDays(plan.lagDays()), to.plusDays(plan.lagDays())),
                        plan.lagDays()))
                .impact(patternImpactSource.impact(userId, row))
                .build();
    }

    private List<AlignedDayResponse> alignedDays(Map<MetricKey, Map<LocalDate, Double>> cache,
                                                 CompanionProperties.PatternPair pair,
                                                 LocalDate from, LocalDate to) {
        return alignedDays(
                PatternGate.window(cache.get(pair.metricA()), from, to),
                PatternGate.window(cache.get(pair.metricB()),
                        from.plusDays(pair.lagDays()), to.plusDays(pair.lagDays())),
                pair.lagDays());
    }

    /** The pairing itself — both windows already cut by the caller, B read {@code lagDays} later.
     *  S6: shared by the catalog and the reflection reads so the chart can never disagree. */
    private List<AlignedDayResponse> alignedDays(Map<LocalDate, Double> seriesA,
                                                 Map<LocalDate, Double> seriesB, int lagDays) {
        List<AlignedDayResponse> out = new ArrayList<>();
        seriesA.forEach((day, a) -> {
            Double b = seriesB.get(day.plusDays(lagDays));
            if (b != null) {
                out.add(AlignedDayResponse.builder().date(day).a(a).b(b).build());
            }
        });
        out.sort(Comparator.comparing(AlignedDayResponse::getDate));
        return out;
    }
}
