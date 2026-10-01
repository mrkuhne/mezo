package io.mrkuhne.mezo.feature.character.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * mezo-d6ivw.11 (S7 final review item 6): the burst arithmetic the reply pipeline's idempotence
 * rests on — which event answers, and which USER lines it answers.
 */
class TeamChatReplyServiceTest {

    private static TeamChatLineEntity line(String kind) {
        TeamChatLineEntity l = new TeamChatLineEntity();
        l.setId(UUID.randomUUID());
        l.setKind(kind);
        l.setBody(kind.toLowerCase());
        return l;
    }

    @Test
    void isUnansweredNewest_onlyForTheNewestUserLine_withNoReplyAfterIt() {
        TeamChatLineEntity open = line("OPEN");
        TeamChatLineEntity u1 = line("USER");
        TeamChatLineEntity u2 = line("USER");
        List<TeamChatLineEntity> burst = List.of(open, u1, u2);
        assertThat(TeamChatReplyService.isUnansweredNewest(burst, u2.getId())).isTrue();
        assertThat(TeamChatReplyService.isUnansweredNewest(burst, u1.getId())).isFalse(); // newer USER line answers
        TeamChatLineEntity reply = line("REPLY");
        assertThat(TeamChatReplyService.isUnansweredNewest(List.of(open, u1, u2, reply), u2.getId())).isFalse();
    }

    @Test
    void isUnansweredNewest_ignoresNonConversationLines_andUnknownIds() {
        TeamChatLineEntity u = line("USER");
        List<TeamChatLineEntity> t = List.of(line("OPEN"), u, line("GUEST"), line("RESOLVE"));
        assertThat(TeamChatReplyService.isUnansweredNewest(t, u.getId())).isTrue();
        assertThat(TeamChatReplyService.isUnansweredNewest(t, UUID.randomUUID())).isFalse();
        assertThat(TeamChatReplyService.isUnansweredNewest(List.of(), u.getId())).isFalse();
    }

    @Test
    void pendingUserLines_areTheUserLinesAfterTheLastReply_oldestFirst() {
        TeamChatLineEntity old = line("USER");
        TeamChatLineEntity u1 = line("USER");
        TeamChatLineEntity u2 = line("USER");
        List<TeamChatLineEntity> t = List.of(line("OPEN"), old, line("REPLY"), u1, line("GUEST"), u2);
        assertThat(TeamChatReplyService.pendingUserLines(t)).containsExactly(u1, u2);
        assertThat(TeamChatReplyService.pendingUserLines(List.of(line("OPEN"), old, line("REPLY")))).isEmpty();
        assertThat(TeamChatReplyService.pendingUserLines(List.of(line("OPEN"), old))).containsExactly(old);
    }
}
