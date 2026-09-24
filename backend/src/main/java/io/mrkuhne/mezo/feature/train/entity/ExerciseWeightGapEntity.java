package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One weight KNOWN to be missing on one exercise's machine (per-machine weight memory,
 * mezo-bk7l2). Learnt from a near swap at log time, healed (soft-deleted) when a set is logged at
 * that weight. Keyed by exercise identity — see {@code ExerciseHistoryResolver}.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "exercise_weight_gap")
@SQLDelete(sql = "update exercise_weight_gap set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExerciseWeightGapEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private String identityKey;

    @NotNull
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal weightKg;
}
