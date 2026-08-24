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
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * W5.2 (bd mezo-b3pp.19, spec §9.2) selection + delivery: highest-effectiveness eligible library
 * entry for a raised flag becomes today's {@code intervention} feed card. No class-level
 * {@code @Transactional} — {@link #listenerDeliversAfterCommit()} needs the flag-raise write to
 * really commit so the AFTER_COMMIT {@code InterventionEventListener} fires (the
 * {@code FlagServiceIT} precedent).
 */
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
        assertThat(row.getKind()).isEqualTo(CompanionMessageEntity.KIND_INTERVENTION);
        assertThat(row.getContent().interventionKey()).isEqualTo("recovery_rest_day");
        assertThat(row.getContent().eyebrow()).isEqualTo(InterventionService.EYEBROW);
        assertThat(row.getContent().body()).containsExactly(
            "Kevés alvás, kemény edzés, magas stressz — a tested most regenerációt kér. "
                + "A mai nap legyen pihenő vagy egészen könnyű mozgás.");
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
            owner, today, CompanionMessageEntity.KIND_INTERVENTION)).isEmpty();
    }

    @Test
    void secondCardSameDayIsSkipped() {
        UUID owner = ownerId();

        Optional<CompanionMessageEntity> first =
            interventionService.deliverForFlag(owner, FlagKey.RECOVERY_NEEDED);
        Optional<CompanionMessageEntity> second =
            interventionService.deliverForFlag(owner, FlagKey.SLEEP_DEBT);

        assertThat(first).isPresent();
        assertThat(second).isEmpty();
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateOrderByGeneratedAtAsc(
            owner, LocalDate.now()))
            .filteredOn(m -> CompanionMessageEntity.KIND_INTERVENTION.equals(m.getKind()))
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
            .findByCreatedByAndMessageDateAndKind(owner, today, CompanionMessageEntity.KIND_INTERVENTION))
            .hasValueSatisfying(m -> assertThat(m.getContent().interventionKey())
                .isIn("stress_reset", "stress_talk")));
    }
}
