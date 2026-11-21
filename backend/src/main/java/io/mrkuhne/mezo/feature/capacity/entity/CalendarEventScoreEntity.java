package io.mrkuhne.mezo.feature.capacity.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** One scored calendar event: the LLM / rule verdict for one exact input (hash) (Boop B7 K1, mezo-r36n9.17). */
@Getter
@Setter
@Entity
@Table(name = "calendar_event_score")
@SQLDelete(sql = "update calendar_event_score set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CalendarEventScoreEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "input_hash", nullable = false, length = 64)
    private String inputHash;

    @Column(nullable = false)
    private short mental;

    @Column(nullable = false)
    private short social;

    @Column(nullable = false)
    private short physical;

    @Column(nullable = false)
    private boolean restores;

    @Column(nullable = false, length = 12)
    private String kind;

    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal confidence;

    /** llm | rule. */
    @Column(nullable = false, length = 8)
    private String source;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
