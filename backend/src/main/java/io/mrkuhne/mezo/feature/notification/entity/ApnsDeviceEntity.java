package io.mrkuhne.mezo.feature.notification.entity;

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

/** One native (APNs) device registration (Boop B1, mezo-r36n9.11) — no sending yet. */
@Getter
@Setter
@Entity
@Table(name = "apns_device")
@SQLDelete(sql = "update apns_device set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ApnsDeviceEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "device_id", nullable = false, columnDefinition = "uuid")
    private UUID deviceId;

    @Column(nullable = false, length = 200)
    private String token;

    @Column(nullable = false, length = 10)
    private String environment;

    @Column(name = "bundle_id", nullable = false, length = 120)
    private String bundleId;

    @Column(name = "app_version", length = 20)
    private String appVersion;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt = Instant.now();

    @Column(name = "invalidated_at")
    private Instant invalidatedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
