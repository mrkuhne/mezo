package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.TeamChatDay;
import io.mrkuhne.mezo.api.dto.TeamChatReplyRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Csapatfal Act III Task 6 (mezo-a9bo7.21): with the team chat switched off the character API
 * still boots — the day read answers an honestly empty {@link TeamChatDay} (the FE polls it; a
 * 404 would read as a failure), while reply / apply answer 404 because there is no ügy to act on.
 * The bare-wrapper + {@code @Nested} shape of {@link TeamChatSwitchOffIT}.
 */
class TeamChatApiSwitchOffIT {

    @Nested
    @TestPropertySource(properties = "mezo.feature.team-chat.enabled=false")
    class Disabled extends ApiIntegrationTest {

        @Autowired private OwnerProperties ownerProperties;
        @Autowired private TeamChatProperties properties;

        @Test
        void dayIsEmpty_replyAndApplyAre404() {
            databasePopulator.populateUser(ownerProperties.ownerEmail());
            LocalDate date = LocalDate.of(2026, 9, 20);

            TeamChatDay day = getForBody("/api/character/team-chat?date=" + date, ownerAuthHeaders(),
                    HttpStatus.OK, TeamChatDay.class);

            assertThat(day.getDate()).isEqualTo(date);
            assertThat(day.getLines()).isEmpty();
            assertThat(day.getOpenThreads()).isEmpty();
            assertThat(day.getPushesToday()).isZero();
            assertThat(day.getPushBudget()).isEqualTo(properties.maxPushesPerDay());
            postForBody("/api/character/team-chat/threads/" + UUID.randomUUID() + "/reply",
                    new TeamChatReplyRequest("szia"), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
            postForBody("/api/character/team-chat/threads/" + UUID.randomUUID() + "/apply/x",
                    null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        }
    }
}
