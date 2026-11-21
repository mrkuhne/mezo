package io.mrkuhne.mezo.feature.season.entity;

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
 * One shopping-list line: merged per catalog item over the week ({@code amount} in the base unit g / ml / db, null
 * for a staple), its shelf group ({@code zoldseg | hus | tej | kamra | egyeb}) and the recipes it is for.
 */
@Getter
@Setter
@Entity
@Table(name = "shopping_item")
@SQLDelete(sql = "update shopping_item set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ShoppingItemEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "list_id", nullable = false)
    private UUID listId;

    /** The merge key: the catalog id, else the lower-case name (a staple: "staple:" + name). */
    @Column(name = "item_key", nullable = false, length = 80)
    private String itemKey;

    @Column(name = "catalog_id")
    private UUID catalogId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "amount", precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "unit", length = 10)
    private String unit;

    @Column(name = "shelf", nullable = false, length = 20)
    private String shelf;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "for_recipes", nullable = false, columnDefinition = "text[]")
    private List<String> forRecipes = new ArrayList<>();

    @Column(name = "checked", nullable = false)
    private boolean checked;

    @Column(name = "changed", nullable = false)
    private boolean changed;

    @Column(name = "staple", nullable = false)
    private boolean staple;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
