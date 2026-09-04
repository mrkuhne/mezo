package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** L3 memory: a confirmed, long-lived fact about the user — top-N of these ride in every system prompt (V1.1). */
@Getter
@Setter
@Entity
@Table(name = "knowledge_fact")
@SQLDelete(sql = "update knowledge_fact set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class KnowledgeFactEntity extends OwnedEntity {

    public static final String SOURCE_CHAT = "chat";
    public static final String SOURCE_PATTERN = "pattern";
    public static final String SOURCE_MANUAL = "manual";
    /** A weekly-review candidate the user accepted (mezo-d20.7.6) — promoted via FactCandidateService. */
    public static final String SOURCE_WEEKLY_REVIEW = "weekly_review";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "fact_text", nullable = false, columnDefinition = "text")
    private String factText;

    /** Mirrors ck_knowledge_fact_category. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "train|fuel|health|life")
    @Column(nullable = false, length = 16)
    private String category;

    /** Mirrors ck_knowledge_fact_source — V1.1 creates only 'manual'; 'chat' = V1.2 extraction,
     *  'pattern' = V3.3 promotion, 'weekly_review' = an accepted weekly lesson (mezo-d20.7.6). */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "chat|pattern|manual|weekly_review")
    @Column(nullable = false, length = 16)
    private String source;

    /** How many times the fact was re-confirmed/re-detected (V1.3 redundancy + V3.3 recurrence increment it). */
    @Column(name = "reinforcement_count", nullable = false)
    private int reinforcementCount;

    /** Whether the fact competes for the top-N system-prompt injection slots. */
    @Column(name = "include_in_prompt", nullable = false)
    private boolean includeInPrompt = true;

    @Column(name = "last_reinforced_at")
    private Instant lastReinforcedAt;

    /** Pinned active facts remain eligible even when lexical relevance is weak. */
    @Column(nullable = false)
    private boolean pinned;

    @Column(name = "valid_from")
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    /** A superseded fact stays auditable but ordinary retrieval excludes it. */
    @Column(name = "superseded_by", columnDefinition = "uuid")
    private UUID supersededBy;

    /** Unresolved contradictions remain linked so retrieval can surface both sides. */
    @Column(name = "conflicts_with", columnDefinition = "uuid")
    private UUID conflictsWith;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private MemoryProvenanceEnvelope provenance = MemoryProvenanceEnvelope.empty();

    @AssertTrue(message = "valid_to must not precede valid_from")
    public boolean isValidityRangeValid() {
        return validFrom == null || validTo == null || !validTo.isBefore(validFrom);
    }
}
