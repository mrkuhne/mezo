package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.character.service.chat.NoopTeamChatKnowledge;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatContext;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatContextBlock;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Csapatfal Act III Task 8 (mezo-a9bo7.22): the "emlékszik" context assembler — today's chat so
 * far, this rule's past episodes (30-day window, current ügy excluded), the feedback/applied
 * rollup on those episodes, and the (no-op, until Emlékezet ships) knowledge block.
 */
@ActiveProfiles("companion-fake")
class TeamChatContextIT extends AbstractIntegrationTest {

    @Autowired private TeamChatContext context;
    @Autowired private TeamChatThreadRepository threads;
    @Autowired private TeamChatLineRepository lines;
    @Autowired private MessageFeedbackRepository feedback;
    @Autowired private TeamChatProperties properties;
    @Autowired private UserPopulator userPopulator;
    @Autowired private NoopTeamChatKnowledge noopKnowledge;
    @Autowired private TransactionTemplate tx;

    private UUID owner() {
        return userPopulator.createUser().getId();
    }

    /** Noon local time today — avoids the midnight-fragile trap of anchoring to "now". */
    private Instant noonToday() {
        return LocalDate.now(properties.zone()).atTime(12, 0).atZone(properties.zone()).toInstant();
    }

    private TeamChatThreadEntity thread(UUID owner, String flagKey, String ownerCharacter, String status,
            Instant openedAt) {
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setCreatedBy(owner);
        t.setFlagKey(flagKey);
        t.setOwnerCharacter(ownerCharacter);
        t.setStatus(status);
        t.setOpenedAt(openedAt);
        return threads.saveAndFlush(t);
    }

    private TeamChatLineEntity line(UUID owner, UUID threadId, String kind, String character, String body,
            Instant occurredAt) {
        TeamChatLineEntity l = new TeamChatLineEntity();
        l.setCreatedBy(owner);
        l.setThreadId(threadId);
        l.setKind(kind);
        l.setCharacter(character);
        l.setBody(body);
        l.setOccurredAt(occurredAt);
        return lines.saveAndFlush(l);
    }

    @Test
    void build_assemblesTodayLines_pastEpisodes_reactions_andEmptyKnowledge() {
        UUID owner = owner();
        Instant at = noonToday();

        // 13 lines today across two threads — todayLines caps at 12, oldest dropped, "Te:" for USER.
        TeamChatThreadEntity chatterThread = thread(owner, FlagKey.LOGGING_GAP, "mezo", "OPEN", at);
        for (int i = 0; i < 13; i++) {
            boolean userTurn = i % 4 == 3;
            line(owner, chatterThread.getId(), userTurn ? "USER" : "OPEN", userTurn ? null : "szunya",
                    "üzenet " + i, at.plus(i, ChronoUnit.MINUTES));
        }

        // The current ügy itself — must never show up in its own past episodes/reactions. Not
        // persisted: only one OPEN thread per (user, flag) is allowed, and the "still open" past
        // episode below already holds that slot for this test's sleep_debt rule.
        TeamChatThreadEntity current = new TeamChatThreadEntity();
        current.setCreatedBy(owner);
        current.setFlagKey(FlagKey.SLEEP_DEBT);
        current.setOwnerCharacter("szunya");
        current.setStatus("OPEN");
        current.setOpenedAt(at);

        // Past episode 1 (10 days ago, RESOLVED) with 👍👍👎 feedback on its lines.
        TeamChatThreadEntity resolved = thread(owner, FlagKey.SLEEP_DEBT, "szunya", "RESOLVED", at.minus(10, ChronoUnit.DAYS));
        resolved.setClosedAt(resolved.getOpenedAt().plus(2, ChronoUnit.HOURS));
        resolved = threads.saveAndFlush(resolved);
        TeamChatLineEntity resolvedLine = line(owner, resolved.getId(), "OPEN", "szunya", "régi sor", resolved.getOpenedAt());
        upvote(owner, resolvedLine.getId());
        upvote2(owner, resolvedLine.getId());

        // Past episode 2 (5 days ago, EXPIRED) — no feedback, no applied action: silent in reactions.
        thread(owner, FlagKey.SLEEP_DEBT, "szunya", "EXPIRED", at.minus(5, ChronoUnit.DAYS));

        // Past episode 3 (2 days ago, still OPEN) with an applied action.
        TeamChatThreadEntity applied = thread(owner, FlagKey.SLEEP_DEBT, "szunya", "OPEN", at.minus(2, ChronoUnit.DAYS));
        applied.setApplied(new TeamChatActionsEnvelope.Applied(
                AdviceActionKey.SHIFT_SLEEP_ANCHOR, applied.getOpenedAt()));
        threads.saveAndFlush(applied);

        // Out of the 30-day window — excluded entirely.
        thread(owner, FlagKey.SLEEP_DEBT, "szunya", "EXPIRED", at.minus(40, ChronoUnit.DAYS));

        // Different rule — excluded by flagKey.
        thread(owner, FlagKey.LOGGING_GAP, "mezo", "RESOLVED", at.minus(3, ChronoUnit.DAYS));

        TeamChatContextBlock block = context.build(owner, current, at);

        assertThat(block.todayLines()).hasSize(12);
        assertThat(block.todayLines().getFirst()).isEqualTo("Szunya: üzenet 1");
        assertThat(block.todayLines().getLast()).isEqualTo("Szunya: üzenet 12");
        assertThat(block.todayLines()).contains("Te: üzenet 3");
        assertThat(block.todayLines()).doesNotContain("Szunya: üzenet 0");

        DateTimeFormatter dateFmt = DateTimeFormatter.ISO_LOCAL_DATE;
        String resolvedDate = resolved.getOpenedAt().atZone(properties.zone()).toLocalDate().format(dateFmt);
        String expiredDate = at.minus(5, ChronoUnit.DAYS).atZone(properties.zone()).toLocalDate().format(dateFmt);
        String appliedDate = applied.getOpenedAt().atZone(properties.zone()).toLocalDate().format(dateFmt);
        assertThat(block.pastEpisodes()).containsExactly(
                resolvedDate + " → RESOLVED at 14:00",
                expiredDate + " → EXPIRED",
                appliedDate + " → still open");

        assertThat(block.reactions()).containsExactly(
                resolvedDate + ": 👍2 👎0",
                appliedDate + ": alkalmazva → " + AdviceActionKey.SHIFT_SLEEP_ANCHOR);

        assertThat(block.knowledge()).isEmpty();
        assertThat(noopKnowledge.forArea(owner, TeamCharacter.SZUNYA)).isEmpty();
    }

    private void upvote(UUID owner, UUID lineId) {
        tx.executeWithoutResult(s -> feedback.upsertVerdict(owner, MessageFeedbackEntity.KIND_TEAM_CHAT_LINE, lineId,
                MessageFeedbackEntity.VERDICT_UP, null));
    }

    /** A second, distinct 👍 needs its own artifact id — {@code message_feedback} allows only one
     *  verdict per artifact — so this seeds a second line on the same episode. */
    private void upvote2(UUID owner, UUID firstLineId) {
        TeamChatThreadEntity resolved = threads.findById(
                lines.findById(firstLineId).orElseThrow().getThreadId()).orElseThrow();
        TeamChatLineEntity second = line(owner, resolved.getId(), "GUEST", "falat", "régi sor 2", resolved.getOpenedAt());
        tx.executeWithoutResult(s -> feedback.upsertVerdict(owner, MessageFeedbackEntity.KIND_TEAM_CHAT_LINE,
                second.getId(), MessageFeedbackEntity.VERDICT_UP, null));
    }
}
