package io.mrkuhne.mezo.feature.gamification.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One coin award/spend line (mezo-huzd). {@code reason} is the DB-CHECKed vocabulary
 * (quest|all3|level_up|streak_7|streak_30|streak_100|saver_used|purchase); the live-row
 * idempotency key is {@code (created_by, reason, source_ref_id)}
 * ({@code uq_coin_event_user_reason_ref}).
 */
@Getter
@Setter
@Entity
@Table(name = "coin_event")
@SQLDelete(sql = "update coin_event set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CoinEventEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private String reason;

    @Column(nullable = false)
    private int amount;

    @NotNull
    @Column(name = "source_ref_id", nullable = false)
    private String sourceRefId;

    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;
}
