package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** The knowledge block's placeholder until Emlékezet ({@code mezo-d6ivw.5}) ships its adapter —
 *  always empty, never a failure mode. Gated the same as every other team chat bean so it only
 *  exists (and only backs off for a real adapter) while the feature is switched on. */
@Component
@ConditionalOnMissingBean(value = TeamChatKnowledgePort.class, ignored = NoopTeamChatKnowledge.class)
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class NoopTeamChatKnowledge implements TeamChatKnowledgePort {

    @Override
    public List<String> forArea(UUID owner, TeamCharacter area) {
        return List.of();
    }
}
