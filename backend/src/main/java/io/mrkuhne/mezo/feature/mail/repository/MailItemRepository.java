package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailItemEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** MailItem rows: the parcel upsert key, the open-item read of the digest. */
public interface MailItemRepository extends JpaRepository<MailItemEntity, UUID> {

    boolean existsByMessageId(UUID messageId);

    Optional<MailItemEntity> findByCreatedByAndCarrierAndParcelKey(UUID createdBy, String carrier, String parcelKey);

    /**
     * The owner's items still open at {@code anchor} that were first seen (or, for a parcel, last changed) before
     * {@code before} — the rolling lists of spec §10.1.
     */
    @Query("select i from MailItemEntity i where i.createdBy = :owner and i.openUntil > :anchor "
        + "and i.stateChangedAt < :before")
    List<MailItemEntity> open(@Param("owner") UUID owner, @Param("anchor") Instant anchor,
                              @Param("before") Instant before);
}
