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

/** One pipeline run (cron or manual) and its outcome. (Boop Levél, mezo-r36n9.38). */
@Getter
@Setter
@Entity
@Table(name = "mail_run")
@SQLDelete(sql = "update mail_run set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MailRunEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "mailbox_id", nullable = false)
    private UUID mailboxId;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "trigger", nullable = false, length = 8)
    private String trigger;

    @Column(name = "fetched", nullable = false)
    private int fetched;

    @Column(name = "classified", nullable = false)
    private int classified;

    @Column(name = "rules_only", nullable = false)
    private boolean rulesOnly;

    @Column(name = "outcome", nullable = false, length = 16)
    private String outcome;

    @Column(name = "error_code", length = 64)
    private String errorCode;
}
