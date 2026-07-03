package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "ai_conversation")
@SQLDelete(sql = "update ai_conversation set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class AiConversationEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Null until the first user message; then that message truncated to mezo.companion.chat.title-max-chars. */
    @Size(max = 120)
    @Column(length = 120)
    private String title;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;
}
