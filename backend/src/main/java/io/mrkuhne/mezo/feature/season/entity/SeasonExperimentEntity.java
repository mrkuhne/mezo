package io.mrkuhne.mezo.feature.season.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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

/**
 * One experiment of the active season (Boop B6 Évad S4, mezo-r36n9.16, spec §5.9): proposed (Boop ötlete) → running
 * ({@code lengthDays} from {@code startDate}) → done (compared with the same number of days before; {@code result}),
 * or dismissed. At most one running and one proposed per owner (partial unique indexes). {@code kept} = „Megtartom
 * szokásnak” — a season rule line in every AI context.
 */
@Getter
@Setter
@Entity
@Table(name = "season_experiment")
@SQLDelete(sql = "update season_experiment set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SeasonExperimentEntity extends OwnedEntity {

    public static final String STATUS_PROPOSED = "proposed";
    public static final String STATUS_RUNNING = "running";
    public static final String STATUS_DONE = "done";
    public static final String STATUS_DISMISSED = "dismissed";

    public static final int DEFAULT_LENGTH = 14;

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "season_id", nullable = false)
    private UUID seasonId;

    /** supplement | recipe | food | habit | text. */
    @Column(name = "subject_kind", nullable = false, length = 12)
    private String subjectKind;

    /** The pantry item (supplement / food) or recipe; null for a habit or a journal line. */
    @Column(name = "subject_ref")
    private UUID subjectRef;

    @Column(name = "title", nullable = false, length = 80)
    private String title;

    /** Why Boop proposed it (one Hungarian sentence); null for his own. */
    @Column(name = "reason", columnDefinition = "text")
    private String reason;

    @Column(name = "start_date")
    private LocalDate startDate;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "length_days", nullable = false)
    private Integer lengthDays = DEFAULT_LENGTH;

    @Column(name = "status", nullable = false, length = 10)
    private String status;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "marked_days", nullable = false, columnDefinition = "date[]")
    private List<LocalDate> markedDays = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result", columnDefinition = "jsonb")
    private SeasonExperimentResultJson result;

    @Column(name = "finished_on")
    private LocalDate finishedOn;

    @Column(name = "kept", nullable = false)
    private boolean kept;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    /** The window's last day ({@code startDate + lengthDays - 1}); null while proposed. */
    public LocalDate endDate() {
        return startDate == null ? null : startDate.plusDays(lengthDays - 1L);
    }

    public boolean is(String s) {
        return s.equals(status);
    }
}
