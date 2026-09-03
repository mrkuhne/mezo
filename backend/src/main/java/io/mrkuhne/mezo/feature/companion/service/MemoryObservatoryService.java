package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MemoryLlmUsageDay;
import io.mrkuhne.mezo.api.dto.MemoryLlmUsageResponse;
import io.mrkuhne.mezo.api.dto.MemoryLlmUsageTotals;
import io.mrkuhne.mezo.api.dto.MemoryEmbeddingKindCount;
import io.mrkuhne.mezo.api.dto.MemoryFactSourceCount;
import io.mrkuhne.mezo.api.dto.MemoryOverviewJobs;
import io.mrkuhne.mezo.api.dto.MemoryOverviewL0;
import io.mrkuhne.mezo.api.dto.MemoryOverviewL1;
import io.mrkuhne.mezo.api.dto.MemoryOverviewL2;
import io.mrkuhne.mezo.api.dto.MemoryOverviewL3;
import io.mrkuhne.mezo.api.dto.MemoryOverviewResponse;
import io.mrkuhne.mezo.api.dto.MemoryPatternCount;
import io.mrkuhne.mezo.api.dto.MemorySummaryItem;
import io.mrkuhne.mezo.api.dto.MemorySummaryListResponse;
import io.mrkuhne.mezo.api.dto.SimilarDayItem;
import io.mrkuhne.mezo.api.dto.SimilarDaysResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmDailyAggregate;
import io.mrkuhne.mezo.feature.llmlog.service.LlmUsageService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Memória-obszervatórium (mezo-al1i): a 3-4 rétegű memória (L0 nyers adat → L1 epizodikus napló +
 * vektorok → L2 ítélet-inbox → L3 tartós tudás) read-only pillanatképe a /insights/memoria tabnak.
 * Semmit nem ír; az L0 a {@link PatternMonitorService} sorozat-cache idiómáját követi (metrikánként
 * egy series()-hívás), így az áttekintés ugyanazt a világot látja, mint a minta-motor.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryObservatoryService {

    private final MetricSeriesService metricSeriesService;
    private final DailySummaryRepository dailySummaryRepository;
    private final MemoryEmbeddingRepository memoryEmbeddingRepository;
    private final PatternRepository patternRepository;
    private final LearnedFactRepository learnedFactRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final CompanionProperties properties;
    private final MemoryRecallService memoryRecallService;
    private final LlmUsageService llmUsageService;

    @Transactional(readOnly = true)
    public MemoryOverviewResponse overview(UUID userId) {
        CompanionProperties.Patterns patterns = properties.patterns();
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(patterns.lookbackDays() - 1L);

        // L0 — a minta-ablak napjai, amelyeken BÁRMELY metrika ad adatot (kulcs-unió). A WEEKEND és a
        // COMBINED_LOAD_MIN naptári metrikák kimaradnak: mindketten minden napra adnak értéket
        // (MetricSeriesService#weekend, illetve #combinedLoad a nem-logolt napokra 0.0-t ír), sosem
        // hiányoznak — ez a naptár bizonyítéka, nem azé, hogy a user bármit is logolt. Egy valódi-adat
        // uniójába keverve mindig a teljes ablakot mutatnák.
        Set<LocalDate> daysWithData = new HashSet<>();
        for (MetricKey metric : MetricKey.values()) {
            if (metric == MetricKey.WEEKEND || metric == MetricKey.COMBINED_LOAD_MIN) {
                continue;
            }
            daysWithData.addAll(PatternGate.window(
                    metricSeriesService.series(userId, metric, from, to), from, to).keySet());
        }

        LocalDate firstDate = dailySummaryRepository.findTop1ByCreatedByOrderBySummaryDateAsc(userId)
                .map(DailySummaryEntity::getSummaryDate).orElse(null);
        LocalDate lastDate = dailySummaryRepository.findTop1ByCreatedByOrderBySummaryDateDesc(userId)
                .map(DailySummaryEntity::getSummaryDate).orElse(null);

        // L2 — kind×status rollup Java-ban: egy user élő mintái kevesen vannak, nem kell GROUP BY.
        Map<String, Integer> byKindStatus = new LinkedHashMap<>();
        Instant lastDetectedAt = null;
        for (PatternEntity row : patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)) {
            byKindStatus.merge(row.getKind() + "|" + row.getStatus(), 1, Integer::sum);
            if (PatternEntity.KIND_STATISTICAL.equals(row.getKind()) && row.getLastDetectedAt() != null
                    && (lastDetectedAt == null || row.getLastDetectedAt().isAfter(lastDetectedAt))) {
                lastDetectedAt = row.getLastDetectedAt();
            }
        }
        List<MemoryPatternCount> patternCounts = byKindStatus.entrySet().stream()
                .map(entry -> {
                    String[] key = entry.getKey().split("\\|", 2);
                    return MemoryPatternCount.builder().kind(key[0]).status(key[1]).count(entry.getValue()).build();
                })
                .toList();

        Map<String, Integer> bySource = new LinkedHashMap<>();
        int totalReinforcements = 0;
        int factsInPrompt = 0;
        for (KnowledgeFactEntity fact : knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)) {
            bySource.merge(fact.getSource(), 1, Integer::sum);
            totalReinforcements += fact.getReinforcementCount();
            if (fact.isIncludeInPrompt()) {
                factsInPrompt++;
            }
        }

        return MemoryOverviewResponse.builder()
                .l0(MemoryOverviewL0.builder()
                        .daysWithAnyData(daysWithData.size())
                        .windowDays(patterns.lookbackDays())
                        .build())
                .l1(MemoryOverviewL1.builder()
                        .summaryCount((int) dailySummaryRepository.countByCreatedBy(userId))
                        .firstDate(firstDate)
                        .lastDate(lastDate)
                        .embeddings(memoryEmbeddingRepository.countByKindForUser(userId).stream()
                                .map(row -> MemoryEmbeddingKindCount.builder()
                                        .kind(row.getKind())
                                        .count((int) row.getCount())
                                        .build())
                                .toList())
                        .build())
                .l2(MemoryOverviewL2.builder()
                        .patterns(patternCounts)
                        .pendingFactCandidates((int) learnedFactRepository
                                .countByCreatedByAndUserDecisionIsNullAndDeletedFalse(userId))
                        .build())
                .l3(MemoryOverviewL3.builder()
                        .facts(bySource.entrySet().stream()
                                .map(entry -> MemoryFactSourceCount.builder()
                                        .source(entry.getKey()).count(entry.getValue()).build())
                                .toList())
                        .totalReinforcements(totalReinforcements)
                        .factsInPrompt(factsInPrompt)
                        .build())
                .jobs(MemoryOverviewJobs.builder()
                        .summaryCron(properties.summary().cron())
                        .patternCron(patterns.cron())
                        .hypothesisCron(properties.hypotheses().cron())
                        .lastSummaryDate(lastDate)
                        .lastDetectedAt(lastDetectedAt == null ? null : lastDetectedAt.atOffset(ZoneOffset.UTC))
                        .build())
                .build();
    }

    /** A napló listája — a hiányzó határok tág defaultra esnek, így egyetlen query-ág van. */
    @Transactional(readOnly = true)
    public MemorySummaryListResponse summaries(UUID userId, LocalDate from, LocalDate to) {
        LocalDate lo = from != null ? from : LocalDate.of(1970, 1, 1);
        LocalDate hi = to != null ? to : LocalDate.now();
        Set<UUID> embeddedRefs = memoryEmbeddingRepository
                .findRefIdsByCreatedByAndKind(userId, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY);
        List<MemorySummaryItem> items = dailySummaryRepository
                .findByCreatedByAndSummaryDateBetweenOrderBySummaryDateDesc(userId, lo, hi)
                .stream()
                .map(summary -> MemorySummaryItem.builder()
                        .date(summary.getSummaryDate())
                        .narrative(summary.getNarrative())
                        .embedded(embeddedRefs.contains(summary.getId()))
                        .build())
                .toList();
        return MemorySummaryListResponse.builder().items(items).build();
    }

    /**
     * A V2.3 recall változatlan újrahasznosítása — a kereső ugyanazt a memóriát látja, mint a
     * {@code find_similar_past_days} tool. Szándékosan NEM @Transactional: az embed hálózati
     * hívása alatt nem tartunk DB-kapcsolatot (a {@link MemoryRecallService} saját indoklása).
     */
    public SimilarDaysResponse similarDays(UUID userId, String query, Integer k) {
        int limit = k != null ? k : 3;
        int renderCap = properties.recall().renderMaxChars();
        List<SimilarDayItem> items = memoryRecallService.recallSimilarDays(userId, query, limit).stream()
                .map(memory -> SimilarDayItem.builder()
                        .date(memory.occurredOn())
                        .excerpt(excerpt(memory.content(), renderCap))
                        .similarity(memory.similarity())
                        .finalScore(memory.score())
                        .build())
                .toList();
        return SimilarDaysResponse.builder().items(items).build();
    }

    /** A tool render-vágásának párja (MemoryTools) — a stored text hosszú, a kártyára kivonat megy. */
    private static String excerpt(String content, int cap) {
        return content.length() > cap ? content.substring(0, cap) + "…" : content;
    }

    /**
     * Az Audit nézet LLM-rollupja (ADR 0014 v1 fölött). Kikapcsolt audit-lognál a query le sem fut:
     * enabled=false + üres sorok — a FE őszinte „audit kikapcsolva" állapotot mutat (spec §4).
     */
    @Transactional(readOnly = true)
    public MemoryLlmUsageResponse llmUsage(Integer days) {
        if (!llmUsageService.auditEnabled()) {
            return MemoryLlmUsageResponse.builder()
                    .enabled(false)
                    .perDay(List.of())
                    .totals(MemoryLlmUsageTotals.builder()
                            .calls(0L).inputTokens(0L).outputTokens(0L).costUsd(null).build())
                    .build();
        }
        List<MemoryLlmUsageDay> perDay = new ArrayList<>();
        long calls = 0;
        long inputTokens = 0;
        long outputTokens = 0;
        BigDecimal cost = null;
        for (LlmDailyAggregate row : llmUsageService.perDay(days != null ? days : 30)) {
            perDay.add(MemoryLlmUsageDay.builder()
                    .date(row.getDay())
                    .calls(row.getCalls())
                    .inputTokens(row.getInputTokens())
                    .outputTokens(row.getOutputTokens())
                    .costUsd(row.getCostUsd() == null ? null : row.getCostUsd().doubleValue())
                    .build());
            calls += row.getCalls();
            inputTokens += row.getInputTokens();
            outputTokens += row.getOutputTokens();
            if (row.getCostUsd() != null) {
                cost = (cost == null ? BigDecimal.ZERO : cost).add(row.getCostUsd());
            }
        }
        return MemoryLlmUsageResponse.builder()
                .enabled(true)
                .perDay(perDay)
                .totals(MemoryLlmUsageTotals.builder()
                        .calls(calls).inputTokens(inputTokens).outputTokens(outputTokens)
                        .costUsd(cost == null ? null : cost.doubleValue())
                        .build())
                .build();
    }
}
