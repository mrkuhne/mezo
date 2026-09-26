package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagClearedEvent;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceWriter;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

/**
 * Task 2 (spec csapat-elo-beszelgetes): {@link FlagTraceWriter} publishes a
 * {@link FlagClearedEvent} whenever a rule's trace row changes TO {@code clear} — from any
 * previous state, since the chat side (not the trace writer) decides whether an ügy was open.
 */
@ExtendWith(MockitoExtension.class)
class FlagTraceWriterClearedEventTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final String FLAG_KEY = "sustained_stress";

    @Mock
    private CompanionFlagTraceRepository repository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private FlagTraceWriter writer;

    @BeforeEach
    void setUp() {
        writer = new FlagTraceWriter(repository, eventPublisher);
    }

    @Test
    void publishesClearedEventWhenPreviousWasRaised() {
        CompanionFlagTraceEntity previous = new CompanionFlagTraceEntity();
        previous.setFlagKey(FLAG_KEY);
        previous.setOutcome("raised");
        when(repository.findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(USER_ID, FLAG_KEY))
            .thenReturn(Optional.of(previous));

        FlagVerdict.ClearEvidence evidence = new FlagVerdict.ClearEvidence("hrv", 55.0, 40.0, null);
        FlagVerdict verdict = FlagVerdict.clear(FLAG_KEY, evidence);
        Instant at = Instant.parse("2026-09-26T10:00:00Z");

        writer.record(USER_ID, verdict, null, at);

        ArgumentCaptor<FlagClearedEvent> captor = ArgumentCaptor.forClass(FlagClearedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        FlagClearedEvent event = captor.getValue();
        assertThat(event.userId()).isEqualTo(USER_ID);
        assertThat(event.flagKey()).isEqualTo(FLAG_KEY);
        assertThat(event.evidence()).isEqualTo(evidence);
        assertThat(event.at()).isEqualTo(at);
    }

    @Test
    void doesNotPublishWhenPreviousWasAlreadyClear() {
        CompanionFlagTraceEntity previous = new CompanionFlagTraceEntity();
        previous.setFlagKey(FLAG_KEY);
        previous.setOutcome("clear");
        previous.setReasonCode(null);
        previous.setDisposition(null);
        when(repository.findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(USER_ID, FLAG_KEY))
            .thenReturn(Optional.of(previous));

        FlagVerdict.ClearEvidence evidence = new FlagVerdict.ClearEvidence("hrv", 55.0, 40.0, null);
        FlagVerdict verdict = FlagVerdict.clear(FLAG_KEY, evidence);

        writer.record(USER_ID, verdict, null, Instant.parse("2026-09-26T10:00:00Z"));

        verify(eventPublisher, never()).publishEvent(any());
        verify(repository, never()).save(any());
    }

    @Test
    void publishesClearedEventWhenPreviousWasUnavailable() {
        CompanionFlagTraceEntity previous = new CompanionFlagTraceEntity();
        previous.setFlagKey(FLAG_KEY);
        previous.setOutcome("unavailable");
        previous.setReasonCode("missing_data");
        when(repository.findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(USER_ID, FLAG_KEY))
            .thenReturn(Optional.of(previous));

        FlagVerdict.ClearEvidence evidence = new FlagVerdict.ClearEvidence("hrv", 55.0, 40.0, null);
        FlagVerdict verdict = FlagVerdict.clear(FLAG_KEY, evidence);
        Instant at = Instant.parse("2026-09-26T11:00:00Z");

        writer.record(USER_ID, verdict, null, at);

        ArgumentCaptor<FlagClearedEvent> captor = ArgumentCaptor.forClass(FlagClearedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().flagKey()).isEqualTo(FLAG_KEY);
        assertThat(captor.getValue().evidence()).isEqualTo(evidence);
    }
}
