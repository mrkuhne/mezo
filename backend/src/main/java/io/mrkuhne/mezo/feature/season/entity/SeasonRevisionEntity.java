package io.mrkuhne.mezo.feature.season.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** One accepted change of a season (activate / apply): the draft and the before / after numbers of its preview. */
@Getter
@Setter
@Entity
@Table(name = "season_revision")
@SQLDelete(sql = "update season_revision set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SeasonRevisionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "season_id", nullable = false)
    private UUID seasonId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "draft", nullable = false, columnDefinition = "jsonb")
    private SeasonDraftJson draft;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "before", columnDefinition = "jsonb")
    private SeasonNumbersJson before;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "after", columnDefinition = "jsonb")
    private SeasonNumbersJson after;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
