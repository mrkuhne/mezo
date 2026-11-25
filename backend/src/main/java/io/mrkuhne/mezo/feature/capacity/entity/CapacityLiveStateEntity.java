package io.mrkuhne.mezo.feature.capacity.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * The live re-plan loop's memory (Boop B7 K3, mezo-r36n9.17), one row per owner: the last verdict it saw for
 * {@code day}, whether that day's gym session collided with an event then, and when it last proposed a today-change.
 */
@Getter
@Setter
@Entity
@Table(name = "capacity_live_state")
@SQLDelete(sql = "update capacity_live_state set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CapacityLiveStateEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The day {@link #verdict} and {@link #collides} were seen for (his zone). */
    @Column(nullable = false)
    private LocalDate day;

    /** laza | rendben | szoros | túl sok ({@code Verdicts.word}). */
    @Column(nullable = false, length = 16)
    private String verdict;

    @Column(nullable = false)
    private boolean collides;

    /** When the loop last stored a today-proposal (null = never). */
    @Column(name = "proposed_at")
    private Instant proposedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
