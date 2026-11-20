package io.mrkuhne.mezo.feature.season.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** One recipe a season allows (pk season + recipe). Replaced as a whole on accept, so hard-deleted. */
@Getter
@Setter
@Entity
@Table(name = "season_allowed_recipe")
@IdClass(SeasonAllowedRecipeEntity.Key.class)
public class SeasonAllowedRecipeEntity {

    @Id
    @Column(name = "season_id", nullable = false)
    private UUID seasonId;

    @Id
    @Column(name = "recipe_id", nullable = false)
    private UUID recipeId;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static SeasonAllowedRecipeEntity of(UUID owner, UUID seasonId, UUID recipeId) {
        SeasonAllowedRecipeEntity e = new SeasonAllowedRecipeEntity();
        e.setCreatedBy(owner);
        e.setSeasonId(seasonId);
        e.setRecipeId(recipeId);
        return e;
    }

    /** Composite key. */
    @Getter
    @Setter
    @NoArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private UUID seasonId;
        private UUID recipeId;
    }
}
