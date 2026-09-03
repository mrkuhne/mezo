package io.mrkuhne.mezo.feature.character.entity;

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

/**
 * One dossier dimension (Karakter spec §2/§4): the 7 lazily-seeded CORE rows + AI-opened
 * CHAPTER rows. Portrait prose is rewritten only by conferences (Slice 3+); maturity is the
 * computed 0–100 coverage roll-up.
 */
@Getter
@Setter
@Entity
@Table(name = "character_dimension")
@SQLDelete(sql = "update character_dimension set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterDimensionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false, length = 40)
    private String key;

    @NotNull
    @Column(nullable = false, length = 80)
    private String title;

    /** CORE | CHAPTER | META. */
    @NotNull
    @Column(nullable = false, length = 10)
    private String kind;

    /** Owning expert persona key; null for CHAPTER rows (the Integrátor owns those). */
    @Column(name = "expert_key", length = 40)
    private String expertKey;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String portrait = "";

    @NotNull
    @Column(nullable = false)
    private Short maturity = 0;

    @NotNull
    @Column(nullable = false)
    private Integer version = 0;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
