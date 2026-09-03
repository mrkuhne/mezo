package io.mrkuhne.mezo.feature.goal.entity;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * An engine-proposed diet change awaiting the owner's decision (suggest + approve — the engine
 * never silently rewrites targets; spec 2026-09-02-diet-plan-design §6.5). Lifecycle:
 * {@code proposed} → {@code accepted} | {@code dismissed} | {@code superseded}. Invariants owned
 * by {@code GoalSuggestionService}: at most one open (proposed) row per (goal, kind) — a newer
 * proposal supersedes the open one; a {@code dedupKey} already decided (dismissed OR accepted)
 * is never re-proposed.
 */
@Getter
@Setter
@Entity
@Table(name = "goal_suggestion")
@SQLDelete(sql = "update goal_suggestion set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GoalSuggestionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(name = "goal_id", nullable = false) private UUID goalId;
    @NotNull @Column(nullable = false) private String kind;   // phase_change|weekly_correction (DB CHECK)
    @NotNull @Column(nullable = false) private String status; // proposed|accepted|dismissed|superseded (DB CHECK)

    /** Trigger-input identity — e.g. "preset:cut-prep:meso:<id>" / "deload:meso:<id>:w:4-4". */
    @NotNull @Column(name = "dedup_key", nullable = false) private String dedupKey;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private GoalSuggestionPayloadJson payload;

    @Column(name = "decided_at") private Instant decidedAt;
}
