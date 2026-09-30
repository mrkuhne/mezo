package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.FactMergeLedgerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** S9 (mezo-d6ivw.10): once-ever memory for the weekly fact merge. */
public interface FactMergeLedgerRepository extends JpaRepository<FactMergeLedgerEntity, UUID> {

    /** A member set already in the ledger (merged, proposed, undone or rejected) is never offered again. */
    boolean existsByCreatedByAndMemberKeyAndDeletedFalse(UUID createdBy, String memberKey);

    /** S9 Task 4: the whole once-ever blocklist for one user, read once per {@code runFor}. */
    List<FactMergeLedgerEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
