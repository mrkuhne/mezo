package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.chat.NoopTeamChatKnowledge;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatBudget;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatContext;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatEventListener;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatExpiryJob;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatInterventionKeyAdapter;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReads;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatService;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatVoiceWriter;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.edition.EditionCandidateCollector;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
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
        @Autowired private EditionCandidateCollector collector;
        @Autowired private TeamChatThreadRepository threads;
        @Autowired private OwnerProperties ownerProperties;
        @Autowired private DatabasePopulator databasePopulator;

        @Test
        void noTeamChatBeans() {
            assertThat(context.getBeanNamesForType(TeamChatService.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatEventListener.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatExpiryJob.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatReads.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatInterventionKeyAdapter.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatBudget.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatContext.class)).isEmpty();
            assertThat(context.getBeanNamesForType(NoopTeamChatKnowledge.class)).isEmpty();
            assertThat(context.getBeanNamesForType(TeamChatVoiceWriter.class)).isEmpty();
        }

        /** Task 15 (mezo-a9bo7.25): the evening edition still runs with the chat off, and the
         *  chat contributes no {@code team_chat_day} recap even if old ügy rows exist. */
        @Test
        void editionCollectorContributesNoTeamChatRecap() {
            UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
            LocalDate day = LocalDate.of(2026, 9, 20);
            var openedAt = day.atTime(9, 0).atZone(ZoneId.of("Europe/Budapest")).toInstant();
            var thread = new io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity();
            thread.setCreatedBy(owner);
            thread.setFlagKey(FlagKey.SLEEP_DEBT);
            thread.setOwnerCharacter("szunya");
            thread.setStatus("OPEN");
            thread.setOpenedAt(openedAt);
            threads.saveAndFlush(thread);

            assertThat(collector.collect(owner, day, null))
                    .noneMatch(c -> "team_chat_day".equals(c.sourceKind()));
        }
    }
}
