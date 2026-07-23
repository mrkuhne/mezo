package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.api.dto.LogSleepRequest;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.mapper.SleepLogMapper;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SleepLogService {

    private final SleepLogRepository repository;
    private final SleepLogMapper mapper;

    public List<SleepLogResponse> list(UUID createdBy) {
        return repository.findAllOwned(createdBy).stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public SleepLogResponse log(UUID createdBy, LogSleepRequest req) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(createdBy); // server-side from principal, never from client
        e.setDate(req.getDate());
        e.setBedtime(req.getBedtime());
        e.setWakeup(req.getWakeup());
        e.setDurationH(req.getDurationH());
        e.setQuality(req.getQuality());
        e.setAwakenings(req.getAwakenings());
        e.setNotes(req.getNote());
        e.setInBedMin(req.getInBedMin());
        e.setAwakeMin(req.getAwakeMin());
        e.setLightMin(req.getLightMin());
        e.setRemMin(req.getRemMin());
        e.setDeepMin(req.getDeepMin());
        e.setSourceQualityPct(req.getSourceQualityPct());
        if (req.getSource() != null) {
            e.setSource(req.getSource()); // entity default stays "manual" when omitted
        }
        return mapper.toResponse(repository.save(e));
    }
}
