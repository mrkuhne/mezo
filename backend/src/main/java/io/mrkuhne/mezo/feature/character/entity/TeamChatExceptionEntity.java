package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** S7 (mezo-d6ivw.7): a durable veto — a known, confirmed exception to a rule for one
 *  (user, flag_key, normalized_tag), captured from a REPLY that explained an ügy. Spec
 *  2026-09-24-mezo-emlekezete-design.md §S7. */
@Getter
@Setter
@Entity
@Table(name = "team_chat_exception")
@SQLDelete(sql = "update team_chat_exception set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TeamChatExceptionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Size(max = 24)
    @Column(name = "flag_key", nullable = false, length = 24)
    private String flagKey;

    @NotNull @Size(max = 16)
    @Column(name = "owner_character", nullable = false, length = 16)
    private String ownerCharacter;

    @NotNull @Size(max = 40)
    @Column(name = "context_tag", nullable = false, length = 40)
    private String contextTag;

    @NotNull @Size(max = 40)
    @Column(name = "normalized_tag", nullable = false, length = 40)
    private String normalizedTag;

    /** The remembered sentence (mirrors its knowledge fact; the chip's text). */
    @NotNull @Size(max = 160)
    @Column(name = "fact_text", nullable = false, length = 160)
    private String factText;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private KeywordsEnvelope keywords;

    @Column(name = "knowledge_fact_id", columnDefinition = "uuid")
    private UUID knowledgeFactId;

    @Column(name = "source_thread_id", columnDefinition = "uuid")
    private UUID sourceThreadId;

    @Column(name = "source_line_id", columnDefinition = "uuid")
    private UUID sourceLineId;

    @NotNull
    @Column(nullable = false)
    private Boolean active = true;

    @NotNull
    @Column(name = "window_started_at", nullable = false)
    private Instant windowStartedAt;
}
