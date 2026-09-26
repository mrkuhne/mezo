package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageFeedbackResponse;
import io.mrkuhne.mezo.api.dto.PutFeedbackRequest;
import io.mrkuhne.mezo.api.dto.TeamChatDay;
import io.mrkuhne.mezo.api.dto.TeamChatLine;
import io.mrkuhne.mezo.api.dto.TeamChatReplyRequest;
import io.mrkuhne.mezo.api.dto.TeamChatThread;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Csapatfal Act III Task 6 (mezo-a9bo7.21): the team chat read / reply / apply endpoints, and a
 * {@code team_chat_line} 👍 accepted end to end by the feedback write path. Fixed calendar days
 * (never now-relative) so the local-day window is midnight-proof.
 */
class TeamChatControllerIT extends ApiIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 20);

    @Autowired private TeamChatThreadRepository threads;
    @Autowired private TeamChatLineRepository lines;
    @Autowired private TeamChatProperties properties;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private Instant at(LocalDate day, int hour) {
        return day.atTime(LocalTime.of(hour, 0)).atZone(properties.zone()).toInstant();
    }

    private TeamChatThreadEntity thread(UUID owner, String flagKey, String character, String status,
            Instant openedAt, boolean pushed) {
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setCreatedBy(owner);
        t.setFlagKey(flagKey);
        t.setOwnerCharacter(character);
        t.setGuestCharacter(null);
        t.setAdviceKey("sleep_recover_tonight");
        t.setStatus(status);
        t.setOpenedAt(openedAt);
        t.setClosedAt("OPEN".equals(status) ? null : openedAt.plusSeconds(3600));
        t.setPushed(pushed);
        t.setActions(new TeamChatActionsEnvelope(List.of(
                new TeamChatActionsEnvelope.Action("sleep_goal_earlier", "Korábbi lefekvés", Map.of()))));
        return threads.saveAndFlush(t);
    }

    private TeamChatLineEntity line(UUID owner, UUID threadId, String kind, String character, String body,
            Instant occurredAt) {
        TeamChatLineEntity l = new TeamChatLineEntity();
        l.setCreatedBy(owner);
        l.setThreadId(threadId);
        l.setKind(kind);
        l.setCharacter(character);
        l.setBody(body);
        l.setVoiced(false);
        l.setFacts(new EditionFactsEnvelope(List.of("7.5 óra")));
        l.setOccurredAt(occurredAt);
        return lines.saveAndFlush(l);
    }

    @Test
    void day_returnsLinesInTimeOrder_threadOnOpenAndResolve_openThreadsOldestFirst() {
        UUID owner = ownerId();
        TeamChatThreadEntity old = thread(owner, FlagKey.LOGGING_GAP, "mezo", "OPEN", at(DAY.minusDays(3), 9), false);
        TeamChatThreadEntity sleep = thread(owner, FlagKey.SLEEP_DEBT, "szunya", "OPEN", at(DAY, 8), true);
        TeamChatThreadEntity resolved = thread(owner, FlagKey.LATE_EATING, "falat", "RESOLVED",
                at(DAY.minusDays(1), 20), true);
        line(owner, old.getId(), "OPEN", "mezo", "régi nyitó", at(DAY.minusDays(3), 9));
        line(owner, resolved.getId(), "OPEN", "falat", "tegnapi nyitó", at(DAY.minusDays(1), 20));
        line(owner, resolved.getId(), "RESOLVE", "falat", "megoldva", at(DAY, 10));
        line(owner, sleep.getId(), "USER", null, "oké", at(DAY, 9));
        line(owner, sleep.getId(), "OPEN", "szunya", "alvásadósság", at(DAY, 8));

        TeamChatDay day = getForBody("/api/character/team-chat?date=" + DAY, ownerAuthHeaders(),
                HttpStatus.OK, TeamChatDay.class);

        assertThat(day.getDate()).isEqualTo(DAY);
        assertThat(day.getLines()).extracting(TeamChatLine::getKind).containsExactly(
                TeamChatLine.KindEnum.OPEN, TeamChatLine.KindEnum.USER, TeamChatLine.KindEnum.RESOLVE);
        TeamChatLine open = day.getLines().get(0);
        assertThat(open.getCharacter()).isEqualTo(TeamChatLine.CharacterEnum.SZUNYA);
        assertThat(open.getBody()).isEqualTo("alvásadósság");
        assertThat(open.getFacts()).containsExactly("7.5 óra");
        assertThat(open.getVoiced()).isFalse();
        assertThat(open.getThread()).isNotNull();
        assertThat(open.getThread().getId()).isEqualTo(sleep.getId());
        assertThat(open.getThread().getRuleLabel()).isEqualTo(FlagCatalog.labelOf(FlagKey.SLEEP_DEBT));
        assertThat(open.getThread().getOwner()).isEqualTo(TeamChatThread.OwnerEnum.SZUNYA);
        assertThat(open.getThread().getStatus()).isEqualTo(TeamChatThread.StatusEnum.OPEN);
        assertThat(open.getThread().getActions()).singleElement().satisfies(a -> {
            assertThat(a.getKey()).isEqualTo("sleep_goal_earlier");
            assertThat(a.getLabel()).isEqualTo("Korábbi lefekvés");
        });
        assertThat(open.getThread().getApplied()).isNull();
        TeamChatLine user = day.getLines().get(1);
        assertThat(user.getCharacter()).isNull();
        assertThat(user.getThread()).isNull();
        TeamChatLine resolve = day.getLines().get(2);
        assertThat(resolve.getThread().getId()).isEqualTo(resolved.getId());
        assertThat(resolve.getThread().getStatus()).isEqualTo(TeamChatThread.StatusEnum.RESOLVED);
        assertThat(resolve.getThread().getClosedAt()).isNotNull();

        assertThat(day.getOpenThreads()).extracting(TeamChatThread::getId)
                .containsExactly(old.getId(), sleep.getId());
        assertThat(day.getPushesToday()).isEqualTo(1); // `resolved` was pushed, but opened the day before
        assertThat(day.getPushBudget()).isEqualTo(properties.maxPushesPerDay());
    }

    @Test
    void day_withoutDate_defaultsToToday_andIsEmptyForAFreshUser() {
        ownerId();

        TeamChatDay day = getForBody("/api/character/team-chat", ownerAuthHeaders(), HttpStatus.OK, TeamChatDay.class);

        assertThat(day.getDate()).isEqualTo(LocalDate.now(properties.zone()));
        assertThat(day.getLines()).isEmpty();
        assertThat(day.getOpenThreads()).isEmpty();
        assertThat(day.getPushesToday()).isZero();
    }

    @Test
    void day_neverShowsAnotherUsersChat() {
        ownerId();
        RegisteredUser other = registerUser("Masik");
        TeamChatThreadEntity foreign = thread(other.id(), FlagKey.SLEEP_DEBT, "szunya", "OPEN", at(DAY, 8), true);
        line(other.id(), foreign.getId(), "OPEN", "szunya", "idegen", at(DAY, 8));

        TeamChatDay day = getForBody("/api/character/team-chat?date=" + DAY, ownerAuthHeaders(),
                HttpStatus.OK, TeamChatDay.class);

        assertThat(day.getLines()).isEmpty();
        assertThat(day.getOpenThreads()).isEmpty();
        assertThat(day.getPushesToday()).isZero();
    }

    @Test
    void reply_writesAUserLine() {
        UUID owner = ownerId();
        TeamChatThreadEntity sleep = thread(owner, FlagKey.SLEEP_DEBT, "szunya", "OPEN", at(DAY, 8), false);

        TeamChatLine reply = postForBody("/api/character/team-chat/threads/" + sleep.getId() + "/reply",
                new TeamChatReplyRequest("Ma korábban fekszem."), ownerAuthHeaders(), HttpStatus.OK,
                TeamChatLine.class);

        assertThat(reply.getKind()).isEqualTo(TeamChatLine.KindEnum.USER);
        assertThat(reply.getThreadId()).isEqualTo(sleep.getId());
        assertThat(reply.getCharacter()).isNull();
        assertThat(reply.getBody()).isEqualTo("Ma korábban fekszem.");
        assertThat(reply.getThread()).isNull();
        assertThat(threads.findById(sleep.getId()).orElseThrow().getStatus()).isEqualTo("OPEN");
    }

    @Test
    void reply_toAnotherUsersThread_404() {
        ownerId();
        RegisteredUser other = registerUser("Masik");
        TeamChatThreadEntity foreign = thread(other.id(), FlagKey.SLEEP_DEBT, "szunya", "OPEN", at(DAY, 8), false);

        postForBody("/api/character/team-chat/threads/" + foreign.getId() + "/reply",
                new TeamChatReplyRequest("szia"), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void apply_unknownThread_404() {
        ownerId();

        String body = postForBody("/api/character/team-chat/threads/" + UUID.randomUUID() + "/apply/sleep_goal_earlier",
                null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "CHARACTER_TEAM_CHAT_NOT_FOUND");
    }

    @Test
    void apply_notOfferedAction_409() {
        UUID owner = ownerId();
        TeamChatThreadEntity sleep = thread(owner, FlagKey.SLEEP_DEBT, "szunya", "OPEN", at(DAY, 8), false);

        postForBody("/api/character/team-chat/threads/" + sleep.getId() + "/apply/nope",
                null, ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
    }

    @Test
    void feedback_onATeamChatLine_isAcceptedByTheFeedbackWritePath() {
        UUID owner = ownerId();
        TeamChatThreadEntity sleep = thread(owner, FlagKey.SLEEP_DEBT, "szunya", "OPEN", at(DAY, 8), false);
        TeamChatLineEntity open = line(owner, sleep.getId(), "OPEN", "szunya", "alvásadósság", at(DAY, 8));

        MessageFeedbackResponse stored = putForBody("/api/companion/feedback",
                new PutFeedbackRequest("team_chat_line", open.getId(), "up", null), ownerAuthHeaders(), HttpStatus.OK,
                MessageFeedbackResponse.class);

        assertThat(stored.getArtifactKind()).isEqualTo("team_chat_line");
        assertThat(stored.getArtifactId()).isEqualTo(open.getId());
        MessageFeedbackResponse[] listed = getForBody(
                "/api/companion/feedback?kind=team_chat_line&ids=" + open.getId(), ownerAuthHeaders(), HttpStatus.OK,
                MessageFeedbackResponse[].class);
        assertThat(listed).singleElement().satisfies(f -> assertThat(f.getVerdict()).isEqualTo("up"));
        deleteAndExpect("/api/companion/feedback/team_chat_line/" + open.getId(), ownerAuthHeaders(),
                HttpStatus.NO_CONTENT);
    }
}
