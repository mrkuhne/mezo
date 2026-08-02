package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One-off (non-recurring) sport event (volleyball | cross | trx) — a dated session/match outside
 * the weekly {@link SportScheduleSlotEntity} rhythm (mezo-e1sp). Unlike the schedule slots it is
 * long-lived (individually created/deleted, never full-replaced); {@code kind}/{@code sport}
 * share the slot table's CHECK vocabularies.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "sport_event")
@SQLDelete(sql = "update sport_event set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SportEventEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @NotNull
    @Column(nullable = false, length = 5)
    private String time;

    @NotNull
    @Column(name = "duration_min", nullable = false)
    private Integer durationMin;

    @NotNull
    @Column(nullable = false)
    private String kind = "training"; // 'training' | 'match' (DB CHECK)

    @NotNull
    @Column(nullable = false)
    private String sport = "volleyball"; // 'volleyball' | 'cross' | 'trx' (DB CHECK)

    @Column
    private String location;

    @Column(name = "intensity_label")
    private String intensityLabel;
}
