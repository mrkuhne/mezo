package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/** What the user's gym lacks ("Mi van a termemben") — one live row per user (sensitivity_profile shape). */
@Getter
@Setter
@Entity
@Table(name = "gym_profile")
@SQLDelete(sql = "update gym_profile set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GymProfileEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** Kit kinds the gym does not have (never bodyweight). */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "off_kinds", columnDefinition = "varchar(16)[]", nullable = false)
    private List<String> offKinds = new ArrayList<>();

    /** Catalogue exercises the gym cannot do even though the kit exists. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "missing_exercise_ids", columnDefinition = "uuid[]", nullable = false)
    private List<UUID> missingExerciseIds = new ArrayList<>();
}
