package io.mrkuhne.mezo.feature.biometrics.checkin.repository;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInSnapshotEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Live snapshots only ({@code @SQLRestriction} on the entity). */
public interface CheckInSnapshotRepository extends JpaRepository<CheckInSnapshotEntity, UUID> {

    Optional<CheckInSnapshotEntity> findByCheckInId(UUID checkInId);

    List<CheckInSnapshotEntity> findByCheckInIdIn(Collection<UUID> checkInIds);

    /** Makes sure the check-in has its one live snapshot row without a unique violation (concurrent saves of
     *  the same slot); the caller reads it back with {@link #findByCheckInId} and fills it. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into check_in_snapshot (created_by, check_in_id, computed_by)
        values (:createdBy, :checkInId, :computedBy)
        on conflict (check_in_id) where is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("checkInId") UUID checkInId,
                       @Param("computedBy") String computedBy);
}
