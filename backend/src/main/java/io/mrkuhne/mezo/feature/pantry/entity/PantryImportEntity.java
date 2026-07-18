package io.mrkuhne.mezo.feature.pantry.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One row per confirmed pantry import (Fuel P6, mezo-bka) — the Kamra "imports" activity feed.
 * The created pantry_item is referenced loosely (ON DELETE SET NULL) so the feed survives
 * item deletion.
 */
@Getter
@Setter
@Entity
@Table(name = "pantry_import")
@SQLDelete(sql = "update pantry_import set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PantryImportEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Size(max = 32)
    @Column(nullable = false, length = 32)
    private String source; // same allow-list as pantry_item.source (ck_pantry_import_source)

    @NotNull
    @Size(max = 200)
    @Column(name = "item_name", nullable = false, length = 200)
    private String itemName;

    @NotNull
    @Column(name = "item_count", nullable = false)
    private Integer itemCount = 1;

    @NotNull
    @Size(max = 20)
    @Column(nullable = false, length = 20)
    private String status = "synced"; // synced | manual-review (ck_pantry_import_status)

    @Size(max = 32)
    @Column(length = 32)
    private String barcode;

    /** Scrape provenance (mezo-8vum): the product-page URL the draft came from. Null for OFF/manual. */
    @Size(max = 2000)
    @Column(name = "source_url", columnDefinition = "text")
    private String sourceUrl;

    @Column(name = "pantry_item_id", columnDefinition = "uuid")
    private UUID pantryItemId;

    @NotNull
    @Column(name = "imported_at", nullable = false)
    private Instant importedAt;
}
