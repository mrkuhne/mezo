package io.mrkuhne.mezo.feature.biometrics.checkin.repository;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInSnapshotEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Live snapshots only ({@code @SQLRestriction} on the entity). */
public interface CheckInSnapshotRepository extends JpaRepository<CheckInSnapshotEntity, UUID> {

    Optional<CheckInSnapshotEntity> findByCheckInId(UUID checkInId);

    List<CheckInSnapshotEntity> findByCheckInIdIn(Collection<UUID> checkInIds);
}
