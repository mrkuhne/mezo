package io.mrkuhne.mezo.feature.capacity.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** The owner's own label of how an event felt (Boop B7 K1, mezo-r36n9.17). */
@Getter
@Setter
@Entity
@Table(name = "capacity_event_feedback")
@SQLDelete(sql = "update capacity_event_feedback set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CapacityEventFeedbackEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Calendar external id without the occurrence part — one label per recurring event. */
    @Column(name = "event_key", nullable = false, length = 200)
    private String eventKey;

    /** drains | neutral | feeds. */
    @Column(nullable = false, length = 8)
    private String effect;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
