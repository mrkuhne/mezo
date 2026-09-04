package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCandidate;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCardService;
import io.mrkuhne.mezo.feature.proactive.service.SetupCheckService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S4 (bd mezo-d58h.4, spec §4 severity order + §5): ONE advice card per day across ALL tiers, and
 * a strictly higher-severity candidate arriving later in the day SUPERSEDES the incumbent instead
 * of being dropped (the S3 shape — two independent first-wins gates — is what this replaces).
 */
@ActiveProfiles("companion-fake")
class AdviceCardServiceIT extends AbstractIntegrationTest {

    @Autowired private AdviceCardService adviceCardService;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;

    private AdviceCandidate flag(String flagKey) {
        return AdviceCandidate.fromFlag(flagKey, flagKey + "_entry", "Mezo · észrevétel",
            List.of("tény"), List.of("javaslat"), "Sablon-szöveg.");
    }

    private AdviceCandidate setup(String checkKey) {
        return AdviceCandidate.fromSetupCheck(checkKey, "Mezo · beállítás",
            List.of("Állítsd be az alvás-célt."), "Állítsd be az alvás-célt.");
    }

    @Test
    void testDeliver_shouldWriteAnAdviceCard() {
        UUID owner = userPopulator.createUser().getId();

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_ADVICE);
        assertThat(card.orElseThrow().getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(card.orElseThrow().getContent().interventionKey()).isEqualTo("sleep_debt_entry");
        assertThat(card.orElseThrow().getContent().facts()).containsExactly("tény");
        assertThat(card.orElseThrow().getContent().suggestions()).containsExactly("javaslat");
    }

    @Test
    void testDeliver_shouldRejectALowerSeverityCandidate_whenTheDayAlreadyHasACard() {
        UUID owner = userPopulator.createUser().getId();
        adviceCardService.deliver(owner, flag(FlagKey.MISSED_WORKOUTS));

        assertThat(adviceCardService.deliver(owner, flag(FlagKey.LOGGING_GAP))).isEmpty();

        assertThat(todaysCard(owner).getContent().adviceKey()).isEqualTo(FlagKey.MISSED_WORKOUTS);
    }

