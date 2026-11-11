package io.mrkuhne.mezo.feature.wearable.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** One Apple Health sample with provenance (Boop B1, mezo-r36n9.11) — upserted by the client's
 *  external id; {@code metric} is a code from {@code ck_health_sample_metric}. */
@Getter
@Setter
@Entity
@Table(name = "health_sample")
public class HealthSampleEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "external_id", nullable = false, length = 64)
    private String externalId;

    @Column(nullable = false, length = 40)
    private String metric;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    private Double value;

    @Column(length = 16)
    private String unit;

    @Column(name = "source_name", length = 80)
    private String sourceName;

    @Column(name = "source_bundle", length = 120)
    private String sourceBundle;

    @Column(length = 80)
    private String device;

    @Column(name = "user_entered", nullable = false)
    private boolean userEntered;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private Map<String, Object> meta;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
