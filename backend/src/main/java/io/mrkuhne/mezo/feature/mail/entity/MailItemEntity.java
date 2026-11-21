package io.mrkuhne.mezo.feature.mail.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** A classified card shown in the morning post (a deadline, a parcel, a deal, ...). (Boop Levél, mezo-r36n9.38). */
@Getter
@Setter
@Entity
@Table(name = "mail_item")
@SQLDelete(sql = "update mail_item set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MailItemEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    @Column(name = "grp", nullable = false, length = 12)
    private String grp;

    @Column(name = "category", nullable = false, length = 24)
    private String category;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "summary", nullable = false, length = 400)
    private String summary;

    @Column(name = "why", nullable = false, length = 300)
    private String why;

    @Column(name = "score")
    private Short score;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "valid_until")
    private Instant validUntil;

    @Column(name = "amount_minor")
    private Long amountMinor;

    @Column(name = "currency", length = 3)
    private String currency;

    @Column(name = "carrier", length = 16)
    private String carrier;

    @Column(name = "parcel_key", length = 64)
    private String parcelKey;

    @Column(name = "parcel_state", length = 12)
    private String parcelState;

    @Column(name = "state_changed_at", nullable = false)
    private Instant stateChangedAt;

    @Column(name = "open_until", nullable = false)
    private Instant openUntil;

    @Column(name = "flagged", nullable = false)
    private boolean flagged;

    @Column(name = "source", nullable = false, length = 8)
    private String source;

    @Column(name = "first_seen_run")
    private UUID firstSeenRun;
}
