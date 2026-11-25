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

/** The owner's Éves terv (mezo-r36n9.113): a 52-week plan of ordered blocks starting on a Monday. One active per owner. */
@Getter
@Setter
@Entity
@Table(name = "training_year_plan")
@SQLDelete(sql = "update training_year_plan set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TrainingYearPlanEntity extends OwnedEntity {

    public static final String ACTIVE = "active";
    public static final String ARCHIVED = "archived";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** active|archived (DB CHECK). */
    @Column(nullable = false, length = 10)
    private String status = ACTIVE;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "block_weeks", nullable = false)
    private Integer blockWeeks;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "consolidation_weeks", nullable = false)
    private Integer consolidationWeeks;

    /** Groups the owner asked to emphasise across the year. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "emphasis", nullable = false, columnDefinition = "text[]")
    private List<String> emphasis = new ArrayList<>();

    @Column(name = "archived_at")
    private Instant archivedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public boolean isActive() {
        return ACTIVE.equals(status);
    }
}
