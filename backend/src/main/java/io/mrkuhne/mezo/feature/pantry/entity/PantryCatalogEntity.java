package io.mrkuhne.mezo.feature.pantry.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * The shared pantry DEFINITION (S4, mezo-qw37.4): what a food/supplement IS — name, brand, kind,
 * macros, NOVA. Hybrid like {@code exercise_catalog}: {@code createdBy == null} is loader master
 * content ({@code seed/pantry-catalog.json}); a set {@code createdBy} is a user-authored row that
 * every user can see and put on their own shelf. Per-user state (stock, price, dose, notes) lives
 * on {@link PantryItemEntity}, which points here via {@code catalog_id}.
 *
 * <p>Deliberately NO {@code @SQLRestriction}: a soft-deleted catalog row must stay loadable through
 * a (soft-deleted) item's FK and revivable by the loader; readers filter {@code deleted} explicitly.
 * Natural key {@code (lower(trim(name)), lower(trim(coalesce(brand,''))))} is unique in the DB
 * ({@code uq_pantry_catalog_natural}); trimming is part of the KEY, not just of the writers, so a
 * legacy untrimmed name cannot become a second, unreachable definition for the same food.
 */
@Getter
@Setter
@Entity
@Table(name = "pantry_catalog")
public class PantryCatalogEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** null = master (loader-owned); set = the authoring user (visible to all). */
    @Column(name = "created_by", columnDefinition = "uuid")
    private UUID createdBy;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @NotNull
    @Column(nullable = false)
    private String kind; // food | supplement | stim | med (ck_pantry_catalog_kind)

    @NotNull
    @Column(nullable = false)
    private String name;

    private String brand;

    @NotNull
    @Column(nullable = false)
    private String source = "manual"; // ck_pantry_catalog_source

    private String category; // ck_pantry_catalog_category (nullable)

    @Column(name = "serving_amount")
    private BigDecimal servingAmount;

    @Column(name = "serving_unit")
    private String servingUnit;

    private BigDecimal kcal;

    @Column(name = "protein_g")
    private BigDecimal proteinG;

    @Column(name = "carbs_g")
    private BigDecimal carbsG;

    @Column(name = "fat_g")
    private BigDecimal fatG;

    @Column(name = "fiber_g")
    private BigDecimal fiberG;

    @Column(name = "sugar_g")
    private BigDecimal sugarG;

    @Column(name = "salt_g")
    private BigDecimal saltG;

    @Column(name = "saturated_fat_g")
    private BigDecimal saturatedFatG;

    @Column(name = "package_label")
    private String packageLabel;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<MicroFact> micros;

    private Short nova; // ck_pantry_catalog_nova

    private String form;

    private Boolean caffeine;

    public boolean isMaster() {
        return createdBy == null;
    }
}
