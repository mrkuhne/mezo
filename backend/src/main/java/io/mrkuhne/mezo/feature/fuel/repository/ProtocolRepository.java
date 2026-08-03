package io.mrkuhne.mezo.feature.fuel.repository;

import io.mrkuhne.mezo.feature.fuel.entity.ProtocolEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * The single living supplement Stack/Protocol store. Single-user, single active protocol at a
 * time: {@link #findByCreatedByAndStatusAndDeletedFalse} resolves the current entry (status
 * {@code active}, never superseded going forward — {@code version} bumps in place on every
 * occurrence mutation instead); {@link #maxVersion} feeds the version to seed a freshly-created
 * row. All finders are owner-scoped and respect the soft-delete flag.
 */
public interface ProtocolRepository extends JpaRepository<ProtocolEntity, UUID> {

    Optional<ProtocolEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);

    List<ProtocolEntity> findByCreatedByAndDeletedFalseOrderByVersionDesc(UUID createdBy);

    @Query("select coalesce(max(p.version), 0) from ProtocolEntity p where p.createdBy = :userId and p.deleted = false")
    int maxVersion(UUID userId);
}
