package io.mrkuhne.mezo.feature.season.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonExperimentEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonMetricsPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonExperimentRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRevisionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

/** Boop B6 Évad S4 review fixes (mezo-r36n9.16): detector isolation, unique-index clash → 409, the journal regex. */
class ExperimentServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 21);
    private static final UUID OWNER = UUID.randomUUID();

    private final SeasonRepository seasons = mock(SeasonRepository.class);
    private final SeasonExperimentRepository experiments = mock(SeasonExperimentRepository.class);
    private final ExperimentProposalDetector detector = mock(ExperimentProposalDetector.class);
    private final PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
    private final SeasonEntity season = new SeasonEntity();
    private ExperimentService service;

    @BeforeEach
    void setUp() {
        season.setId(UUID.randomUUID());
        season.setCreatedBy(OWNER);
        season.setStatus(SeasonEntity.STATUS_ACTIVE);
        when(seasons.findActive(OWNER)).thenReturn(Optional.of(season));
        when(experiments.findBySeasonIdAndStatus(any(), anyString())).thenReturn(List.of());
        when(experiments.findBySeasonIdOrderByCreatedAtDesc(any())).thenReturn(List.of());
        when(txManager.getTransaction(any())).thenAnswer(i -> new SimpleTransactionStatus());
        service = new ExperimentService(seasons, mock(SeasonRevisionRepository.class), experiments,
            mock(SeasonMetricsPort.class), mock(SeasonTrainPort.class), detector,
            mock(io.mrkuhne.mezo.feature.season.port.SeasonExperimentSourcePort.class), null, txManager);
    }

    private static DataIntegrityViolationException clash(String index) {
        return new DataIntegrityViolationException("could not execute statement",
            new RuntimeException("ERROR: duplicate key value violates unique constraint \"" + index + "\""));
    }

    @Test
    void throwingDetectorNeverBreaksTheList() {
        when(detector.detect(any(), any(), any())).thenThrow(new IllegalStateException("source down"));

        ExperimentService.Listing l = service.list(OWNER, TODAY);

        assertThat(l.proposal()).isNull();
        assertThat(l.running()).isNull();
        assertThat(l.past()).isEmpty();
        assertThat(l.proposeOn()).isEqualTo(season.isProposeExperiments());
        // the detector ran in its own transaction, not the caller's
        ArgumentCaptor<TransactionDefinition> defs = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(txManager, atLeastOnce()).getTransaction(defs.capture());
        assertThat(defs.getAllValues()).extracting(TransactionDefinition::getPropagationBehavior)
            .contains(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Test
    void throwingDetectorNeverBreaksTheDailyPass() {
        when(detector.detect(any(), any(), any())).thenThrow(new IllegalStateException("source down"));

        service.daily(OWNER, TODAY);

        verify(detector).detect(OWNER, season, TODAY);
    }

    @Test
    void startHittingTheOneRunningIndexIs409() {
        SeasonExperimentEntity proposal = new SeasonExperimentEntity();
        proposal.setId(UUID.randomUUID());
        proposal.setSeasonId(season.getId());
        proposal.setStatus(SeasonExperimentEntity.STATUS_PROPOSED);
        proposal.setLengthDays(14);
        when(experiments.findByIdAndCreatedBy(proposal.getId(), OWNER)).thenReturn(Optional.of(proposal));
        when(experiments.saveAndFlush(any())).thenThrow(clash("uq_season_experiment_one_running"));

        assertThatThrownBy(() -> service.start(OWNER, proposal.getId(), TODAY))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                assertThat(e.getStatus().value()).isEqualTo(409);
                assertThat(e.getMessage()).contains("EXPERIMENT_ALREADY_RUNNING");
            });
    }

    @Test
    void createHittingTheOneRunningIndexIs409() {
        when(experiments.saveAndFlush(any())).thenThrow(clash("uq_season_experiment_one_running"));

        assertThatThrownBy(() -> service.create(OWNER, "Esti magnézium", "habit", null, 14, TODAY))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                assertThat(e.getStatus().value()).isEqualTo(409);
                assertThat(e.getMessage()).contains("EXPERIMENT_ALREADY_RUNNING");
            });
    }

    @Test
    void otherIntegrityErrorsAreNotRetoldAsAlreadyRunning() {
        when(experiments.saveAndFlush(any())).thenThrow(clash("ck_season_experiment_length_days"));

        assertThatThrownBy(() -> service.create(OWNER, "Esti magnézium", "habit", null, 14, TODAY))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void startedWordMustBeginAWord() {
        assertThat(ExperimentProposalDetector.startedSentence("Abbahagytam, aztán visszaelkezdtem.")).isEmpty();
        assertThat(ExperimentProposalDetector.startedSentence("A szentmostantól szó nem létezik.")).isEmpty();
        assertThat(ExperimentProposalDetector.startedSentence("Ma elkezdtem futni."))
            .contains("Ma elkezdtem futni");
        assertThat(ExperimentProposalDetector.startedSentence("Mostantól sétálok!")).contains("Mostantól sétálok");
        assertThat(ExperimentProposalDetector.startedSentence("(Elkezdtem a jógát)")).isPresent();
    }
}
