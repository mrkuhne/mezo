package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.character.entity.TeamEditionEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionPostRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterRunLog;
import io.mrkuhne.mezo.feature.character.service.edition.EditionCandidateCollector;
import io.mrkuhne.mezo.feature.character.service.edition.EditionVoiceWriter;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionReads;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionService;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * mezo-a9bo7.19: {@link TeamEditionService#run}'s {@code DataIntegrityViolationException} handling,
 * without a database — swallowed ONLY when a live edition for the day really exists now (the
 * parallel run won {@code uq_team_edition_day}); any other integrity failure is rethrown so the
 * job logs it and the next tick retries.
 */
class TeamEditionRaceTest {

    private static final UUID OWNER = UUID.randomUUID();
    private static final LocalDate DAY = LocalDate.of(2026, 9, 26);

    private final TeamEditionRepository editions = mock(TeamEditionRepository.class);
    private final CharacterRunLog runLog = mock(CharacterRunLog.class);
    private final AppNotificationEmitter emitter = mock(AppNotificationEmitter.class);
    private final TeamEditionService proxy = mock(TeamEditionService.class);
    private TeamEditionService service;

    @BeforeEach
    void setUp() {
        @SuppressWarnings("unchecked")
        ObjectProvider<TeamEditionService> self = mock(ObjectProvider.class);
        when(self.getObject()).thenReturn(proxy);
        service = new TeamEditionService(editions, mock(TeamEditionPostRepository.class), mock(TeamEditionReads.class),
                mock(EditionCandidateCollector.class), runLog, emitter, mock(EditionVoiceWriter.class), self);
        when(proxy.publish(eq(OWNER), eq(DAY), any(), anyList(), anyList()))
                .thenThrow(new DataIntegrityViolationException("uq_team_edition_day"));
    }

    @Test
    void aLostRace_isSwallowed_whenTheWinnersEditionExists() {
        when(editions.findByCreatedByAndDay(OWNER, DAY))
                .thenReturn(Optional.empty(), Optional.of(new TeamEditionEntity()));

        assertThatCode(() -> service.run(OWNER, DAY)).doesNotThrowAnyException();
        verifyNoInteractions(runLog, emitter);
    }

    @Test
    void anyOtherIntegrityFailure_isRethrown() {
        when(editions.findByCreatedByAndDay(OWNER, DAY)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.run(OWNER, DAY)).isInstanceOf(DataIntegrityViolationException.class);
    }
}
