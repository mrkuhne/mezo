package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.dto.LogSleepRequest;
import io.mrkuhne.mezo.feature.biometrics.sleep.dto.SleepLogResponse;
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
        e.setDate(req.date());
        e.setBedtime(req.bedtime());
        e.setWakeup(req.wakeup());
        e.setDurationH(req.durationH());
        e.setQuality(req.quality());
        e.setAwakenings(req.awakenings());
        e.setNotes(req.note());
        return mapper.toResponse(repository.save(e));
    }
}
