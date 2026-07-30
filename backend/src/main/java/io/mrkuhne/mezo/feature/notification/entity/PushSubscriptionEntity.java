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

/** One device's Web Push subscription (bd mezo-h4wp.6.1). Soft-deleted when the push service says GONE. */
@Getter
@Setter
@Entity
@Table(name = "push_subscription")
@SQLDelete(sql = "update push_subscription set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PushSubscriptionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "endpoint", nullable = false)
    private String endpoint;

    @NotNull
    @Column(name = "p256dh", nullable = false, length = 120)
    private String p256dh;

    @NotNull
    @Column(name = "auth", nullable = false, length = 40)
    private String auth;

    @Column(name = "user_agent", length = 300)
    private String userAgent;

    @Column(name = "last_success_at")
    private Instant lastSuccessAt;
}
