package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionHitEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionHitRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S7 (mezo-d6ivw.7): a remembered exception at work. When its rule fires again, {@link #gate}
 * decides — before any ügy row exists — whether the day's own texts already name the exception (a
 * silent hit, nothing opens), whether the occurrence after {@code exception-review-hits} hits
 * inside the window is due its one-time review question, or whether a no-push "ma is ez volt?"
 * question opens. {@link #answer} is that question's one-tap answer, {@link #undoRemembered} the
 * remembered chip's undo (a durable veto).
 *
 * <p><b>Locking:</b> every exception/hit write runs under
 * {@link TeamChatExceptionRepository#lockUserExceptions} — taken AFTER the ügy's row lock (answer,
 * undo) or, in {@link #gate}, with no ügy row locked at all — so the read-then-write of the
 * unique (exception, day) hit index can never fail the transaction.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatExceptionService {

    public static final String CHOICE_EXCUSED = "EXCUSED";
    public static final String CHOICE_KEEP = "KEEP";
    public static final String CHOICE_STOP = "STOP";

    static final String HIT_NOTES = "NOTES";
    static final String STOP_NOTE = "kivétel kikapcsolva";

    static final String BODY_EXCUSED = "Rendben, akkor ez most is kivétel volt.";
    static final String BODY_KEEP = "Rendben, akkor marad így — tovább figyelek.";
    static final String BODY_STOP = "Rendben, akkor újra szólok, ha előjön.";

    private final TeamChatExceptionRepository exceptions;
    private final TeamChatExceptionHitRepository hits;
    private final TeamChatThreadRepository threads;
    private final TeamChatLineRepository lines;
    private final TeamChatProperties properties;
    private final KnowledgeFactService knowledge;
    private final TeamChatService teamChat;
    /** The companion note port (check-in, activity, character replies); empty when none. */
    private final List<NarrativeNoteSource> noteSources;

    public record Gate(Kind kind, TeamChatExceptionEntity exception, long hits) {
        public enum Kind { NONE, SKIP, EXCUSE, REVIEW }

        public static Gate none() {
            return new Gate(Kind.NONE, null, 0);
        }
    }

    /**
     * Joins {@code claimThread}'s transaction. Order: review (cap reached, not yet reviewed this
     * window) → the day's texts name the context (silent NOTES hit) → already hit today (skip) →
     * the excuse question. The per-user exception lock is taken before any existence check, so two
     * concurrent opens can never both insert the day's hit.
     */
    @Transactional
    public Gate gate(UUID userId, String flagKey, Instant at) {
        if (exceptions.findByCreatedByAndFlagKeyAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(userId, flagKey)
                .isEmpty()) {
            return Gate.none(); // the common case: no lock taken
        }
        exceptions.lockUserExceptions(userId);
        List<TeamChatExceptionEntity> active =
                exceptions.findByCreatedByAndFlagKeyAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(userId, flagKey);
        if (active.isEmpty()) {
            return Gate.none();
        }
        LocalDate day = at.atZone(properties.zone()).toLocalDate();
        for (TeamChatExceptionEntity e : active) {
            long n = windowHits(e, day);
            if (n >= properties.exceptionReviewHits() && !reviewedThisWindow(userId, e)) {
                return new Gate(Gate.Kind.REVIEW, e, n);
            }
        }
        List<String> texts = dayTexts(userId, day);
        for (TeamChatExceptionEntity e : active) {
            if (TeamChatExceptionMatcher.matches(e.getKeywords().keywords(), texts)) {
                if (!hits.existsByExceptionIdAndHitOnAndDeletedFalse(e.getId(), day)) {
                    saveHit(userId, e.getId(), day, HIT_NOTES, null);
                }
                return new Gate(Gate.Kind.SKIP, e, 0);
            }
        }
        // An exception already hit today (e.g. tapped) also skips — the rule fired again the same day.
        for (TeamChatExceptionEntity e : active) {
            if (hits.existsByExceptionIdAndHitOnAndDeletedFalse(e.getId(), day)) {
                return new Gate(Gate.Kind.SKIP, e, 0);
            }
        }
        return new Gate(Gate.Kind.EXCUSE, active.getFirst(), 0);
    }

    /** The offer's template sentence — what the voice rephrases (and the fallback line). */
    static String template(Gate gate) {
        TeamChatExceptionEntity e = gate.exception();
        if (gate.kind() == Gate.Kind.REVIEW) {
            return "Az utóbbi időben " + gate.hits() + " alkalommal jött elő ez a kivétel: " + e.getContextTag()
                    + ". Ez még rendben van így?";
        }
        String fact = e.getFactText().strip();
        if (!fact.isEmpty() && ".!?…".indexOf(fact.charAt(fact.length() - 1)) < 0) {
            fact = fact + ".";
        }
        return "Tudom, hogy " + lowerFirst(fact) + " Ma is ez volt a helyzet?";
    }

    private static String lowerFirst(String s) {
        return s.isEmpty() ? s : s.substring(0, 1).toLowerCase(Locale.ROOT) + s.substring(1);
    }

    /** Hits since max(windowStartedAt's day, day − (window − 1)) — lesson 25's floor. */
    long windowHits(TeamChatExceptionEntity e, LocalDate day) {
        LocalDate floor = day.minusDays(properties.exceptionWindowDays() - 1L);
        LocalDate started = e.getWindowStartedAt().atZone(properties.zone()).toLocalDate();
        return hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(e.getId(),
                started.isAfter(floor) ? started : floor);
    }

    private boolean reviewedThisWindow(UUID userId, TeamChatExceptionEntity e) {
        return threads.findFirstByCreatedByAndExceptionIdAndOfferAndOpenedAtGreaterThanEqualAndDeletedFalse(
                userId, e.getId(), TeamChatService.OFFER_REVIEW, e.getWindowStartedAt()).isPresent();
    }

    private List<String> dayTexts(UUID userId, LocalDate day) {
        List<String> out = new ArrayList<>();
        for (NarrativeNoteSource s : noteSources) {
            try {
                s.notesOn(userId, day).forEach(n -> {
                    if (n.text() != null) {
                        out.add(n.text());
                    }
                });
            } catch (RuntimeException ex) {
                log.warn("Note source {} failed for the exception match", s.kind(), ex);
            }
        }
        Instant from = day.atStartOfDay(properties.zone()).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(properties.zone()).toInstant().minusNanos(1000);
        lines.findByCreatedByAndKindAndOccurredAtBetweenAndDeletedFalse(userId, TeamChatService.KIND_USER, from, to)
                .forEach(l -> out.add(l.getBody()));
        return out;
    }

    /**
     * The one-tap answers on an EXCUSE/REVIEW ügy: {@code EXCUSED} on an EXCUSE offer,
     * {@code KEEP}/{@code STOP} on a REVIEW offer; any other pairing is a 409. Row-locked;
     * idempotent per choice (the same choice again returns the closed ügy unchanged), a different
     * outcome already recorded is a 409.
     */
    @Transactional
    public TeamChatThreadEntity answer(UUID userId, UUID threadId, String choice) {
        TeamChatThreadEntity thread = threads.lockOwned(threadId, userId).orElseThrow(TeamChatExceptionService::notFound);
        String expectedOffer = CHOICE_EXCUSED.equals(choice) ? TeamChatService.OFFER_EXCUSE
                : CHOICE_KEEP.equals(choice) || CHOICE_STOP.equals(choice) ? TeamChatService.OFFER_REVIEW
                : null;
        if (expectedOffer == null || !expectedOffer.equals(thread.getOffer()) || thread.getExceptionId() == null) {
            throw conflict();
        }
        if (!TeamChatService.STATUS_OPEN.equals(thread.getStatus())) {
            if (alreadyAnswered(thread, choice)) {
                log.info("Team chat ügy {} already answered {} for user {} — idempotent no-op", threadId, choice,
                        userId);
                return thread;
            }
            throw conflict();
        }
        exceptions.lockUserExceptions(userId);
        TeamChatExceptionEntity e = exceptions.findByIdAndCreatedByAndDeletedFalse(thread.getExceptionId(), userId)
                .orElseThrow(TeamChatExceptionService::notFound);
        Instant now = Instant.now();
        String body;
        switch (choice) {
            case CHOICE_EXCUSED -> {
                LocalDate day = now.atZone(properties.zone()).toLocalDate();
                if (!hits.existsByExceptionIdAndHitOnAndDeletedFalse(e.getId(), day)) {
                    saveHit(userId, e.getId(), day, TeamChatReplyService.HIT_TAP, thread.getId());
                }
                close(thread, TeamChatService.CLOSE_EXCUSED, e.getContextTag(), now);
                body = BODY_EXCUSED;
            }
            case CHOICE_KEEP -> {
                e.setWindowStartedAt(now.truncatedTo(ChronoUnit.MICROS));
                exceptions.saveAndFlush(e);
                close(thread, TeamChatService.CLOSE_EXCUSED, e.getContextTag(), now);
                body = BODY_KEEP;
            }
            default -> { // STOP
                e.setActive(false);
                exceptions.saveAndFlush(e);
                if (e.getKnowledgeFactId() != null) {
                    knowledge.muteFromTeamChat(userId, e.getKnowledgeFactId());
                }
                close(thread, TeamChatService.CLOSE_REPLY, STOP_NOTE, now);
                body = BODY_STOP;
            }
        }
        teamChat.writeLine(thread, TeamChatService.KIND_REPLY, thread.getOwnerCharacter(), body, false, List.of(), now);
        log.info("Team chat ügy {} answered {} for user {} (exception {})", threadId, choice, userId, e.getId());
        return thread;
    }

    /** The recorded outcome of a closed offer ügy matches {@code choice}. */
    private static boolean alreadyAnswered(TeamChatThreadEntity thread, String choice) {
        if (!TeamChatService.STATUS_RESOLVED.equals(thread.getStatus())) {
            return false;
        }
        return switch (choice) {
            case CHOICE_EXCUSED, CHOICE_KEEP -> TeamChatService.CLOSE_EXCUSED.equals(thread.getCloseReason());
            case CHOICE_STOP -> TeamChatService.CLOSE_REPLY.equals(thread.getCloseReason())
                    && STOP_NOTE.equals(thread.getCloseNote());
            default -> false;
        };
    }

    /**
     * Undo the remembered chip: withdraw the knowledge (the exception stays as an inactive row —
     * the durable veto, never re-captured), drop the reply's own hit and, when the ügy was closed
     * by that reply and no newer ügy of the rule is open, reopen it. Idempotent.
     */
    @Transactional
    public TeamChatThreadEntity undoRemembered(UUID userId, UUID threadId) {
        TeamChatThreadEntity thread = threads.lockOwned(threadId, userId).orElseThrow(TeamChatExceptionService::notFound);
        exceptions.lockUserExceptions(userId);
        TeamChatExceptionEntity e = exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(threadId, userId)
                .orElseThrow(TeamChatExceptionService::notFound);
        if (Boolean.TRUE.equals(e.getActive())) {
            e.setActive(false);
            exceptions.saveAndFlush(e);
            if (e.getKnowledgeFactId() != null) {
                knowledge.muteFromTeamChat(userId, e.getKnowledgeFactId());
            }
            hits.findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(e.getId(), threadId,
                    TeamChatReplyService.HIT_REPLY).ifPresent(h -> {
                        h.setDeleted(true);
                        hits.saveAndFlush(h);
                    });
        }
        if (TeamChatService.STATUS_RESOLVED.equals(thread.getStatus())
                && TeamChatService.CLOSE_REPLY.equals(thread.getCloseReason())
                && threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(userId, thread.getFlagKey(),
                        TeamChatService.STATUS_OPEN).isEmpty()) {
            thread.setStatus(TeamChatService.STATUS_OPEN);
            thread.setClosedAt(null);
            thread.setCloseReason(null);
            thread.setCloseNote(null);
            threads.saveAndFlush(thread);
            log.info("Team chat ügy {} reopened by the remembered-chip undo for user {}", threadId, userId);
        }
        return thread;
    }

    private void saveHit(UUID userId, UUID exceptionId, LocalDate day, String source, UUID threadId) {
        TeamChatExceptionHitEntity hit = new TeamChatExceptionHitEntity();
        hit.setCreatedBy(userId);
        hit.setExceptionId(exceptionId);
        hit.setHitOn(day);
        hit.setSource(source);
        hit.setThreadId(threadId);
        hits.saveAndFlush(hit);
    }

    private void close(TeamChatThreadEntity thread, String reason, String note, Instant now) {
        thread.setStatus(TeamChatService.STATUS_RESOLVED);
        thread.setClosedAt(now);
        thread.setCloseReason(reason);
        thread.setCloseNote(note);
        threads.saveAndFlush(thread);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("CHARACTER_TEAM_CHAT_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }

    private static SystemRuntimeErrorException conflict() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("CHARACTER_TEAM_CHAT_ANSWER_CONFLICT").build(), HttpStatus.CONFLICT);
    }
}
