package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import io.mrkuhne.mezo.feature.penz.repository.PenzDigestRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes and reads the owner's daily digest row (mezo-r36n9.104). Its own bean so the write is one short
 * transaction that never spans the feed fetches or the LLM call of {@link PenzDigestService#build}.
 */
@Service
@RequiredArgsConstructor
public class PenzDigestStore {

    private final PenzDigestRepository digests;

    /** Replaces the owner's digest for {@code date}: the old row is removed and the new one saved, atomically. */
    @Transactional
    public PenzDigestEntity replace(UUID owner, LocalDate date, String status, List<PenzDigestItemJson> items,
                                    Instant generatedAt, LocalDate pricesAsOf) {
        digests.purgeDay(owner, date);
        PenzDigestEntity row = new PenzDigestEntity();
        row.setCreatedBy(owner);
        row.setDigestDate(date);
        row.setStatus(status);
        row.setItems(new ArrayList<>(items));
        row.setGeneratedAt(generatedAt);
        row.setUpdatedAt(generatedAt);
        row.setPricesAsOf(pricesAsOf);
        return digests.saveAndFlush(row);
    }

    public Optional<PenzDigestEntity> find(UUID owner, LocalDate date) {
        return digests.findByCreatedByAndDigestDateAndDeletedFalse(owner, date);
    }
}
