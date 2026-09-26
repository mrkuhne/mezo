package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.ProactiveMemoryUseEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Owned reads for {@code proactive_memory_use} — every finder filters {@code created_by} in SQL. */
public interface ProactiveMemoryUseRepository extends JpaRepository<ProactiveMemoryUseEntity, UUID> {

    List<ProactiveMemoryUseEntity> findByCreatedByAndUsedOnGreaterThanEqual(UUID createdBy, LocalDate from);
}
