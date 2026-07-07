package io.mrkuhne.mezo.feature.proactive.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One heartbeat note (proactive H1): the companion's short in-day presence for a user+day+window.
 * The window_key/kind vocabularies are the fixed v1 pair (midday→nudge, evening→closing —
 * proactive.md §9 decision p); a note is written once, never regenerated.
 */
@Getter
@Setter
@Entity
@Table(name = "heartbeat_note")
@SQLDelete(sql = "update heartbeat_note set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class HeartbeatNoteEntity extends OwnedEntity {

    public static final String WINDOW_MIDDAY = "midday";
    public static final String WINDOW_EVENING = "evening";
    public static final String KIND_NUDGE = "nudge";
    public static final String KIND_CLOSING = "closing";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "note_date", nullable = false)
    private LocalDate noteDate;

    @NotNull
    @Column(name = "window_key", nullable = false, length = 16)
    private String windowKey;

    @NotNull
    @Column(nullable = false, length = 16)
    private String kind;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
