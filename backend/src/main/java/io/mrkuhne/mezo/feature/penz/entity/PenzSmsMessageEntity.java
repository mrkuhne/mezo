package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A bank SMS the iOS Shortcut posted (spec §10.1.7). One live row per owner and {@code textHash}
 * ({@code sha256(trim(sender)|trim(text))}); inserted with native ON CONFLICT DO NOTHING by the ingest.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_sms_message")
@SQLDelete(sql = "update penz_sms_message set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzSmsMessageEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "sender", nullable = false, length = 100)
    private String sender;

    /** Null when the SMS did not look like money (the text is dropped). */
    @Column(name = "text", columnDefinition = "text")
    private String text;

    @Column(name = "text_hash", nullable = false, length = 64)
    private String textHash;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    /** parsed | ignored | failed | converted. */
    @Column(name = "status", nullable = false, length = 10)
    private String status;

    @Column(name = "reason", length = 60)
    private String reason;

    @Column(name = "kind", length = 8)
    private String kind;

    @Column(name = "amount_minor")
    private Long amountMinor;

    @Column(name = "currency", length = 3)
    private String currency;

    @Column(name = "merchant", length = 200)
    private String merchant;

    @Column(name = "parsed_date")
    private LocalDate parsedDate;

    @Column(name = "category_name", length = 60)
    private String categoryName;

    @Column(name = "transaction_id")
    private UUID transactionId;
}
