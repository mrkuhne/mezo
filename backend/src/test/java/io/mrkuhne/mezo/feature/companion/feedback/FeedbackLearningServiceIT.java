package io.mrkuhne.mezo.feature.companion.feedback;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.service.OneTimeQuestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * W4.2 rollup-layer math (bd mezo-b3pp.16, spec §8.2): per-surface effectiveness, per-feed-kind
 * effectiveness (joined through companion_message), and the style (down-reason) histogram — all
 * inside the configured trailing window, with out-of-window rows excluded.
 */
class FeedbackLearningServiceIT extends AbstractIntegrationTest {

    @Autowired private FeedbackLearningService feedbackLearningService;
    @Autowired private FeedbackRollupRepository feedbackRollupRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FeedbackPopulator feedbackPopulator;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private CompanionProperties companionProperties;
    @Autowired private TeamChatThreadRepository teamChatThreadRepository;
    @Autowired private TeamChatLineRepository teamChatLineRepository;

    @Test
    void testComputeRollups_shouldUpsertElevenScopes_always() {
        UUID owner = userPopulator.createUser().getId();

        int upserted = feedbackLearningService.computeRollups(owner);

        // 11 surface/feed/style scopes + one intervention:<key> scope per configured library entry
        assertThat(upserted).isEqualTo(11 + companionProperties.interventions().size());
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:chat_message", 30))
            .isPresent();
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:chat_message", 30)
            .orElseThrow().getStats().total()).isZero();
    }

    @Test
    void testComputeRollups_shouldCountUpDownPerSurface_whenVerdictsSeeded() {
        UUID owner = userPopulator.createUser().getId();
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_UP, null);
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_UP, null);
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_TOO_MUCH);
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_MEMOIR, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_UP, null);

        feedbackLearningService.computeRollups(owner);

        FeedbackRollupEntity chatRollup = feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:chat_message", 30)
            .orElseThrow();
        assertThat(chatRollup.getStats().up()).isEqualTo(2);
        assertThat(chatRollup.getStats().down()).isEqualTo(1);
        assertThat(chatRollup.getStats().total()).isEqualTo(3);

        FeedbackRollupEntity memoirRollup = feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:memoir", 30)
            .orElseThrow();
        assertThat(memoirRollup.getStats().up()).isEqualTo(1);
        assertThat(memoirRollup.getStats().down()).isZero();
    }

    @Test
    void testComputeRollups_shouldBucketFeedVerdictsByJoinedCompanionMessageKind() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity morning = companionMessagePopulator.createMessage(
            owner, LocalDate.now(), CompanionMessageEntity.KIND_MORNING, "Jó reggelt", java.util.List.of("teszt"));
        CompanionMessageEntity evening = companionMessagePopulator.createMessage(
            owner, LocalDate.now(), CompanionMessageEntity.KIND_EVENING, "Jó estét", java.util.List.of("teszt"));
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE, morning.getId(),
            MessageFeedbackEntity.VERDICT_UP, null);
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE, evening.getId(),
            MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_BAD_TIMING);

        feedbackLearningService.computeRollups(owner);

        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "feed:morning", 30)
            .orElseThrow().getStats().up()).isEqualTo(1);
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "feed:evening", 30)
            .orElseThrow().getStats().down()).isEqualTo(1);
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "feed:sleep", 30)
            .orElseThrow().getStats().total()).isZero();
    }

    @Test
    void testComputeRollups_shouldBuildStyleHistogramPerSurface_fromDownReasonsOnly() {
        UUID owner = userPopulator.createUser().getId();
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_INACCURATE);
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_INACCURATE);
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_UP, null);

        feedbackLearningService.computeRollups(owner);

        FeedbackRollupEntity styleRollup = feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "style", 30)
            .orElseThrow();
        assertThat(styleRollup.getStats().bySurface().get("chat_message").inaccurate()).isEqualTo(2);
        assertThat(styleRollup.getStats().bySurface().get("chat_message").tooMuch()).isZero();
        assertThat(styleRollup.getStats().bySurface().get("memoir").inaccurate()).isZero();
    }

    @Test
    void testComputeRollups_shouldExcludeVerdictsOutsideTheWindow() {
        UUID owner = userPopulator.createUser().getId();
        Instant tooOld = Instant.now().minus(31, ChronoUnit.DAYS);
        feedbackPopulator.createVerdictAt(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_UP, null, tooOld);

        feedbackLearningService.computeRollups(owner);

        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:chat_message", 30)
            .orElseThrow().getStats().total()).isZero();
    }

    @Test
    void testComputeRollups_shouldIncludeReVotedVerdict_whenOnlyUpdatedAtIsInsideTheWindow() {
        UUID owner = userPopulator.createUser().getId();
        UUID artifactId = UUID.randomUUID();
        Instant longBeforeTheWindow = Instant.now().minus(40, ChronoUnit.DAYS);
        feedbackPopulator.createVerdictAt(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, artifactId,
            MessageFeedbackEntity.VERDICT_UP, null, longBeforeTheWindow);

        // the real write path: on-conflict-do-update bumps updated_at but leaves created_at at the
        // 40-day-old first vote — the rollup must still see this fresh 👍→👎 flip
        MessageFeedbackEntity reVoted = feedbackPopulator.revote(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE,
            artifactId, MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_INACCURATE);
        assertThat(reVoted.getCreatedAt()).isBefore(Instant.now().minus(35, ChronoUnit.DAYS));
        assertThat(reVoted.getUpdatedAt()).isAfter(Instant.now().minus(1, ChronoUnit.DAYS));

        feedbackLearningService.computeRollups(owner);

        FeedbackRollupEntity chatRollup = feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:chat_message", 30)
            .orElseThrow();
        assertThat(chatRollup.getStats().down()).isEqualTo(1);
        assertThat(chatRollup.getStats().up()).isZero();
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "style", 30)
            .orElseThrow().getStats().bySurface().get("chat_message").inaccurate()).isEqualTo(1);
    }

    @Test
    void testComputeRollups_shouldOverwriteInPlace_whenRunTwice() {
        UUID owner = userPopulator.createUser().getId();
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_UP, null);
        feedbackLearningService.computeRollups(owner);
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
            MessageFeedbackEntity.VERDICT_UP, null);

        int upserted = feedbackLearningService.computeRollups(owner);

        // still the same row count, not doubled — overwritten in place
        assertThat(upserted).isEqualTo(11 + companionProperties.interventions().size());
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:chat_message", 30)
            .orElseThrow().getStats().up()).isEqualTo(2);
    }

    @Test
    void interventionScopesAreZeroFilledForEveryLibraryKey() {
        UUID owner = userPopulator.createUser().getId();

        feedbackLearningService.computeRollups(owner);

        for (CompanionProperties.Intervention entry : companionProperties.interventions()) {
            FeedbackRollupEntity rollup = feedbackRollupRepository
                .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "intervention:" + entry.key(), 30)
                .orElseThrow();
            assertThat(rollup.getStats().up()).isZero();
            assertThat(rollup.getStats().down()).isZero();
            assertThat(rollup.getStats().total()).isZero();
        }
    }

    @Test
    void interventionVerdictRollsUpUnderItsKey() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity stressReset = companionMessagePopulator.createIntervention(
            owner, LocalDate.now(), "stress_reset", "Tarts egy tudatos lezárást ma este.", Instant.now());
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE, stressReset.getId(),
            MessageFeedbackEntity.VERDICT_UP, null);

        feedbackLearningService.computeRollups(owner);

        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "intervention:stress_reset", 30)
            .orElseThrow().getStats().up()).isEqualTo(1);
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "intervention:stress_reset", 30)
            .orElseThrow().getStats().total()).isEqualTo(1);
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "intervention:stress_talk", 30)
            .orElseThrow().getStats().total()).isZero();
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:feed_message", 30)
            .orElseThrow().getStats().up()).isEqualTo(1);
    }

    /** Csapatfal Act III Task 6 (mezo-a9bo7.21): a 👍 on a team chat line counts under its ügy's
     *  library entry — the chat is the advice card's successor, so its verdicts feed the same
     *  selection signal. A foreign user's line with the same key never leaks in. */
    @Test
    void testComputeRollups_shouldCountATeamChatLineVerdict_underItsThreadsAdviceKey() {
        UUID owner = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        TeamChatLineEntity line = teamChatLine(owner, "stress_reset");
        TeamChatLineEntity foreign = teamChatLine(other, "stress_reset");
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_TEAM_CHAT_LINE, line.getId(),
            MessageFeedbackEntity.VERDICT_UP, null);
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_TEAM_CHAT_LINE, foreign.getId(),
            MessageFeedbackEntity.VERDICT_UP, null);

        feedbackLearningService.computeRollups(owner);

        FeedbackRollupEntity rollup = feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "intervention:stress_reset", 30)
            .orElseThrow();
        assertThat(rollup.getStats().up()).isEqualTo(1);
        assertThat(rollup.getStats().total()).isEqualTo(1);
        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "intervention:stress_talk", 30)
            .orElseThrow().getStats().total()).isZero();
    }

    private TeamChatLineEntity teamChatLine(UUID owner, String adviceKey) {
        TeamChatThreadEntity thread = new TeamChatThreadEntity();
        thread.setCreatedBy(owner);
        thread.setFlagKey("sustained_stress");
        thread.setOwnerCharacter("deru");
        thread.setAdviceKey(adviceKey);
        thread.setStatus("OPEN");
        thread.setOpenedAt(Instant.now());
        thread = teamChatThreadRepository.saveAndFlush(thread);
        TeamChatLineEntity line = new TeamChatLineEntity();
        line.setCreatedBy(owner);
        line.setThreadId(thread.getId());
        line.setKind("OPEN");
        line.setCharacter("deru");
        line.setBody("Tarts egy tudatos lezárást ma este.");
        line.setOccurredAt(Instant.now());
        return teamChatLineRepository.saveAndFlush(line);
    }

    /** S4 (mezo-d58h.4): after Tasks 8-9 flip the flag-sourced card writer to {@code kind=advice},
     *  a flag-sourced advice row (interventionKey set, same envelope field as a pre-S4 intervention
     *  row) must still roll up under its library-entry scope — the twin of
     *  {@link #interventionVerdictRollsUpUnderItsKey}. */
    @Test
    void testComputeRollups_shouldCountAnAdviceCardsVerdict_underItsLibraryEntryScope() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = companionMessagePopulator.createAdvice(owner, LocalDate.now(),
            "sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel",
            "Az elmúlt éjszakák alváshiánya összeadódott.", java.util.List.of("tény"),
            java.util.List.of("javaslat"), Instant.now());
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE, card.getId(),
            MessageFeedbackEntity.VERDICT_UP, null);

        feedbackLearningService.computeRollups(owner);

        assertThat(feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner,
                FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX + "sleep_recover_tonight", 30)
            .orElseThrow().getStats().up()).isEqualTo(1);
    }

    /** Round 2 S5 (bd mezo-d58h.7.5): a verdict on a once-ever QUESTION card is an ANSWER, not a
     *  rating — it must not move any effectiveness scope. Without the exclusion the up-count below
     *  would be 1, and the rollup would be learning from the system's own survey. */
    @Test
    void testComputeRollups_shouldIgnoreVerdictsOnQuestionCards() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity question = companionMessagePopulator.createQuestion(owner,
            LocalDate.now(), OneTimeQuestionService.QUESTION_FLAT_FEEDBACK,
            OneTimeQuestionService.EYEBROW, "Kérdés?", java.util.List.of(),
            java.util.List.of("👍", "👎"), Instant.now());
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE,
            question.getId(), MessageFeedbackEntity.VERDICT_UP, null);

        feedbackLearningService.computeRollups(owner);

        FeedbackRollupEntity surface = feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:feed_message", 30)
            .orElseThrow();
        assertThat(surface.getStats().up()).isZero();
        assertThat(surface.getStats().total()).isZero();
    }
}
