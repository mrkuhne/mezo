package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.chat.TeamChatKnowledgeAdapter;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatKnowledgePort;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S7 (mezo-d6ivw.7): the real {@link TeamChatKnowledgeAdapter} — the csapatfal reads the ONE
 * memory engine through {@link TeamChatKnowledgePort}, replacing the old no-op.
 */
@ActiveProfiles("companion-fake")
class TeamChatKnowledgeAdapterIT extends AbstractIntegrationTest {

    @Autowired private TeamChatKnowledgePort port;
    @Autowired private KnowledgeFactService facts;
    @Autowired private UserPopulator userPopulator;

    @Test
    void theRealAdapterIsWired_andServesTheAreaOwnersFactsPlusUpToTwoMezoFacts() {
        assertThat(port).isInstanceOf(TeamChatKnowledgeAdapter.class);
        UUID owner = userPopulator.createUser().getId();
        facts.captureFromTeamChat(owner, "Meccsnapokon későn eszel.", "falat", UUID.randomUUID(), UUID.randomUUID());
        facts.captureFromTeamChat(owner, "Hétvégén többet alszol.", "szunya", UUID.randomUUID(), UUID.randomUUID());
        for (int i = 0; i < 3; i++) {
            facts.captureFromTeamChat(owner, "Általános " + i + ".", "mezo", UUID.randomUUID(), UUID.randomUUID());
        }
        List<String> falat = port.forArea(owner, TeamCharacter.FALAT);
        assertThat(falat).contains("Meccsnapokon későn eszel.").doesNotContain("Hétvégén többet alszol.");
        assertThat(falat.stream().filter(s -> s.startsWith("Általános"))).hasSize(2);
        assertThat(falat).hasSizeLessThanOrEqualTo(6);
    }
}
