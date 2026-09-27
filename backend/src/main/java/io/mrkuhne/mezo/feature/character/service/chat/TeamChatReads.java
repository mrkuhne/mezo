package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.api.dto.TeamChatAction;
import io.mrkuhne.mezo.api.dto.TeamChatDay;
import io.mrkuhne.mezo.api.dto.TeamChatLine;
import io.mrkuhne.mezo.api.dto.TeamChatRemembered;
import io.mrkuhne.mezo.api.dto.TeamChatThread;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The team chat read model (Csapatfal Act III, mezo-a9bo7.21): one local day of lines in time
 * order — OPEN and RESOLVE lines carry their ügy, so the FE can draw the ügy card and its actions
 * inline — plus every still-open ügy of any day and the day's push count against its budget.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatReads {

    /** The line kinds that embed their ügy. */
    private static final Set<String> THREAD_BEARING =
            Set.of(TeamChatService.KIND_OPEN, TeamChatService.KIND_RESOLVE, TeamChatService.KIND_REPLY);

    private final TeamChatThreadRepository threads;
    private final TeamChatLineRepository lines;
    private final TeamChatExceptionRepository exceptions;
    private final TeamChatProperties properties;

    @Transactional(readOnly = true)
    public TeamChatDay day(UUID userId, LocalDate date) {
        Instant from = date.atStartOfDay(properties.zone()).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(properties.zone()).toInstant().minusNanos(1000);
        List<TeamChatLineEntity> dayLines =
                lines.findByCreatedByAndOccurredAtBetweenAndDeletedFalseOrderByOccurredAtAsc(userId, from, to);

        List<UUID> threadIds = dayLines.stream()
                .filter(l -> THREAD_BEARING.contains(l.getKind()))
                .map(TeamChatLineEntity::getThreadId).filter(Objects::nonNull).distinct().toList();
        Map<UUID, TeamChatThreadEntity> threadById = threads.findAllById(threadIds).stream()
                .filter(t -> userId.equals(t.getCreatedBy()))
                .collect(Collectors.toMap(TeamChatThreadEntity::getId, Function.identity()));

        List<TeamChatThreadEntity> open = threads
                .findByCreatedByAndStatusAndDeletedFalseOrderByOpenedAtAsc(userId, TeamChatService.STATUS_OPEN);

        List<UUID> allThreadIds = new ArrayList<>(threadById.keySet());
        open.forEach(t -> allThreadIds.add(t.getId()));
        Map<UUID, TeamChatExceptionEntity> bornByThreadId = allThreadIds.isEmpty() ? Collections.emptyMap()
                : exceptions.findBySourceThreadIdInAndCreatedByAndDeletedFalse(allThreadIds, userId).stream()
                        .collect(Collectors.toMap(TeamChatExceptionEntity::getSourceThreadId, Function.identity(),
                                (a, b) -> a));

        List<TeamChatThreadEntity> allThreads = new ArrayList<>(threadById.values());
        allThreads.addAll(open);
        List<UUID> offerExceptionIds = allThreads.stream()
                .filter(t -> t.getOffer() != null && t.getExceptionId() != null)
                .map(TeamChatThreadEntity::getExceptionId).distinct().toList();
        Map<UUID, TeamChatExceptionEntity> offerExceptionById = offerExceptionIds.isEmpty() ? Collections.emptyMap()
                : exceptions.findByIdInAndCreatedByAndDeletedFalse(offerExceptionIds, userId).stream()
                        .collect(Collectors.toMap(TeamChatExceptionEntity::getId, Function.identity()));

        List<TeamChatLine> lineDtos = new ArrayList<>(dayLines.size());
        for (TeamChatLineEntity line : dayLines) {
            TeamChatThreadEntity thread = THREAD_BEARING.contains(line.getKind()) && line.getThreadId() != null
                    ? threadById.get(line.getThreadId()) : null;
            lineDtos.add(toLine(line, thread, thread == null ? null : bornByThreadId.get(thread.getId()),
                    thread == null || thread.getExceptionId() == null
                            ? null : offerExceptionById.get(thread.getExceptionId())));
        }
        List<TeamChatThread> openDtos = open.stream()
                .map(t -> toThread(t, bornByThreadId.get(t.getId()),
                        t.getExceptionId() == null ? null : offerExceptionById.get(t.getExceptionId())))
                .toList();
        long pushes = threads.countByCreatedByAndPushedTrueAndOpenedAtBetweenAndDeletedFalse(userId, from, to);

        return TeamChatDay.builder().date(date).lines(lineDtos).openThreads(openDtos)
                .pushesToday((int) pushes).pushBudget(properties.maxPushesPerDay()).build();
    }

    /** Task 15 (mezo-a9bo7.25): the ügyek opened or closed on {@code date} (the user's local day),
     *  oldest first, together with the {@code [from, to)} window they were fetched with — the
     *  evening edition's {@code team_chat_day} recap classifies them against the SAME window. */
    @Transactional(readOnly = true)
    public DayThreads threadsTouchedOn(UUID userId, LocalDate date) {
        Instant from = date.atStartOfDay(properties.zone()).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(properties.zone()).toInstant();
        return new DayThreads(from, to, threads.touchedBetween(userId, from, to));
    }

    /** One local day's touched ügyek plus the half-open window that defined "touched". */
    public record DayThreads(Instant from, Instant to, List<TeamChatThreadEntity> threads) {
        public DayThreads {
            threads = threads == null ? List.of() : List.copyOf(threads);
        }

        public boolean within(Instant at) {
            return at != null && !at.isBefore(from) && at.isBefore(to);
        }
    }

    /** A line as the API shows it; {@code thread} is embedded only when given (OPEN / RESOLVE / REPLY). */
    public static TeamChatLine toLine(TeamChatLineEntity line, TeamChatThreadEntity thread) {
        return toLine(line, thread, null, null);
    }

    /** A line as the API shows it, with its ügy's remembered exception (born on this thread) and,
     *  for an EXCUSE/REVIEW offer, the offered exception. */
    public static TeamChatLine toLine(TeamChatLineEntity line, TeamChatThreadEntity thread,
            TeamChatExceptionEntity born, TeamChatExceptionEntity offerException) {
        return TeamChatLine.builder()
                .id(line.getId())
                .threadId(line.getThreadId())
                .kind(TeamChatLine.KindEnum.fromValue(line.getKind()))
                .character(line.getCharacter() == null ? null : TeamChatLine.CharacterEnum.fromValue(line.getCharacter()))
                .body(line.getBody())
                .voiced(Boolean.TRUE.equals(line.getVoiced()))
                .facts(Optional.ofNullable(line.getFacts()).map(EditionFactsEnvelope::facts)
                        .map(List::copyOf).orElse(List.of()))
                .occurredAt(utc(line.getOccurredAt()))
                .thread(thread == null ? null : toThread(thread, born, offerException))
                .build();
    }

    public static TeamChatThread toThread(TeamChatThreadEntity thread) {
        return toThread(thread, null, null);
    }

    /** {@code born} is the exception captured off this thread (its remembered chip, if any);
     *  {@code offerException} is the exception the thread's EXCUSE/REVIEW offer refers to. */
    public static TeamChatThread toThread(TeamChatThreadEntity thread, TeamChatExceptionEntity born,
            TeamChatExceptionEntity offerException) {
        List<TeamChatAction> actions = Optional.ofNullable(thread.getActions())
                .map(TeamChatActionsEnvelope::actions).orElse(List.of()).stream()
                .map(a -> TeamChatAction.builder().key(a.key()).label(a.label()).build())
                .toList();
        return TeamChatThread.builder()
                .id(thread.getId())
                .flagKey(thread.getFlagKey())
                .ruleLabel(FlagCatalog.labelOf(thread.getFlagKey()))
                .owner(TeamChatThread.OwnerEnum.fromValue(thread.getOwnerCharacter()))
                .guest(thread.getGuestCharacter())
                .status(TeamChatThread.StatusEnum.fromValue(thread.getStatus()))
                .openedAt(utc(thread.getOpenedAt()))
                .closedAt(thread.getClosedAt() == null ? null : utc(thread.getClosedAt()))
                .pushed(Boolean.TRUE.equals(thread.getPushed()))
                .actions(actions)
                .applied(thread.getApplied() == null ? null : thread.getApplied().actionKey())
                .closeReason(thread.getCloseReason() == null ? null
                        : TeamChatThread.CloseReasonEnum.fromValue(thread.getCloseReason()))
                .closeNote(thread.getCloseNote())
                .offer(thread.getOffer() == null ? null : TeamChatThread.OfferEnum.fromValue(thread.getOffer()))
                .offerTag(offerException == null ? null : offerException.getContextTag())
                .remembered(born == null ? null : TeamChatRemembered.builder()
                        .text(born.getFactText()).contextTag(born.getContextTag())
                        .active(Boolean.TRUE.equals(born.getActive())).build())
                .build();
    }

    private static OffsetDateTime utc(Instant at) {
        return at.atOffset(ZoneOffset.UTC);
    }
}
