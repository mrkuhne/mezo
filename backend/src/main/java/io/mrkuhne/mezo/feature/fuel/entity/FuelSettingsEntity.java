package io.mrkuhne.mezo.feature.fuel.entity;

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

/** Fuel planner settings — one live row per owner (partial-unique on created_by, intention_creed shape). */
@Getter
@Setter
@Entity
@Table(name = "fuel_settings")
@SQLDelete(sql = "update fuel_settings set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class FuelSettingsEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Min(3)
    @Max(6)
    @Column(name = "meals_per_day", nullable = false)
    private Integer mealsPerDay;

    @NotNull
    @Column(name = "caffeine_cutoff", nullable = false, length = 5)
    private String caffeineCutoff;
}
