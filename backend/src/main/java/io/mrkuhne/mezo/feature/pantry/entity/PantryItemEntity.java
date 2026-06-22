package io.mrkuhne.mezo.feature.pantry.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

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
    @Column(nullable = false)
    private String kind; // food | supplement | stim | med

    @NotNull
    @Column(nullable = false)
    private String name;

    private String brand;

    @NotNull
    @Column(nullable = false)
    private String source = "manual";

    private String category;
    private String notes;

    // food / nutrition
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

    @Column(name = "price_huf")
    private Integer priceHuf;

    @Column(name = "price_unit")
    private String priceUnit;

    @Column(name = "package_label")
    private String packageLabel;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<MicroFact> micros;

    private Short nova;

    // stock
    @Column(name = "stock_qty")
    private BigDecimal stockQty;

    @Column(name = "stock_unit")
    private String stockUnit;

    @Column(name = "stock_expires")
    private LocalDate stockExpires;

    // supplement / stim
    private String dose;
    private String form;
    private String protocol;
    private String timing;

    @Column(nullable = false)
    private boolean taken = false;

    private Boolean caffeine;
}
