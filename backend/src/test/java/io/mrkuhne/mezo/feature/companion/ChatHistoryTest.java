package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.CompanionLlm.Role;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChatHistoryTest {

    @Test
    void testRender_shouldReturnEmptyString_whenHistoryIsEmpty() {
        assertThat(ChatHistory.render(List.of())).isEmpty();
    }

    @Test
    void testRender_shouldLabelSpeakersOldestFirst_whenHistoryHasBothRoles() {
        String rendered = ChatHistory.render(List.of(
                new Turn(Role.USER, "korábbi kérdés"),
                new Turn(Role.ASSISTANT, "korábbi válasz")));

        assertThat(rendered).startsWith(ChatHistory.HEADER);
        assertThat(rendered).contains("Felhasználó: korábbi kérdés\n");
        assertThat(rendered).contains("Mezo: korábbi válasz\n");
        assertThat(rendered.indexOf("Felhasználó: korábbi kérdés"))
                .isLessThan(rendered.indexOf("Mezo: korábbi válasz"));
    }
}
