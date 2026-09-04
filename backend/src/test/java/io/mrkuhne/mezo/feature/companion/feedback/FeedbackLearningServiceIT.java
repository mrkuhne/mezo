package io.mrkuhne.mezo.feature.companion.feedback;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
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
}
