package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.PersonalContextAssembler;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.text.SafeTruncate;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CONTEXTUAL_FEED_SWITCH,
        FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.COMPANION_SWITCH}, havingValue = "true")
public class FeedContextAssembler {
    private final FeedContinuityService continuity;
    private final PersonalContextAssembler personal;
    private final ContextSnapshotAssembler snapshot;
    private final ObjectProvider<MemoryContextBlock> memory;
    private final io.mrkuhne.mezo.feature.proactive.config.ContextualFeedProperties properties;

    public FeedContext assemble(UUID userId, LocalDate date, Instant asOf, String kind, String eventEvidence) {
        var prior = continuity.render(userId, date, asOf, kind);
        String current = snapshot.render(userId, date);
        String evidence = eventEvidence == null ? "" : eventEvidence;
        String query = kind + " " + SafeTruncate.truncate(evidence.isBlank() ? current : evidence,
                properties.messageMaxChars());
        var block = memory.getIfAvailable();
        var recalled = block == null ? MemoryContextBlock.Rendered.EMPTY
                : block.render(userId, ConsumerPolicy.MORNING_BRIEFING, query, date, false,
                        "proactive_feed", kind, null);
        var refs = new ArrayList<>(prior.refs());
        refs.addAll(recalled.refs());
        return new FeedContext(evidence + "\n" + prior.text() + "\n" + personal.render(userId, date)
                + "\n" + current + "\n" + recalled.block(), prior.priorMessageIds(),
                recalled.retrievalRunId() == null ? List.of() : List.of(recalled.retrievalRunId()), refs);
    }
}
