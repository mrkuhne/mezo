package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
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
 * One product in one sleeve (Boop Pénz L6, mezo-r36n9.104) — the same product in two sleeves is two holdings.
 * Date-less: bespoke finders.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_holding")
@SQLDelete(sql = "update penz_holding set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzHoldingEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "name", nullable = false, length = 80)
    private String name;

    /** bond | etf | stock | fund | crypto | cash. */
    @Column(name = "asset_type", nullable = false, length = 8)
    private String assetType;

    /** The quote symbol (Yahoo), null = not quoted. */
    @Column(name = "symbol", length = 20)
    private String symbol;

    /** mbh | revolut | other. */
    @Column(name = "platform", nullable = false, length = 8)
    private String platform;

    @Column(name = "platform_name", length = 40)
    private String platformName;

    /** short | mid | long. */
    @Column(name = "sleeve", nullable = false, length = 5)
    private String sleeve;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "bond_rate_pct", precision = 7, scale = 4)
    private BigDecimal bondRatePct;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "news_terms", nullable = false, columnDefinition = "jsonb")
    private List<String> newsTerms = new ArrayList<>();

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "archived", nullable = false)
    private boolean archived;

    @Column(name = "client_ref")
    private UUID clientRef;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
