package io.mrkuhne.mezo.feature.penz.entity;

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
 * A savings goal ({@code goal}) or purchase plan ({@code purchase}) — Boop Pénz L5, mezo-r36n9.103. Amounts are
 * HUF minor units; {@code savedMinor} is the owner's own running figure. Date-less: bespoke finders.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_savings_goal")
@SQLDelete(sql = "update penz_savings_goal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzSavingsGoalEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "name", nullable = false, length = 80)
    private String name;

    /** goal | purchase. */
    @Column(name = "kind", nullable = false, length = 8)
    private String kind;

    @Column(name = "target_minor", nullable = false)
    private long targetMinor;

    @Column(name = "saved_minor", nullable = false)
    private long savedMinor;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "client_ref")
    private UUID clientRef;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
