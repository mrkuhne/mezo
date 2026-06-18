package io.mrkuhne.mezo.feature.biometrics.profile.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Single-row-per-owner biometric profile: {@code sex} (M|F, DB CHECK), {@code heightCm} +
 * {@code birthDate} (both NOT NULL) and the optional {@code bodyFatPct}. One row per owner is
 * enforced by {@code uq_biometric_profile_created_by} and upheld in {@code BiometricProfileService}
 * (find-or-create by {@code createdBy}).
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "biometric_profile")
@SQLDelete(sql = "update biometric_profile set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class BiometricProfileEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private String sex; // M|F (DB CHECK ck_biometric_profile_sex)

    @NotNull
    @Column(name = "height_cm", nullable = false, precision = 5, scale = 2)
    private BigDecimal heightCm;

    @NotNull
    @Column(name = "birth_date", nullable = false)
    private LocalDate birthDate;

    @Column(name = "body_fat_pct", precision = 4, scale = 2)
    private BigDecimal bodyFatPct;
}
