package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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
 * One product of the owner's curated list (Boop Pénz L7, mezo-r36n9.105, build notes call 10). {@code status}
 * suggested|approved|declined, {@code suggestedBy} research|owner, {@code kind} / {@code distribution} /
 * {@code currency} mirror their check constraints; {@code sleeves} (jsonb) ⊆ short|mid|long. {@code seedKey} is set
 * on research seed rows only (unique per owner, deleted rows included — a seed is inserted once ever).
 */
@Getter
@Setter
@Entity
@Table(name = "penz_product")
@SQLDelete(sql = "update penz_product set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzProductEntity extends OwnedEntity {

    public static final String STATUS_SUGGESTED = "suggested";
    public static final String STATUS_APPROVED = "approved";
    public static final String STATUS_DECLINED = "declined";
    public static final String BY_RESEARCH = "research";
    public static final String BY_OWNER = "owner";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "seed_key", length = 40)
    private String seedKey;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "kind", nullable = false, length = 13)
    private String kind;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sleeves", nullable = false)
    private List<String> sleeves = new ArrayList<>();

    @Column(name = "what_it_is", nullable = false, length = 600)
    private String whatItIs;

    @Column(name = "ter_pct", precision = 6, scale = 3)
    private BigDecimal terPct;

    @Column(name = "entry_fee_pct", precision = 6, scale = 3)
    private BigDecimal entryFeePct;

    @Column(name = "fee_note", length = 300)
    private String feeNote;

    @Column(name = "distribution", nullable = false, length = 12)
    private String distribution;

    @Column(name = "isin", length = 12)
    private String isin;

    @Column(name = "symbol", length = 20)
    private String symbol;

    @Column(name = "source_name", length = 120)
    private String sourceName;

    @Column(name = "source_url", length = 500)
    private String sourceUrl;

    @Column(name = "reviewed_at", nullable = false)
    private LocalDate reviewedAt;

    @Column(name = "status", nullable = false, length = 9)
    private String status;

    @Column(name = "suggested_by", nullable = false, length = 8)
    private String suggestedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;
}
