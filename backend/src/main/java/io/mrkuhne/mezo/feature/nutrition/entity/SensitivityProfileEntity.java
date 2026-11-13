package io.mrkuhne.mezo.feature.nutrition.entity;

import io.mrkuhne.mezo.feature.nutrition.service.Sensitivity;
import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
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

/** The owner's food sensitivities — one live row per owner (diet_settings shape). */
@Getter
@Setter
@Entity
@Table(name = "sensitivity_profile")
@SQLDelete(sql = "update sensitivity_profile set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SensitivityProfileEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<Sensitivity> items = new ArrayList<>();

    @Column(name = "nova_enabled", nullable = false)
    private boolean novaEnabled = true;

    @Column(name = "nova_max_level", nullable = false)
    private int novaMaxLevel = 2;
}
