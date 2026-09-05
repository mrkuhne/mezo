package io.mrkuhne.mezo.feature.proactive;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.companion.feedback.config.FeedbackLearningProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.InterventionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
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
    @Autowired private FlagLogPopulator flagLogPopulator;

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

    /** Publish path e2e: flag evaluation raises flags -> FlagRaisedEvent -> async
     *  InterventionEventListener -> card (per S4 severity gate, one card survives per day).
     *  Awaitility rides out the @Async hop (the CompanionMessageEventIT precedent). This
     *  fixture logs check-ins but no meals and no sleep—the same evaluation raises both
     *  SUSTAINED_STRESS (rank 12) and LOGGING_GAP (rank 6), so the S4 severity gate hands the
     *  day's single card to the higher-ranked LOGGING_GAP. The point the test pins is that the
     *  AFTER_COMMIT listener delivers a card at all, which it still does. */
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
            .hasValueSatisfying(m -> {
                assertThat(m.getContent().adviceKey()).isEqualTo(FlagKey.LOGGING_GAP);
                assertThat(m.getContent().interventionKey())
                    .isIn("logging_gap_restart", "logging_gap_sleep_suspicion");
            }));
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

    /** Whole-branch review fix (bd mezo-d58h.7.1): {@code protocol_lapse_resume}'s
     *  {@code cooldown-hours} was originally 168 (a week) — but {@link
     *  InterventionService#deliverForFlag}'s cooldown check is scoped PER INTERVENTION KEY PER
     *  USER, not per item, unlike {@code ProtocolLapseRule}'s own 7-day PER-ITEM cooldown. A 168h
     *  library-entry cooldown would have meant: once item A's card delivered, NO card for a
     *  different item B for a full week, even though the rule itself is happy to raise for B the
     *  next day — silently defeating the whole point of the per-item design. Now that the value
     *  is fixed to 24h (matching {@code cooldown-hours.protocol-lapse}), item A's card delivered
     *  48h ago — well past the FIXED 24h cooldown, but still well inside the OLD buggy 168h one —
     *  must NOT block item B's fresh raise from becoming a card. This is a genuine regression
     *  test for the config value, not just the rule's raise: it asserts a REAL {@code
     *  companion_message} row for item B, through the exact delivery path
     *  ({@code InterventionService.deliverForFlag}) real cards go through. */
    @Test
    void aDifferentItemsRaiseIsNotBlockedByAnEarlierItemsDeliveredCard() {
        UUID owner = ownerId();
        // Item A's card, delivered 48h ago — inside the OLD 168h cooldown, outside the FIXED 24h one.
        companionMessagePopulator.createAdvice(owner, LocalDate.now().minusDays(2),
            FlagKey.PROTOCOL_LAPSE, "protocol_lapse_resume", InterventionService.EYEBROW,
            "Magnézium kimaradt.", List.of(), List.of(),
            Instant.now().minus(48, ChronoUnit.HOURS));
        // Item B's fresh raise, today — the frozen payload deliverForFlag actually renders facts from.
        UUID otherPantryItemId = UUID.randomUUID();
        flagLogPopulator.raise(owner, FlagKey.PROTOCOL_LAPSE, FlagKey.SOURCE_SWEEP,
            FlagPayloadEnvelope.protocolLapse(new FlagPayloadEnvelope.ProtocolLapse(
                otherPantryItemId.toString(), "D3-vitamin", "wake", 2, 2,
                List.of(), null, 14, 12, 0.857, 0.60)));

        Optional<CompanionMessageEntity> card =
            interventionService.deliverForFlag(owner, FlagKey.PROTOCOL_LAPSE);

        assertThat(card).isPresent();
        assertThat(card.get().getContent().interventionKey()).isEqualTo("protocol_lapse_resume");
        assertThat(card.get().getContent().adviceKey()).isEqualTo(FlagKey.PROTOCOL_LAPSE);
        assertThat(card.get().getContent().facts()).anySatisfy(f -> assertThat(f).contains("D3-vitamin"));
    }
}
