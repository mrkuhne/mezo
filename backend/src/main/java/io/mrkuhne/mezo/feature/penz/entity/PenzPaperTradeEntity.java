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
 * One paper trade (Boop Pénz L7, mezo-r36n9.105): a plan, opened at a typed entry, closed with the journal line.
 * Prices are per-unit minor units of {@code currency}; the HUF twins are booked once by the L4 FX policy at the
 * trade's own dates and stored. {@code paper} is always true in phase 1.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_paper_trade")
@SQLDelete(sql = "update penz_paper_trade set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzPaperTradeEntity extends OwnedEntity {

    public static final String PLANNED = "planned";
    public static final String OPEN = "open";
    public static final String CLOSED = "closed";
    public static final String CANCELLED = "cancelled";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "paper", nullable = false)
    private boolean paper = true;

    /** planned | open | closed | cancelled. */
    @Column(name = "status", nullable = false, length = 9)
    private String status = PLANNED;

    @Column(name = "instrument", nullable = false, length = 60)
    private String instrument;

    /** long | short. */
    @Column(name = "direction", nullable = false, length = 5)
    private String direction;

    @Column(name = "why", nullable = false, length = 500)
    private String why;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "quantity", nullable = false, precision = 24, scale = 8)
    private BigDecimal quantity;

    @Column(name = "planned_entry_minor")
    private Long plannedEntryMinor;

    @Column(name = "stop_minor", nullable = false)
    private long stopMinor;

    @Column(name = "target_minor")
    private Long targetMinor;

    /** The rate the plan figures are valued at — the entry date's once opened; null for HUF. */
    @Column(name = "fx_rate", precision = 18, scale = 8)
    private BigDecimal fxRate;

    @Column(name = "fx_rate_date")
    private LocalDate fxRateDate;

    @Column(name = "entry_minor")
    private Long entryMinor;

    @Column(name = "entry_date")
    private LocalDate entryDate;

    @Column(name = "risk_minor")
    private Long riskMinor;

    @Column(name = "risk_huf_minor")
    private Long riskHufMinor;

    @Column(name = "cost_huf_minor")
    private Long costHufMinor;

    @Column(name = "exit_minor")
    private Long exitMinor;

    @Column(name = "exit_date")
    private LocalDate exitDate;

    @Column(name = "exit_fx_rate", precision = 18, scale = 8)
    private BigDecimal exitFxRate;

    @Column(name = "exit_fx_rate_date")
    private LocalDate exitFxRateDate;

    @Column(name = "pnl_minor")
    private Long pnlMinor;

    @Column(name = "pnl_huf_minor")
    private Long pnlHufMinor;

    @Column(name = "r_multiple", precision = 10, scale = 2)
    private BigDecimal rMultiple;

    @Column(name = "last_close_minor")
    private Long lastCloseMinor;

    @Column(name = "last_close_date")
    private LocalDate lastCloseDate;

    @Column(name = "last_close_fx_rate", precision = 18, scale = 8)
    private BigDecimal lastCloseFxRate;

    @Column(name = "last_close_fx_rate_date")
    private LocalDate lastCloseFxRateDate;

    @Column(name = "unrealized_huf_minor")
    private Long unrealizedHufMinor;

    /** The eight fixed tag keys (read in Java, never queried). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tags", nullable = false, columnDefinition = "jsonb")
    private List<String> tags = new ArrayList<>();

    @Column(name = "mistake", nullable = false)
    private boolean mistake;

    @Column(name = "line", length = 140)
    private String line;

    @Column(name = "client_ref")
    private UUID clientRef;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
