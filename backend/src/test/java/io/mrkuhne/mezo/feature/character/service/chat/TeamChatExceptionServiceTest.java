package io.mrkuhne.mezo.feature.character.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionHitRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

/**
 * mezo-d6ivw.11: the undo's lost reopen race (a retryable 409, never a 500) and the exception ↔
 * knowledge-fact mirror ({@link TeamChatExceptionService#followFact}).
 */
class TeamChatExceptionServiceTest {

    private static final UUID USER = UUID.randomUUID();
    private final TeamChatExceptionRepository exceptions = mock(TeamChatExceptionRepository.class);
    private final TeamChatThreadRepository threads = mock(TeamChatThreadRepository.class);
    private final KnowledgeFactService knowledge = mock(KnowledgeFactService.class);
    private final TeamChatExceptionService service = new TeamChatExceptionService(exceptions,
            mock(TeamChatExceptionHitRepository.class), threads, mock(TeamChatLineRepository.class),
            mock(TeamChatProperties.class), knowledge, mock(TeamChatService.class), List.of());

    @Test
    void undo_losingTheReopenRaceToANewRaise_isA409() {
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setId(UUID.randomUUID());
        t.setFlagKey("late_eating");
        t.setStatus(TeamChatService.STATUS_RESOLVED);
        t.setCloseReason(TeamChatService.CLOSE_REPLY);
        TeamChatExceptionEntity e = exception(false);
        when(threads.lockOwned(t.getId(), USER)).thenReturn(Optional.of(t));
        when(exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(t.getId(), USER)).thenReturn(Optional.of(e));
        when(threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(USER, "late_eating", "OPEN"))
                .thenReturn(Optional.empty());
        when(threads.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uq_team_chat_thread_open"));

        assertThatThrownBy(() -> service.undoRemembered(USER, t.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void followFact_liveFact_reactivatesWithAFreshWindow_andTakesTheEditedText() {
        TeamChatExceptionEntity e = exception(false);
        Instant oldWindow = e.getWindowStartedAt();
        when(exceptions.findByKnowledgeFactIdAndCreatedByAndDeletedFalse(e.getKnowledgeFactId(), USER))
                .thenReturn(List.of(e));
        when(knowledge.liveText(USER, e.getKnowledgeFactId())).thenReturn(Optional.of(" Új szöveg. "));

        service.followFact(USER, e.getKnowledgeFactId());

        assertThat(e.getActive()).isTrue();
        assertThat(e.getFactText()).isEqualTo("Új szöveg.");
        assertThat(e.getWindowStartedAt()).isAfter(oldWindow);
        verify(exceptions).lockUserExceptions(USER);
        verify(exceptions).saveAndFlush(e);
    }

    @Test
    void followFact_withdrawnFact_deactivates_andKeepsTheText() {
        TeamChatExceptionEntity e = exception(true);
        when(exceptions.findByKnowledgeFactIdAndCreatedByAndDeletedFalse(e.getKnowledgeFactId(), USER))
                .thenReturn(List.of(e));
        when(knowledge.liveText(USER, e.getKnowledgeFactId())).thenReturn(Optional.empty());

        service.followFact(USER, e.getKnowledgeFactId());

        assertThat(e.getActive()).isFalse();
        assertThat(e.getFactText()).isEqualTo("Régi szöveg.");
    }

    @Test
    void followFact_tooLongEdit_keepsTheOldChipText_andAnUnrelatedFactTakesNoLock() {
        TeamChatExceptionEntity e = exception(true);
        when(exceptions.findByKnowledgeFactIdAndCreatedByAndDeletedFalse(e.getKnowledgeFactId(), USER))
                .thenReturn(List.of(e));
        when(knowledge.liveText(USER, e.getKnowledgeFactId())).thenReturn(Optional.of("x".repeat(161)));
        service.followFact(USER, e.getKnowledgeFactId());
        assertThat(e.getFactText()).isEqualTo("Régi szöveg.");
        verify(exceptions, never()).saveAndFlush(any());

        UUID unrelated = UUID.randomUUID();
        when(exceptions.findByKnowledgeFactIdAndCreatedByAndDeletedFalse(unrelated, USER)).thenReturn(List.of());
        TeamChatExceptionServiceTest.this.service.followFact(USER, unrelated);
        verify(knowledge, never()).liveText(USER, unrelated);
    }

    private static TeamChatExceptionEntity exception(boolean active) {
        TeamChatExceptionEntity e = new TeamChatExceptionEntity();
        e.setId(UUID.randomUUID());
        e.setCreatedBy(USER);
        e.setKnowledgeFactId(UUID.randomUUID());
        e.setFactText("Régi szöveg.");
        e.setActive(active);
        e.setWindowStartedAt(Instant.now().minus(30, ChronoUnit.DAYS));
        return e;
    }
}
