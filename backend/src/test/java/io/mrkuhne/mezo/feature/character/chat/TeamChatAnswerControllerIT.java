package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.TeamChatThread;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.KeywordsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * Emlékezet S7 Task 7 (mezo-d6ivw.7): the one-tap answer and the remembered chip's undo over
 * HTTP — the status codes and the ügy they answer with (the service rules are TeamChatExceptionIT's).
 */
class TeamChatAnswerControllerIT extends ApiIntegrationTest {

    @Autowired private TeamChatThreadRepository threads;
    @Autowired private TeamChatExceptionRepository exceptions;
    @Autowired private TeamChatProperties properties;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private Instant earlierToday() {
        return LocalDate.now(properties.zone()).atStartOfDay(properties.zone()).toInstant();
    }

    private TeamChatExceptionEntity exception(UUID owner, UUID sourceThreadId) {
        TeamChatExceptionEntity e = new TeamChatExceptionEntity();
        e.setCreatedBy(owner);
        e.setFlagKey(FlagKey.LATE_EATING);
        e.setOwnerCharacter("falat");
        e.setContextTag("meccsnap");
        e.setNormalizedTag("meccsnap");
        e.setFactText("Meccsnapokon későn eszel — ez rendben van.");
        e.setKeywords(new KeywordsEnvelope(List.of("meccs")));
        e.setSourceThreadId(sourceThreadId);
        e.setActive(true);
        e.setWindowStartedAt(earlierToday());
        return exceptions.saveAndFlush(e);
    }

    private TeamChatThreadEntity thread(UUID owner, String status, String closeReason) {
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setCreatedBy(owner);
        t.setFlagKey(FlagKey.LATE_EATING);
        t.setOwnerCharacter("falat");
        t.setAdviceKey("late_eating_ease_up");
        t.setStatus(status);
        t.setOpenedAt(earlierToday());
        t.setClosedAt("OPEN".equals(status) ? null : earlierToday().plusSeconds(60));
        t.setCloseReason(closeReason);
        t.setPushed(false);
        t.setActions(new TeamChatActionsEnvelope(List.of()));
        return threads.saveAndFlush(t);
    }

    private TeamChatThreadEntity excuseOffer(UUID owner) {
        TeamChatThreadEntity source = thread(owner, "RESOLVED", "REPLY");
        TeamChatExceptionEntity e = exception(owner, source.getId());
        TeamChatThreadEntity offer = thread(owner, "OPEN", null);
        offer.setOffer("EXCUSE");
        offer.setExceptionId(e.getId());
        return threads.saveAndFlush(offer);
    }

    private String answerUri(UUID threadId) {
        return "/api/character/team-chat/threads/" + threadId + "/answer";
    }

    @Test
    void answerExcused_onAnExcuseOffer_closesItExcused_thenKeepIs409() {
        UUID owner = ownerId();
        TeamChatThreadEntity offer = excuseOffer(owner);

        TeamChatThread answered = postForBody(answerUri(offer.getId()), Map.of("choice", "EXCUSED"),
                ownerAuthHeaders(), HttpStatus.OK, TeamChatThread.class);

        assertThat(answered.getId()).isEqualTo(offer.getId());
        assertThat(answered.getStatus()).isEqualTo(TeamChatThread.StatusEnum.RESOLVED);
        assertThat(answered.getCloseReason()).isEqualTo(TeamChatThread.CloseReasonEnum.EXCUSED);
        assertThat(answered.getCloseNote()).isEqualTo("meccsnap");
        assertThat(answered.getOffer()).isEqualTo(TeamChatThread.OfferEnum.EXCUSE);
        assertThat(answered.getOfferTag()).isEqualTo("meccsnap");

        postForBody(answerUri(offer.getId()), Map.of("choice", "KEEP"), ownerAuthHeaders(), HttpStatus.CONFLICT,
                String.class);
    }

    @Test
    void undoRemembered_onAForeignUgy_is404() {
        UUID owner = ownerId();
        excuseOffer(owner);
        RegisteredUser other = registerUser("Idegen");
        TeamChatThreadEntity foreign = thread(other.id(), "RESOLVED", "REPLY");
        exception(other.id(), foreign.getId());

        exchangeForBody(HttpMethod.DELETE, "/api/character/team-chat/threads/" + foreign.getId() + "/remembered",
                null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void undoRemembered_reopensTheUgy_andShowsTheChipInactive() {
        UUID owner = ownerId();
        TeamChatThreadEntity source = thread(owner, "RESOLVED", "REPLY");
        exception(owner, source.getId());

        TeamChatThread undone = exchangeForBody(HttpMethod.DELETE,
                "/api/character/team-chat/threads/" + source.getId() + "/remembered", null, ownerAuthHeaders(),
                HttpStatus.OK, TeamChatThread.class);

        assertThat(undone.getStatus()).isEqualTo(TeamChatThread.StatusEnum.OPEN);
        assertThat(undone.getCloseReason()).isNull();
        assertThat(undone.getRemembered()).isNotNull();
        assertThat(undone.getRemembered().getActive()).isFalse();
    }
}
