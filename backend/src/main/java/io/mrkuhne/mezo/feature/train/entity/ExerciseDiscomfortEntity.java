package io.mrkuhne.mezo.feature.train.entity;

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
 * A swap-time "nem esik jól" note on an exercise (mezo-r36n9.66). Keyed by exercise identity
 * ({@code ExerciseHistoryResolver.identityKey}), unique per live (user, identity, day).
 */
@Getter
@Setter
@Entity
@Table(name = "exercise_discomfort")
@SQLDelete(sql = "update exercise_discomfort set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExerciseDiscomfortEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "identity_key", nullable = false, length = 160)
    private String identityKey;

    /** Catalogue link of the outgoing row; null for a custom (user-authored, unlinked) exercise. */
    @Column(name = "catalog_id", columnDefinition = "uuid")
    private UUID catalogId;

    @NotNull
    @Column(name = "noted_on", nullable = false)
    private LocalDate notedOn;

    @NotNull
    @Column(nullable = false, length = 8)
    private String source = "swap";
}
