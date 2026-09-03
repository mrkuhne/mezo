package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * W3.2 consolidation ladder (bd mezo-b3pp.13, spec §7.2): the rung generator. A finished WEEK is
 * condensed from that week's {@code daily_summary} narratives, a finished MONTH from that month's
 * {@code week} rungs — each in the {@link DailySummaryService} shape: PURE-CODE gather (dated
 * lines of already-generated prose) → ONE cheap-tier call that only condenses (NFR-M-4: never
 * derive and narrate in one step). The cheap tier is deliberate: nothing new is being reasoned
 * out here, prose is being shortened; the smart tier stays for real synthesis (memoir, quarterly).
 *
 * <p>Idempotent by {@code (created_by, granularity, period_start)}: an existing rung is returned
 * untouched and the model is NOT called again, so the job's backfill window can re-offer every
 * period on every run. A period with no source rows produces NO row (nothing to consolidate), and
 * an unusable (blank) answer produces no row either — an empty rung would shadow fine-grained
 * memory with nothing (IDENT-3).
 *
 * <p>Consolidation never deletes: the daily rows and their vectors stay exactly where they are
 * (spec §12); only ambient recall's coverage filter changes what it asks for.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PeriodSummaryService {

    /** Prompt prefix the fake LLM dispatches on (the {@code SUMMARY_MARKER} precedent). */
    public static final String WEEKLY_MARKER = "HETI-KONSZOLIDACIO-FELADAT";
    /** Prompt prefix the fake LLM dispatches on. */
    public static final String MONTHLY_MARKER = "HAVI-KONSZOLIDACIO-FELADAT";

    private static final String WEEKLY_PROMPT = WEEKLY_MARKER + "\n"
            + "Sűrítsd az alábbi napi összefoglalókat EGY rövid (4-6 mondatos), múlt idejű, magyar "
            + "heti összefoglalóvá {{NÉV}} hetéről. Csak a megadott szövegekre támaszkodj, semmit ne "
            + "találj ki; a visszatérő mintákat és a hét ívét emeld ki, a napi felsorolást ne "
            + "ismételd meg. Közvetlen, társ-hangú fogalmazás.";

    private static final String MONTHLY_PROMPT = MONTHLY_MARKER + "\n"
            + "Sűrítsd az alábbi heti összefoglalókat EGY rövid (4-6 mondatos), múlt idejű, magyar "
            + "havi összefoglalóvá {{NÉV}} hónapjáról. Csak a megadott szövegekre támaszkodj, semmit "
            + "ne találj ki; a hónap ívét és a heteken átnyúló mintákat emeld ki. Közvetlen, "
            + "társ-hangú fogalmazás.";

    private final PeriodSummaryRepository periodSummaryRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;

    /**
     * The week rung for the ISO week starting at {@code weekStart} (a Monday). Returns the
     * existing row untouched, or {@code null} when the week carries no daily summaries.
     */
    @Transactional
    public PeriodSummaryEntity generateWeek(UUID userId, LocalDate weekStart) {
        PeriodSummaryEntity existing = periodSummaryRepository
                .findByCreatedByAndGranularityAndPeriodStart(
                        userId, PeriodSummaryEntity.GRANULARITY_WEEK, weekStart)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        LocalDate weekEnd = weekStart.plusDays(6);
        List<String> lines = dailySummaryRepository
                .findByCreatedByAndSummaryDateBetweenOrderBySummaryDateDesc(userId, weekStart, weekEnd)
                .reversed()
                .stream()
                .map(day -> "- " + day.getSummaryDate() + ": " + day.getNarrative())
                .toList();
        if (lines.isEmpty()) {
            log.debug("No daily summaries in week {} for {} — no weekly rung", weekStart, userId);
            return null;
        }
        String payload = "Hét: " + weekStart + " – " + weekEnd + "\n" + String.join("\n", lines);
        return persist(userId, PeriodSummaryEntity.GRANULARITY_WEEK, weekStart,
                complete(userId, WEEKLY_PROMPT, payload, "weekly"));
    }

    /**
     * The month rung for the month starting at {@code monthStart} (the 1st) — condensed from the
     * WEEK rungs whose Monday falls inside the month. {@code null} when there are none, so the
     * ladder is built strictly bottom-up (a month can only exist above its weeks).
     */
    @Transactional
    public PeriodSummaryEntity generateMonth(UUID userId, LocalDate monthStart) {
        PeriodSummaryEntity existing = periodSummaryRepository
                .findByCreatedByAndGranularityAndPeriodStart(
                        userId, PeriodSummaryEntity.GRANULARITY_MONTH, monthStart)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        LocalDate monthEnd = monthStart.withDayOfMonth(monthStart.lengthOfMonth());
        List<String> lines = periodSummaryRepository
                .findByCreatedByAndGranularityAndPeriodStartBetweenOrderByPeriodStartAsc(
                        userId, PeriodSummaryEntity.GRANULARITY_WEEK, monthStart, monthEnd)
                .stream()
                .map(week -> "- " + week.getPeriodStart() + " hete: " + week.getSummaryText())
                .toList();
        if (lines.isEmpty()) {
            log.debug("No weekly rungs in month {} for {} — no monthly rung", monthStart, userId);
            return null;
        }
        String payload = "Hónap: " + monthStart + " – " + monthEnd + "\n" + String.join("\n", lines);
        return persist(userId, PeriodSummaryEntity.GRANULARITY_MONTH, monthStart,
                complete(userId, MONTHLY_PROMPT, payload, "monthly"));
    }

    private String complete(UUID userId, String prompt, String payload, String operation) {
        return llmCallContextHolder.runWith(
                new LlmCallContext("companion_consolidation", operation, null, null),
                () -> companionLlm.complete(promptPersona.render(userId, prompt), payload));
    }

    /** No row for a blank answer — an empty rung would shadow real memory with nothing. */
    private PeriodSummaryEntity persist(UUID userId, String granularity, LocalDate periodStart,
                                        String text) {
        if (text == null || text.isBlank()) {
            log.warn("Unusable {} consolidation answer for {} period {} — no row",
                    granularity, userId, periodStart);
            return null;
        }
        PeriodSummaryEntity entity = new PeriodSummaryEntity();
        entity.setCreatedBy(userId);
        entity.setGranularity(granularity);
        entity.setPeriodStart(periodStart);
        entity.setSummaryText(text.strip());
        return periodSummaryRepository.saveAndFlush(entity);
    }
}
