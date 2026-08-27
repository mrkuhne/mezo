package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A nightly expert's observation (Karakter spec §5): grounded in detector signals, tagged
 * against the dimensions it may inform, later consumed by a conference.
 */
@Getter
@Setter
@Entity
@Table(name = "character_observation")
@SQLDelete(sql = "update character_observation set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterObservationEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "expert_key", nullable = false, length = 40)
    private String expertKey;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "dimension_keys", nullable = false, columnDefinition = "jsonb")
    private List<String> dimensionKeys;

    @NotNull
    @Column(nullable = false)
    private LocalDate day;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String text;

    @NotNull
    @Column(nullable = false)
    private Short salience;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private ObservationSignalsEnvelope signals;

    @Column(name = "consumed_by_conference_id", columnDefinition = "uuid")
    private UUID consumedByConferenceId;
}
