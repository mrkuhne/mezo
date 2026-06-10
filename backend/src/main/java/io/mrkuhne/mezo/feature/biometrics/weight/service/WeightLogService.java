package io.mrkuhne.mezo.feature.biometrics.weight.service;

import io.mrkuhne.mezo.feature.biometrics.weight.dto.LogWeightRequest;
import io.mrkuhne.mezo.feature.biometrics.weight.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.mapper.WeightLogMapper;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WeightLogService {

    private final WeightLogRepository repository;
    private final WeightLogMapper mapper;

    public List<WeightLogResponse> list(UUID createdBy) {
        return repository.findAllOwned(createdBy).stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public WeightLogResponse log(UUID createdBy, LogWeightRequest req) {
        WeightLogEntity e = new WeightLogEntity();
        e.setCreatedBy(createdBy); // server-side from principal, never from client
        e.setDate(req.date());
        e.setWeightKg(req.weightKg());
        e.setNote(req.note());
        return mapper.toResponse(repository.save(e));
    }
}
