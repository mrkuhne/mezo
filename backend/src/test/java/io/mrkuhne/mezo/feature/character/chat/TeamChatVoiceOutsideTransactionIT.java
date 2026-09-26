package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatService;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatVoiceWriter;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * mezo-a9bo7.25 drain-debug regression: the team chat's LLM voice call must run with NO database
 * transaction open — i.e. without a pooled connection pinned for the whole model round-trip.
 *
 * <p>Evidence it matters (thread dump, FlagServiceIT with a real provider key exported): five
 * async listener threads each held one of the pool's connections inside {@code openThread}'s
 * transaction while blocked on the provider's HTTP response; the test thread, three more listener
 * threads and the LLM-log writer queued on {@code HikariPool.getConnection}. Nothing deadlocked,
 * but every raise's DB work serialized behind multi-second model calls and the async work
 * outlived the 30 s pre-reset drain. In production the same shape pins one connection per raised
 * flag for the model's whole latency.
 *
 * <p>Same dump, second shape: {@code decidePush} held its connection on the per-user advisory lock
 * while {@code AppNotificationService.emit} ({@code REQUIRES_NEW}) waited for a SECOND one — a
 * pool-size of parallel pushes deadlocks the pool until the connection timeout. The push is now
 * reserved in its own transaction and emitted after it committed.
 */
@ActiveProfiles("companion-fake")
class TeamChatVoiceOutsideTransactionIT extends AbstractIntegrationTest {

    @Autowired private TeamChatService service;
    @Autowired private TeamChatThreadRepository threads;
    @Autowired private TeamChatLineRepository lines;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private TeamChatProperties properties;
    @MockitoSpyBean private TeamChatVoiceWriter voiceWriter;
    @MockitoSpyBean private AppNotificationEmitter emitter;

    /** Whether a transaction was active at the moment of each voice call. */
    private final List<Boolean> txActiveAtVoiceCall = new CopyOnWriteArrayList<>();

    /** Whether a transaction was active at the moment of each team chat push emit. */
    private final List<Boolean> txActiveAtTeamChatEmit = new CopyOnWriteArrayList<>();

    @BeforeEach
    void recordTransactionStateAtEveryVoiceCall() {
        txActiveAtVoiceCall.clear();
        doAnswer(invocation -> {
            txActiveAtVoiceCall.add(TransactionSynchronizationManager.isActualTransactionActive());
            return invocation.callRealMethod();
        }).when(voiceWriter).write(any(UUID.class), any(TeamChatThreadEntity.class), anyString(), anyList(),
                anyString(), anyBoolean());
        txActiveAtTeamChatEmit.clear();
        doAnswer(invocation -> {
            if (invocation.getArgument(1) == AppNotificationKind.TEAM_CHAT) {
                txActiveAtTeamChatEmit.add(TransactionSynchronizationManager.isActualTransactionActive());
            }
            return invocation.callRealMethod();
        }).when(emitter).emit(any(), any(), any(), any(), any(), any(), any());
    }

    /** Daytime, so the evening quiet window never swallows the push. */
    private Instant todayAt(int hour, int minute) {
        return LocalDate.now(properties.zone()).atTime(hour, minute).atZone(properties.zone()).toInstant();
    }

    private UUID ownerWithSleepDebtRaise() {
        UUID owner = userPopulator.createUser().getId();
        flagLogPopulator.raise(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                        7.5, 7, 7, 5.0, 6.5, Map.of())));
        return owner;
    }

    private List<TeamChatLineEntity> linesOf(UUID owner) {
        return lines.findByCreatedByAndOccurredAtBetweenAndDeletedFalseOrderByOccurredAtAsc(
                owner, Instant.now().minus(1, ChronoUnit.DAYS), Instant.now().plus(1, ChronoUnit.DAYS));
    }

    @Test
    void open_voicesTheLineWithNoTransactionOpen_andStillWritesTheVoicedLine() {
        UUID owner = ownerWithSleepDebtRaise();

        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();

        assertThat(txActiveAtVoiceCall).containsExactly(false);
        assertThat(linesOf(owner)).singleElement().satisfies(line -> {
            assertThat(line.getKind()).isEqualTo("OPEN");
            assertThat(line.getThreadId()).isEqualTo(thread.getId());
            assertThat(line.getVoiced()).isTrue();
            assertThat(line.getBody())
                    .isEqualTo(FakeCompanionLlm.teamChatOwnerBody(line.getFacts().facts().getFirst()));
        });
    }

    @Test
    void open_emitsThePushAfterTheReservationCommitted_notInsideIt() {
        UUID owner = ownerWithSleepDebtRaise();

        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, todayAt(10, 0)).orElseThrow();

        assertThat(txActiveAtTeamChatEmit).containsExactly(false);
        assertThat(threads.findById(thread.getId()).orElseThrow().getPushed()).isTrue();
    }

    @Test
    void resolve_voicesTheLineWithNoTransactionOpen_andStillResolvesWithTheVoicedLine() {
        UUID owner = ownerWithSleepDebtRaise();
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();
        txActiveAtVoiceCall.clear();
        FlagVerdict.ClearEvidence evidence = new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null);

        TeamChatLineEntity resolved =
                service.resolve(owner, FlagKey.SLEEP_DEBT, evidence, Instant.now()).orElseThrow();

        assertThat(txActiveAtVoiceCall).containsExactly(false);
        assertThat(resolved.getKind()).isEqualTo("RESOLVE");
        assertThat(resolved.getVoiced()).isTrue();
        assertThat(resolved.getThreadId()).isEqualTo(thread.getId());
        assertThat(threads.findById(thread.getId()).orElseThrow().getStatus()).isEqualTo("RESOLVED");
    }
}