    /** S5 (bd mezo-d58h.5, spec §6): the delivered card carries the {@code sleep_debt} action
     *  ({@link io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey#SHIFT_SLEEP_ANCHOR})
     *  when the user has a sleep-goal row, and NONE when they don't — asserted through the
     *  delivery path (not the catalog directly), since that is what actually reaches the wire. */
    @Test
    void testDeliver_shouldOfferShiftSleepAnchor_whenSleepDebtAndGoalRowExists() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().actions()).hasSize(1);
        assertThat(card.orElseThrow().getContent().actions().get(0).key())
            .isEqualTo(io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey.SHIFT_SLEEP_ANCHOR);
    }

    @Test
    void testDeliver_shouldOfferNoActions_whenSleepDebtAndNoGoalRow() {
        UUID owner = userPopulator.createUser().getId();

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().actions()).isEmpty();
    }

    /** S6 (bd mezo-d58h.6): the delivered {@code joint_overuse} card carries the {@code
     *  lighten_tomorrow} action, and specifically NOT {@code shift_sleep_anchor} — the
     *  cross-check that catches a copy-paste mapping error in the catalog. */
    @Test
    void testDeliver_shouldOfferLightenTomorrow_whenJointOveruse() {
        UUID owner = userPopulator.createUser().getId();

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.JOINT_OVERUSE));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().actions()).hasSize(1);
        assertThat(card.orElseThrow().getContent().actions().get(0).key())
            .isEqualTo(io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey.LIGHTEN_TOMORROW);
    }

    /** S6: the delivered {@code ignored_nudge} card carries {@code shift_sleep_anchor} when a
     *  sleep-goal row exists, and specifically NOT {@code lighten_tomorrow}. */
    @Test
    void testDeliver_shouldOfferShiftSleepAnchor_whenIgnoredNudgeAndGoalRowExists() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.IGNORED_NUDGE));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().actions()).hasSize(1);
        assertThat(card.orElseThrow().getContent().actions().get(0).key())
            .isEqualTo(io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey.SHIFT_SLEEP_ANCHOR);
    }

    /** S6: the catalog must not assume {@code ignored_nudge}'s rule gate guarantees a goal row —
     *  it re-checks the repository itself, so the offer is absent without one. */
    @Test
    void testDeliver_shouldOfferNoActions_whenIgnoredNudgeAndNoGoalRow() {
        UUID owner = userPopulator.createUser().getId();

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.IGNORED_NUDGE));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().actions()).isEmpty();
    }

    /** Equal rank never churns the card — a re-raise of the same flag must leave the row (and its
     *  „Segített?" votes) exactly where they are. */
    @Test
    void testDeliver_shouldRejectAnEqualSeverityCandidate() {
        UUID owner = userPopulator.createUser().getId();
        UUID firstId = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT)).orElseThrow().getId();

        assertThat(adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT))).isEmpty();

        assertThat(todaysCard(owner).getId()).isEqualTo(firstId);
    }

    @Test
    void testDeliver_shouldSupersedeTheDaysCard_whenTheCandidateIsMoreSevere() {
        UUID owner = userPopulator.createUser().getId();
        UUID lowId = adviceCardService.deliver(owner, flag(FlagKey.LOGGING_GAP)).orElseThrow().getId();

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.MISSED_WORKOUTS));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getId()).isNotEqualTo(lowId);
        // The partial unique index is per (user, day, kind) on LIVE rows — the loser is soft-deleted.
        assertThat(todaysCard(owner).getContent().adviceKey()).isEqualTo(FlagKey.MISSED_WORKOUTS);
        assertThat(companionMessageRepository.findById(lowId)).isEmpty();
    }

    /** The whole point of S4 item 1: a setup card and a flag card can no longer both land today. */
    @Test
    void testDeliver_shouldSubsumeSetupCards_inTheSameGate() {
        UUID owner = userPopulator.createUser().getId();
        adviceCardService.deliver(owner, setup(SetupCheckService.CHECK_MISSING_SLEEP_GOAL));

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT));

        assertThat(card).isPresent();
        assertThat(companionMessageRepository
            .findByCreatedByAndMessageDateOrderByGeneratedAtAsc(owner, LocalDate.now()))
            .hasSize(1);
        assertThat(todaysCard(owner).getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
    }

    /**
     * bd mezo-d58h.4 concurrency defect: {@code FlagService.evaluateAndLog} can raise several
     * flags in one evaluation, and {@code InterventionEventListener} delivers each
     * {@code FlagRaisedEvent} {@code @Async} AFTER_COMMIT — so two {@code deliver} calls for the
     * SAME user genuinely run on separate threads at the same time. {@code @Transactional} does
     * NOT propagate across threads, so this test — real threads, no shared transaction, a latch
     * forcing both to reach {@code deliver}'s gate together — reproduces exactly that race
     * instead of merely asserting the two calls in sequence (which would prove nothing about the
     * gate's atomicity). Without the advisory lock in {@code AdviceCardService.deliver}, both
     * threads can read "no incumbent" before either writes, and whichever thread's insert
     * commits first wins — independent of severity. With the lock, the loser queues, re-reads
     * the winner's committed row, and {@link io.mrkuhne.mezo.feature.proactive.service.AdvicePriority}
     * decides. Without the lock, WHICH candidate reads "no incumbent" first — and so which one's
     * insert commits first — is arbitrary JVM thread scheduling: a single trial can pass by luck.
     * Repeating with a fresh user each time makes a lucky all-green run astronomically unlikely
     * if the gate is not actually atomic, without making any single trial itself flaky.
     */
    @Test
    void testDeliver_concurrentCallsForTheSameUser_leaveTheHigherSeverityCard() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            for (int trial = 0; trial < 20; trial++) {
                UUID owner = userPopulator.createUser().getId();
                CountDownLatch bothReady = new CountDownLatch(2);
                CountDownLatch go = new CountDownLatch(1);

                // MISSED_WORKOUTS outranks LOGGING_GAP (AdvicePriority.ORDER) regardless of
                // which thread's transaction commits first.
                Future<Optional<CompanionMessageEntity>> lowSeverity = executor.submit(() -> {
                    bothReady.countDown();
                    await(go);
                    return adviceCardService.deliver(owner, flag(FlagKey.LOGGING_GAP));
                });
                Future<Optional<CompanionMessageEntity>> highSeverity = executor.submit(() -> {
                    bothReady.countDown();
                    await(go);
                    return adviceCardService.deliver(owner, flag(FlagKey.MISSED_WORKOUTS));
                });

                assertThat(bothReady.await(5, TimeUnit.SECONDS))
                    .as("trial %d: both threads reached the gate", trial).isTrue();
                go.countDown();

                lowSeverity.get(10, TimeUnit.SECONDS);
                highSeverity.get(10, TimeUnit.SECONDS);

                assertThat(todaysCard(owner).getContent().adviceKey())
                    .as("trial %d", trial).isEqualTo(FlagKey.MISSED_WORKOUTS);
                assertThat(companionMessageRepository
                    .findByCreatedByAndMessageDateOrderByGeneratedAtAsc(owner, LocalDate.now()))
                    .as("trial %d", trial).hasSize(1);
            }
        } finally {
            executor.shutdownNow();
        }
    }

    private void await(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private CompanionMessageEntity todaysCard(UUID owner) {
        return companionMessageRepository.findByCreatedByAndMessageDateAndKind(
            owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE).orElseThrow();
    }
}
