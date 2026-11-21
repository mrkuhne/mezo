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

/** The owner's read-only mirror mailbox; the app password is stored encrypted (cipher + nonce). (Boop Levél, mezo-r36n9.38). */
@Getter
@Setter
@Entity
@Table(name = "mail_mailbox")
@SQLDelete(sql = "update mail_mailbox set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MailMailboxEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "address", nullable = false, length = 254)
    private String address;

    @Column(name = "secret_cipher", nullable = false)
    private byte[] secretCipher;

    @Column(name = "secret_nonce", nullable = false)
    private byte[] secretNonce;

    @Column(name = "state", nullable = false, length = 16)
    private String state;

    @Column(name = "zero_run_streak", nullable = false)
    private int zeroRunStreak;

    @Column(name = "last_run_at")
    private Instant lastRunAt;
}
