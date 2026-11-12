package io.mrkuhne.mezo.feature.dayclose.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One day's evening close from Boop (B3, mezo-r36n9.13, spec §7.4) — one live row per owner and date
 * ({@code uq_day_close_created_by_close_date}). {@code closedAt} is the phone's capture moment. The evening
 * text is not here: it lives in {@code journal_entry}, linked by {@code journalEntryId}. {@code boopLine} is
 * Boop's generated sentence, valid while {@code boopLineHash} matches the close's current inputs.
 */
@Getter
@Setter
@Entity
@Table(name = "day_close")
@SQLDelete(sql = "update day_close set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DayCloseEntity extends OwnedEntity {

    public static final String OUTCOME_DONE = "done";
    public static final String OUTCOME_PARTIAL = "partial";
    public static final String OUTCOME_NO = "no";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "close_date", nullable = false)
    private LocalDate closeDate;

    @Column(name = "closed_at", nullable = false)
    private Instant closedAt;

    /** 1–10, the evening check-in's energy; null when not answered. */
    @Column(name = "evening_energy")
    private Integer eveningEnergy;

    /** 1–5 (Nehéz … Remek); stored ×2 into the 20:00 check-in's 1–10 {@code day_rating}. */
    @Column(name = "day_rating", nullable = false)
    private Integer dayRating;

    @Column(name = "goal_text", columnDefinition = "text")
    private String goalText;

    /** done | partial | no; null when the goal was not judged. */
    @Column(name = "goal_outcome", length = 8)
    private String goalOutcome;

    /** B2's plan goals as seen at close — a JSON array of {id, title, result, met}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "plan_goals", nullable = false)
    private String planGoals = "[]";

    @Column(name = "journal_entry_id")
    private UUID journalEntryId;

    @Column(name = "boop_line", columnDefinition = "text")
    private String boopLine;

    @Column(name = "boop_line_hash", length = 64)
    private String boopLineHash;

    @Column(name = "client_ref", nullable = false)
    private UUID clientRef;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
