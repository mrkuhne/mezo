package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.util.UUID;

/**
 * An extraction candidate on its way to becoming a {@link KnowledgeFactEntity}:
 * candidate → user decision (accept/reject/refine, null until decided) → promoted_fact_id.
 * Table-only in V1.1; the extraction + confirm flow arrives with V1.2 (roadmap §V1.2).
 */
@Getter
@Setter
@Entity
@Table(name = "learned_fact")
@SQLDelete(sql = "update learned_fact set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class LearnedFactEntity extends OwnedEntity {

    public static final String DECISION_ACCEPT = "accept";
    public static final String DECISION_REJECT = "reject";
    public static final String DECISION_REFINE = "refine";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "candidate_text", nullable = false, columnDefinition = "text")
    private String candidateText;

    /** Mirrors ck_learned_fact_category — classified by the extractor at capture time (V1.2). */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "train|fuel|health|life")
    @Column(nullable = false, length = 16)
    private String category;

    /** The chat message the candidate was extracted from (loose ref — ON DELETE SET NULL). */
    @Column(name = "derived_from_message_id", columnDefinition = "uuid")
    private UUID derivedFromMessageId;

    /** Mirrors ck_learned_fact_user_decision; null = undecided (the V1.2 pending inbox). */
    @Size(max = 16)
    @Pattern(regexp = "accept|reject|refine")
    @Column(name = "user_decision", length = 16)
    private String userDecision;

    /** The user-edited wording when the decision is 'refine'. */
    @Column(name = "refined_text", columnDefinition = "text")
    private String refinedText;

    /** The knowledge_fact this candidate was promoted into (loose ref — ON DELETE SET NULL). */
    @Column(name = "promoted_fact_id", columnDefinition = "uuid")
    private UUID promotedFactId;
}
