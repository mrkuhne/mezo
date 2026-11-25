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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** A fetched message. Sensitive senders keep headers only; the raw body is purged after 30 days. (Boop Levél, mezo-r36n9.38). */
@Getter
@Setter
@Entity
@Table(name = "mail_message")
@SQLDelete(sql = "update mail_message set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MailMessageEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "mailbox_id", nullable = false)
    private UUID mailboxId;

    @Column(name = "gm_msgid")
    private Long gmMsgid;

    @Column(name = "message_id", nullable = false, length = 998)
    private String messageId;

    @Column(name = "content_hash", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.CHAR)
    private String contentHash;

    @Column(name = "folder", nullable = false, length = 64)
    private String folder;

    @Column(name = "uid", nullable = false)
    private long uid;

    @Column(name = "uidvalidity", nullable = false)
    private long uidvalidity;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "from_addr", nullable = false, length = 254)
    private String fromAddr;

    @Column(name = "from_name", length = 200)
    private String fromName;

    @Column(name = "via", nullable = false, length = 8)
    private String via;

    @Column(name = "subject", columnDefinition = "text")
    private String subject;

    @Column(name = "body_redacted", columnDefinition = "text")
    private String bodyRedacted;

    @Column(name = "body_purged", nullable = false)
    private boolean bodyPurged;

    @Column(name = "sensitive", nullable = false)
    private boolean sensitive;

    /** Set once the digest pipeline has handled the message (item created, merged into a parcel, or skipped). */
    @Column(name = "processed_at")
    private Instant processedAt;
}
