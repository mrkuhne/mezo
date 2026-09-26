package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.chat.TeamChatBudget;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatEventListener;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatExpiryJob;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatInterventionKeyAdapter;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReads;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Csapatfal Act III Task 5 (mezo-a9bo7.21): with {@code mezo.feature.team-chat.enabled=false}
 * none of the team chat engine beans exist. A bare wrapper with only a {@code @Nested} class —
 * the {@code TeamEditionServiceSwitchOffIT} shape, so the switched-off context never shares a
 * test class with an always-on one.
 */
class TeamChatSwitchOffIT {

    @Nested
    @ActiveProfiles("companion-fake")
    @TestPropertySource(properties = "mezo.feature.team-chat.enabled=false")
    class Disabled extends AbstractIntegrationTest {

        @Autowired private ApplicationContext context;

        @Test
        void noTeamChatBeans() {
            assertThat(context.getBeanNamesForType(TeamChatService.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatEventListener.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatExpiryJob.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatReads.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatInterventionKeyAdapter.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatBudget.class)).isEmpty();
        }
    }
}
