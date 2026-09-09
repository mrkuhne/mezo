package io.mrkuhne.mezo.feature.llmlog.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One upsertable outcome signal per backend-minted AI draft (Slice 8 Task 1, bd mezo-76f6, plan
 * 2026-09-09-admin-value-dashboard-slice8 Rulings). Lives in the {@code llmlog} slice — it rides
 * the existing meal→llmlog / train→llmlog / admin→llmlog edges instead of creating a new
 * meal↔train cycle.
 *
 * <p>{@code uq_ai_draft_outcome_owner_draft} spans soft-deleted rows too (mirrors
 * {@code message_feedback}), so the write path is a native upsert (see
 * {@link io.mrkuhne.mezo.feature.llmlog.repository.AiDraftOutcomeRepository#upsertOutcome}) that
 * resurrects a retracted row rather than colliding with it — last signal wins per (owner, draft).
 *
 * <p>{@code feature} is a free slug (no CHECK, no FK) — the admin scorecard joins by slug; an
 * unrecognized value is simply invisible to that aggregate, never a 400 (spec: "free slug").
 */
@Getter
@Setter
@Entity
@Table(name = "ai_draft_outcome", uniqueConstraints =
    @UniqueConstraint(name = "uq_ai_draft_outcome_owner_draft", columnNames = {"created_by", "draft_id"}))
@SQLDelete(sql = "update ai_draft_outcome set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class AiDraftOutcomeEntity extends OwnedEntity {

    public static final String OUTCOME_ACCEPTED = "accepted";
    public static final String OUTCOME_EDITED = "edited";
    public static final String OUTCOME_DISCARDED = "discarded";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Free slug (e.g. 'meal_draft', 'meso_plan') — not validated against a fixed list. */
    @NotNull
    @Size(max = 40)
    @Column(nullable = false, length = 40)
    private String feature;

    /** The backend-minted draft id the generator response carried (no FK — the draft itself is
     *  never persisted; it is a stateless response-only concept). */
    @NotNull
    @Column(name = "draft_id", nullable = false, columnDefinition = "uuid")
    private UUID draftId;

    /** Mirrors ck_ai_draft_outcome_outcome. */
    @NotNull
    @Size(max = 10)
    @Pattern(regexp = "accepted|edited|discarded")
    @Column(nullable = false, length = 10)
    private String outcome;
}
