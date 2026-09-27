package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import java.util.List;
import java.util.UUID;

/**
 * The confirmed-knowledge / person-fact block for a team chat line's context (Csapatfal Act III
 * Task 8, mezo-a9bo7.22, spec §5.3 "emlékszik"). Character owns *when and where* a line speaks;
 * Emlékezet S7 (mezo-d6ivw.7) implements it: {@link TeamChatKnowledgeAdapter}.
 */
public interface TeamChatKnowledgePort {

    /** Background sentences relevant to {@code area} for {@code owner} — background only; the
     *  voice guard still allows numbers solely from the event's own whitelisted facts. */
    List<String> forArea(UUID owner, TeamCharacter area);
}
