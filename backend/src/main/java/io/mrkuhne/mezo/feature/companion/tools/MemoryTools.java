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
import java.util.List;
import java.util.UUID;

/**
 * V2.3 episodic-recall tool over the {@code MemoryRecallService} — the "volt már ilyen napod?"
 * answer. Read-only over OUR OWN vectors (IDENT-2 holds), ownership from the ToolContext, refs
 * = the recalled days (kind {@code Memory}) so the FE chips show what got remembered.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryTools {

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

    /** One side of the comparison: a quarter renders its month rungs, a month its own. Every
     *  rendered rung adds a {@code Memory} ref (the {@code find_similar_past_days} idiom), so the
     *  FE chips show exactly which periods the answer was built from. */
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
            ToolContexts.audit(toolContext).addRef("Memory", rung.getPeriodStart().toString());
            String text = rung.getSummaryText().length() > cap
                    ? rung.getSummaryText().substring(0, cap) + "…"
                    : rung.getSummaryText();
            b.append("\n").append(rung.getPeriodStart()).append(": ").append(text);
        }
    }
}
