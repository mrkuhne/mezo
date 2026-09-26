package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceCopy;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict.ClearEvidence;
import io.mrkuhne.mezo.feature.proactive.service.AdviceActionCatalog;
import io.mrkuhne.mezo.feature.proactive.service.AdviceApplyService;
import io.mrkuhne.mezo.feature.proactive.service.AdvicePick;
import io.mrkuhne.mezo.feature.proactive.service.InterventionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
 * (all kinds). At the cap {@link #open} writes nothing and warns; {@link #resolve} still closes
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

    static final String KIND_OPEN = "OPEN";
    static final String KIND_GUEST = "GUEST";
    static final String KIND_RESOLVE = "RESOLVE";
    static final String KIND_SKEPTIC = "SKEPTIC";
    static final String KIND_USER = "USER";

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

    /** A raise opens an ügy — a no-op when the rule has no owner (e.g. {@code all_healthy}), an ügy
     *  for it is already open, the day's line cap is reached, or the library has no eligible entry. */
    @Transactional
    public Optional<TeamChatThreadEntity> open(UUID userId, String flagKey, Instant at) {
        Optional<TeamCharacter> owner = TeamChatCast.ownerOf(flagKey);
        if (owner.isEmpty()) {
            return Optional.empty();
        }
        if (threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(userId, flagKey, STATUS_OPEN).isPresent()) {
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
        TeamChatThreadEntity thread = threads.saveAndFlush(draft);

        // The Szkeptikus speaks only on an honest coverage gap in the raise's own frozen payload;
        // the gap sentence joins the facts so the guard lets its numbers through.
        Optional<String> gap = TeamChatVoiceWriter.skepticGap(flagKey, picked.payload());
        List<String> facts = gap.map(g -> Stream.concat(picked.facts().stream(), Stream.of(g)).toList())
                .orElse(picked.facts());
        TeamChatLines voiced = voice(thread, KIND_OPEN, facts, picked.textHu(), gap.isPresent());
        writeLine(thread, KIND_OPEN, thread.getOwnerCharacter(), voiced.ownerBody(), voiced.voiced(), facts, at);
        writeGuestLine(thread, voiced, facts, at);
        voiced.skepticBody().ifPresent(body -> writeOptionalLine(thread, KIND_SKEPTIC,
                TeamCharacter.SZKEPTIKUS.key(), body, voiced.voiced(), facts, at));
        maybePush(thread, owner.get(), voiced.ownerBody(), at);
        log.info("Team chat ügy {} opened for user {} flag {} by {}", thread.getId(), userId, flagKey,
                thread.getOwnerCharacter());
        return Optional.of(thread);
    }

    /** A clear resolves the open ügy with the owner's RESOLVE line — nothing when none is open. */
    @Transactional
    public Optional<TeamChatLineEntity> resolve(UUID userId, String flagKey, ClearEvidence evidence, Instant at) {
        Optional<TeamChatThreadEntity> open =
                threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(userId, flagKey, STATUS_OPEN);
        if (open.isEmpty()) {
            return Optional.empty();
        }
        TeamChatThreadEntity thread = open.get();
        thread.setStatus(STATUS_RESOLVED);
        thread.setClosedAt(at);
        threads.saveAndFlush(thread);
        if (capReached(userId, at)) {
            // The ügy is over either way — only the RESOLVE line is dropped, never the status flip
            // (a cleared rule must not linger as OPEN until it expires).
            log.warn("Team chat daily line cap reached for user {} — RESOLVE line of {} dropped", userId, flagKey);
            return Optional.empty();
        }

        List<String> facts = FlagTraceCopy.clearFacts(evidence);
        // Never a Szkeptikus on a resolution (spec §5.4); a guest only when the ügy had one.
        TeamChatLines voiced = voice(thread, KIND_RESOLVE, facts, FlagTraceCopy.clearText(evidence), false);
        TeamChatLineEntity line = writeLine(thread, KIND_RESOLVE, thread.getOwnerCharacter(),
                voiced.ownerBody(), voiced.voiced(), facts, at);
        writeGuestLine(thread, voiced, facts, at);
        log.info("Team chat ügy {} resolved for user {} flag {}", thread.getId(), userId, flagKey);
        return Optional.of(line);
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

    /** The user's reply — a USER line on their own ügy; it never resolves the ügy. */
    @Transactional
    public TeamChatLineEntity reply(UUID userId, UUID threadId, String text) {
        String body = text == null ? "" : text.trim();
        if (body.isEmpty() || body.length() > REPLY_MAX_CHARS) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("CHARACTER_TEAM_CHAT_REPLY_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
        TeamChatThreadEntity thread = owned(userId, threadId);
        return writeLine(thread, KIND_USER, null, body, false, List.of(), Instant.now());
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

    /** Task 10 (mezo-a9bo7.23): at most {@code maxPushesPerDay} phone pushes per user per local
     *  day — the second only when this ügy's flag key outranks every ügy already pushed today
     *  ({@link TeamChatPushPolicy}). Never called from {@link #resolve} — a resolution never
     *  pushes. */
    private void maybePush(TeamChatThreadEntity thread, TeamCharacter owner, String ownerBody, Instant at) {
        List<String> pushedToday = pushedTodayFlagKeys(thread.getCreatedBy(), at);
        if (!TeamChatPushPolicy.shouldPush(thread.getFlagKey(), pushedToday, properties.maxPushesPerDay())) {
            return;
        }
        thread.setPushed(true);
        threads.saveAndFlush(thread);
        String title = owner.displayName() + " · " + FlagCatalog.labelOf(thread.getFlagKey());
        appNotifications.emit(thread.getCreatedBy(), AppNotificationKind.TEAM_CHAT, title,
                pushExcerpt(ownerBody), AppNotificationKind.TEAM_CHAT.deeplink(), thread.getId(),
                "team_chat:" + thread.getId());
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
        return lines.countByCreatedByAndCharacterIsNotNullAndOccurredAtBetweenAndDeletedFalse(userId, from, to)
                >= properties.dailyLineCap();
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

    private TeamChatLineEntity writeLine(TeamChatThreadEntity thread, String kind, String character, String body,
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

    private TeamChatThreadEntity owned(UUID userId, UUID threadId) {
        return threads.findByIdAndCreatedByAndDeletedFalse(threadId, userId).orElseThrow(TeamChatService::notFound);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("CHARACTER_TEAM_CHAT_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
