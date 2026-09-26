package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.chat.TeamChatEventListener;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatService;
import io.mrkuhne.mezo.feature.proactive.service.InterventionEventListener;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Final review M7 (mezo-a9bo7.25): the PRODUCTION switch combination — the team chat on, the
 * daily advice card retired ({@code application.yml} defaults, which the test properties override
 * for the pre-Act-III proactive ITs). Exactly one of the two raise listeners may exist, or a flag
 * raise would both open an ügy and write the old card. A bare wrapper with only a {@code @Nested}
 * class — the {@link TeamChatSwitchOffIT} shape, so this context never shares a class with the
 * always-on one.
 */
class TeamChatProductionSwitchIT {

    @Nested
    @ActiveProfiles("companion-fake")
    @TestPropertySource(properties = {
        "mezo.feature.team-chat.enabled=true",
        "mezo.proactive.advice-card.enabled=false"
    })
    class ProductionCombination extends AbstractIntegrationTest {

        @Autowired private ApplicationContext context;

        @Test
        void onlyTheTeamChatListensToRaises() {
            assertThat(context.getBeanNamesForType(InterventionEventListener.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatEventListener.class)).hasSize(1);
            assertThat(context.getBeanNamesForType(TeamChatService.class)).hasSize(1);
        }
    }
}
