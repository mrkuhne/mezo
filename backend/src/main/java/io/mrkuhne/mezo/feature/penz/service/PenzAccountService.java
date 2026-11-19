package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzAccountRequest;
import io.mrkuhne.mezo.api.dto.PenzAccountResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzAccountRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Money accounts (Boop Pénz L4, mezo-r36n9.102). At most one default and one savings-target account per owner:
 * setting either flag first takes it off every other account (the partial unique indexes enforce it).
 */
@Service
@RequiredArgsConstructor
public class PenzAccountService {

    private final PenzAccountRepository repository;
    private final PenzMapper mapper;

    @Transactional(readOnly = true)
    public List<PenzAccountResponse> list(UUID owner, boolean includeArchived) {
        List<PenzAccountEntity> rows = includeArchived
            ? repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)
            : repository.findByCreatedByAndArchivedFalseAndDeletedFalseOrderByNameAsc(owner);
        return rows.stream()
            .sorted(Comparator.comparing((PenzAccountEntity a) -> !a.isDefaultAccount()))
            .map(mapper::toResponse)
            .toList();
    }

    @Transactional
    public PenzAccountResponse create(UUID owner, PenzAccountRequest req) {
        clearFlags(owner, req);
        PenzAccountEntity row = new PenzAccountEntity();
        row.setCreatedBy(owner);
        apply(row, req);
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzAccountResponse update(UUID owner, UUID id, PenzAccountRequest req) {
        require(owner, id);
        clearFlags(owner, req);
        PenzAccountEntity row = require(owner, id); // re-read: the flag clear detached the context
        apply(row, req);
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzAccountResponse archive(UUID owner, UUID id) {
        PenzAccountEntity row = require(owner, id);
        row.setArchived(true);
        row.setDefaultAccount(false);
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    /** The owner's live account, else 404 {@code PENZ_ACCOUNT_NOT_FOUND} (another owner's id is a 404 too). */
    @Transactional(readOnly = true)
    public PenzAccountEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_ACCOUNT_NOT_FOUND"));
    }

    private void clearFlags(UUID owner, PenzAccountRequest req) {
        if (Boolean.TRUE.equals(req.getIsDefault())) {
            repository.clearDefault(owner);
        }
        if (Boolean.TRUE.equals(req.getIsSavingsTarget())) {
            repository.clearSavingsTarget(owner);
        }
    }

    private static void apply(PenzAccountEntity row, PenzAccountRequest req) {
        row.setName(req.getName().strip());
        row.setType(req.getType());
        row.setCurrency(req.getCurrency());
        row.setOpeningBalanceMinor(req.getOpeningBalanceMinor() == null ? 0L : req.getOpeningBalanceMinor());
        row.setDefaultAccount(Boolean.TRUE.equals(req.getIsDefault()));
        row.setSavingsTarget(Boolean.TRUE.equals(req.getIsSavingsTarget()));
        row.setSmsSender(req.getSmsSender() == null || req.getSmsSender().isBlank() ? null : req.getSmsSender().strip());
    }
}
