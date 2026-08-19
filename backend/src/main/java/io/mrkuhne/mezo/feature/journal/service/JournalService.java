package io.mrkuhne.mezo.feature.journal.service;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.api.dto.UpdateJournalEntryRequest;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.mapper.JournalMapper;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Free-prose journal entry lifecycle (Phase 5 W1.1, bd mezo-b3pp.1, spec §4.1): create (defaulting
 * {@code occurredOn} to today when absent), ranged listing newest-first, update (text and/or day),
 * and soft-delete. Create/update publish {@link JournalEntrySavedEvent}, delete publishes
 * {@link JournalEntryDeletedEvent} — Task 4's AFTER_COMMIT companion embed listener consumes both.
 * Gated {@code JOURNAL_SWITCH}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")
public class JournalService {

    private final JournalEntryRepository repository;
    private final JournalMapper mapper;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public JournalEntryResponse create(UUID userId, CreateJournalEntryRequest request) {
        JournalEntryEntity e = new JournalEntryEntity();
        e.setCreatedBy(userId);
        e.setOccurredOn(request.getOccurredOn() == null ? LocalDate.now() : request.getOccurredOn());
        e.setText(request.getText());
        e.setSource(request.getSource());
        JournalEntryEntity saved = repository.saveAndFlush(e);
        eventPublisher.publishEvent(new JournalEntrySavedEvent(saved.getId()));
        return mapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<JournalEntryResponse> list(UUID userId, LocalDate from, LocalDate to) {
        return repository
            .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(userId, from, to)
            .stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public JournalEntryResponse update(UUID userId, UUID entryId, UpdateJournalEntryRequest request) {
        JournalEntryEntity e = findOwned(userId, entryId);
        e.setText(request.getText());
        if (request.getOccurredOn() != null) {
            e.setOccurredOn(request.getOccurredOn());
        }
        JournalEntryEntity saved = repository.saveAndFlush(e);
        eventPublisher.publishEvent(new JournalEntrySavedEvent(saved.getId()));
        return mapper.toResponse(saved);
    }

    @Transactional
    public void delete(UUID userId, UUID entryId) {
        JournalEntryEntity e = findOwned(userId, entryId);
        repository.delete(e); // @SQLDelete -> soft delete
        eventPublisher.publishEvent(new JournalEntryDeletedEvent(e.getId()));
    }

    private JournalEntryEntity findOwned(UUID userId, UUID entryId) {
        return repository.findByIdAndCreatedByAndDeletedFalse(entryId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("JOURNAL_ENTRY_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
