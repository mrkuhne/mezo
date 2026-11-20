package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One investment proposal (Boop Pénz L7, mezo-r36n9.105, build notes calls 11–15). {@code kind} lump_sum|monthly,
 * {@code status} proposed|accepted|dismissed|superseded mirror their check constraints; {@code month} = the Budapest
 * month it was made in. {@code body} is the computed content; {@code plan} his accepted numbers as a checklist.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_proposal")
@SQLDelete(sql = "update penz_proposal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzProposalEntity extends OwnedEntity {

    public static final String KIND_LUMP_SUM = "lump_sum";
    public static final String KIND_MONTHLY = "monthly";
    public static final String STATUS_PROPOSED = "proposed";
    public static final String STATUS_ACCEPTED = "accepted";
    public static final String STATUS_DISMISSED = "dismissed";
    public static final String STATUS_SUPERSEDED = "superseded";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "kind", nullable = false, length = 8)
    private String kind;

    @Column(name = "status", nullable = false, length = 10)
    private String status;

    @Column(name = "amount_huf_minor", nullable = false)
    private long amountHufMinor;

    @Column(name = "month", nullable = false, length = 7)
    private String month;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "body", nullable = false)
    private PenzProposalJson body;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "plan", nullable = false)
    private List<PenzProposalJson.StepJson> plan = new ArrayList<>();

    @Column(name = "accepted_at")
    private Instant acceptedAt;
}
