package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.chat.TeamChatBudget;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Csapatfal Act III Task 7 (mezo-a9bo7.22): the team chat monthly USD cap — spend under
 * {@code monthly-usd-cap} (1.00) still has room, spend at or over it does not, and only
 * {@code team_chat} rows count toward it.
 */
@ActiveProfiles("companion-fake")
class TeamChatBudgetIT extends AbstractIntegrationTest {

    @Autowired private TeamChatBudget budget;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID owner() {
        return userPopulator.createUser().getId();
    }

    @Test
    void hasRoomUnderTheCap() {
        UUID owner = owner();
        llmLogPopulator.log(owner, CallKind.CHAT, "team_chat", "gemini-2.5-flash", 100, 20,
                null, new BigDecimal("0.50"));
        llmLogPopulator.log(owner, CallKind.CHAT, "team_chat", "gemini-2.5-flash", 100, 20,
                null, new BigDecimal("0.49"));

        assertThat(budget.hasRoom(owner)).isTrue();
    }

    @Test
    void noRoomAtOrOverTheCap() {
        UUID owner = owner();
        llmLogPopulator.log(owner, CallKind.CHAT, "team_chat", "gemini-2.5-flash", 100, 20,
                null, new BigDecimal("0.50"));
        llmLogPopulator.log(owner, CallKind.CHAT, "team_chat", "gemini-2.5-flash", 100, 20,
                null, new BigDecimal("0.49"));
        llmLogPopulator.log(owner, CallKind.CHAT, "team_chat", "gemini-2.5-flash", 100, 20,
                null, new BigDecimal("0.02"));

        assertThat(budget.hasRoom(owner)).isFalse();
    }

    @Test
    void anotherFeaturesSpendDoesNotCount() {
        UUID owner = owner();
        llmLogPopulator.log(owner, CallKind.CHAT, "character_edition", "gemini-2.5-flash", 100, 20,
                null, new BigDecimal("5.00"));

        assertThat(budget.hasRoom(owner)).isTrue();
    }
}
