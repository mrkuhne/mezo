package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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
 * The owner's daily news digest (Boop Pénz L6, mezo-r36n9.104): one live row per owner and {@code digestDate}
 * ({@code uq_penz_digest_created_by_digest_date}); a rebuild replaces it. {@code status} ready|quiet|failed mirrors
 * {@code ck_penz_digest_status} (the API's {@code pending} is "no row"); {@code items} are the validated,
 * contract-shaped stories.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_digest")
@SQLDelete(sql = "update penz_digest set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzDigestEntity extends OwnedEntity {

    public static final String STATUS_READY = "ready";
    public static final String STATUS_QUIET = "quiet";
    public static final String STATUS_FAILED = "failed";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "digest_date", nullable = false)
    private LocalDate digestDate;

    @Column(name = "status", nullable = false, length = 6)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "items", nullable = false)
    private List<PenzDigestItemJson> items = new ArrayList<>();

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    @Column(name = "prices_as_of")
    private LocalDate pricesAsOf;
}
