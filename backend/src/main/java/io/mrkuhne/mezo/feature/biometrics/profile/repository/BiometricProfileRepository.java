package io.mrkuhne.mezo.feature.biometrics.profile.repository;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BiometricProfileRepository extends JpaRepository<BiometricProfileEntity, UUID> {

    // One row per owner (uq_biometric_profile_created_by) — drives find-or-create in the service.
    Optional<BiometricProfileEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
