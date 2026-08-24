package io.mrkuhne.mezo.feature.companion.flags.repository;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanionFlagLogRepository extends JpaRepository<CompanionFlagLogEntity, UUID> {

    Optional<CompanionFlagLogEntity> findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, String flagKey);

    List<CompanionFlagLogEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    /** Cooldown gate: is there a raise of this flag newer than {@code since}? */
    @Query("""
        SELECT count(f) > 0 FROM CompanionFlagLogEntity f
        WHERE f.createdBy = :createdBy AND f.flagKey = :flagKey AND f.createdAt >= :since
        """)
    boolean existsRaiseSince(
        @Param("createdBy") UUID createdBy, @Param("flagKey") String flagKey, @Param("since") Instant since);

    /** all_healthy's quiet-window gate: any NON-all_healthy raise since {@code since}? */
    @Query("""
        SELECT count(f) > 0 FROM CompanionFlagLogEntity f
        WHERE f.createdBy = :createdBy AND f.flagKey <> 'all_healthy' AND f.createdAt >= :since
        """)
    boolean existsProblemRaiseSince(@Param("createdBy") UUID createdBy, @Param("since") Instant since);
}
