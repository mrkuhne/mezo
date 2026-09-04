package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.AlignedDayResponse;
import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternPairDetailResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * mezo-tk88.3: the pattern detail page's single read. Reuses the monitor's EXACT pair math
 * ({@link PatternMonitorService#toPair}) so the detail can never disagree with the dashboard;
 * days are computed live from the current window (frozen rows honestly show today's data). The
 * downstream "what came of this" block is delegated behind {@link PatternImpactSource} — see its
 * javadoc for why (ArchitectureTest's companion↔proactive cycle-freeze rule).
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

    @Transactional(readOnly = true)
    public PatternPairDetailResponse detail(UUID userId, String pairKey) {
        CompanionProperties.Patterns config = properties.patterns();
        CompanionProperties.PatternPair pair = config.pairs().stream()
                .filter(p -> p.key().equals(pairKey))
                .findFirst()
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("COMPANION_PATTERN_PAIR_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

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
                .pattern(row == null ? null : mapper.toPatternResponse(row))
                .events(row == null ? List.of() : patternEventRepository
                        .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(userId, row.getId())
                        .stream().map(mapper::toPatternEventResponse).toList())
                .days(alignedDays(cache, pair, from, to))
                .impact(patternImpactSource.impact(userId, row))
                .build();
    }

    private List<AlignedDayResponse> alignedDays(Map<MetricKey, Map<LocalDate, Double>> cache,
                                                 CompanionProperties.PatternPair pair,
                                                 LocalDate from, LocalDate to) {
        Map<LocalDate, Double> seriesA = PatternGate.window(cache.get(pair.metricA()), from, to);
        Map<LocalDate, Double> seriesB = PatternGate.window(cache.get(pair.metricB()),
                from.plusDays(pair.lagDays()), to.plusDays(pair.lagDays()));
        List<AlignedDayResponse> out = new ArrayList<>();
        seriesA.forEach((day, a) -> {
            Double b = seriesB.get(day.plusDays(pair.lagDays()));
            if (b != null) {
                out.add(AlignedDayResponse.builder().date(day).a(a).b(b).build());
            }
        });
        out.sort(Comparator.comparing(AlignedDayResponse::getDate));
        return out;
    }
}
