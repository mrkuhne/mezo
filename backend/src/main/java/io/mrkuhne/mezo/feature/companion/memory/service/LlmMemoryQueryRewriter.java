package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Cheap, bounded LLM rewrite used only for context-dependent memory requests. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LlmMemoryQueryRewriter implements MemoryQueryRewriter {

    public static final String REWRITE_MARKER = "MEMORY-QUERY-REWRITE-FELADAT";

    private static final String SYSTEM_PROMPT = REWRITE_MARKER + "\n"
            + "Írd át a felhasználó utolsó kérdését egyetlen, önmagában érthető magyar "
            + "keresőkérdéssé a megadott rövid beszélgetési előzmény alapján. "
            + "Csak a keresőkérdést add vissza, magyarázat, címke és idézőjel nélkül.";

    private static final LlmCallContext CALL_CONTEXT =
            new LlmCallContext("companion_recall", "query_rewrite", null, null);

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;

    @Override
    public String rewrite(String currentQuery, List<CompanionLlm.Turn> boundedHistory) {
        return llmCallContextHolder.runWith(CALL_CONTEXT, () -> companionLlm.complete(
                SYSTEM_PROMPT,
                boundedHistory,
                currentQuery,
                List.of(),
                Map.of()));
    }
}
