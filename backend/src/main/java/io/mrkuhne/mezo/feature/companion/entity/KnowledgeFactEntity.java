package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
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
    /** A once-ever question's answer (round 2 S5, mezo-d58h.7.5) — the user answered a direct
     *  question with one tap, which is a confirmation in its own right and needs no Tudástár
     *  accept step. */
    public static final String SOURCE_QUESTION = "question";
    /** A csapatfal REPLY that closed an ügy with a concrete explanation (S7, mezo-d6ivw.7) —
     *  captured as a durable {@code TeamChatExceptionEntity}, mirrored here for the Tudástár. */
    public static final String SOURCE_TEAM_CHAT = "team_chat";

    /** S6 (mezo-d6ivw.6): why a fact is muted — mirrors ck_knowledge_fact_muted_reason. */
    public static final String MUTED_USER = "user";
    public static final String MUTED_REFUTED = "refuted";
    public static final String MUTED_SUPERSEDED = "superseded";

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
     *  'pattern' = V3.3 promotion, 'weekly_review' = an accepted weekly lesson (mezo-d20.7.6),
     *  'question' = a once-ever question's answer (mezo-d58h.7.5), 'team_chat' = a csapatfal
     *  REPLY exception (S7, mezo-d6ivw.7). */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "chat|pattern|manual|weekly_review|question|team_chat")
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

    /** U9b (mezo-zpxv7): the team character that owns this fact — mirrors ck_knowledge_fact_owner.
     *  A producer that names none gets the category default at persist time (never null in the DB). */
    @Size(max = 16)
    @Pattern(regexp = "szunya|mocor|falat|deru|mezo")
    @Column(nullable = false, length = 16)
    private String owner;

    /** S6: null while the fact is active; set together with include_in_prompt=false. */
    @Size(max = 16)
    @Pattern(regexp = "user|refuted|superseded")
    @Column(name = "muted_reason", length = 16)
    private String mutedReason;

    /** S6: when it was muted; null when active or when a pre-S6 mute was backfilled. */
    @Column(name = "muted_at")
    private Instant mutedAt;

    @AssertTrue(message = "valid_to must not precede valid_from")
    public boolean isValidityRangeValid() {
        return validFrom == null || validTo == null || !validTo.isBefore(validFrom);
    }

    /** S6: the ONE way to silence a fact — the prompt seat and the reason move together. */
    public void mute(String reason, Instant at) {
        this.includeInPrompt = false;
        this.mutedReason = reason;
        this.mutedAt = at;
    }

    /** S6: re-enable clears the reason, whatever it was (the user may revive a superseded fact).
     *  A revived superseded fact drops its successor link too — retrieval and the S7 owner read
     *  both skip rows with {@code superseded_by} set, so keeping it would re-enable in name only. */
    public void unmute() {
        this.includeInPrompt = true;
        this.mutedReason = null;
        this.mutedAt = null;
        this.supersededBy = null;
    }

    @PrePersist
    void defaultOwner() {
        if (owner == null) {
            owner = FactOwner.forCategory(category);
        }
    }
}
