package io.mrkuhne.mezo.feature.proactive;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.companion.feedback.config.FeedbackLearningProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.InterventionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W5.2 (bd mezo-b3pp.19, spec §9.2) selection + delivery: highest-effectiveness eligible library
 * entry for a raised flag becomes today's {@code advice} feed card (S4, bd mezo-d58h.4 — delivery
 * now routes through {@code AdviceCardService}). No class-level {@code @Transactional} —
 * {@link #listenerDeliversAfterCommit()} needs the flag-raise write to really commit so the
 * AFTER_COMMIT {@code InterventionEventListener} fires (the {@code FlagServiceIT} precedent).
 *
 * <p>{@code @ActiveProfiles("companion-fake")}: delivery now goes through
 * {@code AdviceProseGenerator}, so this pins the fake chat model instead of wiring the real one
 * (the {@code AdviceCardServiceIT} precedent).
 */
@ActiveProfiles("companion-fake")
class InterventionServiceIT extends AbstractIntegrationTest {

    @Autowired private InterventionService interventionService;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private FeedbackRollupRepository feedbackRollupRepository;
    @Autowired private FeedbackLearningProperties feedbackLearningProperties;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private FlagService flagService;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private void seedRollup(UUID owner, String key, int up, int down) {
        FeedbackRollupEntity e = new FeedbackRollupEntity();
        e.setCreatedBy(owner);
        e.setScope(FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX + key);
        e.setWindowDays(feedbackLearningProperties.windowDays());
        e.setStats(FeedbackRollupStatsEnvelope.effectiveness(up, down));
        e.setComputedAt(Instant.now());
        feedbackRollupRepository.saveAndFlush(e);
    }

    @Test
    void raisedFlagWritesTheCard() {
        UUID owner = ownerId();

        Optional<CompanionMessageEntity> result = interventionService.deliverForFlag(owner, FlagKey.RECOVERY_NEEDED);

        assertThat(result).isPresent();
        CompanionMessageEntity row = result.get();
        assertThat(row.getKind()).isEqualTo(CompanionMessageEntity.KIND_ADVICE);
        assertThat(row.getContent().adviceKey()).isEqualTo(FlagKey.RECOVERY_NEEDED);
        assertThat(row.getContent().interventionKey()).isEqualTo("recovery_rest_day");
        assertThat(row.getContent().eyebrow()).isEqualTo(InterventionService.EYEBROW);
        // Unscripted advice call — the fake LLM's number-free default, not the library's own
        // textHu(): the prose now comes from AdviceProseGenerator, only falling back to
        // textHu() when the model call fails, answers blank, or invents a number.
        assertThat(row.getContent().body()).containsExactly(FakeCompanionLlm.ADVICE_DEFAULT_ANSWER);
        assertThat(row.getContent().refs()).isEmpty();
    }

    @Test
    void higherEffectivenessWins() {
        UUID owner = ownerId();
        seedRollup(owner, "stress_reset", 1, 3);
        seedRollup(owner, "stress_talk", 3, 1);

        Optional<CompanionMessageEntity> result =
            interventionService.deliverForFlag(owner, FlagKey.SUSTAINED_STRESS);

        assertThat(result).isPresent();
        assertThat(result.get().getContent().interventionKey()).isEqualTo("stress_talk");
    }

    @Test
    void unseenKeyBeatsVotedKey() {
        UUID owner = ownerId();
        seedRollup(owner, "stress_talk", 3, 1);

        Optional<CompanionMessageEntity> result =
            interventionService.deliverForFlag(owner, FlagKey.SUSTAINED_STRESS);

        assertThat(result).isPresent();
        assertThat(result.get().getContent().interventionKey()).isEqualTo("stress_reset");
    }

    /** No rollups seeded for either candidate ⇒ both {@code stress_reset}/{@code stress_talk} get
     *  the same {@code OPTIMISTIC_PRIOR} — a genuine tie, not "unseen beats voted" ({@link
     *  #unseenKeyBeatsVotedKey}). {@code Stream.max}'s FIRST-max-under-a-strict-comparator
     *  semantics must then fall through to config order (application.yml lists {@code
     *  stress_reset} before {@code stress_talk}), not, say, insertion order into the effectiveness
     *  map or any other incidental ordering. */
    @Test
    void tieBreakKeepsConfigOrder_whenBothCandidatesAreUnseen() {
        UUID owner = ownerId();

        Optional<CompanionMessageEntity> result =
            interventionService.deliverForFlag(owner, FlagKey.SUSTAINED_STRESS);

        assertThat(result).isPresent();
        assertThat(result.get().getContent().interventionKey()).isEqualTo("stress_reset");
    }

    @Test
    void perKeyCooldownSkipsToNextBest() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        companionMessagePopulator.createIntervention(owner, today.minusDays(1), "stress_reset",
            "…", Instant.now().minus(12, ChronoUnit.HOURS)); // 12h < 48h cooldown

        Optional<CompanionMessageEntity> result =
            interventionService.deliverForFlag(owner, FlagKey.SUSTAINED_STRESS);

        assertThat(result).isPresent();
        assertThat(result.get().getContent().interventionKey()).isEqualTo("stress_talk");
    }

    @Test
    void allKeysInCooldownDeliversNothing() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // distinct message_dates (uq_companion_message_created_by_date_kind allows only one
        // intervention row per calendar date); generatedAt (not message_date) drives the cooldown.
        companionMessagePopulator.createIntervention(owner, today.minusDays(1), "stress_reset",
            "…", Instant.now().minus(12, ChronoUnit.HOURS)); // 12h < 48h cooldown
        companionMessagePopulator.createIntervention(owner, today.minusDays(2), "stress_talk",
            "…", Instant.now().minus(12, ChronoUnit.HOURS)); // 12h < 72h cooldown

        Optional<CompanionMessageEntity> result =
            interventionService.deliverForFlag(owner, FlagKey.SUSTAINED_STRESS);

        assertThat(result).isEmpty();
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
            owner, today, CompanionMessageEntity.KIND_ADVICE)).isEmpty();
    }

    /** Under S4 the same-day gate is severity-based, not blanket ({@code AdviceCardService},
     *  {@code AdvicePriority}) — a same-day second raise is skipped only when it does NOT
     *  outrank the incumbent. SLEEP_DEBT outranks RECOVERY_NEEDED (spec §4 order), so the second
     *  raise here must stay skipped; {@link #listenerDeliversAfterCommit()} and
     *  {@code AdviceCardServiceIT} cover the supersede-by-higher-severity half. */
    @Test
    void secondCardSameDayIsSkipped() {
        UUID owner = ownerId();

        Optional<CompanionMessageEntity> first =
            interventionService.deliverForFlag(owner, FlagKey.SLEEP_DEBT);
        Optional<CompanionMessageEntity> second =
            interventionService.deliverForFlag(owner, FlagKey.RECOVERY_NEEDED);

        assertThat(first).isPresent();
        assertThat(second).isEmpty();
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateOrderByGeneratedAtAsc(
            owner, LocalDate.now()))
            .filteredOn(m -> CompanionMessageEntity.KIND_ADVICE.equals(m.getKind()))
            .hasSize(1);
    }

    /** Publish path e2e: FlagService.evaluateAndLog raises SUSTAINED_STRESS -> FlagRaisedEvent ->
     *  async InterventionEventListener -> card. Awaitility rides out the @Async hop (the
     *  CompanionMessageEventIT precedent). */
    @Test
    void listenerDeliversAfterCommit() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);

        flagService.evaluateAndLog(owner, FlagKey.SOURCE_WRITE);

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(companionMessageRepository
            .findByCreatedByAndMessageDateAndKind(owner, today, CompanionMessageEntity.KIND_ADVICE))
            .hasValueSatisfying(m -> assertThat(m.getContent().interventionKey())
                .isIn("stress_reset", "stress_talk")));
    }

    @Test
    void testDeliverForFlag_shouldWriteAnAdviceRowCarryingBothKeys() {
        UUID owner = ownerId();

        Optional<CompanionMessageEntity> card = interventionService.deliverForFlag(owner, FlagKey.SLEEP_DEBT);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_ADVICE);
        assertThat(card.orElseThrow().getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(card.orElseThrow().getContent().interventionKey()).isNotBlank();
    }

    /** The per-ENTRY cooldown must now see advice rows: a card written today under the new kind
     *  has to keep its own library entry out of the library for cooldownHours. Without this the
     *  cooldown silently stopped matching anything the moment the kind changed. */
    @Test
    void testDeliverForFlag_shouldRespectTheEntryCooldown_acrossAdviceRows() {
        UUID owner = ownerId();
        companionMessagePopulator.createAdvice(owner, LocalDate.now().minusDays(1),
            FlagKey.SLEEP_DEBT, "sleep_recover_tonight", InterventionService.EYEBROW,
            "tegnapi kártya", List.of(), List.of("javaslat"),
            Instant.now().minus(1, ChronoUnit.HOURS));

        Optional<CompanionMessageEntity> card = interventionService.deliverForFlag(owner, FlagKey.SLEEP_DEBT);

        // sleep_recover_tonight is the ONLY sleep_debt entry in the library and it is inside its
        // 48h cooldown, so there is no eligible entry left.
        assertThat(card).isEmpty();
    }
}
