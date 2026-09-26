package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.api.dto.TeamChatAction;
import io.mrkuhne.mezo.api.dto.TeamChatDay;
import io.mrkuhne.mezo.api.dto.TeamChatLine;
import io.mrkuhne.mezo.api.dto.TeamChatThread;
import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
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
    private static final Set<String> THREAD_BEARING = Set.of(TeamChatService.KIND_OPEN, TeamChatService.KIND_RESOLVE);

    private final TeamChatThreadRepository threads;
    private final TeamChatLineRepository lines;
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

        List<TeamChatLine> lineDtos = new ArrayList<>(dayLines.size());
        for (TeamChatLineEntity line : dayLines) {
            TeamChatThreadEntity thread = THREAD_BEARING.contains(line.getKind()) && line.getThreadId() != null
                    ? threadById.get(line.getThreadId()) : null;
            lineDtos.add(toLine(line, thread));
        }
        List<TeamChatThread> open = threads
                .findByCreatedByAndStatusAndDeletedFalseOrderByOpenedAtAsc(userId, TeamChatService.STATUS_OPEN)
                .stream().map(TeamChatReads::toThread).toList();
        long pushes = threads.countByCreatedByAndPushedTrueAndOpenedAtBetweenAndDeletedFalse(userId, from, to);

        return TeamChatDay.builder().date(date).lines(lineDtos).openThreads(open)
                .pushesToday((int) pushes).pushBudget(properties.maxPushesPerDay()).build();
    }

    /** A line as the API shows it; {@code thread} is embedded only when given (OPEN / RESOLVE). */
    public static TeamChatLine toLine(TeamChatLineEntity line, TeamChatThreadEntity thread) {
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
                .thread(thread == null ? null : toThread(thread))
                .build();
    }

    public static TeamChatThread toThread(TeamChatThreadEntity thread) {
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
                .build();
    }

    private static OffsetDateTime utc(Instant at) {
        return at.atOffset(ZoneOffset.UTC);
    }
}
