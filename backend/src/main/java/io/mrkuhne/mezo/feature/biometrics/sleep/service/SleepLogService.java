package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.api.dto.LogSleepRequest;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.mapper.SleepLogMapper;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SleepLogService {

    private final SleepLogRepository repository;
    private final SleepLogMapper mapper;
    private final ApplicationEventPublisher eventPublisher;

    public List<SleepLogResponse> list(UUID createdBy) {
        return repository.findAllOwned(createdBy).stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public SleepLogResponse log(UUID createdBy, LogSleepRequest req) {
        SleepHypnogram hypnogram = req.getHypnogram() == null ? null
            : new SleepHypnogram(req.getHypnogram().getBucketMin(), req.getHypnogram().getStages());
        SleepNightMerge.Entry entry = new SleepNightMerge.Entry(req.getBedtime(), req.getWakeup(), req.getDurationH(),
            req.getQuality(), req.getAwakenings(), req.getNote(), req.getInBedMin(), req.getAwakeMin(),
            req.getLightMin(), req.getRemMin(), req.getDeepMin(), req.getSourceQualityPct(), hypnogram,
            req.getSource());
        // One live night per date: merge into the date's row when there is one (locked), else insert.
        SleepLogEntity e = repository.findByCreatedByAndDateAndDeletedFalse(createdBy, req.getDate())
            .orElseGet(() -> {
                // Race-safe: insert-if-absent, then lock + load whichever row now owns the date.
                repository.insertLiveShellIfAbsent(createdBy, req.getDate());
                return repository.findByCreatedByAndDateAndDeletedFalse(createdBy, req.getDate()).orElseThrow();
            });
        SleepNightMerge.applyEntry(e, entry);
        SleepLogResponse resp = mapper.toResponse(repository.save(e));
        // AFTER_COMMIT listener (CompanionMessageEventListener) reacts once this row is durable.
        eventPublisher.publishEvent(new SleepLogSavedEvent(createdBy, req.getDate()));
        return resp;
    }
}
