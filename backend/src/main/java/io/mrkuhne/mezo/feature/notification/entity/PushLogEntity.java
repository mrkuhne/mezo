package io.mrkuhne.mezo.feature.notification.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * The per-day send ledger (bd mezo-h4wp.6.2): one row per (user, local day, dedupKey), written
 * BEFORE the send so a failed send never re-fires the same notification on the next minute — a
 * lost notification is strictly better than a duplicated one.
 */
@Getter
@Setter
@Entity
@Table(name = "push_log")
@SQLDelete(sql = "update push_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PushLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @NotNull
    @Column(name = "dedup_key", nullable = false, length = 80)
    private String dedupKey;

    @NotNull
    @Column(name = "category", nullable = false, length = 24)
    private String category;

    @CreationTimestamp
    @Column(name = "sent_at", nullable = false, updatable = false)
    private Instant sentAt;
}
