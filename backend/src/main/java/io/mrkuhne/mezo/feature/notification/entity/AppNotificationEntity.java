package io.mrkuhne.mezo.feature.notification.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One AI-brain event in the notification outbox (bd mezo-gzhp.1, spec 2026-08-18 §3).
 * The HU copy is composed at emit time and stored — the in-app bell renders it and the
 * push (slice F3) sends it verbatim; there is no second copy source anywhere.
 */
@Getter
@Setter
@Entity
@Table(name = "app_notification")
@SQLDelete(sql = "update app_notification set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class AppNotificationEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "kind", nullable = false, length = 32)
    private String kind;

    @NotNull
    @Column(name = "title", nullable = false, length = 120)
    private String title;

    @Column(name = "body", length = 300)
    private String body;

    @NotNull
    @Column(name = "deeplink", nullable = false, length = 200)
    private String deeplink;

    @Column(name = "ref_id")
    private UUID refId;

    @NotNull
    @Column(name = "dedup_key", nullable = false, length = 80)
    private String dedupKey;

    @NotNull
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "read_at")
    private Instant readAt;
}
