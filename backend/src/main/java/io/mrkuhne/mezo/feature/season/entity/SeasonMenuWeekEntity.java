package io.mrkuhne.mezo.feature.season.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** A menu week (Mon..Sun) of the active season (Boop B6 Évad S3, mezo-r36n9.16): proposed → approved on his tap. */
@Getter
@Setter
@Entity
@Table(name = "season_menu_week")
@SQLDelete(sql = "update season_menu_week set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SeasonMenuWeekEntity extends OwnedEntity {

    public static final String STATUS_PROPOSED = "proposed";
    public static final String STATUS_APPROVED = "approved";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "season_id", nullable = false)
    private UUID seasonId;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "status", nullable = false, length = 10)
    private String status = STATUS_PROPOSED;

    /** Rotates the planner's choice: „Kérek másikat" increments it. */
    @Column(name = "variant", nullable = false)
    private int variant;

    /** The allowed recipes were too few for the week without repeats. */
    @Column(name = "repeated", nullable = false)
    private boolean repeated;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public boolean approved() {
        return STATUS_APPROVED.equals(status);
    }
}
