package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.proactive.config.ContextualFeedProperties;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.text.SafeTruncate;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CONTEXTUAL_FEED_SWITCH,
        FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.COMPANION_SWITCH}, havingValue = "true")
public class FeedContinuityService {
    private static final String HEADER = "\n[KORÁBBI MEZO-ÜZENETEK — korábbi értelmezések, nem új bizonyítékok]\n";
    private final CompanionMessageRepository repository;
    private final ContextualFeedProperties properties;

    public FeedContext render(UUID userId, LocalDate date, Instant asOf, String kind) {
        var from = date.minusDays(properties.historyDays() - 1L);
        var page = PageRequest.of(0, properties.historyMaxMessages());
        var same = repository.findContinuity(userId, from, date, asOf, kind, true, page);
        var other = repository.findContinuity(userId, from, date, asOf, kind, false, page);
        var chosen = new LinkedHashMap<UUID, CompanionMessageEntity>();
        same.stream().limit(properties.sameKindReserved()).forEach(m -> chosen.put(m.getId(), m));
        for (var row : other) {
            if (chosen.size() >= properties.historyMaxMessages()) break;
            chosen.put(row.getId(), row);
        }
        for (var row : same) {
            if (chosen.size() >= properties.historyMaxMessages()) break;
            chosen.putIfAbsent(row.getId(), row);
        }
        if (chosen.isEmpty()) return FeedContext.EMPTY;
        var rows = chosen.values().stream().sorted(Comparator
                .comparing(CompanionMessageEntity::getGeneratedAt)
                .thenComparing(m -> m.getId().toString())).toList();
        var text = new StringBuilder(HEADER);
        var ids = new ArrayList<UUID>();
        var refs = new ArrayList<RefsEnvelope.Ref>();
        // Share space across selected rows so long excerpts cannot evict reserved same-kind history.
        int perRow = (properties.historyMaxChars() - HEADER.length()) / rows.size();
        for (var row : rows) {
            String label = "source=companion_message;id=" + row.getId() + ";kind=" + row.getKind()
                    + ";date=" + row.getMessageDate() + ";generated=" + row.getGeneratedAt() + "\n";
            String body = row.getContent().eyebrow() + ": " + String.join(" ", row.getContent().body());
            int room = Math.min(properties.messageMaxChars(), perRow - label.length() - 14);
            if (room < 1) continue;
            String excerpt = SafeTruncate.truncate(body, room);
            text.append(label).append(excerpt);
            if (excerpt.length() < body.length()) text.append(" [levágva]");
            text.append('\n');
            ids.add(row.getId());
            refs.add(new RefsEnvelope.Ref("companion_message", row.getId().toString(), row.getKind()));
        }
        return new FeedContext(text.toString(), ids, List.of(), refs);
    }
}
