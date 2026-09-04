package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The ONE writer of the day's coaching card (S4, bd mezo-d58h.4, spec §4 severity order + §5).
 * Replaces the two independent first-wins gates S1–S3 shipped ({@code InterventionService} on
 * {@code kind=intervention}, {@code SetupCheckService} on {@code kind=setup}), which between them
 * could land TWO cards on the same day.
 *
 * <p><b>Gate:</b> today's live {@code advice} row is the incumbent. A candidate that does not
 * STRICTLY outrank it ({@link AdvicePriority}) is dropped; one that does supersedes it — soft
 * delete + insert inside this method's transaction, which the partial unique index
 * {@code uq_companion_message_created_by_date_kind ... where is_deleted = false} permits. A
 * superseded card's „Segített?" votes are left dangling by design (spec §8.1 names a dangling
 * feedback artifact harmless in a single-user app).
 *
 * <p><b>Concurrency (bd mezo-d58h.4):</b> {@code FlagService.evaluateAndLog} can raise several
 * flags in one evaluation, each publishing a {@code FlagRaisedEvent} that
 * {@code InterventionEventListener} handles {@code @Async} AFTER_COMMIT — so two {@code deliver}
 * calls for the same user can race on separate threads. The gate above is a non-atomic
 * check-then-act, so without help the partial unique index would let commit ORDER, not
 * {@link AdvicePriority}, pick the day's card. {@code companionMessageRepository
 * .lockForDelivery} (a transaction-scoped {@code pg_advisory_xact_lock}, first statement in
 * {@link #deliver}) serializes deliveries per user so the read-then-write sequence is atomic
 * against other deliveries for the same user — see its javadoc for the full mechanism.
 *
 * <p><b>Not conditioned on {@code INTERVENTION_SWITCH}</b>, deliberately: {@code SetupCheckService}
 * (which runs without that switch) is one of its two callers, so gating this bean on the
 * intervention switch would fail the Spring context whenever that switch is off.
 *
 * <p>Per-source cooldowns are NOT here — they stay with the writer that owns their semantics (the
 * per-library-entry cooldown in {@code InterventionService}, the weekly per-check re-emit window in
 * {@code SetupCheckService}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class AdviceCardService {

    private final CompanionMessageRepository companionMessageRepository;
    private final AdviceProseGenerator adviceProseGenerator;

    @Transactional
    public Optional<CompanionMessageEntity> deliver(UUID userId, AdviceCandidate candidate) {
        // FIRST statement, before the incumbent read: see CompanionMessageRepository
        // .lockForDelivery's javadoc for the race this closes (bd mezo-d58h.4). Serializes
        // concurrent deliver() calls for the SAME user so the read-then-write gate below is
        // atomic against them — the loser waits here, then re-reads a committed incumbent.
        companionMessageRepository.lockForDelivery(userId);
        LocalDate today = LocalDate.now();
        Optional<CompanionMessageEntity> incumbent = companionMessageRepository
            .findByCreatedByAndMessageDateAndKind(userId, today, CompanionMessageEntity.KIND_ADVICE);
        if (incumbent.isPresent()) {
            String incumbentKey = incumbent.get().getContent().adviceKey();
            if (!AdvicePriority.outranks(candidate.adviceKey(), incumbentKey)) {
                log.info("Advice {} skipped for user {}: today's card ({}) ranks at least as high",
                    candidate.adviceKey(), userId, incumbentKey);
                return Optional.empty();
            }
            companionMessageRepository.delete(incumbent.get());
            companionMessageRepository.flush();
            log.info("Advice {} supersedes today's card ({}) for user {}",
                candidate.adviceKey(), incumbentKey, userId);
        }
        String prose = adviceProseGenerator.write(userId, candidate);
        CompanionMessageEntity row = new CompanionMessageEntity();
        row.setCreatedBy(userId);
        row.setMessageDate(today);
        row.setKind(CompanionMessageEntity.KIND_ADVICE);
        row.setContent(CompanionMessageEnvelope.advice(candidate.eyebrow(), prose,
            candidate.adviceKey(), candidate.interventionKey(), candidate.setupKey(),
            candidate.facts(), candidate.suggestions()));
        row.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        CompanionMessageEntity saved = companionMessageRepository.saveAndFlush(row);
        log.info("Advice {} delivered for user {}", candidate.adviceKey(), userId);
        return Optional.of(saved);
    }
}
