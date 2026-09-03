package io.mrkuhne.mezo.feature.pantry.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Per-user pantry STATE (S4, mezo-qw37.4): stock, price, notes, dose/protocol/timing/taken for
 * one shared definition ({@link PantryCatalogEntity}). The id is what {@code meal_item},
 * {@code recipe_ingredient}, {@code protocol_item} and {@code supplement_intake} reference
 * (ON DELETE RESTRICT) — the split kept every id. One LIVE row per (created_by, catalog_id)
 * ({@code uq_pantry_item_created_by_catalog_id}). Definition reads go through
 * {@code getCatalog()}; the repository finders that feed mappers {@code join fetch} it.
 */
@Getter
@Setter
@Entity
@Table(name = "pantry_item")
@SQLDelete(sql = "update pantry_item set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PantryItemEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "catalog_id", nullable = false)
    private PantryCatalogEntity catalog;

    private String notes;

    @Column(name = "price_huf")
    private Integer priceHuf;

    @Column(name = "price_unit")
    private String priceUnit;

    // stock
    @Column(name = "stock_qty")
    private BigDecimal stockQty;

    @Column(name = "stock_unit")
    private String stockUnit;

    @Column(name = "stock_expires")
    private LocalDate stockExpires;

    // supplement / stim (per-user protocol facts; `form` and `caffeine` are definition facts on the catalog)
    private String dose;
    private String protocol;
    private String timing;

    @Column(nullable = false)
    private boolean taken = false;
}
