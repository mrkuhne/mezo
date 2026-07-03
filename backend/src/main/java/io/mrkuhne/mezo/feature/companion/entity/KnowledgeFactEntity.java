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

import java.time.Instant;
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

    /** Mirrors ck_knowledge_fact_source — V1.1 creates only 'manual'; 'chat' = V1.2 extraction, 'pattern' = V3.3 promotion. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "chat|pattern|manual")
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
}
