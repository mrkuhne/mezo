package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.quarterly.config.QuarterlyProperties;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import io.mrkuhne.mezo.feature.companion.service.MemoryRecallService;
import io.mrkuhne.mezo.feature.companion.service.MemoryRecallService.RecalledMemory;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
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
 * V2.3 episodic-recall tool over the {@code MemoryRecallService} — the "volt már ilyen napod?"
 * answer. Read-only over OUR OWN vectors (IDENT-2 holds), ownership from the ToolContext, refs
 * = the recalled days (kind {@code Memory}) so the FE chips show what got remembered.
 *
 * <p>W5.3 (mezo-b3pp.20) added {@link #comparePeriods} here too — same read-only, same
 * ToolContext ownership, but its refs are whole MONTH rungs and therefore carry their own kind
 * ({@link #REF_KIND_PERIOD}), never {@code Memory}: see {@link #renderPeriod}.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryTools {

    /** Ref kind for a whole MONTH rung of the consolidation ladder — deliberately not {@code
     *  Memory}, which means a single day (see {@link #renderPeriod}). */
    public static final String REF_KIND_PERIOD = "Időszak";

    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("yyyy-MM");

    private final MemoryRecallService memoryRecallService;
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
        List<RecalledMemory> memories = memoryRecallService.recallSimilarDays(userId, description, limit);
        if (memories.isEmpty()) {
            return "Hasonló korábbi napok: " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Hasonló korábbi napok (téma-egyezés és frissesség szerint):");
        for (RecalledMemory memory : memories) {
            ToolContexts.audit(toolContext).addRef("Memory", memory.occurredOn().toString());
            int renderCap = properties.recall().renderMaxChars();
            String content = memory.content().length() > renderCap
                    ? memory.content().substring(0, renderCap) + "…"
                    : memory.content();
            b.append('\n').append(memory.occurredOn())
                    .append(" (egyezés ").append(Math.round(memory.similarity() * 100)).append("%): ")
                    .append(content);
        }
        return b.toString();
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
