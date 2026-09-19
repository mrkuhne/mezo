package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContextItem;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.companion.quarterly.config.QuarterlyProperties;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * Episodic-recall tool over the memory platform (Memória mindenhol S10, mezo-eq85.10; V2.3's
 * {@code MemoryRecallService} retired from this call site — see {@link MemoryContextService}) —
 * the "volt már ilyen napod?" answer, {@link ConsumerPolicy#SIMILAR_DAYS} — a policy that scopes
 * the RETRIEVAL itself to {@code daily_summary} sourced items (see
 * {@link ConsumerPolicy#scopedSourceKind()}) and keeps the raw-cosine relevance floor
 * {@code mezo.companion.recall.min-similarity} (0.25): a day below it is not a similar day, and an
 * honest "nincs adat" beats a fabricated resemblance. Read-only over OUR OWN vectors (IDENT-2
 * holds), ownership from the ToolContext, refs = the recalled days (kind {@code Memory}) so the FE
 * chips show what got remembered. No numeric score is rendered — the platform's rank is ordinal,
 * not a 0..1 fraction (see {@code task-10-codebase-notes.md} §1).
 *
 * <p>W5.3 (mezo-b3pp.20) added {@link #comparePeriods} here too — same read-only, same
 * ToolContext ownership, but its refs are whole MONTH rungs and therefore carry their own kind
 * ({@link #REF_KIND_PERIOD}), never {@code Memory}: see {@link #renderPeriod}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryTools {

    /** Ref kind for a whole MONTH rung of the consolidation ladder — deliberately not {@code
     *  Memory}, which means a single day (see {@link #renderPeriod}). */
    public static final String REF_KIND_PERIOD = "Időszak";

    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("yyyy-MM");

    /** memory_item.source_kind for a nightly summary — the ONLY kind "hasonló NAPOK" means
     *  (Memória mindenhol S10, mezo-eq85.10). Belt-and-braces SECOND guard: the policy scopes the
     *  retrieval query itself, which is what actually enforces "days" — a mapping-only filter runs
     *  after the token budget has already truncated the fused rank, so it would see no day at all
     *  once non-day hits had spent the budget. */
    private static final String SOURCE_KIND_DAILY_SUMMARY = ConsumerPolicy.SOURCE_KIND_DAILY_SUMMARY;

    /** What the tool says when the memory platform is unreachable (mezo-eq85.10 FIX 3) — an honest
     *  "I could not look", never {@link ToolText#NO_DATA}, which asserts the day does not exist. */
    private static final String RECALL_UNAVAILABLE = "Hasonló korábbi napok: a memóriát most nem "
            + "sikerült elérni, ezért nem tudom megmondani, volt-e ilyen napod.";

    private final MemoryContextService memoryContextService;
    private final MemoryPlatformProperties memoryPlatformProperties;
    private final CompanionProperties properties;
    private final PeriodSummaryRepository periodSummaryRepository;
    private final QuarterlyProperties quarterlyProperties;

    @Tool(name = "find_similar_past_days", description = "Tematikusan hasonló KORÁBBI napok"
            + " felidézése a napi összefoglalók emlék-tárából. A description a keresett élmény/állapot"
            + " szöveges leírása; k = hány napot idézzen fel. Használd, amikor a user arra kíváncsi,"
            + " volt-e már hasonló napja/élménye, vagy egy korábbi hasonló helyzetre kérdez rá.")
    public String findSimilarPastDays(
            @ToolParam(description = "A keresett élmény/téma/állapot leírása") String description,
            @ToolParam(required = false, description = "Hány hasonló napot idézzen fel (alapértelmezés 3)") Integer k,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        // 'required' only shapes the advertised schema — the model can still omit/null the arg.
        if (description == null || description.isBlank()) {
            return "Hasonló korábbi napok: " + ToolText.NO_DATA;
        }
        int limit = ToolText.clamp(k, 1, properties.recall().maxK(), 3);
        List<MemoryContextItem> days;
        try {
            days = similarDailySummaries(userId, description, limit);
        } catch (RuntimeException failure) {
            // Deliberately NOT ToolText.NO_DATA: "nincs adat" means "nincs ilyen napod", which would
            // be a lie about the user's own history when the truth is that WE could not look
            // (mezo-eq85.10 FIX 3). The turn must not fail over it either — the model can still
            // answer everything else it was asked.
            log.warn("find_similar_past_days could not reach the memory platform", failure);
            return RECALL_UNAVAILABLE;
        }
        if (days.isEmpty()) {
            return "Hasonló korábbi napok: " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Hasonló korábbi napok (rangsor szerint):");
        int renderCap = properties.recall().renderMaxChars();
        for (MemoryContextItem day : days) {
            ToolContexts.audit(toolContext).addRef("Memory", day.occurredOn().toString());
            String content = day.content().length() > renderCap
                    ? day.content().substring(0, renderCap) + "…"
                    : day.content();
            b.append('\n').append(day.occurredOn()).append(": ").append(content);
        }
        return b.toString();
    }

    /** Shared with {@link io.mrkuhne.mezo.feature.companion.service.MemoryObservatoryService}
     *  (Memória mindenhol S10): the memory platform's own SIMILAR_DAYS policy, filtered to
     *  daily-summary sourced items, limited to {@code limit} AFTER the filter. */
    private List<MemoryContextItem> similarDailySummaries(UUID userId, String query, int limit) {
        MemoryPlatformProperties.PolicyLimits limits =
                memoryPlatformProperties.limitsFor(ConsumerPolicy.SIMILAR_DAYS);
        if (!limits.enabled()) {
            // The per-policy kill switch: a disabled surface does NO fan-out and writes NO
            // memory_retrieval_run row, so it can be rolled back purely by config (mezo-eq85.10).
            return List.of();
        }
        MemoryRequest request = new MemoryRequest(userId, ConsumerPolicy.SIMILAR_DAYS, query,
                List.of(), LocalDate.now(), limits.maxTokens(), null, false);
        MemoryContext context = memoryContextService.retrieveOrFail(request);
        return context.items().stream()
                .filter(item -> SOURCE_KIND_DAILY_SUMMARY.equals(item.sourceKind()))
                .limit(limit)
                .toList();
    }

    @Tool(name = "compare_periods", description = "Két KORÁBBI IDŐSZAK összevetése a havi "
            + "összefoglalókból: mi jellemezte az egyiket, mi a másikat. periodA és periodB "
            + "formátuma negyedév (pl. 2026-Q3) vagy hónap (pl. 2026-07); a negyedév a benne lévő "
            + "havi összefoglalókból áll össze. Használd, amikor a user két időszakot hasonlít "
            + "össze ('mi változott a nyár óta', 'milyen volt a tavasz a nyárhoz képest', "
            + "'jobb negyedév volt ez, mint az előző?'). Csak a saját időszak-összefoglalóit "
            + "adja vissza — az AI-üzenetekre adott visszajelzéseket (tetszik/nem tetszik) NEM "
            + "tartalmazza. Ha egy időszakról nincs összefoglaló, azt őszintén kimondja.")
    public String comparePeriods(
            @ToolParam(description = "Az első időszak: 2026-Q3 (negyedév) vagy 2026-07 (hónap)") String periodA,
            @ToolParam(description = "A második időszak, ugyanabban a formátumban") String periodB,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        LocalDate startA = Quarters.parse(periodA);
        LocalDate startB = Quarters.parse(periodB);
        // 'required' only shapes the advertised schema — the model can still omit/garble an arg.
        if (startA == null || startB == null) {
            return "Időszak-összehasonlítás: " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Időszak-összehasonlítás:");
        renderPeriod(b, userId, periodA.strip(), startA, toolContext);
        renderPeriod(b, userId, periodB.strip(), startB, toolContext);
        return b.toString();
    }

    /**
     * One side of the comparison: a quarter renders its month rungs, a month its own.
     *
     * <p>Every rendered rung adds a ref, so the FE chips show exactly which periods the answer was
     * built from — but the ref is {@code Időszak}/{@code 2026-07}, NOT the {@code Memory}/ISO-date
     * shape {@code find_similar_past_days} uses (mezo-b3pp.20 final review, F4). {@code RefTag}
     * renders any ref generically as {@code [kind] label}, so a {@code Memory} ref carrying
     * {@code 2026-07-01} would put six chips reading like six specific DAYS under "Hivatkozott ·
     * L3" when the answer was in fact built from six whole MONTHS. That is exactly the lie this
     * same slice removed from the candidate card (see {@code formatCandidateDate}'s note in
     * {@code data/insights/graph.ts}: showing a three-month period as a single day) — the slice
     * must not resolve the same problem two opposite ways. A distinct kind plus a period-shaped
     * label says what the provenance actually is; no FE change is needed for either.
     */
    private void renderPeriod(StringBuilder b, UUID userId, String label, LocalDate start,
            ToolContext toolContext) {
        LocalDate end = Quarters.isQuarter(label) ? Quarters.endOf(start) : start;
        List<PeriodSummaryEntity> rungs = periodSummaryRepository
                .findByCreatedByAndGranularityAndPeriodStartBetweenOrderByPeriodStartAsc(
                        userId, PeriodSummaryEntity.GRANULARITY_MONTH, start, end);
        b.append("\n\n").append(label).append(':');
        if (rungs.isEmpty()) {
            b.append(' ').append(ToolText.NO_DATA);
            return;
        }
        int cap = quarterlyProperties.renderMaxChars();
        for (PeriodSummaryEntity rung : rungs) {
            ToolContexts.audit(toolContext).addRef(REF_KIND_PERIOD, monthLabel(rung.getPeriodStart()));
            String text = rung.getSummaryText().length() > cap
                    ? rung.getSummaryText().substring(0, cap) + "…"
                    : rung.getSummaryText();
            b.append("\n").append(rung.getPeriodStart()).append(": ").append(text);
        }
    }

    /** {@code 2026-07} — the ref label for a month rung, in the same spelling {@code
     *  Quarters.parse} accepts for a month, so a chip reads back as a period the tool understands. */
    private static String monthLabel(LocalDate periodStart) {
        return periodStart.format(MONTH_LABEL);
    }
}
