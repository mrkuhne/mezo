package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.PreparedMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Selects raw vs rewritten retrieval text while keeping rewrite failure non-blocking. */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryQueryPreparer {

    static final int MAX_HISTORY_TURNS = 6;
    static final int MAX_HISTORY_TURN_CHARS = 500;
    static final int MAX_REWRITTEN_QUERY_CHARS = 500;

    private final MemoryQueryAnalyzer analyzer;
    private final MemoryQueryRewriter rewriter;

    public PreparedMemoryQuery prepare(MemoryRequest request) {
        PreparedMemoryQuery analyzed = analyzer.analyze(
                request.currentQuery(), request.shortConversationHistory());
        if (analyzed.mode() != QueryMode.CONTEXT_DEPENDENT) {
            return analyzed;
        }

        String denseQuery = rewriteOrRaw(analyzed.rawQuery(), request.shortConversationHistory());
        return new PreparedMemoryQuery(
                analyzed.mode(), analyzed.rawQuery(), denseQuery, analyzed.from(), analyzed.to());
    }

    private String rewriteOrRaw(String rawQuery, List<CompanionLlm.Turn> history) {
        try {
            String rewritten = rewriter.rewrite(rawQuery, boundedHistory(history));
            if (rewritten == null) {
                return rawQuery;
            }
            String trimmed = rewritten.trim();
            return trimmed.isBlank() || trimmed.length() > MAX_REWRITTEN_QUERY_CHARS
                    ? rawQuery
                    : trimmed;
        } catch (RuntimeException exception) {
            log.warn("Memory query rewrite failed; raw query will be used", exception);
            return rawQuery;
        }
    }

    private static List<CompanionLlm.Turn> boundedHistory(List<CompanionLlm.Turn> history) {
        if (history == null || history.isEmpty()) {
            return List.of();
        }
        List<CompanionLlm.Turn> usable = history.stream()
                .filter(turn -> turn != null && turn.content() != null && !turn.content().isBlank())
                .map(turn -> new CompanionLlm.Turn(
                        turn.role(),
                        turn.content().substring(0, Math.min(turn.content().length(), MAX_HISTORY_TURN_CHARS))))
                .toList();
        return usable.stream()
                .skip(Math.max(0, usable.size() - MAX_HISTORY_TURNS))
                .toList();
    }
}
