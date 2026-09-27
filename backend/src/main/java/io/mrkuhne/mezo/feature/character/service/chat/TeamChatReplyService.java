package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.KeywordsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionHitEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionHitRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S7 (mezo-d6ivw.7): the owner character answers the user's reply — and a concrete explanation
 * closes the ügy and becomes durable knowledge. Claim (short tx) → voice (no tx) → commit (short
 * tx, row-locked), the {@link TeamChatService#openThread} shape. Answers every unanswered USER line
 * of the ügy at once (one REPLY per burst). Never pushes.
 *
 * <p><b>Burst / idempotence:</b> every USER line publishes its own {@link TeamChatRepliedEvent}.
 * An event steps back when a USER line NEWER than its own exists (that line's event answers the
 * whole burst) or when a REPLY already follows its line. {@link TeamChatService#reply} and
 * {@link #commit} both write under the ügy's row lock, so line order is commit order and the
 * checks are exact: when the commit sees a newer USER line, that line's event is guaranteed to
 * claim after it and find the burst still unanswered; when it does not, any later USER line sorts
 * after the REPLY and is pending for its own event.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatReplyService {

    static final String HIT_REPLY = "REPLY";
    static final String HIT_TAP = "TAP";
    static final int CLOSE_NOTE_MAX = 60;

    private final TeamChatThreadRepository threads;
    private final TeamChatLineRepository lines;
    private final TeamChatExceptionRepository exceptions;
    private final TeamChatExceptionHitRepository hits;
    private final TeamChatProperties properties;
    private final TeamChatReplyVoiceWriter voiceWriter;
    private final TeamChatService teamChat;
    private final KnowledgeFactService knowledge;
    private final ObjectProvider<TeamChatReplyService> self;

    /** What {@link #claim} hands the voice step: the ügy, its unanswered USER lines (oldest first),
     *  whether the day's voiced budget for this ügy has room, the OPEN line's facts and the offer. */
    record Claim(TeamChatThreadEntity thread, List<TeamChatLineEntity> pending, boolean mayVoice,
            List<String> threadFacts, String offerNote) {
    }

    /** Answers the ügy's unanswered USER lines, if {@code lineId}'s event is the one that should.
     *  Deliberately NOT {@code @Transactional}: the voice call runs with no transaction open. */
    public void answer(UUID userId, UUID threadId, UUID lineId) {
        try {
            Optional<Claim> claim = self.getObject().claim(userId, threadId, lineId);
            if (claim.isEmpty()) {
                return;
            }
            Claim c = claim.get();
            List<String> texts = c.pending().stream().map(TeamChatLineEntity::getBody).toList();
            TeamChatReplyDraft draft = c.mayVoice()
                    ? voiceWriter.write(userId, c.thread(), texts, c.threadFacts(), c.offerNote())
                    : TeamChatReplyDraft.template(TeamChatReplyVoiceWriter.templateFor(ownerOf(c.thread())));
            self.getObject().commit(userId, threadId, c.pending().getLast().getId(), draft);
        } catch (Exception e) {
            log.warn("Team chat answer failed for user {} ügy {}", userId, threadId, e);
        }
    }

    /** Pending = USER lines after the ügy's last REPLY. Empty when {@code lineId} is not the newest
     *  USER line (the newer line's event answers the burst), when a REPLY already follows it, or
     *  when the user's REPLY cap for the day is spent. */
    @Transactional(readOnly = true)
    Optional<Claim> claim(UUID userId, UUID threadId, UUID lineId) {
        Optional<TeamChatThreadEntity> found = threads.findByIdAndCreatedByAndDeletedFalse(threadId, userId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        TeamChatThreadEntity thread = found.get();
        List<TeamChatLineEntity> transcript = lines.findByThreadIdAndDeletedFalseOrderByOccurredAtAsc(threadId);
        if (!isUnansweredNewest(transcript, lineId)) {
            return Optional.empty();
        }
        List<TeamChatLineEntity> pending = pendingUserLines(transcript);
        if (pending.isEmpty()) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        LocalDate day = now.atZone(properties.zone()).toLocalDate();
        Instant from = day.atStartOfDay(properties.zone()).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(properties.zone()).toInstant().minusNanos(1000);
        if (lines.countByCreatedByAndKindAndOccurredAtBetweenAndDeletedFalse(userId, TeamChatService.KIND_REPLY,
                from, to) >= properties.replyDailyCap()) {
            log.warn("Team chat reply cap reached for user {} — ügy {} stays unanswered", userId, threadId);
            return Optional.empty();
        }
        boolean mayVoice = lines.countByThreadIdAndKindAndVoicedTrueAndOccurredAtBetweenAndDeletedFalse(threadId,
                TeamChatService.KIND_REPLY, from, to) < properties.replyVoicedPerThreadDay();
        List<String> threadFacts = transcript.stream()
                .filter(l -> TeamChatService.KIND_OPEN.equals(l.getKind()))
                .findFirst()
                .map(l -> l.getFacts() == null ? List.<String>of() : l.getFacts().facts())
                .orElse(List.of());
        return Optional.of(new Claim(thread, pending, mayVoice, threadFacts, offerNote(userId, thread)));
    }

    /** Writes the REPLY line and applies the code decision, under the ügy's row lock. Skips when
     *  the burst grew meanwhile (a USER line newer than {@code lastUserLineId}: its own event
     *  answers everything) or another event already answered it. */
    @Transactional
    void commit(UUID userId, UUID threadId, UUID lastUserLineId, TeamChatReplyDraft draft) {
        TeamChatThreadEntity thread = threads.lockOwned(threadId, userId).orElse(null);
        if (thread == null) {
            return;
        }
        if (!isUnansweredNewest(lines.findByThreadIdAndDeletedFalseOrderByOccurredAtAsc(threadId), lastUserLineId)) {
            log.info("Team chat ügy {} answer dropped — the burst grew or was already answered", threadId);
            return;
        }
        Instant now = Instant.now();
        teamChat.writeLine(thread, TeamChatService.KIND_REPLY, thread.getOwnerCharacter(), draft.reply(),
                draft.voiced(), List.of(), now);

        TeamChatReplyDecision.Outcome outcome = TeamChatReplyDecision.Outcome.ANSWER_ONLY;
        if (TeamChatService.STATUS_OPEN.equals(thread.getStatus()) && draft.voiced()
                && TeamChatReplyDraft.CONCRETE.equals(draft.verdict())) {
            // Serializes this user's exception writes (the unique (user, rule, tag) and
            // (exception, day) indexes) across ügyek — read-then-write below must not race.
            exceptions.lockUserExceptions(userId);
            String tag = draft.contextTag() == null ? "" : TeamChatExceptionMatcher.normalize(draft.contextTag());
            Optional<TeamChatExceptionEntity> sameTag = tag.isEmpty() ? Optional.empty()
                    : exceptions.findFirstByCreatedByAndFlagKeyAndNormalizedTagAndDeletedFalse(
                            userId, thread.getFlagKey(), tag);
            boolean active = sameTag.map(e -> Boolean.TRUE.equals(e.getActive())).orElse(false);
            boolean vetoed = sameTag.isPresent() && !active;
            String offerTag = thread.getExceptionId() == null ? null
                    : exceptions.findByIdAndCreatedByAndDeletedFalse(thread.getExceptionId(), userId)
                            .map(TeamChatExceptionEntity::getNormalizedTag).orElse(null);
            outcome = TeamChatReplyDecision.decide(thread.getStatus(), thread.getOffer(), draft, active, vetoed,
                    offerTag);
            switch (outcome) {
                case ANSWER_ONLY -> { }
                case CLOSE_NEW_EXCEPTION -> {
                    String contextTag = draft.contextTag().strip();
                    String factText = draft.factText().strip();
                    UUID factId = knowledge.captureFromTeamChat(userId, factText, thread.getOwnerCharacter(),
                            lastUserLineId, thread.getId());
                    TeamChatExceptionEntity e = new TeamChatExceptionEntity();
                    e.setCreatedBy(userId);
                    e.setFlagKey(thread.getFlagKey());
                    e.setOwnerCharacter(thread.getOwnerCharacter());
                    e.setContextTag(contextTag);
                    e.setNormalizedTag(tag);
                    e.setFactText(factText);
                    e.setKeywords(new KeywordsEnvelope(draft.keywords()));
                    e.setKnowledgeFactId(factId);
                    e.setSourceThreadId(thread.getId());
                    e.setSourceLineId(lastUserLineId);
                    e.setWindowStartedAt(now);
                    TeamChatExceptionEntity saved = exceptions.saveAndFlush(e);
                    hit(userId, saved.getId(), thread.getId(), HIT_REPLY, now);
                    close(thread, TeamChatService.CLOSE_REPLY, contextTag, now);
                }
                case CLOSE_AS_HIT_ON_ACTIVE -> {
                    TeamChatExceptionEntity known = sameTag.orElseThrow();
                    hit(userId, known.getId(), thread.getId(), HIT_REPLY, now);
                    close(thread, TeamChatService.CLOSE_REPLY, known.getContextTag(), now);
                }
                case EXCUSE_TAP_EQUIVALENT -> {
                    hit(userId, thread.getExceptionId(), thread.getId(), HIT_TAP, now);
                    close(thread, TeamChatService.CLOSE_EXCUSED,
                            sameTag.map(TeamChatExceptionEntity::getContextTag).orElse(draft.contextTag()), now);
                }
            }
        }
        log.info("Team chat ügy {} answered for user {} (voiced={}, verdict={}, outcome={})", threadId, userId,
                draft.voiced(), draft.verdict(), outcome);
    }

    /** True when {@code lineId} is on the transcript, no USER line follows it and no REPLY does. */
    static boolean isUnansweredNewest(List<TeamChatLineEntity> transcript, UUID lineId) {
        int at = -1;
        for (int i = 0; i < transcript.size(); i++) {
            if (transcript.get(i).getId().equals(lineId)) {
                at = i;
                break;
            }
        }
        if (at < 0) {
            return false;
        }
        for (TeamChatLineEntity later : transcript.subList(at + 1, transcript.size())) {
            if (TeamChatService.KIND_USER.equals(later.getKind()) || TeamChatService.KIND_REPLY.equals(later.getKind())) {
                return false;
            }
        }
        return true;
    }

    /** The USER lines after the transcript's last REPLY, oldest first. */
    static List<TeamChatLineEntity> pendingUserLines(List<TeamChatLineEntity> transcript) {
        List<TeamChatLineEntity> pending = new ArrayList<>();
        for (TeamChatLineEntity line : transcript) {
            if (TeamChatService.KIND_REPLY.equals(line.getKind())) {
                pending.clear();
            } else if (TeamChatService.KIND_USER.equals(line.getKind())) {
                pending.add(line);
            }
        }
        return pending;
    }

    /** The EXCUSE/REVIEW offer riding the ügy, as the voice writer's {@code ajánlat:} line. */
    private String offerNote(UUID userId, TeamChatThreadEntity thread) {
        if (thread.getOffer() == null || thread.getExceptionId() == null) {
            return null;
        }
        return exceptions.findByIdAndCreatedByAndDeletedFalse(thread.getExceptionId(), userId)
                .map(e -> TeamChatService.OFFER_EXCUSE.equals(thread.getOffer())
                        ? "ismert kivétel: " + e.getFactText() + " — kérdezd meg röviden, ma is ez volt-e"
                        : TeamChatService.OFFER_REVIEW.equals(thread.getOffer())
                                ? "felülvizsgálat: " + e.getContextTag()
                                : null)
                .orElse(null);
    }

    /** One hit per (exception, local day) — a second one the same day is a no-op. */
    private void hit(UUID userId, UUID exceptionId, UUID threadId, String source, Instant now) {
        LocalDate day = now.atZone(properties.zone()).toLocalDate();
        if (hits.existsByExceptionIdAndHitOnAndDeletedFalse(exceptionId, day)) {
            return;
        }
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
        String trimmed = note == null ? null : note.strip();
        thread.setCloseNote(trimmed == null || trimmed.length() <= CLOSE_NOTE_MAX
                ? trimmed : trimmed.substring(0, CLOSE_NOTE_MAX));
        threads.saveAndFlush(thread);
    }

    private static TeamCharacter ownerOf(TeamChatThreadEntity thread) {
        return TeamCharacter.valueOf(thread.getOwnerCharacter().toUpperCase(Locale.ROOT));
    }
}
