package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "ai_message")
@SQLDelete(sql = "update ai_message set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class AiMessageEntity extends OwnedEntity {

    public static final String ROLE_USER = "user";
    public static final String ROLE_ASSISTANT = "assistant";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private AiConversationEntity conversation;

    /** Mirrors ck_ai_message_role. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "user|assistant")
    @Column(nullable = false, length = 16)
    private String role;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** Tool-call audit envelope — always null in V0.2; V0.5 starts writing it. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tool_calls", columnDefinition = "jsonb")
    private ToolCallsEnvelope toolCalls;

    /** Data references backing the answer — always null in V0.2; V0.5 starts writing it. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private RefsEnvelope refs;

    /** V1.3: true when the advisor chain rejected the answer even after the corrective retry. */
    @Column(nullable = false)
    private boolean degraded;
}
