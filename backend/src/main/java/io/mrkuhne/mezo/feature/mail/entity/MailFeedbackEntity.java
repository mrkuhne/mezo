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

/** The owner's verdict on an item (interest / nope), feeding the few-shot examples. (Boop Levél, mezo-r36n9.38). */
@Getter
@Setter
@Entity
@Table(name = "mail_feedback")
@SQLDelete(sql = "update mail_feedback set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MailFeedbackEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Column(name = "verdict", nullable = false, length = 8)
    private String verdict;

    @Column(name = "from_addr", nullable = false, length = 254)
    private String fromAddr;

    @Column(name = "summary", nullable = false, length = 200)
    private String summary;

    /** The latest tap on the item; ordering and the half-life decay read this, not created_at. */
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
