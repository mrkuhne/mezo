package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzSmsMessageEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Ingested bank SMS: one live row per owner and text hash, inserted with a native ON CONFLICT DO NOTHING. */
public interface PenzSmsMessageRepository extends JpaRepository<PenzSmsMessageEntity, UUID> {

    Optional<PenzSmsMessageEntity> findByCreatedByAndTextHashAndDeletedFalse(UUID createdBy, String textHash);

    /**
     * Stores one SMS unless the owner already has a live one with the same {@code textHash}: 1 when inserted,
     * 0 for a replay (or a concurrent duplicate). The caller reads the row back by hash.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_sms_message (created_by, sender, text, text_hash, received_at, status, reason, kind,
                                      amount_minor, currency, merchant, parsed_date, category_name)
        values (:createdBy, :sender, :text, :textHash, :receivedAt, :status, :reason, :kind,
                :amountMinor, :currency, :merchant, :parsedDate, :categoryName)
        on conflict (created_by, text_hash) where is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("sender") String sender, @Param("text") String text,
                       @Param("textHash") String textHash, @Param("receivedAt") Instant receivedAt,
                       @Param("status") String status, @Param("reason") String reason, @Param("kind") String kind,
                       @Param("amountMinor") Long amountMinor, @Param("currency") String currency,
                       @Param("merchant") String merchant, @Param("parsedDate") LocalDate parsedDate,
                       @Param("categoryName") String categoryName);
}
