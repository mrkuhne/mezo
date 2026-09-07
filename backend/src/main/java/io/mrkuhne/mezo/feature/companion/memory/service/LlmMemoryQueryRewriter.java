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

    private static final String FEATURE_COMPANION_RECALL = "companion_recall";
    private static final String OPERATION = "query_rewrite";

    private static final LlmCallContext CALL_CONTEXT =
            new LlmCallContext(FEATURE_COMPANION_RECALL, OPERATION, null, null);

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;

    @Override
    public String rewrite(String currentQuery, List<CompanionLlm.Turn> boundedHistory) {
        return llmCallContextHolder.runWith(callContext(), () -> companionLlm.complete(
                SYSTEM_PROMPT,
                boundedHistory,
                currentQuery,
                List.of(),
                Map.of()));
    }

    /**
     * {@code companion_recall/query_rewrite} for every caller EXCEPT the admin explorer's dry-run
     * replay (mezo-4qyt), which re-labels this call to its own feature so one replay's total cost
     * is priceable in the admin cost matrix.
     *
     * <p>Why not simply inherit the ambient feature: {@link LlmCallContextHolder#runWith}
     * save-and-restores, so a chat turn's ambient {@code companion_chat} is live on this thread
     * too — and inheriting it would silently move EVERY chat rewrite row out of
     * {@code companion_recall} and corrupt the shipped cost matrix. Only the replay label is
     * honoured.
     */
    private LlmCallContext callContext() {
        LlmCallContext ambient = llmCallContextHolder.get();
        return ambient.isAdminReplay()
                ? new LlmCallContext(ambient.feature(), OPERATION, null, null)
                : CALL_CONTEXT;
    }
}
