package io.mrkuhne.mezo.feature.progression.entity;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Entity
@Table(name = "level_up_event")
@SQLDelete(sql = "update level_up_event set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class LevelUpEventEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "source_type", nullable = false)
    // DB CHECK, widened additively over time (latest: 202609021010_mezo-iizd.1):
    // GYM|SPORT|RUN|QUEST|ACTIVITY|HABIT|NEEDS|LIFE_GOAL
    private String sourceType;

    @NotNull
    @Column(name = "source_ref_id", nullable = false)
    private UUID sourceRefId;

    @CreationTimestamp
    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    // mezo-huzd: business date for streak/day aggregation (spec D7), set explicitly by the
    // award(...) tail in ProgressionService — never defaulted here.
    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @Column(name = "total_xp", nullable = false)
    private long totalXp;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private LevelUpResult payload;
}
