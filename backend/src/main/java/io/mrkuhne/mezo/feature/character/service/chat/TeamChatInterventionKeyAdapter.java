package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.feedback.service.TeamChatInterventionKeySource;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The team chat side of {@link TeamChatInterventionKeySource} (mezo-a9bo7.21): line → its ügy's
 *  {@code advice_key}, owner-scoped on both the line and the thread. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatInterventionKeyAdapter implements TeamChatInterventionKeySource {

    private final TeamChatLineRepository lines;
    private final TeamChatThreadRepository threads;

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> interventionKeysByIds(UUID userId, Collection<UUID> lineIds) {
        if (lineIds.isEmpty()) {
            return Map.of();
        }
        List<TeamChatLineEntity> owned = lines.findByIdInAndCreatedBy(lineIds, userId);
        List<UUID> threadIds = owned.stream().map(TeamChatLineEntity::getThreadId)
                .filter(Objects::nonNull).distinct().toList();
        Map<UUID, TeamChatThreadEntity> threadById = threads.findAllById(threadIds).stream()
                .filter(t -> userId.equals(t.getCreatedBy()))
                .collect(Collectors.toMap(TeamChatThreadEntity::getId, Function.identity()));
        Map<UUID, String> keys = new HashMap<>();
        for (TeamChatLineEntity line : owned) {
            TeamChatThreadEntity thread = line.getThreadId() == null ? null : threadById.get(line.getThreadId());
            if (thread != null && thread.getAdviceKey() != null) {
                keys.put(line.getId(), thread.getAdviceKey());
            }
        }
        return keys;
    }
}
