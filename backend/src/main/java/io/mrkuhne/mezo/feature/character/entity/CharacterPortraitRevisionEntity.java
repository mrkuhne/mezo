package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One immutable portrait snapshot of a dimension at a given conference (Karakter spec §4) —
 * backs the future "Történet" view.
 */
@Getter
@Setter
@Entity
@Table(name = "character_portrait_revision")
@SQLDelete(sql = "update character_portrait_revision set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterPortraitRevisionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "dimension_id", nullable = false, columnDefinition = "uuid")
    private UUID dimensionId;

    @NotNull
    @Column(nullable = false)
    private Integer version;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String portrait;

    @NotNull
    @Column(name = "conference_id", nullable = false, columnDefinition = "uuid")
    private UUID conferenceId;
}
