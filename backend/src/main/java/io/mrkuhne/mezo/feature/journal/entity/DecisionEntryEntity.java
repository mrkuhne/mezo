package io.mrkuhne.mezo.feature.journal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
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
 * One recorded decision (Phase 5 W1.4, bd mezo-b3pp.4, spec §4.1/§5.4): the decision text, the
 * server-frozen context snapshot, and — after {@code review_due} comes around — how it turned out.
 */
@Getter
@Setter
@Entity
@Table(name = "decision_entry")
@SQLDelete(sql = "update decision_entry set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DecisionEntryEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "decided_on", nullable = false)
    private LocalDate decidedOn;

    @NotNull
    @Column(name = "decision_text", nullable = false, columnDefinition = "text")
    private String decisionText;

    /** What the system knew when the decision was written — never client-supplied. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_snapshot", nullable = false)
    private DecisionContextEnvelope contextSnapshot;

    @NotNull
    @Column(name = "review_due", nullable = false)
    private LocalDate reviewDue;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    /** Mirrors ck_decision_entry_outcome_rating; null until reviewed. */
    @Min(1)
    @Max(5)
    @Column(name = "outcome_rating")
    private Short outcomeRating;

    @Column(name = "outcome_text", columnDefinition = "text")
    private String outcomeText;
}
