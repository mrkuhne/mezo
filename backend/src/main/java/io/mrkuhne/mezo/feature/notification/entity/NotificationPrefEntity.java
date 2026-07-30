package io.mrkuhne.mezo.feature.notification.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Per-category notification preference (bd mezo-h4wp.6.2). A MISSING row means "the code
 * default" (see {@code NotificationCategory}) — never "off" — so a newly added category ships
 * with its intended default instead of silently arriving disabled.
 */
@Getter
@Setter
@Entity
@Table(name = "notification_pref")
@SQLDelete(sql = "update notification_pref set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class NotificationPrefEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "category", nullable = false, length = 24)
    private String category;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "lead_minutes", nullable = false)
    private int leadMinutes;
}
