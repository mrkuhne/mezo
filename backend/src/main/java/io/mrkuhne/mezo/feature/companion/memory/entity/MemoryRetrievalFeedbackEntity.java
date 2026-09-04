package io.mrkuhne.mezo.feature.companion.memory.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;

/** Explicit beta feedback for one owner-visible retrieval result. */
@Getter
@Setter
@Entity
@Table(name = "memory_retrieval_feedback")
@SQLDelete(sql = "update memory_retrieval_feedback set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MemoryRetrievalFeedbackEntity extends OwnedEntity {

    public static final String ACTION_USEFUL = "useful";
    public static final String ACTION_IRRELEVANT = "irrelevant";
    public static final String ACTION_SUPPRESS = "suppress";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "run_id", nullable = false, columnDefinition = "uuid")
    private UUID runId;

    @NotNull
    @Column(name = "result_id", nullable = false, columnDefinition = "uuid")
    private UUID resultId;

    @Column(name = "memory_item_id", columnDefinition = "uuid")
    private UUID memoryItemId;

    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "useful|irrelevant|suppress")
    @Column(nullable = false, length = 16)
    private String action;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
