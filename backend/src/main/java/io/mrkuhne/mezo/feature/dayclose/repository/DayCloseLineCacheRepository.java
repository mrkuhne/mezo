package io.mrkuhne.mezo.feature.dayclose.repository;

import io.mrkuhne.mezo.feature.dayclose.entity.DayCloseLineCacheEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** Boop's cached one-liners by input hash, owner-scoped. */
public interface DayCloseLineCacheRepository extends JpaRepository<DayCloseLineCacheEntity, UUID> {

    Optional<DayCloseLineCacheEntity> findByCreatedByAndInputHash(UUID createdBy, String inputHash);

    /** Stores a line for {@code inputHash}; two racing first asks both generate, the first insert wins. */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into day_close_line_cache (created_by, input_hash, line)
        values (:createdBy, :inputHash, :line)
        on conflict (created_by, input_hash) where is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("inputHash") String inputHash,
                       @Param("line") String line);
}
