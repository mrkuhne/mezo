package io.mrkuhne.mezo.feature.character.chat;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatService;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagClearedEvent;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaisedEvent;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceCopy;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.AnchorResolver;
import io.mrkuhne.mezo.feature.proactive.service.AdvicePriority;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Csapatfal Act III Task 5 (mezo-a9bo7.21) + Task 9 (mezo-a9bo7.22): the team chat engine, voiced
 * through the fake LLM (owner, cross-talk guest, Szkeptikus on a payload gap) —
 * a raise opens an ügy owned by the rule's character, a clear resolves it, 7 days open expires
 * it, a reply writes a USER line synchronously (the async answer is TeamChatReplyIT's domain), and
 * an offered action is applied exactly once. No class-level
 * {@code @Transactional}: case (a) needs the raise to really commit so the AFTER_COMMIT listener
 * fires (the {@code InterventionServiceIT} precedent).
 */
@ActiveProfiles("companion-fake")
class TeamChatServiceIT extends AbstractIntegrationTest {

    @Autowired private TeamChatService service;
    @Autowired private TeamChatThreadRepository threads;
    @Autowired private AppNotificationRepository appNotifications;
    @Autowired private TeamChatLineRepository lines;
    @Autowired private TeamChatProperties properties;
    @Autowired private CompanionProperties companionProperties;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private SleepGoalRepository sleepGoalRepository;
    @Autowired private CompanionFlagTraceRepository flagTraces;
    @Autowired private ApplicationEventPublisher publisher;
    @Autowired private TransactionTemplate tx;
    @Autowired private AnchorResolver anchorResolver;

    /** A fixed local clock time today in the team chat's zone — push tests must not depend on the
     *  wall clock since the quiet window (22:00–07:00) gates pushes (final review C1). */
    private Instant todayAt(int hour, int minute) {
        return LocalDate.now(properties.zone()).atTime(hour, minute).atZone(properties.zone()).toInstant();
    }

    private List<AppNotificationEntity> teamChatPushes(UUID owner) {
        return appNotifications.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner).stream()
                .filter(n -> AppNotificationKind.TEAM_CHAT.key().equals(n.getKind()))
                .toList();
    }

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
        // E2: the fake voices the line from the first fact — guard-passing, so voiced=true.
        assertThat(line.getFacts().facts()).isNotEmpty();
        assertThat(line.getBody()).isEqualTo(FakeCompanionLlm.teamChatOwnerBody(line.getFacts().facts().getFirst()))
                .isNotEqualTo(sleepDebtLibraryText());
        assertThat(line.getVoiced()).isTrue();
        assertThat(line.getThreadId()).isEqualTo(opened.getFirst().getId());
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
            assertThat(l.getBody()).isEqualTo(
                    FakeCompanionLlm.teamChatOwnerBody(FlagTraceCopy.clearFacts(evidence).getFirst()));
            assertThat(l.getVoiced()).isTrue();
            assertThat(l.getFacts().facts()).isEqualTo(FlagTraceCopy.clearFacts(evidence));
            assertThat(l.getThreadId()).isEqualTo(thread.getId());
        });
        TeamChatThreadEntity reread = threads.findById(thread.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo("RESOLVED");
        assertThat(reread.getCloseReason()).isEqualTo("DATA");
        assertThat(reread.getClosedAt()).isNotNull();
    }

    private void raiseLoadFuelLog(UUID owner, int kcalLoggedDays) {
        flagLogPopulator.raise(owner, FlagKey.LOAD_FUEL_MISMATCH, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.loadFuelMismatch(new FlagPayloadEnvelope.LoadFuelMismatch(
                        7, 610.0, 500.0, 1800.0, 2600.0, 0.69, 0.8, kcalLoggedDays, 6.8, 6.5, 7, 4, "kcal", null)));
    }

    private List<TeamChatLineEntity> linesOf(TeamChatThreadEntity thread) {
        return lines.findByThreadIdAndDeletedFalse(thread.getId()).stream()
                .sorted(java.util.Comparator.comparing(TeamChatLineEntity::getKind))
                .toList();
    }

    // (c'') E2 cross-talk: a guest rule opens with the owner's voiced line AND the guest's line.
    @Test
    void open_guestRule_writesAVoicedOpenLineAndAGuestLine() {
        UUID owner = owner();
        raiseLoadFuelLog(owner, 7);

        TeamChatThreadEntity thread = service.open(owner, FlagKey.LOAD_FUEL_MISMATCH, Instant.now()).orElseThrow();

        assertThat(thread.getOwnerCharacter()).isEqualTo("mocor");
        assertThat(thread.getGuestCharacter()).isEqualTo("falat");
        List<TeamChatLineEntity> written = linesOf(thread);
        assertThat(written).extracting(TeamChatLineEntity::getKind).containsExactly("GUEST", "OPEN");
        TeamChatLineEntity guest = written.get(0);
        TeamChatLineEntity open = written.get(1);
        assertThat(open.getCharacter()).isEqualTo("mocor");
        assertThat(open.getVoiced()).isTrue();
        assertThat(open.getBody()).isEqualTo(FakeCompanionLlm.teamChatOwnerBody(open.getFacts().facts().getFirst()));
        assertThat(guest.getCharacter()).isEqualTo("falat");
        assertThat(guest.getBody()).isEqualTo(FakeCompanionLlm.TEAM_CHAT_GUEST_BODY);
        assertThat(guest.getVoiced()).isTrue();
    }

    // (c''') a coverage gap in the frozen payload brings the Szkeptikus — on the open only.
    @Test
    void open_withAPayloadGap_addsASkepticLine_andTheResolveCarriesOnlyTheGuest() {
        UUID owner = owner();
        raiseLoadFuelLog(owner, 5);

        TeamChatThreadEntity thread = service.open(owner, FlagKey.LOAD_FUEL_MISMATCH, Instant.now()).orElseThrow();

        List<TeamChatLineEntity> opened = linesOf(thread);
        assertThat(opened).extracting(TeamChatLineEntity::getKind).containsExactly("GUEST", "OPEN", "SKEPTIC");
        TeamChatLineEntity skeptic = opened.get(2);
        assertThat(skeptic.getCharacter()).isEqualTo("szkeptikus");
        assertThat(skeptic.getBody()).isEqualTo(FakeCompanionLlm.TEAM_CHAT_SKEPTIC_BODY);
        assertThat(skeptic.getFacts().facts())
                .contains("Hiányzó adat: az utolsó 7 napból 2 napon nincs rögzített kalória");

        service.resolve(owner, FlagKey.LOAD_FUEL_MISMATCH,
                new FlagVerdict.ClearEvidence("load_avg", 420.0, 500.0, null), Instant.now());

        assertThat(linesOf(thread)).extracting(TeamChatLineEntity::getKind)
                .containsExactly("GUEST", "GUEST", "OPEN", "RESOLVE", "SKEPTIC");
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

    // (h) a reply writes a USER line synchronously. S7 (mezo-d6ivw.7): the owner's async answer —
    // which may close the ügy — is TeamChatReplyIT's domain, so nothing here waits for it.
    @Test
    void reply_writesAUserLineSynchronously() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();

        TeamChatLineEntity reply = service.reply(owner, thread.getId(), "  Rendben, ma korábban fekszem.  ");

        assertThat(reply.getKind()).isEqualTo("USER");
        assertThat(reply.getCharacter()).isNull();
        assertThat(reply.getBody()).isEqualTo("Rendben, ma korábban fekszem.");
        assertThat(reply.getThreadId()).isEqualTo(thread.getId());
        assertThat(lines.findById(reply.getId())).isPresent();
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

    // ---- Task 10 (mezo-a9bo7.23): the push budget — at most 2/day, the second only when its
    // ügy outranks every ügy already pushed today (AdvicePriority: load_fuel_mismatch outranks
    // sleep_debt). ----

    // (j) the lower-severity ügy opens first, the more severe one second — both fit the budget.
    @Test
    void open_lowerSeverityFirstThenMoreSevere_pushesBoth() {
        UUID owner = owner();
        Instant now = todayAt(10, 0);
        raiseSleepDebtLog(owner);
        raiseLoadFuelLog(owner, 7);

        TeamChatThreadEntity first = service.open(owner, FlagKey.SLEEP_DEBT, now).orElseThrow();
        TeamChatThreadEntity second = service.open(owner, FlagKey.LOAD_FUEL_MISMATCH, now).orElseThrow();

        assertThat(threads.findById(first.getId()).orElseThrow().getPushed()).isTrue();
        assertThat(threads.findById(second.getId()).orElseThrow().getPushed()).isTrue();
        assertThat(appNotifications.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
                .filteredOn(n -> AppNotificationKind.TEAM_CHAT.key().equals(n.getKind()))
                .hasSize(2)
                .allSatisfy(n -> assertThat(n.getDeeplink()).isEqualTo("/mezo/elo"));
    }

    // (k) reversed order: the more severe ügy opens first — the second, less severe one is silent.
    @Test
    void open_moreSevereFirstThenLowerSeverity_pushesOnlyTheFirst() {
        UUID owner = owner();
        Instant now = todayAt(10, 0);
        raiseSleepDebtLog(owner);
        raiseLoadFuelLog(owner, 7);

        TeamChatThreadEntity first = service.open(owner, FlagKey.LOAD_FUEL_MISMATCH, now).orElseThrow();
        TeamChatThreadEntity second = service.open(owner, FlagKey.SLEEP_DEBT, now).orElseThrow();

        assertThat(threads.findById(first.getId()).orElseThrow().getPushed()).isTrue();
        assertThat(threads.findById(second.getId()).orElseThrow().getPushed()).isFalse();
        assertThat(appNotifications.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
                .filteredOn(n -> AppNotificationKind.TEAM_CHAT.key().equals(n.getKind()))
                .singleElement()
                .satisfies(n -> {
                    assertThat(n.getRefId()).isEqualTo(first.getId());
                    assertThat(n.getDedupKey()).isEqualTo("team_chat:" + first.getId());
                    assertThat(n.getTitle()).isEqualTo("Mocor · Terhelés–táplálás");
                    assertThat(n.getDeeplink()).isEqualTo("/mezo/elo");
                });
    }

    // (l) a resolve never pushes, budget or not.
    @Test
    void resolve_neverPushes() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        service.open(owner, FlagKey.SLEEP_DEBT, todayAt(10, 0));

        service.resolve(owner, FlagKey.SLEEP_DEBT,
                new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null), todayAt(10, 5));

        assertThat(appNotifications.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
                .filteredOn(n -> AppNotificationKind.TEAM_CHAT.key().equals(n.getKind()))
                .hasSize(1); // only the OPEN's push — the RESOLVE wrote no second one.
    }

    // ---- Task 11 (mezo-a9bo7.23): the hourly catch-up sweep — a missed raise still opens its
    // ügy WITHOUT a push (the moment passed), a missed clear still resolves it, and a second run
    // changes nothing. ----

    /** A trace row this user's rule left behind — the resolve gate's input. */
    private CompanionFlagTraceEntity writeTrace(UUID owner, String flagKey, String outcome,
            FlagVerdict.ClearEvidence evidence, Instant occurredAt) {
        CompanionFlagTraceEntity trace = new CompanionFlagTraceEntity();
        trace.setCreatedBy(owner);
        trace.setFlagKey(flagKey);
        trace.setOutcome(outcome);
        trace.setEvidence(evidence);
        trace.setOccurredAt(occurredAt);
        return flagTraces.saveAndFlush(trace);
    }

    // (m) a raise with no thread at all → catch-up opens it, unpushed, no app notification.
    @Test
    void catchUp_opensAMissedRaise_withoutAPush() {
        UUID owner = owner();
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                        7.5, 7, 7, 5.0, 6.5, Map.of())),
                Instant.now().minus(1, ChronoUnit.HOURS));

        service.catchUp(Instant.now());

        TeamChatThreadEntity thread = threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(
                owner, FlagKey.SLEEP_DEBT, "OPEN").orElseThrow();
        assertThat(thread.getPushed()).isFalse();
        assertThat(appNotifications.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
                .filteredOn(n -> AppNotificationKind.TEAM_CHAT.key().equals(n.getKind()))
                .isEmpty();
        assertThat(linesOf(owner)).hasSize(1);
    }

    // (n) a raise older than the 2 h lookback is left alone (final review M6 — a day-long window
    // would re-open, right after the deploy, raises that already got the retired advice card).
    @Test
    void catchUp_ignoresARaiseOlderThanTheLookback() {
        UUID owner = owner();
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                        7.5, 7, 7, 5.0, 6.5, Map.of())),
                Instant.now().minus(3, ChronoUnit.HOURS));

        service.catchUp(Instant.now());

        assertThat(threadsOf(owner)).isEmpty();
    }

    // (o) all_healthy never opens, even through the sweep.
    @Test
    void catchUp_skipsAllHealthyRaises() {
        UUID owner = owner();
        flagLogPopulator.raiseAt(owner, FlagKey.ALL_HEALTHY, FlagKey.SOURCE_WRITE, null,
                Instant.now().minus(1, ChronoUnit.HOURS));

        service.catchUp(Instant.now());

        assertThat(threadsOf(owner)).isEmpty();
    }

    // (p) a raise the listener already handled (a thread already opened at/after it) is left alone.
    @Test
    void catchUp_leavesAnAlreadyOpenedRaiseAlone() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity opened = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();

        service.catchUp(Instant.now());

        assertThat(threadsOf(owner)).singleElement()
                .satisfies(t -> assertThat(t.getId()).isEqualTo(opened.getId()));
    }

    // (q) an OPEN ügy whose rule's latest trace is clear gets resolved by the sweep.
    @Test
    void catchUp_resolvesAnOpenThreadWhoseLatestTraceIsClear() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT,
                Instant.now().minus(5, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MICROS), false).orElseThrow();
        FlagVerdict.ClearEvidence evidence = new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null);
        // Distinct from the catch-up run time below, so the assertion actually pins the backdate
        // (the chip reads "RENDEZŐDÖTT · hh:mm" — it must say when the flag really cleared).
        Instant clearedAt = Instant.now().minus(3, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MICROS);
        writeTrace(owner, FlagKey.SLEEP_DEBT, "clear", evidence, clearedAt);

        service.catchUp(Instant.now());

        TeamChatThreadEntity reread = threads.findById(thread.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo("RESOLVED");
        assertThat(reread.getClosedAt()).isEqualTo(clearedAt);
        assertThat(linesOf(thread)).extracting(TeamChatLineEntity::getKind).contains("RESOLVE");
    }

    // (r) an OPEN ügy whose latest trace is still raised is left OPEN.
    @Test
    void catchUp_leavesAnOpenThreadAloneWhenTheLatestTraceIsNotClear() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, Instant.now()).orElseThrow();
        writeTrace(owner, FlagKey.SLEEP_DEBT, "raised", null, Instant.now());

        service.catchUp(Instant.now());

        assertThat(threads.findById(thread.getId()).orElseThrow().getStatus()).isEqualTo("OPEN");
    }

    // (s) idempotent: running the sweep twice changes nothing further.
    @Test
    void catchUp_runningTwiceChangesNothing() {
        UUID owner = owner();
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                        7.5, 7, 7, 5.0, 6.5, Map.of())),
                Instant.now().minus(1, ChronoUnit.HOURS));

        service.catchUp(Instant.now());
        TeamChatThreadEntity thread = threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(
                owner, FlagKey.SLEEP_DEBT, "OPEN").orElseThrow();
        writeTrace(owner, FlagKey.SLEEP_DEBT, "clear",
                new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null), Instant.now());
        service.catchUp(Instant.now());
        int linesAfterFirstResolve = linesOf(owner).size();
        int threadsAfterFirstResolve = threadsOf(owner).size();

        service.catchUp(Instant.now());

        assertThat(threads.findById(thread.getId()).orElseThrow().getStatus()).isEqualTo("RESOLVED");
        assertThat(threadsOf(owner)).hasSize(threadsAfterFirstResolve);
        assertThat(linesOf(owner)).hasSize(linesAfterFirstResolve);
    }

    // (q') final review M1: a clear trace OLDER than the ügy's own open (a stale clear the raise
    // has not yet overwritten) never backdates the close before the open.
    @Test
    void catchUp_neverBackdatesAResolveBeforeTheThreadOpened() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        Instant openedAt = Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MICROS);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, openedAt, false).orElseThrow();
        writeTrace(owner, FlagKey.SLEEP_DEBT, "clear", new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null),
                Instant.now().minus(3, ChronoUnit.HOURS));

        service.catchUp(Instant.now());

        TeamChatThreadEntity reread = threads.findById(thread.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo("RESOLVED");
        assertThat(reread.getClosedAt()).isEqualTo(openedAt);
    }

    @Test
    void overnightRaise_waitsUntilMorning_thenOpensOnceWithMorningTimestampAndPush() {
        UUID owner = owner();
        LocalDate day = LocalDate.now(properties.zone());
        Instant night = day.atTime(0, 5).atZone(properties.zone()).toInstant();
        Instant beforeMorning = day.atTime(6, 20).atZone(properties.zone()).toInstant();
        Instant morning = day.atTime(7, 20).atZone(properties.zone()).toInstant();
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                        7.5, 7, 7, 5.0, 6.5, Map.of())), night);
        writeTrace(owner, FlagKey.SLEEP_DEBT, "raised", null, night);

        assertThat(service.open(owner, FlagKey.SLEEP_DEBT, night)).isEmpty();
        service.catchUp(beforeMorning);
        assertThat(threadsOf(owner)).isEmpty();

        service.catchUp(morning);
        TeamChatThreadEntity opened = threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(
                owner, FlagKey.SLEEP_DEBT, "OPEN").orElseThrow();
        assertThat(opened.getOpenedAt()).isEqualTo(morning);
        assertThat(opened.getPushed()).isTrue();
        assertThat(teamChatPushes(owner)).hasSize(1);

        service.catchUp(morning.plus(1, ChronoUnit.HOURS));
        assertThat(threadsOf(owner)).hasSize(1);
        assertThat(teamChatPushes(owner)).hasSize(1);
    }

    @Test
    void overnightRaise_doesNotPublishWhenFlagClearedBeforeMorning() {
        UUID owner = owner();
        LocalDate day = LocalDate.now(properties.zone());
        Instant night = day.atTime(0, 5).atZone(properties.zone()).toInstant();
        Instant morning = day.atTime(7, 0).atZone(properties.zone()).toInstant();
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                        7.5, 7, 7, 5.0, 6.5, Map.of())), night);
        writeTrace(owner, FlagKey.SLEEP_DEBT, "raised", null, night);
        writeTrace(owner, FlagKey.SLEEP_DEBT, "clear",
                new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null), night.plus(1, ChronoUnit.HOURS));

        service.catchUp(morning);

        assertThat(threadsOf(owner)).isEmpty();
        assertThat(teamChatPushes(owner)).isEmpty();
    }

    @Test
    void overnightRaise_isRecoveredAfterRestartEvenWhenHourlyTraceStillRaised() {
        UUID owner = owner();
        LocalDate day = LocalDate.now(properties.zone());
        Instant night = day.atTime(0, 5).atZone(properties.zone()).toInstant();
        Instant afterRestart = day.atTime(8, 20).atZone(properties.zone()).toInstant();
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                        7.5, 7, 7, 5.0, 6.5, Map.of())), night);
        writeTrace(owner, FlagKey.SLEEP_DEBT, "raised", null, night);
        writeTrace(owner, FlagKey.SLEEP_DEBT, "raised", null, day.atTime(8, 5)
                .atZone(properties.zone()).toInstant());

        service.catchUp(afterRestart);

        assertThat(threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(
                owner, FlagKey.SLEEP_DEBT, "OPEN")).isPresent();
    }

    // ---- final review C1 (mezo-a9bo7.25, spec D3): quiet hours 22:00–07:00. ----

    // An open in the evening part of the window stays silent AND leaves the day's budget alone: a
    // later, lower-severity open on the same local day still pushes as the day's first.
    @Test
    void eveningQuietOpen_staysSilent_andDoesNotConsumeTheDaysBudget() {
        UUID owner = owner();
        raiseLoadFuelLog(owner, 7);
        raiseSleepDebtLog(owner);

        assertThat(service.open(owner, FlagKey.LOAD_FUEL_MISMATCH, todayAt(22, 0))).isEmpty();
        assertThat(teamChatPushes(owner)).isEmpty();

        // SLEEP_DEBT does NOT outrank LOAD_FUEL_MISMATCH — it only pushes if the silent evening
        // open consumed nothing.
        TeamChatThreadEntity morning = service.open(owner, FlagKey.SLEEP_DEBT, todayAt(9, 0)).orElseThrow();

        assertThat(threads.findById(morning.getId()).orElseThrow().getPushed()).isTrue();
        assertThat(teamChatPushes(owner)).singleElement()
                .satisfies(n -> assertThat(n.getRefId()).isEqualTo(morning.getId()));
    }

    // An after-midnight raise waits until morning; the morning thread and its push use that time.
    @Test
    void afterMidnightQuietOpen_waitsUntilMorning_andItsAnchorIsAfterTheQuietEnd() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        Instant night = todayAt(3, 0);

        assertThat(service.open(owner, FlagKey.SLEEP_DEBT, night)).isEmpty();
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, todayAt(7, 0)).orElseThrow();

        assertThat(threads.findById(thread.getId()).orElseThrow().getPushed()).isTrue();
        AppNotificationEntity push = teamChatPushes(owner).getFirst();
        push.setOccurredAt(todayAt(7, 0));
        appNotifications.saveAndFlush(push);

        AnchorSet anchors = anchorResolver.resolve(owner, LocalDate.now(properties.zone()));

        assertThat(anchors.backendAnchors())
                .filteredOn(a -> a.category() == NotificationCategory.INTERVENTION && a.url().startsWith("/mezo/elo"))
                .singleElement()
                .satisfies(a -> assertThat(a.minuteOfDay()).isGreaterThanOrEqualTo(7 * 60));
    }

    // ---- final review I3: a feed-channel library entry never pushes. ----

    @Test
    void feedChannelEntry_opensTheUgy_butNeverPushes() {
        UUID owner = owner();
        // protocol_lapse's only library entry (protocol_lapse_resume) is channel: feed.
        TeamChatThreadEntity thread = service.open(owner, FlagKey.PROTOCOL_LAPSE, todayAt(10, 0)).orElseThrow();

        assertThat(thread.getAdviceKey()).isEqualTo("protocol_lapse_resume");
        assertThat(threads.findById(thread.getId()).orElseThrow().getPushed()).isFalse();
        assertThat(teamChatPushes(owner)).isEmpty();
    }

    // ---- final review I2: parallel raises from one evaluation never beat the push budget. ----

    @Test
    void parallelOpens_neverExceedThePushPolicy() throws Exception {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        raiseLoadFuelLog(owner, 7);
        Instant at = todayAt(10, 0);
        List<String> flags = List.of(FlagKey.LATE_EATING, FlagKey.SLEEP_DEBT, FlagKey.LOAD_FUEL_MISMATCH);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(flags.size());
        try {
            List<Future<Optional<TeamChatThreadEntity>>> futures = flags.stream()
                    .map(flag -> pool.submit(() -> {
                        start.await();
                        return service.open(owner, flag, at);
                    }))
                    .toList();
            start.countDown();
            for (Future<Optional<TeamChatThreadEntity>> f : futures) {
                assertThat(f.get(30, SECONDS)).isPresent();
            }
        } finally {
            pool.shutdownNow();
        }

        // Order-free (drain-debug follow-up): the emit now runs AFTER the reservation committed, so
        // the notifications' occurredAt no longer mirrors the decision order. Assert on the
        // reservations (the pushed ügyek) instead.
        List<TeamChatThreadEntity> pushedThreads = threadsOf(owner).stream().filter(TeamChatThreadEntity::getPushed)
                .toList();
        assertThat(pushedThreads).hasSizeBetween(1, properties.maxPushesPerDay());
        assertThat(teamChatPushes(owner)).extracting(AppNotificationEntity::getRefId)
                .containsExactlyInAnyOrderElementsOf(pushedThreads.stream().map(TeamChatThreadEntity::getId).toList());
        if (pushedThreads.size() == 2) {
            // Serialized decisions: one of the two must strictly outrank the other (it was the second
            // decision) — never two peers that both slipped through a race.
            String a = pushedThreads.get(0).getFlagKey();
            String b = pushedThreads.get(1).getFlagKey();
            assertThat(AdvicePriority.outranks(a, b) || AdvicePriority.outranks(b, a)).isTrue();
        }
    }

    // Drain-debug follow-up (mezo-a9bo7.25): the push decision runs after open's model call; a clear
    // that resolved the ügy in between must never page the user.
    @Test
    void anUgyResolvedBeforeThePushDecision_isNeverPushed() {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread =
                service.open(owner, FlagKey.SLEEP_DEBT, todayAt(10, 0), false).orElseThrow();
        service.resolve(owner, FlagKey.SLEEP_DEBT,
                new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null), todayAt(10, 1));

        service.decidePush(thread.getId(), "sor", true, false);

        assertThat(teamChatPushes(owner)).isEmpty();
        assertThat(threads.findById(thread.getId()).orElseThrow().getPushed()).isNotEqualTo(Boolean.TRUE);
    }

    // S7 Task 7 fold-in (mezo-d6ivw.7): closeThread row-locks the OPEN ügy and re-checks it — a
    // clear racing a reply-close must not overwrite closeReason/closeNote or add a RESOLVE line.
    @Test
    void resolve_racingAReplyClose_neverRecloses_theUgyAsData() throws Exception {
        UUID owner = owner();
        raiseSleepDebtLog(owner);
        TeamChatThreadEntity thread = service.open(owner, FlagKey.SLEEP_DEBT, todayAt(10, 0), false).orElseThrow();
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            // A reply-close holding the ügy's row lock (TeamChatReplyService.commit's shape).
            Future<?> replyClose = pool.submit(() -> tx.executeWithoutResult(s -> {
                TeamChatThreadEntity row = threads.lockOwned(thread.getId(), owner).orElseThrow();
                row.setStatus("RESOLVED");
                row.setCloseReason("REPLY");
                row.setCloseNote("meccsnap");
                row.setClosedAt(Instant.now());
                threads.saveAndFlush(row);
                locked.countDown();
                try {
                    release.await(10, SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(locked.await(10, SECONDS)).isTrue();
            Future<Optional<TeamChatLineEntity>> resolve = pool.submit(() -> service.resolve(owner,
                    FlagKey.SLEEP_DEBT, new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null),
                    todayAt(10, 5)));
            Thread.sleep(500); // let the resolve reach (and block on) the row
            release.countDown();
            replyClose.get(10, SECONDS);

            assertThat(resolve.get(10, SECONDS)).isEmpty();
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
        TeamChatThreadEntity reread = threads.findById(thread.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo("RESOLVED");
        assertThat(reread.getCloseReason()).isEqualTo("REPLY");
        assertThat(reread.getCloseNote()).isEqualTo("meccsnap");
        assertThat(lines.findByThreadIdAndDeletedFalse(thread.getId()))
                .noneMatch(l -> "RESOLVE".equals(l.getKind()));
    }
}
