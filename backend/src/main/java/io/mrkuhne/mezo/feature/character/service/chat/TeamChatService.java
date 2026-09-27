package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceCopy;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict.ClearEvidence;
import io.mrkuhne.mezo.feature.proactive.service.AdviceActionCatalog;
import io.mrkuhne.mezo.feature.proactive.service.AdviceApplyService;
import io.mrkuhne.mezo.feature.proactive.service.AdvicePick;
import io.mrkuhne.mezo.feature.proactive.service.InterventionService;
import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * The all-day team chat engine (Csapatfal Act III, mezo-a9bo7.21, spec 2026-09-26 §5): a raised
 * coaching rule opens an "ügy" owned by the rule's character ({@link TeamChatCast}), its clear
 * resolves it, seven days open expires it. The chat speaks ONLY on a teendő and its resolution —
 * nothing else in this class writes a character line.
 *
 * <p><b>Voice:</b> {@link #voice} delegates to the guarded {@link TeamChatVoiceWriter} (E2, mezo-a9bo7.22):
 * one LLM call writes the owner's line, the cross-talk guest's line and — only on an open whose
 * frozen payload shows a coverage gap — a Szkeptikus line. Any failure falls back to the honest
 * template text (the library {@code textHu} on open, the {@link FlagTraceCopy} sentence on resolve)
 * with {@code voiced=false} and no company.
 *
 * <p><b>Safety cap:</b> at most {@code daily-line-cap} character lines per user per local day
 * (every kind but REPLY, which has its own {@code reply-daily-cap}). At the cap {@link #open} writes nothing and warns; {@link #resolve} still closes
 * the ügy as RESOLVED but drops its RESOLVE line.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatService {

    static final String STATUS_OPEN = "OPEN";
    static final String STATUS_RESOLVED = "RESOLVED";
    static final String STATUS_EXPIRED = "EXPIRED";

    /** S7 (mezo-d6ivw.7): why a RESOLVED ügy closed. */
    static final String CLOSE_DATA = "DATA";
    static final String CLOSE_REPLY = "REPLY";
    static final String CLOSE_EXCUSED = "EXCUSED";

    /** S7: the offer riding a RESOLVED ügy — a known-exception question, or a capped re-check. */
    static final String OFFER_EXCUSE = "EXCUSE";
    static final String OFFER_REVIEW = "REVIEW";

    static final String KIND_OPEN = "OPEN";
    static final String KIND_GUEST = "GUEST";
    static final String KIND_RESOLVE = "RESOLVE";
    static final String KIND_SKEPTIC = "SKEPTIC";
    static final String KIND_USER = "USER";
    /** S7: the owner character's answer to the user's USER line(s) ({@link TeamChatReplyService});
     *  counted against its own {@code reply-daily-cap}, never the shared {@code daily-line-cap}. */
    static final String KIND_REPLY = "REPLY";

    static final int REPLY_MAX_CHARS = 1000;

    /** Task 10 (mezo-a9bo7.23): the push body's cap — an SMS-length excerpt of the OPEN line. */
    static final int PUSH_BODY_MAX_CHARS = 140;

    private final TeamChatThreadRepository threads;
    private final TeamChatLineRepository lines;
    private final TeamChatProperties properties;
    private final InterventionService interventionService;
    private final AdviceActionCatalog actionCatalog;
    private final AdviceApplyService adviceApplyService;
    private final TeamChatVoiceWriter voiceWriter;
    private final AppNotificationEmitter appNotifications;
    private final CompanionFlagLogRepository flagLogs;
    private final CompanionFlagTraceRepository flagTraces;
    private final UserFanOut userFanOut;
    private final NotificationProperties notificationProperties;
    private final ObjectProvider<TeamChatService> self;
    private final ApplicationEventPublisher events;
    /** S7 (mezo-d6ivw.7): the known-exception gate at open — a provider, since the exception
     *  service writes its answer lines through this class. */
    private final ObjectProvider<TeamChatExceptionService> exceptionGate;

    /** Task 11 (mezo-a9bo7.23): the catch-up sweep's lookback — how far back a missed raise still
     *  gets picked up. Final review M6 (mezo-a9bo7.25): 2 h, not 24 — the sweep runs hourly, so two
     *  hours covers a missed run with margin, while a day-long window would re-open, on the first
     *  run after the deploy, every pre-deploy raise that already got the retired advice card. */
    static final long CATCH_UP_LOOKBACK_HOURS = 2;

    /** What {@link #openThread} hands the push step: the committed ügy, its OPEN line's body (the
     *  push excerpt) and the picked library entry's push gates (final review I3). */
    record Opened(TeamChatThreadEntity thread, String ownerBody, boolean pushAllowed, boolean quietHoursExempt) {
    }

    /** A raise opens an ügy — a no-op when the rule has no owner (e.g. {@code all_healthy}), an ügy
     *  for it is already open, the day's line cap is reached, or the library has no eligible entry.
     *  Pushes on open (Task 10) — see the {@code allowPush} overload for the catch-up path.
     *
     *  <p>Final review I2 (mezo-a9bo7.25): deliberately NOT {@code @Transactional} — the ügy and its
     *  lines commit first ({@link #openThread}), and only then does {@link #decidePush} run in a
     *  second, short transaction (under the per-user budget lock). So a push can never outlive a
     *  rolled-back ügy, parallel raises serialize on the lock and always see each other's committed
     *  pushes, and no thread ever holds two pooled connections while it waits for the lock (the
     *  afterCommit variant did, and exhausted the pool). Callers must not wrap this in a transaction
     *  of their own: the push step would not see the uncommitted ügy (the async
     *  {@link TeamChatEventListener} never does). */
    public Optional<TeamChatThreadEntity> open(UUID userId, String flagKey, Instant at) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            // mezo-a9bo7.27: the push step runs in its own transaction and cannot see this caller's
            // uncommitted ügy — it would silently skip the push. Say so instead of staying quiet.
            log.warn("Team chat open for user {} flag {} called inside a transaction — the push is skipped",
                    userId, flagKey);
        }
        Optional<Opened> opened = openThread(userId, flagKey, at);
        opened.ifPresent(o -> {
            try {
                self.getObject().decidePush(o.thread().getId(), o.ownerBody(), o.pushAllowed(),
                        o.quietHoursExempt());
            } catch (Exception e) {
                log.warn("Team chat push decision failed for ügy {}", o.thread().getId(), e);
            }
        });
        return opened.map(Opened::thread);
    }

    /** Task 11 (mezo-a9bo7.23): {@code allowPush=false} lets the hourly catch-up sweep open an ügy
     *  for a raise the async listener missed WITHOUT paging the user — the moment for a push has
     *  already passed. Joins the caller's transaction when there is one (the sweep's per-user one). */
    public Optional<TeamChatThreadEntity> open(UUID userId, String flagKey, Instant at, boolean allowPush) {
        if (allowPush) {
            return open(userId, flagKey, at);
        }
        return openThread(userId, flagKey, at).map(Opened::thread);
    }

    /** What {@link #claimThread} hands the voice step: the committed ügy plus everything its lines
     *  are written from. */
    record Claim(TeamChatThreadEntity thread, AdvicePick picked, List<String> facts, boolean skepticEligible,
            String templateOverride, boolean silent) {
    }

    /**
     * The ügy + its lines, without any push decision — see {@link #open}. Three steps, and the
     * middle one deliberately OUTSIDE any transaction (drain-debug, mezo-a9bo7.25): the voice call is
     * a multi-second model round-trip, and a transaction open across it pins one pooled connection
     * per raised flag for the whole call — with parallel raises (plus the LLM-log writer, plus any
     * request) that starved the pool: a thread dump showed every connection held by a listener
     * blocked on the provider's HTTP response while the rest queued on {@code getConnection}.
     * <ol>
     *   <li>{@link #claimThread} (short tx): the guards, the library pick and the ügy row, committed —
     *       the claim a second raise of the same rule sees;</li>
     *   <li>{@link #voice} (no tx): the guarded LLM call, never throws;</li>
     *   <li>{@link #writeOpenLines} (short tx): the OPEN line and its company.</li>
     * </ol>
     * When the caller already runs a transaction (the catch-up sweep's per-user one) all three
     * simply join it.
     */
    Optional<Opened> openThread(UUID userId, String flagKey, Instant at) {
        Optional<Claim> claim = self.getObject().claimThread(userId, flagKey, at);
        if (claim.isEmpty()) {
            return Optional.empty();
        }
        Claim c = claim.get();
        String template = c.templateOverride() != null ? c.templateOverride() : c.picked().textHu();
        TeamChatLines voiced = voice(c.thread(), KIND_OPEN, c.facts(), template, c.skepticEligible());
        self.getObject().writeOpenLines(c.thread(), voiced, c.facts(), at);
        log.info("Team chat ügy {} opened for user {} flag {} by {}", c.thread().getId(), userId, flagKey,
                c.thread().getOwnerCharacter());
        // S7: a known-exception question (EXCUSE / REVIEW) never pages the user.
        return Optional.of(new Opened(c.thread(), voiced.ownerBody(), !c.silent() && c.picked().pushAllowed(),
                c.picked().quietHoursExempt()));
    }

    /** Step 1 of {@link #openThread}: the guards, the pick and the committed ügy row. */
    @Transactional
    Optional<Claim> claimThread(UUID userId, String flagKey, Instant at) {
        Optional<TeamCharacter> owner = TeamChatCast.ownerOf(flagKey);
        if (owner.isEmpty()) {
            return Optional.empty();
        }
        if (threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(userId, flagKey, STATUS_OPEN).isPresent()) {
            return Optional.empty();
        }
        // S7 (mezo-d6ivw.7): a remembered exception — a silent hit, a one-tap question or a review.
        TeamChatExceptionService gateService = exceptionGate.getIfAvailable();
        TeamChatExceptionService.Gate gate = gateService == null
                ? TeamChatExceptionService.Gate.none() : gateService.gate(userId, flagKey, at);
        if (gate.kind() == TeamChatExceptionService.Gate.Kind.SKIP) {
            log.info("Team chat {} for user {} skipped — known exception '{}' named today", flagKey, userId,
                    gate.exception().getContextTag());
            return Optional.empty();
        }
        if (gateService != null
                && threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(userId, flagKey, STATUS_OPEN)
                        .isPresent()) {
            // Re-checked after the gate: when it waited on the exception lock, a concurrent open or a
            // remembered-chip undo may have committed an OPEN ügy of this rule meanwhile.
            return Optional.empty();
        }
        if (capReached(userId, at)) {
            log.warn("Team chat daily line cap reached for user {} — open of {} dropped", userId, flagKey);
            return Optional.empty();
        }
        Optional<AdvicePick> pick = interventionService.pick(userId, flagKey,
                (entryKey, since) -> threads.existsByCreatedByAndAdviceKeyAndOpenedAtGreaterThanEqualAndDeletedFalse(
                        userId, entryKey, since));
        if (pick.isEmpty()) {
            return Optional.empty();
        }
        AdvicePick picked = pick.get();

        TeamChatThreadEntity draft = new TeamChatThreadEntity();
        draft.setCreatedBy(userId);
        draft.setFlagKey(flagKey);
        draft.setOwnerCharacter(owner.get().key());
        draft.setGuestCharacter(TeamChatCast.guestOf(flagKey).map(TeamCharacter::key).orElse(null));
        draft.setAdviceKey(picked.entryKey());
        draft.setStatus(STATUS_OPEN);
        draft.setOpenedAt(at);
        draft.setActions(new TeamChatActionsEnvelope(actionCatalog.forCard(userId, flagKey).stream()
                .map(a -> new TeamChatActionsEnvelope.Action(a.key(), a.label(), a.params()))
                .toList()));
        boolean offer = gate.kind() == TeamChatExceptionService.Gate.Kind.EXCUSE
                || gate.kind() == TeamChatExceptionService.Gate.Kind.REVIEW;
        String templateOverride = null;
        if (offer) {
            draft.setOffer(gate.kind() == TeamChatExceptionService.Gate.Kind.REVIEW ? OFFER_REVIEW : OFFER_EXCUSE);
            draft.setExceptionId(gate.exception().getId());
            templateOverride = TeamChatExceptionService.template(gate);
        }
        TeamChatThreadEntity thread = threads.saveAndFlush(draft);

        // The Szkeptikus speaks only on an honest coverage gap in the raise's own frozen payload;
        // the gap sentence joins the facts so the guard lets its numbers through.
        Optional<String> gap = TeamChatVoiceWriter.skepticGap(flagKey, picked.payload());
        List<String> facts = gap.map(g -> Stream.concat(picked.facts().stream(), Stream.of(g)).toList())
                .orElse(picked.facts());
        if (gate.kind() == TeamChatExceptionService.Gate.Kind.REVIEW) {
            // The review sentence carries its hit count — as a fact, so the voice guard lets it through.
            facts = Stream.concat(facts.stream(), Stream.of(templateOverride)).toList();
        }
        return Optional.of(new Claim(thread, picked, facts, gap.isPresent(), templateOverride, offer));
    }

    /** Step 3 of {@link #openThread}: the OPEN line (always — the cap was checked at the claim) and
     *  the optional guest / Szkeptikus lines. */
    @Transactional
    void writeOpenLines(TeamChatThreadEntity thread, TeamChatLines voiced, List<String> facts, Instant at) {
        writeLine(thread, KIND_OPEN, thread.getOwnerCharacter(), voiced.ownerBody(), voiced.voiced(), facts, at);
        writeGuestLine(thread, voiced, facts, at);
        voiced.skepticBody().ifPresent(body -> writeOptionalLine(thread, KIND_SKEPTIC,
                TeamCharacter.SZKEPTIKUS.key(), body, voiced.voiced(), facts, at));
    }

    /** A clear resolves the open ügy with the owner's RESOLVE line — nothing when none is open.
     *  Same three-step shape as {@link #openThread} (drain-debug, mezo-a9bo7.25): the status flip
     *  commits first ({@link #closeThread}), the voice call runs with no transaction open, and the
     *  lines commit in a second short one ({@link #writeResolveLines}). Joins the caller's
     *  transaction when there is one (the catch-up sweep). */
    public Optional<TeamChatLineEntity> resolve(UUID userId, String flagKey, ClearEvidence evidence, Instant at) {
        Optional<TeamChatThreadEntity> closed = self.getObject().closeThread(userId, flagKey, at);
        if (closed.isEmpty()) {
            return Optional.empty();
        }
        TeamChatThreadEntity thread = closed.get();
        List<String> facts = FlagTraceCopy.clearFacts(evidence);
        // Never a Szkeptikus on a resolution (spec §5.4); a guest only when the ügy had one.
        TeamChatLines voiced = voice(thread, KIND_RESOLVE, facts, FlagTraceCopy.clearText(evidence), false);
        TeamChatLineEntity line = self.getObject().writeResolveLines(thread, voiced, facts, at);
        log.info("Team chat ügy {} resolved for user {} flag {}", thread.getId(), userId, flagKey);
        return Optional.of(line);
    }

    /** Step 1 of {@link #resolve}: flips the open ügy to RESOLVED — empty when none is open, or when
     *  the day's line cap leaves no room for its RESOLVE line (the ügy is still closed then: a
     *  cleared rule must not linger as OPEN until it expires). */
    @Transactional
    Optional<TeamChatThreadEntity> closeThread(UUID userId, String flagKey, Instant at) {
        // S7 (mezo-d6ivw.7): row-locked — a reply-close or a one-tap answer holding the lock wins,
        // and this clear then finds no OPEN ügy instead of overwriting its close reason.
        Optional<TeamChatThreadEntity> open = threads.lockOpenByFlag(userId, flagKey);
        if (open.isEmpty() || !STATUS_OPEN.equals(open.get().getStatus())) {
            return Optional.empty();
        }
        TeamChatThreadEntity thread = open.get();
        thread.setStatus(STATUS_RESOLVED);
        thread.setClosedAt(at);
        thread.setCloseReason(CLOSE_DATA);
        TeamChatThreadEntity saved = threads.saveAndFlush(thread);
        if (capReached(userId, at)) {
            log.warn("Team chat daily line cap reached for user {} — RESOLVE line of {} dropped", userId, flagKey);
            return Optional.empty();
        }
        return Optional.of(saved);
    }

    /** Step 3 of {@link #resolve}: the RESOLVE line and, when voiced, the guest's. */
    @Transactional
    TeamChatLineEntity writeResolveLines(TeamChatThreadEntity thread, TeamChatLines voiced, List<String> facts,
            Instant at) {
        TeamChatLineEntity line = writeLine(thread, KIND_RESOLVE, thread.getOwnerCharacter(),
                voiced.ownerBody(), voiced.voiced(), facts, at);
        writeGuestLine(thread, voiced, facts, at);
        return line;
    }

    /** OPEN ügyek opened before {@code now − expireAfterDays} become EXPIRED; returns how many. */
    @Transactional
    public int expire(Instant now) {
        Instant before = now.minus(properties.expireAfterDays(), ChronoUnit.DAYS);
        List<TeamChatThreadEntity> stale = threads.findByStatusAndOpenedAtBeforeAndDeletedFalse(STATUS_OPEN, before);
        for (TeamChatThreadEntity thread : stale) {
            thread.setStatus(STATUS_EXPIRED);
            thread.setClosedAt(now);
        }
        threads.saveAllAndFlush(stale);
        return stale.size();
    }

    /** Task 11 (mezo-a9bo7.23): the hourly catch-up sweep — a safety net for a raise/clear the
     *  {@link TeamChatEventListener} missed (e.g. an app restart mid-flight). Per active user
     *  ({@link UserFanOut#forEachActiveUser}), each user runs in its OWN transaction via the
     *  self-injection idiom ({@code TeamEditionService}), so one user's failure never rolls back
     *  another's, and the fan-out's own try/catch keeps a failing user from aborting the sweep.
     *  Idempotent: a second run changes nothing. Never {@code @Transactional} itself — the
     *  self-call must go through the proxy. */
    public void catchUp(Instant now) {
        userFanOut.forEachActiveUser("Team chat catch-up", user -> self.getObject().catchUpUser(user.getId(), now));
    }

    @Transactional
    void catchUpUser(UUID userId, Instant now) {
        // Resolves BEFORE opens — a lock-order rule (S7, mezo-d6ivw.7): an open's exception gate
        // takes the per-user exception advisory lock, held to the end of this transaction, while
        // TeamChatExceptionService.answer / TeamChatReplyService.commit take an ügy's row lock and
        // THEN that advisory lock. A resolve (closeThread's row lock) after an open would wait on a
        // row lock while holding the advisory lock — a deadlock cycle. Accepted cost: a raise and
        // its clear that both fall inside one sweep window leave the ügy OPEN until the next hourly
        // run resolves it.
        catchUpMissedResolves(userId);
        catchUpMissedOpens(userId, now);
    }

    /** Every raise in the last {@link #CATCH_UP_LOOKBACK_HOURS} hours with no thread opened at/after
     *  it for that flag opens one WITHOUT a push — the moment for paging the user already passed.
     *  {@code all_healthy} is skipped: it never has an owner, so {@link #open} already no-ops for it. */
    private void catchUpMissedOpens(UUID userId, Instant now) {
        Instant since = now.minus(CATCH_UP_LOOKBACK_HOURS, ChronoUnit.HOURS);
        List<CompanionFlagLogEntity> raises =
                flagLogs.findByCreatedByAndDeletedFalseAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(userId, since);
        for (CompanionFlagLogEntity raise : raises) {
            String flagKey = raise.getFlagKey();
            if (FlagKey.ALL_HEALTHY.equals(flagKey)) {
                continue;
            }
            if (threads.existsByCreatedByAndFlagKeyAndOpenedAtGreaterThanEqualAndDeletedFalse(
                    userId, flagKey, raise.getCreatedAt())) {
                continue; // the listener (or an earlier sweep) already opened this raise's ügy
            }
            open(userId, flagKey, raise.getCreatedAt(), false);
        }
    }

    /** Every OPEN ügy whose rule's latest trace row is a clear gets resolved with that row's
     *  evidence — the clear-event counterpart the listener may have missed. Backdated to the
     *  trace row's own {@code occurredAt} (the {@link #catchUpMissedOpens} precedent): the chip
     *  reads "RENDEZŐDÖTT · hh:mm" and must say when the flag actually cleared, not when the
     *  sweep happened to notice. */
    private void catchUpMissedResolves(UUID userId) {
        for (TeamChatThreadEntity thread : threads.findByCreatedByAndStatusAndDeletedFalseOrderByOpenedAtAsc(
                userId, STATUS_OPEN)) {
            flagTraces.findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(userId, thread.getFlagKey())
                    .filter(trace -> "clear".equals(trace.getOutcome()))
                    // Never before the ügy's own open (final review M1): the latest trace can be an
                    // older clear the raise that opened this ügy has not yet overwritten.
                    .ifPresent(trace -> resolve(userId, thread.getFlagKey(), trace.getEvidence(),
                            latest(trace.getOccurredAt(), thread.getOpenedAt())));
        }
    }

    /** The user's reply — a USER line on their own ügy, written synchronously; the owner answers
     *  asynchronously (S7, {@link TeamChatReplyService} via {@link TeamChatReplyListener}, after
     *  commit), and only that answer may close the ügy.
     *
     *  <p>Takes the ügy's row lock ({@code lockOwned}) — the same lock {@link TeamChatReplyService}'s
     *  commit holds — so USER lines and REPLY lines of one ügy are written strictly one after the
     *  other and their {@code occurredAt} order is their commit order. That is what lets the answer
     *  step tell "a USER line newer than the burst I answered" apart from "already answered". */
    @Transactional
    public TeamChatLineEntity reply(UUID userId, UUID threadId, String text) {
        String body = text == null ? "" : text.trim();
        if (body.isEmpty() || body.length() > REPLY_MAX_CHARS) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("CHARACTER_TEAM_CHAT_REPLY_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
        TeamChatThreadEntity thread = threads.lockOwned(threadId, userId).orElseThrow(TeamChatService::notFound);
        TeamChatLineEntity line = writeLine(thread, KIND_USER, null, body, false, List.of(), Instant.now());
        events.publishEvent(new TeamChatRepliedEvent(userId, threadId, line.getId()));
        return line;
    }

    /** Applies an offered action exactly once — the {@code AdviceApplyService.apply} contract on
     *  an ügy: not offered → 409, a different action already applied → 409, the same one again →
     *  idempotent no-op that never reaches the port. The row lock serializes concurrent taps. */
    @Transactional
    public TeamChatThreadEntity apply(UUID userId, UUID threadId, String actionKey) {
        TeamChatThreadEntity thread = threads.lockOwned(threadId, userId).orElseThrow(TeamChatService::notFound);
        TeamChatActionsEnvelope.Action offered = Optional.ofNullable(thread.getActions())
                .map(TeamChatActionsEnvelope::actions).orElse(List.of()).stream()
                .filter(a -> a.key().equals(actionKey))
                .findFirst()
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_TEAM_CHAT_ACTION_NOT_OFFERED").build(), HttpStatus.CONFLICT));

        TeamChatActionsEnvelope.Applied applied = thread.getApplied();
        if (applied != null) {
            if (applied.actionKey().equals(actionKey)) {
                log.info("Team chat action {} already applied to ügy {} for user {} — idempotent no-op",
                        actionKey, threadId, userId);
                return thread;
            }
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("CHARACTER_TEAM_CHAT_ACTION_CONFLICT").build(), HttpStatus.CONFLICT);
        }

        adviceApplyService.applyPort(userId, actionKey, offered.params());
        thread.setApplied(new TeamChatActionsEnvelope.Applied(actionKey, Instant.now().truncatedTo(ChronoUnit.MICROS)));
        TeamChatThreadEntity saved = threads.saveAndFlush(thread);
        log.info("Team chat action {} applied to ügy {} for user {}", actionKey, threadId, userId);
        return saved;
    }

    /** The voice seam — the guarded LLM writer, which falls back to the template itself. */
    TeamChatLines voice(TeamChatThreadEntity thread, String kind, List<String> facts, String templateText,
            boolean skepticEligible) {
        return voiceWriter.write(thread.getCreatedBy(), thread, kind, facts, templateText, skepticEligible);
    }

    /** The cross-talk guest's line — only on an ügy that has a guest, only when one was voiced. */
    private void writeGuestLine(TeamChatThreadEntity thread, TeamChatLines voiced, List<String> facts, Instant at) {
        if (thread.getGuestCharacter() != null) {
            voiced.guestBody().ifPresent(body -> writeOptionalLine(thread, KIND_GUEST,
                    thread.getGuestCharacter(), body, voiced.voiced(), facts, at));
        }
    }

    /** Task 10 (mezo-a9bo7.23) + final review C1/I2/I3 (mezo-a9bo7.25): whether a freshly opened
     *  ügy pages the user, decided in its OWN short transaction after the open committed
     *  ({@link #open}). Skips a
     *  {@code feed}-channel library entry (it never pushes, on any surface), an open inside the
     *  EVENING part of the quiet window (spec D3 — the line stays silent, the day's budget is not
     *  consumed; a {@code quietHoursExempt} entry is let through), then — under the per-user
     *  advisory lock that serializes parallel raises — applies the budget: at most
     *  {@code maxPushesPerDay} per local day, the second only when this ügy's flag key outranks
     *  every ügy already pushed today ({@link TeamChatPushPolicy}). An after-midnight open inside
     *  the window still pushes (it counts against that local day); the feed-anchored push path
     *  defers its ring to the quiet end. Never called from {@link #resolve} — a resolution never
     *  pushes.
     *
     *  <p>Drain-debug (mezo-a9bo7.25): the decision ({@link #reservePush}) and the emit are two
     *  steps. The emit ({@code AppNotificationService.emit}) is {@code REQUIRES_NEW} by contract —
     *  called inside the decision's transaction it asked the pool for a SECOND connection while the
     *  first one sat on the per-user advisory lock; a thread dump caught two such threads parked on
     *  {@code getConnection} with their lock-holding connections idle. Enough parallel raises (pool
     *  size of them) deadlock the pool outright until the connection timeout. So the budget slot is
     *  reserved and committed first, and the notification is emitted after, on one connection at a
     *  time. An emit failure after the reservation gives the slot back (mezo-a9bo7.27,
     *  {@link #releasePush}): a push that never rang must not eat the day's budget. */
    public void decidePush(UUID threadId, String ownerBody, boolean pushAllowed, boolean quietHoursExempt) {
        self.getObject().reservePush(threadId, ownerBody, pushAllowed, quietHoursExempt).ifPresent(p -> {
            boolean emitted = appNotifications.tryEmit(p.userId(), AppNotificationKind.TEAM_CHAT, p.title(),
                    p.body(), AppNotificationKind.TEAM_CHAT.deeplink(), p.threadId(), p.dedupKey());
            if (!emitted) {
                self.getObject().releasePush(p.threadId());
            }
        });
    }

    /** mezo-a9bo7.27: undo a {@link #reservePush} whose emit failed — the ügy counts as not pushed
     *  again, so its budget slot is free. A retry of the same ügy is still deduped by its key. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void releasePush(UUID threadId) {
        threads.setPushed(threadId, false);
        log.info("Team chat ügy {} push released — the emit failed", threadId);
    }

    /** A push the budget granted and {@link #reservePush} committed — emitted by {@link #decidePush}. */
    record ReservedPush(UUID userId, UUID threadId, String title, String body, String dedupKey) {
    }

    /** The gates and the budget of {@link #decidePush}, in its own short transaction under the
     *  per-user advisory lock; marks the ügy pushed and returns what to emit. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    Optional<ReservedPush> reservePush(UUID threadId, String ownerBody, boolean pushAllowed,
            boolean quietHoursExempt) {
        if (!pushAllowed) {
            log.info("Team chat ügy {} not pushed — a feed-only library entry or a silent exception offer", threadId);
            return Optional.empty();
        }
        Optional<TeamChatThreadEntity> found = threads.findById(threadId);
        if (found.isEmpty()) {
            return Optional.empty(); // soft-deleted meanwhile (the entity's @SQLRestriction hides it)
        }
        UUID userId = found.get().getCreatedBy();
        if (!quietHoursExempt && inEveningQuiet(found.get().getOpenedAt())) {
            log.info("Team chat ügy {} not pushed — opened in the evening quiet window", threadId);
            return Optional.empty();
        }
        threads.lockPushBudget(userId);
        // Re-read under the lock: a racing decision for the same ügy may already have pushed it, and
        // a clear may have resolved it while open's model call ran (the decision now follows the
        // committed lines, drain-debug mezo-a9bo7.25) — a resolved ügy never pages the user.
        // mezo-a9bo7.27: a scalar read, not findById — that would return the copy cached above.
        if (!threads.unpushedStatus(threadId).filter(STATUS_OPEN::equals).isPresent()) {
            return Optional.empty();
        }
        TeamChatThreadEntity thread = found.get();
        List<String> pushedToday = pushedTodayFlagKeys(userId, thread.getOpenedAt());
        if (!TeamChatPushPolicy.shouldPush(thread.getFlagKey(), pushedToday, properties.maxPushesPerDay())) {
            return Optional.empty();
        }
        Optional<TeamCharacter> owner = TeamChatCast.ownerOf(thread.getFlagKey());
        if (owner.isEmpty()) {
            return Optional.empty();
        }
        threads.setPushed(threadId, true);
        String title = owner.get().displayName() + " · " + FlagCatalog.labelOf(thread.getFlagKey());
        String dedupKey = "team_chat:" + thread.getId()
                + (quietHoursExempt ? AppNotificationKind.QUIET_HOURS_EXEMPT_SUFFIX : "");
        return Optional.of(new ReservedPush(userId, thread.getId(), title, pushExcerpt(ownerBody), dedupKey));
    }

    /** Spec D3 / final review C1: {@code at} falls in the part of the quiet window BEFORE local
     *  midnight ({@code mezo.notification.quiet-hours}, wrap-aware — the
     *  {@code AnchorResolver.interventionFireMinute} reading). Only a window that wraps midnight has
     *  such a part; a same-day window (or start == end, "no quiet hours") never blocks here — the
     *  feed-anchored push path defers those rings to the window's end instead. */
    boolean inEveningQuiet(Instant at) {
        LocalTime quietStart = LocalTime.parse(notificationProperties.quietHours().start());
        LocalTime quietEnd = LocalTime.parse(notificationProperties.quietHours().end());
        if (!quietStart.isAfter(quietEnd)) {
            return false;
        }
        return !at.atZone(properties.zone()).toLocalTime().isBefore(quietStart);
    }

    private static Instant latest(Instant a, Instant b) {
        return a.isAfter(b) ? a : b;
    }

    /** The flag keys of every ügy already pushed on {@code at}'s local day (the user's zone, the
     *  {@link #capReached} idiom). */
    private List<String> pushedTodayFlagKeys(UUID userId, Instant at) {
        LocalDate day = at.atZone(properties.zone()).toLocalDate();
        Instant from = day.atStartOfDay(properties.zone()).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(properties.zone()).toInstant().minusNanos(1000);
        return threads.findByCreatedByAndPushedTrueAndOpenedAtBetweenAndDeletedFalse(userId, from, to).stream()
                .map(TeamChatThreadEntity::getFlagKey)
                .toList();
    }

    /** The OPEN line's body, cut to {@link #PUSH_BODY_MAX_CHARS} with an ellipsis when trimmed. */
    private static String pushExcerpt(String body) {
        String trimmed = body == null ? "" : body.trim();
        if (trimmed.length() <= PUSH_BODY_MAX_CHARS) {
            return trimmed;
        }
        return trimmed.substring(0, PUSH_BODY_MAX_CHARS - 1).stripTrailing() + "…";
    }

    private boolean capReached(UUID userId, Instant at) {
        LocalDate day = at.atZone(properties.zone()).toLocalDate();
        Instant from = day.atStartOfDay(properties.zone()).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(properties.zone()).toInstant().minusNanos(1000);
        // S7: REPLY lines have their own cap (reply-daily-cap) and never eat this one.
        return lines.countByCreatedByAndCharacterIsNotNullAndKindNotAndOccurredAtBetweenAndDeletedFalse(
                userId, KIND_REPLY, from, to) >= properties.dailyLineCap();
    }

    /** A guest / skeptic line — dropped (with a warn) rather than breaking the cap. */
    private void writeOptionalLine(TeamChatThreadEntity thread, String kind, String character, String body,
            boolean voiced, List<String> facts, Instant at) {
        if (capReached(thread.getCreatedBy(), at)) {
            log.warn("Team chat daily line cap reached for user {} — {} line on ügy {} dropped",
                    thread.getCreatedBy(), kind, thread.getId());
            return;
        }
        writeLine(thread, kind, character, body, voiced, facts, at);
    }

    /** Package-private for {@link TeamChatReplyService} (S7) — joins the caller's transaction. */
    TeamChatLineEntity writeLine(TeamChatThreadEntity thread, String kind, String character, String body,
            boolean voiced, List<String> facts, Instant at) {
        TeamChatLineEntity line = new TeamChatLineEntity();
        line.setCreatedBy(thread.getCreatedBy());
        line.setThreadId(thread.getId());
        line.setKind(kind);
        line.setCharacter(character);
        line.setBody(body);
        line.setVoiced(voiced);
        line.setFacts(new EditionFactsEnvelope(facts));
        line.setOccurredAt(at);
        return lines.saveAndFlush(line);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("CHARACTER_TEAM_CHAT_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
