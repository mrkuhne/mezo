package io.mrkuhne.mezo.feature.train.entity;

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
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/** One block of an Éves terv (mezo-r36n9.113): kind, 1-2 focus groups, length, gap before it, and the linked mesocycle once started. */
@Getter
@Setter
@Entity
@Table(name = "training_year_block")
@SQLDelete(sql = "update training_year_block set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TrainingYearBlockEntity extends OwnedEntity {

    public static final String PLANNED = "planned";
    public static final String RUNNING = "running";
    public static final String DONE = "done";
    public static final String SKIPPED = "skipped";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "plan_id", nullable = false, columnDefinition = "uuid")
    private UUID planId;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(nullable = false)
    private Integer ordinal;

    /** upper|lower|consolidation (DB CHECK). */
    @Column(nullable = false, length = 14)
    private String kind;

    /** 1-2 landmark groups (0 for a consolidation block). */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "focus", nullable = false, columnDefinition = "text[]")
    private List<String> focus = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(nullable = false)
    private Integer weeks;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "gap_weeks", nullable = false)
    private Integer gapWeeks = 0;

    @Column(name = "planned_start")
    private LocalDate plannedStart;

    @Column(name = "mesocycle_id", columnDefinition = "uuid")
    private UUID mesocycleId;

    /** planned|running|done|skipped (DB CHECK). */
    @Column(nullable = false, length = 10)
    private String status = PLANNED;

    /** True when this block adopted an already running mesocycle. */
    @Column(nullable = false)
    private boolean adopted = false;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public boolean is(String s) {
        return s.equals(status);
    }
}
