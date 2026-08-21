package io.mrkuhne.mezo.feature.journal.service;

import io.mrkuhne.mezo.api.dto.CreateGratitudeEntryRequest;
import io.mrkuhne.mezo.api.dto.GratitudeEntryResponse;
import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import io.mrkuhne.mezo.feature.journal.mapper.GratitudeMapper;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
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

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")
public class GratitudeService {

    private final GratitudeEntryRepository gratitudeEntryRepository;
    private final GratitudeMapper gratitudeMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public GratitudeEntryResponse create(UUID userId, CreateGratitudeEntryRequest request) {
        GratitudeEntryEntity e = new GratitudeEntryEntity();
        e.setCreatedBy(userId);
        e.setOccurredOn(request.getOccurredOn() == null ? LocalDate.now() : request.getOccurredOn());
        e.setText(request.getText());
        e.setLifeArea(request.getLifeArea());
        GratitudeEntryEntity saved = gratitudeEntryRepository.saveAndFlush(e);
        eventPublisher.publishEvent(new GratitudeEntrySavedEvent(saved.getId()));
        return gratitudeMapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<GratitudeEntryResponse> list(UUID userId, LocalDate from, LocalDate to) {
        return gratitudeEntryRepository
            .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(userId, from, to)
            .stream().map(gratitudeMapper::toResponse).toList();
    }

    @Transactional
    public void delete(UUID userId, UUID entryId) {
        GratitudeEntryEntity e = findOwned(userId, entryId);
        gratitudeEntryRepository.delete(e); // @SQLDelete -> soft delete
        eventPublisher.publishEvent(new GratitudeEntryDeletedEvent(e.getId()));
    }

    private GratitudeEntryEntity findOwned(UUID userId, UUID entryId) {
        return gratitudeEntryRepository.findByIdAndCreatedByAndDeletedFalse(entryId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("GRATITUDE_ENTRY_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
