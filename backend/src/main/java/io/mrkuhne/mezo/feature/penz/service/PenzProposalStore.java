package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.entity.PenzProposalEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzProposalJson;
import io.mrkuhne.mezo.feature.penz.repository.PenzProposalRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one short write of a new proposal (mezo-r36n9.105, build notes call 15): every still-proposed proposal of the
 * same kind becomes {@code superseded}, then the new one is stored {@code proposed}. Kept apart so the model call of
 * {@link PenzProposalService#create} runs outside any transaction.
 */
@Service
@RequiredArgsConstructor
public class PenzProposalStore {

    private final PenzProposalRepository repository;

    @Transactional
    public PenzProposalEntity insert(UUID owner, String kind, long amountMinor, String month, PenzProposalJson body) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        for (PenzProposalEntity old : repository.findByCreatedByAndKindAndStatusAndDeletedFalse(owner, kind,
            PenzProposalEntity.STATUS_PROPOSED)) {
            old.setStatus(PenzProposalEntity.STATUS_SUPERSEDED);
            old.setUpdatedAt(now);
        }
        PenzProposalEntity row = new PenzProposalEntity();
        row.setCreatedBy(owner);
        row.setKind(kind);
        row.setStatus(PenzProposalEntity.STATUS_PROPOSED);
        row.setAmountHufMinor(amountMinor);
        row.setMonth(month);
        row.setBody(body);
        row.setPlan(new ArrayList<>());
        return repository.saveAndFlush(row);
    }
}
