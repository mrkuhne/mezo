package io.mrkuhne.mezo.feature.nutrition.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** Diet preferences — one live row per owner (fuel_settings shape, partial-unique on created_by). */
@Getter
@Setter
@Entity
@Table(name = "diet_settings")
@SQLDelete(sql = "update diet_settings set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DietSettingsEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "split_preset", nullable = false, length = 16)
    private String splitPreset;

    /** Custom split fields, tenths of a percent — null unless splitPreset = custom. */
    @Min(0)
    @Max(1000)
    @Column(name = "protein_pct_x10")
    private Integer proteinPctX10;

    @Min(0)
    @Max(1000)
    @Column(name = "carbs_pct_x10")
    private Integer carbsPctX10;

    @Min(0)
    @Max(1000)
    @Column(name = "fat_pct_x10")
    private Integer fatPctX10;

    @NotNull
    @Column(name = "protein_tier", nullable = false, length = 16)
    private String proteinTier;

    @NotNull
    @Min(500)
    @Max(8000)
    @Column(name = "water_ml", nullable = false)
    private Integer waterMl;

    @NotNull
    @Min(10)
    @Max(80)
    @Column(name = "fiber_g", nullable = false)
    private Integer fiberG;
}
