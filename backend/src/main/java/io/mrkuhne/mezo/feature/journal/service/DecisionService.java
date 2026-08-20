package io.mrkuhne.mezo.feature.journal.service;

import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.ReviewDecisionRequest;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.journal.entity.DecisionContextEnvelope;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.mapper.DecisionMapper;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Decision journal lifecycle (Phase 5 W1.4, bd mezo-b3pp.4, spec §5.4): create — freezing the
 * server's OWN context snapshot, never the client's — list newest-first, and review (rating +
 * outcome). Both writes publish {@link DecisionEntrySavedEvent} for the companion embed listener.
 * Gated {@code JOURNAL_SWITCH}, exactly like {@code JournalService}.
 *
 * <p>The assembler arrives through an {@link ObjectProvider} because it is
 * {@code @ConditionalOnProperty(COMPANION_SWITCH)}: with the companion off there is no snapshot to
 * take, and the honest record of that is an EMPTY snapshotText — not a fabricated one, and not a
 * failed decision write (IDENT-3).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")
public class DecisionService {

    private final DecisionEntryRepository repository;
    private final DecisionMapper mapper;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectProvider<ContextSnapshotAssembler> contextSnapshotAssembler;
    private final CompanionProperties companionProperties;

    @Transactional
    public DecisionEntryResponse create(UUID userId, CreateDecisionEntryRequest request) {
        LocalDate decidedOn = request.getDecidedOn() == null ? LocalDate.now() : request.getDecidedOn();
        DecisionEntryEntity e = new DecisionEntryEntity();
        e.setCreatedBy(userId);
        e.setDecidedOn(decidedOn);
        e.setDecisionText(request.getDecisionText());
        e.setContextSnapshot(captureSnapshot(userId));
        e.setReviewDue(decidedOn.plusDays(companionProperties.journal().decisionReviewDays()));
        DecisionEntryEntity saved = repository.saveAndFlush(e);
        eventPublisher.publishEvent(new DecisionEntrySavedEvent(saved.getId()));
        return mapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<DecisionEntryResponse> list(UUID userId) {
        return repository.findByCreatedByAndDeletedFalseOrderByDecidedOnDescCreatedAtDesc(userId)
            .stream().map(mapper::toResponse).toList();
    }

    /**
     * Records how the decision turned out. Re-runnable on purpose (PUT semantics): refining an
     * outcome later overwrites rating/text and restamps {@code reviewedAt} — no 409, because the
     * L2 inbox's "already decided" guard protects an approval transition, not your own hindsight.
     */
    @Transactional
    public DecisionEntryResponse review(UUID userId, UUID decisionId, ReviewDecisionRequest request) {
        DecisionEntryEntity e = repository.findByIdAndCreatedByAndDeletedFalse(decisionId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("DECISION_ENTRY_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        e.setOutcomeRating(request.getOutcomeRating().shortValue());
        e.setOutcomeText(request.getOutcomeText());
        e.setReviewedAt(Instant.now());
        DecisionEntryEntity saved = repository.saveAndFlush(e);
        eventPublisher.publishEvent(new DecisionEntrySavedEvent(saved.getId()));
        return mapper.toResponse(saved);
    }

    private DecisionContextEnvelope captureSnapshot(UUID userId) {
        ContextSnapshotAssembler assembler = contextSnapshotAssembler.getIfAvailable();
        String text = assembler == null ? "" : assembler.render(userId, LocalDate.now());
        return new DecisionContextEnvelope(text, Instant.now());
    }
}
