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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One FE-written recurring notification-schedule entry (bd mezo-h4wp.6.3) — the snapshot a
 * client PUTs for a category with no backend anchor ({@code checkin}, {@code fuel_slot}; see
 * {@code NotificationCategory.feWritten()}). {@code weekday} is ISO 1=Mon..7=Sun; {@code null}
 * means every day. Maintained via full replace per category: soft-deleted and re-inserted on
 * every save, so a category legitimately holds many live rows at once.
 */
@Getter
@Setter
@Entity
@Table(name = "notification_schedule")
@SQLDelete(sql = "update notification_schedule set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class NotificationScheduleEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "weekday")
    private Integer weekday;

    @NotNull
    @Column(name = "time", nullable = false, length = 5)
    private String time;

    @NotNull
    @Column(name = "category", nullable = false, length = 24)
    private String category;

    @NotNull
    @Column(name = "title", nullable = false, length = 120)
    private String title;

    @Column(name = "body", length = 300)
    private String body;

    @NotNull
    @Column(name = "deeplink", nullable = false, length = 200)
    private String deeplink;

    @NotNull
    @Column(name = "source", nullable = false, length = 24)
    private String source;
}
