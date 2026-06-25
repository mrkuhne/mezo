package io.mrkuhne.mezo.feature.progression.entity;

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
import org.hibernate.annotations.UpdateTimestamp;

@Getter
@Setter
@Entity
@Table(name = "skill_progress")
@SQLDelete(sql = "update skill_progress set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SkillProgressEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "skill_key", nullable = false)
    private String skillKey;

    @NotNull
    @Column(name = "skill_kind", nullable = false)
    private String skillKind; // ATHLETIC|MUSCLE (DB CHECK)

    // primitive long/int are never null → @Column(nullable=false) only (mirrors OwnedEntity.deleted)
    @Column(name = "cumulative_xp", nullable = false)
    private long cumulativeXp = 0L;

    @Column(name = "current_level", nullable = false)
    private int currentLevel = 1;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
