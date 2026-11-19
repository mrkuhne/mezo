package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** The owner's money settings — one live row per owner ({@code uq_penz_settings_created_by}); HUF minor units. */
@Getter
@Setter
@Entity
@Table(name = "penz_settings")
@SQLDelete(sql = "update penz_settings set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzSettingsEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "savings_target_minor", nullable = false)
    private long savingsTargetMinor;

    /** The Gyakorlás monthly cap (spec §10.1.2), deducted like a fixed cost. */
    @Column(name = "practice_monthly_minor", nullable = false)
    private long practiceMonthlyMinor;

    @Column(name = "week_start", nullable = false, length = 10)
    private String weekStart = "monday";

    @Column(name = "emergency_fund_months", nullable = false)
    private int emergencyFundMonths = 6;

    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone = "Europe/Budapest";

    /** {"YYYY-MM": {"savingsTargetHufMinor": n, "categoryBudgets": {"&lt;categoryId&gt;": n}}}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "month_overrides", nullable = false)
    private String monthOverrides = "{}";

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
