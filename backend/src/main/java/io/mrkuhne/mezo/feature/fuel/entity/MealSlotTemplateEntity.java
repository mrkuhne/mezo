package io.mrkuhne.mezo.feature.fuel.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/** Meal-slot template — one live row per owner per day type (partial-unique on created_by, day_type). */
@Getter
@Setter
@Entity
@Table(name = "meal_slot_template")
@SQLDelete(sql = "update meal_slot_template set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MealSlotTemplateEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "day_type", nullable = false, length = 11)
    private String dayType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<MealSlotJson> slots;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
