package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W1 weekly plan-suggestion generator (spec §5): PURE-CODE gather (prior-week daily summaries
 * strictly BEFORE week_start + facts block + pattern list — the HypothesisPipelineService
 * idiom — plus the V0.3 snapshot for the current state) → ONE SMART-tier call → plain
 * Hungarian prose. Empty prior week or blank answer ⇒ NO row (honest absence). Existing row ⇒
 * returned untouched (idempotent; no weekly staleness machinery by decision).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class WeeklySuggestionGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String WEEKLY_SUGGESTION_MARKER = "HETI-TERVJAVASLAT";

    private static final String PROMPT = WEEKLY_SUGGESTION_MARKER + "\n"
            + "Írj rövid (3-5 mondatos), magyar heti tervjavaslatot Danielnek a most kezdődő "
            + "hétre, kizárólag a megadott adatokból. Építs az előző hét összefoglalóira, a "
            + "megerősített tényekre és a mintákra; adj 2-3 konkrét, végrehajtható javaslatot. "
            + "Számot vagy adatot kitalálni tilos; gyógyszer adagolására (pl. retatrutid) "
            + "vonatkozó változtatást SOHA ne javasolj — az orvosi döntés. Sima folyószöveggel "
            + "válaszolj, markdown és felsorolás nélkül.";

    private final WeeklySuggestionRepository weeklySuggestionRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final PatternRepository patternRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final GrowthDigestBlock growthDigestBlock;

    /** Generates (or returns the existing) suggestion for one ISO-Monday week; null = honest absence. */
    @Transactional
    public WeeklySuggestionEntity generate(UUID userId, LocalDate weekStart) {
        WeeklySuggestionEntity existing = weeklySuggestionRepository
                .findByCreatedByAndWeekStart(userId, weekStart).orElse(null);
        if (existing != null) {
            return existing;
        }
        String payload = gather(userId, weekStart);
        if (payload == null) {
            log.debug("No prior-week summaries for {} before {} — no suggestion", userId, weekStart);
            return null;
        }
        String prose = companionLlm.completeSmart(PROMPT, payload);
        if (prose == null || prose.isBlank()) {
            log.warn("Blank weekly-suggestion answer for {} week {} — no row", userId, weekStart);
            return null;
        }
        WeeklySuggestionEntity suggestion = new WeeklySuggestionEntity();
        suggestion.setCreatedBy(userId);
        suggestion.setWeekStart(weekStart);
        suggestion.setProse(prose.strip());
        suggestion.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return weeklySuggestionRepository.saveAndFlush(suggestion);
    }

    /** PURE-CODE prompt payload; null when the prior week (strictly before weekStart) is empty. */
    public String gather(UUID userId, LocalDate weekStart) {
        List<DailySummaryEntity> priorWeek = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
                        userId, weekStart.minusDays(7)).stream()
                .filter(s -> s.getSummaryDate().isBefore(weekStart))
                .toList();
        if (priorWeek.isEmpty()) {
            return null;
        }
        String narratives = priorWeek.stream()
                .map(s -> "- " + s.getSummaryDate() + ": " + s.getNarrative())
                .collect(Collectors.joining("\n"));
        String facts = knowledgeFactService.renderPromptBlock(userId);
        String patterns = patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId).stream()
                .map(p -> "- " + p.getTitle() + " (státusz: " + p.getStatus() + ")")
                .collect(Collectors.joining("\n"));
        return contextSnapshotAssembler.render(userId, LocalDate.now())
                + facts
                + "\n\nELŐZŐ HÉT NAPJAI (legfrissebb elöl):\n" + narratives
                + (patterns.isBlank() ? "" : "\n\nMINTÁK:\n" + patterns)
                + growthDigestBlock.render(userId, weekStart.minusWeeks(1));
    }
}
