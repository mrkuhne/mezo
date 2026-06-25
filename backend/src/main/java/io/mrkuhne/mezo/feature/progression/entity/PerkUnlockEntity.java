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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "perk_unlock")
@SQLDelete(sql = "update perk_unlock set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PerkUnlockEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "skill_key", nullable = false)
    private String skillKey;

    @NotNull
    @Column(name = "perk_key", nullable = false)
    private String perkKey;

    @Column(name = "milestone_level", nullable = false)
    private int milestoneLevel;

    @CreationTimestamp
    @Column(name = "unlocked_at", nullable = false, updatable = false)
    private Instant unlockedAt;
}
