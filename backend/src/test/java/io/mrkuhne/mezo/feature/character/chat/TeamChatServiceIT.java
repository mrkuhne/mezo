package io.mrkuhne.mezo.feature.character.chat;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatService;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagClearedEvent;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaisedEvent;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceCopy;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Csapatfal Act III Task 5 (mezo-a9bo7.21): the team chat engine with the E1 template voice —
 * a raise opens an ügy owned by the rule's character, a clear resolves it, 7 days open expires
 * it, a reply never resolves, and an offered action is applied exactly once. No class-level
 * {@code @Transactional}: case (a) needs the raise to really commit so the AFTER_COMMIT listener
 * fires (the {@code InterventionServiceIT} precedent).
 */
@ActiveProfiles("companion-fake")
class TeamChatServiceIT extends AbstractIntegrationTest {

    @Autowired private TeamChatService service;
    @Autowired private TeamChatThreadRepository threads;
    @Autowired private TeamChatLineRepository lines;
    @Autowired private TeamChatProperties properties;
    @Autowired private CompanionProperties companionProperties;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private SleepGoalRepository sleepGoalRepository;
    @Autowired private ApplicationEventPublisher publisher;
    @Autowired private TransactionTemplate tx;

    private UUID owner() {
        return userPopulator.createUser().getId();
    }

    private String sleepDebtLibraryText() {
        return companionProperties.interventions().stream()
                .filter(e -> e.flag().equals(FlagKey.SLEEP_DEBT))
                .findFirst().orElseThrow().textHu();
    }

