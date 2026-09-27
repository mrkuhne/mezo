package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoryForgetVetoRepository extends JpaRepository<MemoryForgetVetoEntity, UUID> {

    boolean existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(UUID createdBy, String domain, String vetoKey);

    List<MemoryForgetVetoEntity> findByCreatedByAndDomainAndDeletedFalse(UUID createdBy, String domain);
}
