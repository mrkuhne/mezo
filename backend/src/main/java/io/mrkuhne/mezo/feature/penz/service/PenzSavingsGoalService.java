package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzSavingsGoalRequest;
import io.mrkuhne.mezo.api.dto.PenzSavingsGoalResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzSavingsGoalEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzSavingsGoalRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Savings goals and purchase plans — "mire gyűjtök" (Boop Pénz L5, mezo-r36n9.103). HUF only. A phone write
 * carrying a {@code clientRef} is idempotent: a native {@code INSERT … ON CONFLICT DO NOTHING} on the partial unique
 * index {@code (created_by, client_ref)}, then a read-back, so a retry returns the stored row.
 */
@Service
@RequiredArgsConstructor
public class PenzSavingsGoalService {

    private final PenzSavingsGoalRepository repository;
    private final PenzMapper mapper;

    public List<PenzSavingsGoalResponse> list(UUID owner) {
        return repository.findByCreatedByAndDeletedFalseOrderByPositionAscCreatedAtAsc(owner).stream()
            .map(mapper::toResponse).toList();
    }

    @Transactional
    public PenzSavingsGoalResponse create(UUID owner, PenzSavingsGoalRequest req) {
        if (req.getClientRef() != null) {
            Optional<PenzSavingsGoalEntity> replay = repository.findByCreatedByAndClientRefAndDeletedFalse(owner,
                req.getClientRef());
            if (replay.isPresent()) {
                return mapper.toResponse(replay.get());
            }
        }
        PenzSavingsGoalEntity row = new PenzSavingsGoalEntity();
        row.setCreatedBy(owner);
        apply(row, req);
        row.setPosition(req.getPosition() == null ? repository.nextPosition(owner) : req.getPosition());
        row.setClientRef(req.getClientRef());
        if (row.getClientRef() == null) {
            return mapper.toResponse(repository.saveAndFlush(row));
        }
        repository.insertIfAbsent(owner, row.getName(), row.getKind(), row.getTargetMinor(), row.getSavedMinor(),
            row.getDueDate(), row.getNote(), row.getPosition(), row.getClientRef());
        return mapper.toResponse(repository.findByCreatedByAndClientRefAndDeletedFalse(owner, row.getClientRef())
            .orElseThrow()); // just inserted, or the concurrent winner
    }

    @Transactional
    public PenzSavingsGoalResponse update(UUID owner, UUID id, PenzSavingsGoalRequest req) {
        PenzSavingsGoalEntity row = require(owner, id);
        apply(row, req);
        if (req.getPosition() != null) {
            row.setPosition(req.getPosition());
        }
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    /** Soft delete. */
    @Transactional
    public void delete(UUID owner, UUID id) {
        repository.delete(require(owner, id));
        repository.flush();
    }

    /** The owner's live savings goal, else 404 {@code PENZ_SAVINGS_GOAL_NOT_FOUND}. */
    private PenzSavingsGoalEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_SAVINGS_GOAL_NOT_FOUND"));
    }

    private static void apply(PenzSavingsGoalEntity row, PenzSavingsGoalRequest req) {
        String name = req.getName().strip();
        if (name.isEmpty()) {
            throw PenzErrors.field("name");
        }
        row.setName(name);
        row.setKind(req.getKind());
        row.setTargetMinor(req.getTargetHufMinor());
        row.setSavedMinor(req.getSavedHufMinor() == null ? 0L : req.getSavedHufMinor());
        row.setDueDate(req.getDueDate());
        row.setNote(blankToNull(req.getNote()));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
