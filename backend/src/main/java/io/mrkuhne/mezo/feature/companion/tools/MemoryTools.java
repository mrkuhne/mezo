package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.service.MemoryRecallService;
import io.mrkuhne.mezo.feature.companion.service.MemoryRecallService.RecalledMemory;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

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

    /** Per-memory render cap — the model needs the gist, not the full narrative re-quoted. */
    private static final int RENDER_MAX_CHARS = 300;

    private final MemoryRecallService memoryRecallService;
    private final CompanionProperties properties;

    @Tool(name = "find_similar_past_days", description = "Tematikusan hasonló KORÁBBI napok"
            + " felidézése a napi összefoglalók emlék-tárából (pl. 'volt már ilyen napod?','mikor"
            + " aludtál ilyen rosszul edzés után?'). A description a keresett élmény/állapot"
            + " szöveges leírása; k = hány napot idézzen fel.")
    public String findSimilarPastDays(
            @ToolParam(description = "A keresett élmény/téma/állapot leírása") String description,
            @ToolParam(required = false, description = "Hány hasonló napot idézzen fel") Integer k,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int limit = ToolText.clamp(k, 1, properties.recall().maxK(), 3);
        List<RecalledMemory> memories = memoryRecallService.recallSimilarDays(userId, description, limit);
        if (memories.isEmpty()) {
            return "Hasonló korábbi napok: " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Hasonló korábbi napok (téma-egyezés és frissesség szerint):");
        for (RecalledMemory memory : memories) {
            ToolContexts.audit(toolContext).addRef("Memory", memory.occurredOn().toString());
            String content = memory.content().length() > RENDER_MAX_CHARS
                    ? memory.content().substring(0, RENDER_MAX_CHARS) + "…"
                    : memory.content();
            b.append('\n').append(memory.occurredOn())
                    .append(" (egyezés ").append(Math.round(memory.similarity() * 100)).append("%): ")
                    .append(content);
        }
        return b.toString();
    }
}
