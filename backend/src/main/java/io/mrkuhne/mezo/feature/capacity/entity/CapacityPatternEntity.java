package io.mrkuhne.mezo.feature.capacity.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** A learned recurring pattern of the owner's days (Boop B7 K1, mezo-r36n9.17). */
@Getter
@Setter
@Entity
@Table(name = "capacity_pattern")
@SQLDelete(sql = "update capacity_pattern set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CapacityPatternEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, length = 60)
    private String key;

    @Column(nullable = false)
    private int evidence;

    @Column(nullable = false)
    private int consistent;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @Column(name = "last_seen")
    private LocalDate lastSeen;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
