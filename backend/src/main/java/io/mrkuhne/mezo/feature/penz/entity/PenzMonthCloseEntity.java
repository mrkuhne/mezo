package io.mrkuhne.mezo.feature.penz.entity;

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

/** A closed month ('YYYY-MM'), one live row per owner and month; figures in HUF minor units. */
@Getter
@Setter
@Entity
@Table(name = "penz_month_close")
@SQLDelete(sql = "update penz_month_close set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzMonthCloseEntity extends OwnedEntity {

    public static final String LEFTOVER_TRANSFERRED = "transferred";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "month", nullable = false, length = 7)
    private String month;

    @Column(name = "final_remaining_minor", nullable = false)
    private long finalRemainingMinor;

    @Column(name = "deficit_minor", nullable = false)
    private long deficitMinor;

    /** transferred | kept | none. */
    @Column(name = "leftover_action", nullable = false, length = 12)
    private String leftoverAction;

    @Column(name = "transfer_pair_id")
    private UUID transferPairId;

    @Column(name = "closed_at", nullable = false)
    private Instant closedAt;
}
