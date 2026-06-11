package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.mapper.CheckInMapper;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CheckInService {

    private final CheckInRepository repository;
    private final CheckInMapper mapper;

    public List<CheckInResponse> listForDay(UUID createdBy, LocalDate date) {
        return repository.findByCreatedByAndDateOrderBySlotTime(createdBy, date).stream()
            .map(mapper::toResponse)
            .toList();
    }

    @Transactional
    public CheckInResponse save(UUID createdBy, SaveCheckInRequest req) {
        // Upsert on the (createdBy, date, slotTime) slot — one row per slot per day.
        // single-user app: no concurrency guard on the (created_by, date, slot_time) upsert; revisit (retry or ON CONFLICT) if multi-device lands
        CheckInEntity e = repository
            .findByCreatedByAndDateAndSlotTime(createdBy, req.getDate(), req.getSlotTime())
            .orElseGet(CheckInEntity::new);
        e.setCreatedBy(createdBy); // server-side from principal, never from client
        e.setDate(req.getDate());
        e.setSlotTime(req.getSlotTime());
        e.setState(req.getState());
        e.setEnergy(req.getEnergy());
        e.setStress(req.getStress());
        e.setBody(req.getBody());
        e.setMental(req.getMental());
        e.setNote(req.getNote());
        e.setSavedAt(Instant.now());
        return mapper.toResponse(repository.save(e));
    }
}
