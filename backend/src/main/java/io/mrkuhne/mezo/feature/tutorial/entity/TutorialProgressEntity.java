package io.mrkuhne.mezo.feature.tutorial.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/** Mezo-kalauz seen-store — one live row per owner (partial-unique on created_by, fuel_settings shape). */
@Getter
@Setter
@Entity
@Table(name = "tutorial_progress")
@SQLDelete(sql = "update tutorial_progress set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TutorialProgressEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, TutorialProgressEntryJson> progress = new HashMap<>();

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