    private void raiseSleepDebtLog(UUID owner) {
        flagLogPopulator.raise(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                        7.5, 7, 7, 5.0, 6.5, Map.of())));
    }

    private List<TeamChatThreadEntity> threadsOf(UUID owner) {
        return threads.findByCreatedByAndOpenedAtBetweenAndDeletedFalse(
                owner, Instant.now().minus(30, ChronoUnit.DAYS), Instant.now().plus(1, ChronoUnit.DAYS));
    }

    private List<TeamChatLineEntity> linesOf(UUID owner) {
        return lines.findByCreatedByAndOccurredAtBetweenAndDeletedFalseOrderByOccurredAtAsc(
                owner, Instant.now().minus(30, ChronoUnit.DAYS), Instant.now().plus(1, ChronoUnit.DAYS));
    }

    // (a) through the event: publish-and-commit → @Async AFTER_COMMIT listener → open.
    @Test
    void raiseEvent_opensOneThreadOwnedBySzunya_withTheLibraryLine() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);

        tx.executeWithoutResult(s -> publisher.publishEvent(
                new FlagRaisedEvent(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE)));

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(owner)).hasSize(1));
        List<TeamChatThreadEntity> opened = threadsOf(owner);
        assertThat(opened).singleElement().satisfies(t -> {
            assertThat(t.getStatus()).isEqualTo("OPEN");
            assertThat(t.getOwnerCharacter()).isEqualTo("szunya");
            assertThat(t.getFlagKey()).isEqualTo(FlagKey.SLEEP_DEBT);
            assertThat(t.getAdviceKey()).isEqualTo("sleep_recover_tonight");
        });
        TeamChatLineEntity line = linesOf(owner).getFirst();
        assertThat(line.getKind()).isEqualTo("OPEN");
        assertThat(line.getCharacter()).isEqualTo("szunya");
        assertThat(line.getBody()).isEqualTo(sleepDebtLibraryText());
        assertThat(line.getVoiced()).isFalse();
        assertThat(line.getThreadId()).isEqualTo(opened.getFirst().getId());
        assertThat(line.getFacts().facts()).isNotEmpty();
    }

    // (b) a second raise while the ügy is open changes nothing.
    @Test
    void secondRaise_keepsOneThreadAndOneLine() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);

        assertThat(service.open(owner, FlagKey.SLEEP_DEBT, Instant.now())).isPresent();
        assertThat(service.open(owner, FlagKey.SLEEP_DEBT, Instant.now())).isEmpty();

        assertThat(threadsOf(owner)).hasSize(1);
        assertThat(linesOf(owner)).hasSize(1);
    }

    // (c) a clear resolves the open ügy with the FlagTraceCopy sentence.
    @Test
    void clear_resolvesTheThreadWithTheTraceCopyLine() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();
        FlagVerdict.ClearEvidence evidence = new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null);

        Optional<TeamChatLineEntity> resolved =
                service.resolve(owner, FlagKey.SLEEP_DEBT, evidence, Instant.now());

        assertThat(resolved).hasValueSatisfying(l -> {
            assertThat(l.getKind()).isEqualTo("RESOLVE");
            assertThat(l.getCharacter()).isEqualTo("szunya");
            assertThat(l.getBody()).isEqualTo(FlagTraceCopy.clearText(evidence));
            assertThat(l.getFacts().facts()).isEqualTo(FlagTraceCopy.clearFacts(evidence));
            assertThat(l.getThreadId()).isEqualTo(thread.getId());
        });
        TeamChatThreadEntity reread = threads.findById(thread.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo("RESOLVED");
        assertThat(reread.getClosedAt()).isNotNull();
    }

    // (c') the clear path through the event too, to cover the listener's second method.
    @Test
    void clearEvent_resolvesThroughTheListener() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();

        tx.executeWithoutResult(s -> publisher.publishEvent(new FlagClearedEvent(owner, FlagKey.SLEEP_DEBT,
                new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null), Instant.now())));

        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(threads.findById(thread.getId()).orElseThrow().getStatus()).isEqualTo("RESOLVED"));
    }

    // (d) a clear with no open ügy writes nothing.
    @Test
    void clearWithoutOpenThread_writesNothing() {
        UUID owner = owner();

        assertThat(service.resolve(owner, FlagKey.SLEEP_DEBT,
                new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null), Instant.now())).isEmpty();

        assertThat(threadsOf(owner)).isEmpty();
        assertThat(linesOf(owner)).isEmpty();
    }

    // (e) all_healthy never opens an ügy.
    @Test
    void allHealthyRaise_opensNothing() {
        UUID owner = owner();

        assertThat(service.open(owner, FlagKey.ALL_HEALTHY, Instant.now())).isEmpty();

        assertThat(threadsOf(owner)).isEmpty();
    }

    /** Seeds {@code count} character lines at {@code now} on a separate, already-resolved ügy. */
    private void fillLines(UUID owner, int count, Instant now) {
        TeamChatThreadEntity other = new TeamChatThreadEntity();
        other.setCreatedBy(owner);
        other.setFlagKey(FlagKey.LOGGING_GAP);
        other.setOwnerCharacter("mezo");
        other.setStatus("RESOLVED");
        other.setOpenedAt(now);
        other.setClosedAt(now);
        other = threads.saveAndFlush(other);
        for (int i = 0; i < count; i++) {
            TeamChatLineEntity line = new TeamChatLineEntity();
            line.setCreatedBy(owner);
            line.setThreadId(other.getId());
            line.setKind(i == 0 ? "OPEN" : "GUEST");
            line.setCharacter("mezo");
            line.setBody("sor " + i);
            line.setOccurredAt(now);
            lines.saveAndFlush(line);
        }
    }

    // (f) the 13th character line of a local day is dropped.
    @Test
    void dailyLineCap_dropsTheLineBeyondTheCap() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        Instant now = Instant.now();
        fillLines(owner, properties.dailyLineCap(), now);

        assertThat(service.open(owner, FlagKey.SLEEP_DEBT, now)).isEmpty();

        assertThat(linesOf(owner)).hasSize(properties.dailyLineCap());
        assertThat(threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(
                owner, FlagKey.SLEEP_DEBT, "OPEN")).isEmpty();
    }

    // (f') at the cap a clear still closes the ügy — only its RESOLVE line is dropped.
    @Test
    void dailyLineCap_resolveStillClosesTheThread_butDropsTheLine() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        Instant now = Instant.now();
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, now).orElseThrow();
        fillLines(owner, properties.dailyLineCap() - 1, now);

        assertThat(service.resolve(owner, FlagKey.SLEEP_DEBT,
                new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null), now)).isEmpty();

        TeamChatThreadEntity reread = threads.findById(thread.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo("RESOLVED");
        assertThat(reread.getClosedAt()).isNotNull();
        assertThat(lines.existsByThreadIdAndKind(thread.getId(), "RESOLVE")).isFalse();
        assertThat(linesOf(owner)).hasSize(properties.dailyLineCap());
    }

    // (g) an ügy open for 8 days expires.
    @Test
    void expire_closesAnEightDayOldOpenThread() {
        UUID owner = owner();
        Instant now = Instant.now();
        TeamChatThreadEntity old = new TeamChatThreadEntity();
        old.setCreatedBy(owner);
        old.setFlagKey(FlagKey.SLEEP_DEBT);
        old.setOwnerCharacter("szunya");
        old.setStatus("OPEN");
        old.setOpenedAt(now.minus(8, ChronoUnit.DAYS));
        old = threads.saveAndFlush(old);
        TeamChatThreadEntity fresh = new TeamChatThreadEntity();
        fresh.setCreatedBy(owner);
        fresh.setFlagKey(FlagKey.LOGGING_GAP);
        fresh.setOwnerCharacter("mezo");
        fresh.setStatus("OPEN");
        fresh.setOpenedAt(now.minus(2, ChronoUnit.DAYS));
        fresh = threads.saveAndFlush(fresh);

        assertThat(service.expire(now)).isGreaterThanOrEqualTo(1);

        TeamChatThreadEntity expired = threads.findById(old.getId()).orElseThrow();
        assertThat(expired.getStatus()).isEqualTo("EXPIRED");
        assertThat(expired.getClosedAt()).isNotNull();
        assertThat(threads.findById(fresh.getId()).orElseThrow().getStatus()).isEqualTo("OPEN");
    }

    // (h) a reply writes a USER line and never resolves.
    @Test
    void reply_writesAUserLine_andLeavesTheThreadOpen() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();

        TeamChatLineEntity reply = service.reply(owner, thread.getId(), "  Rendben, ma korábban fekszem.  ");

        assertThat(reply.getKind()).isEqualTo("USER");
        assertThat(reply.getCharacter()).isNull();
        assertThat(reply.getBody()).isEqualTo("Rendben, ma korábban fekszem.");
        assertThat(threads.findById(thread.getId()).orElseThrow().getStatus()).isEqualTo("OPEN");
        assertThat(linesOf(owner)).hasSize(2);
    }

    @Test
    void reply_rejectsBlankAndOverlongText_andForeignThreads() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();

        assertThatThrownBy(() -> service.reply(owner, thread.getId(), "   "))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .hasMessageContaining("CHARACTER_TEAM_CHAT_REPLY_INVALID");
        assertThatThrownBy(() -> service.reply(owner, thread.getId(), "x".repeat(1001)))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .hasMessageContaining("CHARACTER_TEAM_CHAT_REPLY_INVALID");
        assertThatThrownBy(() -> service.reply(owner(), thread.getId(), "szia"))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .hasMessageContaining("CHARACTER_TEAM_CHAT_NOT_FOUND");
    }

    // (i) an offered action runs the port once; a second apply is an idempotent no-op.
    @Test
    void apply_runsThePortOnce_andIsIdempotent() {
        UUID owner = owner();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:45", 15);
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();
        assertThat(thread.getActions().actions())
                .extracting(a -> a.key()).containsExactly(AdviceActionKey.SHIFT_SLEEP_ANCHOR);

        TeamChatThreadEntity first = service.apply(owner, thread.getId(), AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        String anchorAfterFirst = sleepGoalRepository.findByCreatedByAndDeletedFalse(owner)
                .orElseThrow().getAnchorTime();
        TeamChatThreadEntity second = service.apply(owner, thread.getId(), AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        String anchorAfterSecond = sleepGoalRepository.findByCreatedByAndDeletedFalse(owner)
                .orElseThrow().getAnchorTime();

        assertThat(anchorAfterFirst).isNotEqualTo("06:45");
        assertThat(anchorAfterSecond).isEqualTo(anchorAfterFirst);
        assertThat(first.getApplied().actionKey()).isEqualTo(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        assertThat(second.getApplied().at()).isEqualTo(first.getApplied().at());
        assertThatThrownBy(() -> service.apply(owner, thread.getId(), AdviceActionKey.LIGHTEN_TOMORROW))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .hasMessageContaining("CHARACTER_TEAM_CHAT_ACTION_NOT_OFFERED");
    }
}
