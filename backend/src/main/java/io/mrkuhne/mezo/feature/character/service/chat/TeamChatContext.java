package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The background block a character's voice call gets (Csapatfal Act III Task 8, mezo-a9bo7.22,
 * spec §5.3 "emlékszik" — upgrade 1): today's chat so far, this rule's past episodes, the user's
 * reactions to them, and a knowledge block ({@link TeamChatKnowledgePort}) Emlékezet
 * ({@code mezo-d6ivw.5}) fills in later. Context is background only — the voice guard still
 * allows numbers solely from the event's own whitelisted facts.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatContext {

    private static final int TODAY_LINES_MAX = 12;
    private static final int PAST_EPISODES_MAX = 5;
    private static final int PAST_EPISODES_WINDOW_DAYS = 30;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT);

    private final TeamChatThreadRepository threads;
    private final TeamChatLineRepository lines;
    private final MessageFeedbackRepository feedback;
    private final TeamChatProperties properties;
    private final TeamChatKnowledgePort knowledge;

    /** The context block for the line about to be written on {@code thread} at {@code at}. */
    @Transactional(readOnly = true)
    public TeamChatContextBlock build(UUID owner, TeamChatThreadEntity thread, Instant at) {
        List<TeamChatThreadEntity> pastThreads = pastThreadsOf(owner, thread, at);
        return new TeamChatContextBlock(
                todayLines(owner, at),
                pastEpisodes(pastThreads),
                reactions(owner, pastThreads),
                knowledge.forArea(owner, TeamCharacter.valueOf(thread.getOwnerCharacter().toUpperCase(Locale.ROOT))));
    }

    private List<String> todayLines(UUID owner, Instant at) {
        LocalDate day = at.atZone(properties.zone()).toLocalDate();
        Instant from = day.atStartOfDay(properties.zone()).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(properties.zone()).toInstant().minusNanos(1000);
        List<TeamChatLineEntity> dayLines =
                lines.findByCreatedByAndOccurredAtBetweenAndDeletedFalseOrderByOccurredAtAsc(owner, from, to);
        List<TeamChatLineEntity> capped = dayLines.size() > TODAY_LINES_MAX
                ? dayLines.subList(dayLines.size() - TODAY_LINES_MAX, dayLines.size()) : dayLines;
        return capped.stream().map(TeamChatContext::toTodayLine).toList();
    }

    private static String toTodayLine(TeamChatLineEntity line) {
        String name = line.getCharacter() == null
                ? "Te" : TeamCharacter.valueOf(line.getCharacter().toUpperCase(Locale.ROOT)).displayName();
        return name + ": " + line.getBody();
    }

    /** This rule's OTHER episodes in the last {@value #PAST_EPISODES_WINDOW_DAYS} days, oldest
     *  first, the ügy currently being written on filtered out. */
    private List<TeamChatThreadEntity> pastThreadsOf(UUID owner, TeamChatThreadEntity thread, Instant at) {
        Instant since = at.minus(PAST_EPISODES_WINDOW_DAYS, ChronoUnit.DAYS);
        List<TeamChatThreadEntity> all = threads
                .findByCreatedByAndFlagKeyAndOpenedAtGreaterThanEqualAndDeletedFalseOrderByOpenedAtAsc(
                        owner, thread.getFlagKey(), since)
                .stream().filter(t -> !t.getId().equals(thread.getId())).toList();
        return all.size() > PAST_EPISODES_MAX ? all.subList(all.size() - PAST_EPISODES_MAX, all.size()) : all;
    }

    private List<String> pastEpisodes(List<TeamChatThreadEntity> pastThreads) {
        return pastThreads.stream().map(this::toEpisode).toList();
    }

    private String toEpisode(TeamChatThreadEntity thread) {
        String openedDate = thread.getOpenedAt().atZone(properties.zone()).toLocalDate().format(DATE);
        String outcome = switch (thread.getStatus()) {
            case "RESOLVED" -> "RESOLVED at " + thread.getClosedAt().atZone(properties.zone()).format(TIME);
            case "EXPIRED" -> "EXPIRED";
            default -> "still open";
        };
        return openedDate + " → " + outcome;
    }

    /** Feedback rollup and the applied action, if any, per past episode — oldest first, entries
     *  with nothing to say (no votes, nothing applied) are skipped. */
    private List<String> reactions(UUID owner, List<TeamChatThreadEntity> pastThreads) {
        return pastThreads.stream()
                .flatMap(thread -> reactionsOf(owner, thread).stream())
                .toList();
    }

    private List<String> reactionsOf(UUID owner, TeamChatThreadEntity thread) {
        String openedDate = thread.getOpenedAt().atZone(properties.zone()).toLocalDate().format(DATE);
        List<UUID> lineIds = lines.findByThreadIdAndDeletedFalse(thread.getId()).stream()
                .map(TeamChatLineEntity::getId).toList();
        List<MessageFeedbackEntity> votes = lineIds.isEmpty() ? List.of()
                : feedback.findByCreatedByAndArtifactKindAndArtifactIdInAndDeletedFalse(
                        owner, MessageFeedbackEntity.KIND_TEAM_CHAT_LINE, lineIds);
        long up = votes.stream().filter(v -> MessageFeedbackEntity.VERDICT_UP.equals(v.getVerdict())).count();
        long down = votes.stream().filter(v -> MessageFeedbackEntity.VERDICT_DOWN.equals(v.getVerdict())).count();

        List<String> out = new ArrayList<>();
        if (up > 0 || down > 0) {
            out.add(openedDate + ": 👍" + up + " 👎" + down);
        }
        TeamChatActionsEnvelope.Applied applied = thread.getApplied();
        if (applied != null) {
            out.add(openedDate + ": alkalmazva → " + applied.actionKey());
        }
        return out;
    }
}
